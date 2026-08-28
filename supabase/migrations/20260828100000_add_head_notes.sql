-- General notes for an animal, distinct from feed_notes and turnout_notes
-- (e.g. "Slow eater — give him room at the trough. Farrier every 6 weeks.").
-- No column-level visibility restriction: hands already read the whole
-- `head` row via the existing select_authenticated policy.
alter table public.head add column if not exists notes text;
