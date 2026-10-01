-- Hand one-off shifts: structured time, optional link to an existing shift,
-- a "Needs Help" flag, and an optional title.
--
-- A one-off's "when" used to be free text (event_time, e.g. "8am"). It's
-- now one of two things, picked in the form:
--   * start_time    -- a real time from a native time picker, or
--   * shift_type_id -- one of that weekday's existing shifts ("AM", "PM"),
--                      in which case the one-off shows inside that shift's
--                      group on the calendar instead of as its own entry.
-- Never both (check constraint below). The form requires one of them on
-- every save; legacy rows (see backfill) have neither until next edited.
--
-- title is now optional: a one-off can be just "5 PM" or just sit inside
-- the AM shift with its hands listed.
--
-- needs_help marks an unstaffed one-off: it shows as "OPEN SHIFT" instead
-- of hand names. Either/or with assigned hands -- the app clears
-- hand_shift_event_members when needs_help is saved as true.
alter table public.hand_shift_events
  add column start_time time,
  add column shift_type_id uuid references public.hand_shift_types (id) on delete restrict,
  add column needs_help boolean not null default false;

alter table public.hand_shift_events
  alter column title drop not null;

alter table public.hand_shift_events
  add constraint hand_shift_events_time_or_shift
  check (start_time is null or shift_type_id is null);

-- Legacy free-text times can't be parsed reliably ("8am", "after lunch",
-- "10-ish"), so they move into the title verbatim, e.g. "Gymkhana · 8am",
-- rather than being guessed at. event_time is kept (nullable, no longer
-- read or written by the app -- same precedent as head.tag_id) so a
-- frontend still on the old build during deploy doesn't break.
alter table public.hand_shift_events
  alter column event_time drop not null;

update public.hand_shift_events
set title = title || ' · ' || btrim(event_time),
    event_time = null
where btrim(coalesce(event_time, '')) <> '';
