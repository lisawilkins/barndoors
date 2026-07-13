-- Preloaded extensible-list values, per barndoors-schema.md.
-- Managers can add more of each via "New" in the app — these are just the
-- starting set, not a hardcoded enum.

insert into public.feed_items (name, dual_unit) values
  ('Alfalfa', true),
  ('Grass', true),
  ('Grain', false),
  ('SR Pro', false),
  ('SimpliFly', false),
  ('Calf Manna', false)
on conflict (name) do nothing;

insert into public.turnout_locations (name) values
  ('Back paddock'),
  ('Small paddock'),
  ('Side paddock'),
  ('Large paddock'),
  ('Alley/Arena')
on conflict (name) do nothing;

insert into public.chore_types (name, instructions) values
  ('Feed', null),
  ('Muck stalls', null),
  ('Clean waters', null),
  ('Clean troughs', null),
  ('Clean out old hay', null),
  ('Fly spray', null),
  ('Blow/Sweep Barn', null),
  ('Misters On/Off', null),
  ('Replace fly traps', null),
  ('Replace fly spray', null),
  ('Trash', null),
  ('Shavings', null),
  ('Turnout', null)
on conflict (name) do nothing;
