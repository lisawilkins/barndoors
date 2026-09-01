-- Restructure Wrangler scheduling: time slots are now day-specific ("Mon
-- 5:30-6:30 PM"), managed on their own page instead of inline on a
-- wrangler's profile. Since a time slot now carries its own day, a
-- wrangler's recurring assignment no longer needs its own days_of_week or
-- date range — assigning a wrangler to a (day-scoped) time slot *is* the
-- recurring pattern. Recurring assignments are now created directly on the
-- wrangler's profile (day -> time slot -> activity -> horse), not from the
-- calendar. Table is new as of 20260831100000 with no real data in
-- production yet, so this rewrites it in place rather than layering
-- backward-compatibility columns.

alter table public.wrangler_time_slots
  add column day_of_week text not null default 'mon';

alter table public.wrangler_time_slots
  alter column day_of_week drop default;

alter table public.wrangler_time_slots
  add constraint wrangler_time_slots_day_of_week_valid check (
    day_of_week in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
  );

-- The same time-of-day label can now recur across different days (Mon
-- 5:30-6:30 PM and Tue 5:30-6:30 PM are different rows), so uniqueness
-- moves from name alone to (day, name).
alter table public.wrangler_time_slots drop constraint wrangler_time_slots_name_key;
alter table public.wrangler_time_slots
  add constraint wrangler_time_slots_day_name_key unique (day_of_week, name);

-- days_of_week / start_date / end_date are gone — the time slot's own
-- day_of_week is now the single source of truth for which weekday an
-- assignment falls on.
alter table public.wrangler_recurring_assignments
  drop constraint wrangler_recurring_assignments_days_valid;
alter table public.wrangler_recurring_assignments drop column days_of_week;
alter table public.wrangler_recurring_assignments drop column start_date;
alter table public.wrangler_recurring_assignments drop column end_date;

-- A wrangler can only hold one standing assignment per time slot.
alter table public.wrangler_recurring_assignments
  add constraint wrangler_recurring_assignments_wrangler_slot_key unique (wrangler_id, time_slot_id);
