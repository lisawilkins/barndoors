-- A time slot's (day, name) uniqueness should only apply among active slots.
-- Archived slots are kept for history rather than deleted, so without this
-- change an archived "5:30-6:30p" permanently blocks reusing that name on
-- the same day even after the original is renamed or replaced.

alter table public.wrangler_time_slots drop constraint wrangler_time_slots_day_name_key;

create unique index wrangler_time_slots_day_name_active_key
  on public.wrangler_time_slots (day_of_week, name)
  where active;
