-- Wranglers: people who participate in riding/working sessions. Pure tracked
-- data, not app users — same visibility rule as every other roster table
-- (hands read, managers/admins write), via the existing apply_standard_policies().
-- See barndoors-schema.md "Part 4 — Wranglers" and AGENTS.md "Roles & permissions."

create table public.wranglers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_initial text not null,
  age integer,
  gender text,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

select public.apply_standard_policies('public.wranglers');

-- Predefined, manager-extensible time slots (same shape as feed_items /
-- turnout_locations) rather than free-form start/end times, so a printed
-- schedule scans consistently.
create table public.wrangler_time_slots (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

select public.apply_standard_policies('public.wrangler_time_slots');

-- Standing weekly pattern, mirrors turnout_groups.days_of_week. start_date /
-- end_date bound when the pattern is in effect without deleting history.
create table public.wrangler_recurring_assignments (
  id uuid primary key default gen_random_uuid(),
  wrangler_id uuid not null references public.wranglers (id) on delete cascade,
  days_of_week text[] not null default '{}',
  time_slot_id uuid not null references public.wrangler_time_slots (id) on delete restrict,
  activity text not null check (activity in ('riding', 'working')),
  horse_id uuid references public.head (id) on delete set null,
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  constraint wrangler_recurring_assignments_days_valid check (
    days_of_week <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
  ),
  constraint wrangler_recurring_assignments_horse_riding_only check (
    horse_id is null or activity = 'riding'
  )
);

select public.apply_standard_policies('public.wrangler_recurring_assignments');

-- Cancels one occurrence of a recurring pattern (e.g. "Bella won't be there
-- on the 23rd") without touching the standing pattern itself.
create table public.wrangler_recurring_skips (
  id uuid primary key default gen_random_uuid(),
  recurring_assignment_id uuid not null references public.wrangler_recurring_assignments (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (recurring_assignment_id, date)
);

select public.apply_standard_policies('public.wrangler_recurring_skips');

-- One-off, non-recurring assignments (e.g. a single fill-in shift). Also how
-- a manager represents a one-time change to a recurring slot, by pairing a
-- skip on the recurring row with one of these.
create table public.wrangler_assignments (
  id uuid primary key default gen_random_uuid(),
  wrangler_id uuid not null references public.wranglers (id) on delete cascade,
  date date not null,
  time_slot_id uuid not null references public.wrangler_time_slots (id) on delete restrict,
  activity text not null check (activity in ('riding', 'working')),
  horse_id uuid references public.head (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  constraint wrangler_assignments_horse_riding_only check (
    horse_id is null or activity = 'riding'
  ),
  unique (wrangler_id, date, time_slot_id)
);

select public.apply_standard_policies('public.wrangler_assignments');

-- Standing notes not tied to any wrangler, e.g. "Smoky can't be ridden this
-- month." One table, mutually-exclusive scope columns — same pattern as
-- chore_items_has_one_owner's list_id/section_id split. A month note stores
-- note_month as the first of that month (e.g. 2026-09-01).
create table public.wrangler_calendar_notes (
  id uuid primary key default gen_random_uuid(),
  note_date date,
  note_month date,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  constraint wrangler_calendar_notes_has_one_scope check (
    ((note_date is not null)::int + (note_month is not null)::int) = 1
  )
);

select public.apply_standard_policies('public.wrangler_calendar_notes');
