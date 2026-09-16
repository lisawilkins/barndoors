-- Lets a standing Hand recurring shift occur every other week instead of
-- every week. Off by default (biweekly = false), matching how the row
-- behaved before this migration. When turned on, biweekly_start_date
-- anchors which calendar week (Sun-Sat) is an "on" week — the app computes
-- the cadence client-side (HandSchedule.jsx / handSchedule.js), this column
-- is just the anchor date a manager picks in the "Beginning on" field.
alter table public.hand_recurring_shifts
  add column biweekly boolean not null default false,
  add column biweekly_start_date date;

alter table public.hand_recurring_shifts
  add constraint hand_recurring_shifts_biweekly_start_required
  check (not biweekly or biweekly_start_date is not null);
