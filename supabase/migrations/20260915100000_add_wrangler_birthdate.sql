-- Wranglers get a "Birthday" field in the app, replacing "Gender" in the
-- form and list. The old `gender` column and its existing values are kept
-- (not shown or collected anymore) rather than dropped, same precedent as
-- head.tag_id — see AGENTS.md "Data model" and barndoors-schema.md
-- "Part 4 — Wranglers".
alter table public.wranglers
  add column birthdate date;
