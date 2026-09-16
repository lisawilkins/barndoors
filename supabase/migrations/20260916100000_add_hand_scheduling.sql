-- Hand Scheduling: drop the dead `shifts` scaffolding table (zero frontend
-- references, no .ics Edge Function ever built against it — see AGENTS.md
-- "Calendar" and barndoors-schema.md) and replace it with a proper set of
-- tables mirroring the Wrangler scheduling shape (see
-- 20260831100000_add_wranglers.sql and
-- 20260831120000_restructure_wrangler_scheduling.sql), adapted for Hands:
--   - Hands are `profiles` rows with role = 'hand' — there is no separate
--     `hands` table, so every FK below points at profiles(id) instead of a
--     roster table of its own.
--   - No activity/horse_id — that's Wrangler-only riding/working data.
--   - One-off shifts are freestanding multi-hand events (title/time/notes),
--     not slot-based like a Wrangler one-off.
--   - Hands get a dedicated hand_vacations table (a hand can have several
--     open-ended ranges on file at once) with no Wrangler equivalent.
--
-- Safety check performed before writing this migration: grepped the repo
-- for `shifts` (table name, `.from('shifts')`, `public.shifts`) outside
-- this feature's own new files — zero references beyond the table's own
-- creation/comment in earlier migrations. Re-run that grep immediately
-- before applying this migration, in case the repo changed since.

drop table if exists public.shifts;

-- Shift types: predefined, manager-extensible, day-specific — same shape
-- and reasoning as wrangler_time_slots. "Sun AM" and "Mon AM" are different
-- rows even though both are named "AM", since a type's own day is what
-- makes assigning a hand to it a *recurring weekly* shift. Managed on its
-- own page (/hands/shift-types), not inline on a hand's profile.
create table public.hand_shift_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  day_of_week text not null check (day_of_week in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index hand_shift_types_day_name_active_key
  on public.hand_shift_types (day_of_week, name)
  where active;

select public.apply_standard_policies('public.hand_shift_types');

-- Default set: AM + PM x every day of the week (14 rows). Ships as plain
-- inserts inside this migration, not supabase/seed.sql — seed.sql's
-- sql_paths only load on a local `supabase db reset` (see
-- supabase/config.toml), never on the `supabase db push` this project uses
-- to deploy to its linked remote project, so any default data a production
-- deploy needs has to ship as migration data. sort_order 0/1 keeps AM
-- listed before PM on every day.
insert into public.hand_shift_types (name, day_of_week, sort_order) values
  ('AM', 'sun', 0), ('PM', 'sun', 1),
  ('AM', 'mon', 0), ('PM', 'mon', 1),
  ('AM', 'tue', 0), ('PM', 'tue', 1),
  ('AM', 'wed', 0), ('PM', 'wed', 1),
  ('AM', 'thu', 0), ('PM', 'thu', 1),
  ('AM', 'fri', 0), ('PM', 'fri', 1),
  ('AM', 'sat', 0), ('PM', 'sat', 1);

-- Standing weekly pattern. Built directly on a hand's own profile
-- (HandForm.jsx): pick a day, pick a shift type for that day. Since
-- shift_type_id already carries a day (via hand_shift_types.day_of_week),
-- no separate day/date-range column is needed here.
create table public.hand_recurring_shifts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  shift_type_id uuid not null references public.hand_shift_types (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  unique (profile_id, shift_type_id)
);

select public.apply_standard_policies('public.hand_recurring_shifts');

-- Cancels one occurrence of a recurring shift (e.g. "Anne called in sick on
-- the 23rd") without touching the standing pattern — not a vacation.
create table public.hand_recurring_shift_skips (
  id uuid primary key default gen_random_uuid(),
  recurring_shift_id uuid not null references public.hand_recurring_shifts (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (recurring_shift_id, date)
);

select public.apply_standard_policies('public.hand_recurring_shift_skips');

-- One-off shifts: freestanding events (not tied to a shift type), added
-- from the calendar (HandSchedule.jsx), not the profile. More than one hand
-- can be assigned to the same event.
--   e.g. "Gymkhana | Sept 29 | 8am | Groom for event. Meet at SA or event
--   venue | Anne, Lisa, Sharon"
create table public.hand_shift_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  event_time text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

select public.apply_standard_policies('public.hand_shift_events');

create table public.hand_shift_event_members (
  event_id uuid not null references public.hand_shift_events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (event_id, profile_id)
);

select public.apply_standard_policies('public.hand_shift_event_members');

-- Vacations: a hand can have multiple separate ranges on file at once, so
-- this is its own table, not two columns on profiles. Purely a visual
-- overlay in the schedule UI (dim + palm tree) — never removes/hides a
-- shift on a vacation day.
create table public.hand_vacations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  constraint hand_vacations_end_after_start check (end_date >= start_date)
);

select public.apply_standard_policies('public.hand_vacations');
