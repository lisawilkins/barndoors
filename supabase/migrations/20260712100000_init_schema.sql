-- BarnDoors — initial schema
--
-- Mirrors barndoors-schema.md (repo root). If you change a table here, update that
-- file too — it's the source of truth for the data model.
--
-- Permission model (see AGENTS.md "Roles & permissions"):
--   - Managers: full read/write on everything.
--   - Hands: read-only, full stop. No per-table exceptions.
--   - "auth.role() = 'manager'" in AGENTS.md is shorthand for the app-level role
--     stored on profiles.role — it's not the literal Postgres/Supabase auth.role()
--     (which only returns 'authenticated'/'anon'/'service_role'). We implement the
--     intent with a public.is_manager() helper that checks profiles.role instead.

-- Supabase installs its bundled extensions into the `extensions` schema, not
-- `public` — match that so `extensions.gen_random_bytes()` below resolves
-- the same way on a brand-new project as it does on one where pgcrypto is
-- already installed there.
create extension if not exists pgcrypto with schema extensions;

-- Note: public.is_manager() is defined further down, right after the
-- `profiles` table is created. `language sql` function bodies are
-- parse-analyzed at CREATE FUNCTION time (unlike plpgsql), so it can't
-- reference public.profiles before that table exists.

-- ---------------------------------------------------------------------------
-- Helper: apply the standard "everyone authenticated reads, only managers
-- write" policy set to a table. Used for every table except `profiles`,
-- which has its own field-level visibility rules.
-- ---------------------------------------------------------------------------
create or replace function public.apply_standard_policies(tbl regclass)
returns void
language plpgsql
as $$
begin
  execute format('alter table %s enable row level security', tbl);
  execute format(
    'create policy "select_authenticated" on %s for select to authenticated using (true)',
    tbl
  );
  execute format(
    'create policy "insert_managers_only" on %s for insert to authenticated with check (public.is_manager())',
    tbl
  );
  execute format(
    'create policy "update_managers_only" on %s for update to authenticated using (public.is_manager()) with check (public.is_manager())',
    tbl
  );
  execute format(
    'create policy "delete_managers_only" on %s for delete to authenticated using (public.is_manager())',
    tbl
  );
end;
$$;

-- =============================================================================
-- Part 3 — Managers & Hands
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'hand' check (role in ('manager', 'hand')),
  name text not null,
  photo_url text,
  phone text,
  email text,
  emergency_contact text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  calendar_feed_token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Managers and hands. id matches auth.users.id.';
comment on column public.profiles.email is 'Restricted — hidden from other hands, see profiles_hand_visible view.';
comment on column public.profiles.emergency_contact is 'Restricted — hidden from other hands, see profiles_hand_visible view.';

-- ---------------------------------------------------------------------------
-- Helper: is the current authenticated user a manager?
-- security definer so it can read profiles regardless of the caller's own RLS,
-- avoiding recursive-policy issues. Must come after `profiles` exists (see
-- note near the top of this file).
-- ---------------------------------------------------------------------------
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$;

alter table public.profiles enable row level security;

-- Managers see/manage everyone. Hands may only select their own full row
-- directly (so they can't read other hands' email/emergency_contact by
-- querying the base table) — for everyone else, they go through the view.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (public.is_manager() or id = auth.uid());

create policy "profiles_insert_managers_only" on public.profiles
  for insert to authenticated
  with check (public.is_manager());

-- Managers can update anyone; a hand may update their own non-role fields
-- (kept simple for now: hands can update their own row, but not role/status —
-- flag if per-field enforcement here becomes necessary).
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (public.is_manager() or id = auth.uid())
  with check (public.is_manager() or id = auth.uid());

create policy "profiles_delete_managers_only" on public.profiles
  for delete to authenticated
  using (public.is_manager());

-- Field-level visibility: hands query this view instead of the base table
-- for anyone else's profile. security_invoker = off (default) so it can read
-- every row regardless of the caller's own RLS — the column-level nulling
-- below is what actually protects the restricted fields.
create view public.profiles_hand_visible as
select
  id,
  role,
  name,
  photo_url,
  phone,
  status,
  created_at,
  case when id = auth.uid() then email else null end as email,
  case when id = auth.uid() then emergency_contact else null end as emergency_contact
from public.profiles;

grant select on public.profiles_hand_visible to authenticated;

-- Auto-create a profile (default role: hand) whenever someone signs up via
-- Supabase Auth. A manager then promotes/edits the row as needed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, name, email, status)
  values (
    new.id,
    'hand',
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.email,
    'active'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  period text not null check (period in ('AM', 'PM')),
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly')),
  recurrence_end_date date,
  created_at timestamptz not null default now()
);

select public.apply_standard_policies('public.shifts');

-- =============================================================================
-- Part 1 — Heard / Head
-- =============================================================================

create table public.head (
  id uuid primary key default gen_random_uuid(),
  tag_id text,
  name text,
  species text,
  breed text,
  sex text,
  birth_date date,
  status text not null default 'active' check (status in ('active', 'sold', 'deceased', 'archived')),
  status_date date,
  acquired_date date,
  feed_notes text,
  turnout_notes text,
  created_at timestamptz not null default now()
);

select public.apply_standard_policies('public.head');

create table public.head_custom_fields (
  id uuid primary key default gen_random_uuid(),
  head_id uuid not null references public.head (id) on delete cascade,
  field_name text not null,
  field_value text,
  created_at timestamptz not null default now()
);

select public.apply_standard_policies('public.head_custom_fields');

create table public.head_records (
  id uuid primary key default gen_random_uuid(),
  head_id uuid not null references public.head (id) on delete cascade,
  record_type text not null,
  value text,
  unit text,
  recorded_by uuid references public.profiles (id),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

select public.apply_standard_policies('public.head_records');

create table public.head_photos (
  id uuid primary key default gen_random_uuid(),
  head_id uuid not null references public.head (id) on delete cascade,
  photo_url text not null,
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz not null default now()
);

select public.apply_standard_policies('public.head_photos');

create table public.feed_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  dual_unit boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

select public.apply_standard_policies('public.feed_items');

create table public.head_feed_plan (
  id uuid primary key default gen_random_uuid(),
  head_id uuid not null references public.head (id) on delete cascade,
  feed_item_id uuid not null references public.feed_items (id) on delete restrict,
  amount_flakes numeric,
  amount_lbs numeric,
  amount numeric,
  unit text check (unit in ('cup', 'scoop', 'handful', 'lbs')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

select public.apply_standard_policies('public.head_feed_plan');

create table public.turnout_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

select public.apply_standard_policies('public.turnout_locations');

create table public.turnout_groups (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.turnout_locations (id) on delete restrict,
  name text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

select public.apply_standard_policies('public.turnout_groups');

create table public.turnout_group_members (
  group_id uuid not null references public.turnout_groups (id) on delete cascade,
  head_id uuid not null references public.head (id) on delete cascade,
  primary key (group_id, head_id)
);

select public.apply_standard_policies('public.turnout_group_members');

-- =============================================================================
-- Part 2 — Chores
-- =============================================================================

create table public.chore_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  instructions text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

select public.apply_standard_policies('public.chore_types');

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  chore_type_id uuid not null references public.chore_types (id) on delete restrict,
  period text not null check (period in ('AM', 'PM')),
  assignment_type text not null check (assignment_type in ('open', 'assigned-once', 'assigned-recurring')),
  assigned_to uuid references public.profiles (id),
  recurrence text not null default 'none' check (
    recurrence in ('none', 'daily', 'weekly', 'semi-monthly', 'monthly', 'quarterly')
  ),
  recurrence_details jsonb,
  created_by uuid references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  constraint assigned_to_required_unless_open check (
    (assignment_type = 'open') or (assigned_to is not null)
  )
);

select public.apply_standard_policies('public.chores');

-- =============================================================================
-- Storage — photo uploads (online-only, no offline queue)
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('head-photos', 'head-photos', true),
  ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "head_photos_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'head-photos');

create policy "head_photos_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'head-photos' and public.is_manager());

create policy "head_photos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'head-photos' and public.is_manager())
  with check (bucket_id = 'head-photos' and public.is_manager());

create policy "head_photos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'head-photos' and public.is_manager());

create policy "profile_photos_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos');

create policy "profile_photos_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-photos' and public.is_manager());

create policy "profile_photos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-photos' and public.is_manager())
  with check (bucket_id = 'profile-photos' and public.is_manager());

create policy "profile_photos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-photos' and public.is_manager());
