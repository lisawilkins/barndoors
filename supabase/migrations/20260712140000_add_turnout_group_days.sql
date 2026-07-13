-- Standing turnout groups need a weekly schedule (days of week).
alter table public.turnout_groups
  add column if not exists days_of_week text[] not null default '{}';

alter table public.turnout_groups
  drop constraint if exists turnout_groups_days_of_week_valid;

alter table public.turnout_groups
  add constraint turnout_groups_days_of_week_valid
  check (
    days_of_week <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
  );
