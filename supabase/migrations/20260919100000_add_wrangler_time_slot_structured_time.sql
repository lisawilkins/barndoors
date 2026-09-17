-- wrangler_time_slots.name used to be free-hand text (e.g. "530 - 630p"),
-- with sort_order a separately hand-maintained integer set once at
-- creation and never resynced on rename -- exactly how Thursday's two
-- slots ended up backwards. Adding structured start/end times lets the
-- app derive both the display name and sort_order from the same value on
-- every save, so they can't drift apart again.
--
-- Nullable: archived/inactive legacy rows (old typo'd duplicates, etc.)
-- are never displayed or edited again, so there's no need to force-parse
-- their free text -- only active rows are backfilled below.
alter table public.wrangler_time_slots
  add column start_time time,
  add column end_time time;

alter table public.wrangler_time_slots
  add constraint wrangler_time_slots_end_after_start
  check (start_time is null or end_time is null or end_time > start_time);

-- Backfill + reformat every currently-active row from its current
-- free-hand name, and recompute sort_order from the real start time --
-- this is what fixes Thursday's backwards order, as a side effect of
-- deriving sort_order from start_time instead of trusting the old
-- hand-set value. New display format ("5:30 - 6:30 PM" style) applied
-- uniformly so there's no mixed old/new-style state.
update public.wrangler_time_slots set name = '5:30 – 6:30 PM', start_time = '17:30', end_time = '18:30', sort_order = 1050 where day_of_week = 'fri' and name = '530 - 630p' and active;
update public.wrangler_time_slots set name = '5:30 – 6:30 PM', start_time = '17:30', end_time = '18:30', sort_order = 1050 where day_of_week = 'mon' and name = '530 - 630p' and active;
update public.wrangler_time_slots set name = '7 – 8 PM',       start_time = '19:00', end_time = '20:00', sort_order = 1140 where day_of_week = 'mon' and name = '7 - 8p'    and active;
update public.wrangler_time_slots set name = '7 – 9 AM',       start_time = '07:00', end_time = '09:00', sort_order = 420  where day_of_week = 'sat' and name = '7 - 9a'    and active;
update public.wrangler_time_slots set name = '7 – 8 PM',       start_time = '19:00', end_time = '20:00', sort_order = 1140 where day_of_week = 'thu' and name = '7 - 8p'    and active;
update public.wrangler_time_slots set name = '5:30 – 6:30 PM', start_time = '17:30', end_time = '18:30', sort_order = 1050 where day_of_week = 'thu' and name = '530 - 630p' and active;
update public.wrangler_time_slots set name = '5:30 – 6:30 PM', start_time = '17:30', end_time = '18:30', sort_order = 1050 where day_of_week = 'tue' and name = '530 - 630p' and active;
update public.wrangler_time_slots set name = '7 – 8 PM',       start_time = '19:00', end_time = '20:00', sort_order = 1140 where day_of_week = 'tue' and name = '7 - 8p'    and active;
update public.wrangler_time_slots set name = '5:30 – 6:30 PM', start_time = '17:30', end_time = '18:30', sort_order = 1050 where day_of_week = 'wed' and name = '530 - 630p' and active;
update public.wrangler_time_slots set name = '7 – 8 PM',       start_time = '19:00', end_time = '20:00', sort_order = 1140 where day_of_week = 'wed' and name = '7 - 8p'    and active;
