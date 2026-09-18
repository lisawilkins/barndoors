-- =============================================================================
-- LOCAL ONLY — made-up FPO barn for screenshots and recordings.
--
-- Loaded by `supabase db reset` / first `supabase start` (see
-- supabase/config.toml [db.seed]). Never applied by `supabase db push`.
--
-- Do not run this file against the live barn. Do not dump production into it.
-- Every name below is invented. Wranglers are portrayed as kids with fake
-- names and no photos.
-- =============================================================================

-- Refuse a hosted/production database. Local CLI uses the well-known demo
-- JWT secret; hosted projects do not. If that GUC isn't present, fall
-- through to the "already has barn data" check below.
do $$
declare
  jwt_secret text;
begin
  jwt_secret := coalesce(
    nullif(current_setting('app.settings.jwt_secret', true), ''),
    nullif(current_setting('pgrst.jwt_secret', true), ''),
    ''
  );
  if jwt_secret <> ''
     and jwt_secret not like '%super-secret-jwt-token-with-at-least-32-characters-long%'
  then
    raise exception
      'FPO seed is local-only. This database is not the local Supabase stack. Never run supabase/seed.sql against production.';
  end if;

  -- A local reset is empty here; the live barn is not.
  if exists (select 1 from public.head)
     or exists (select 1 from public.wranglers)
     or exists (select 1 from public.chore_lists)
     or exists (
       select 1 from public.profiles
       where coalesce(email, '') not in (
         'manager@fpo.local',
         'admin@fpo.local',
         'hand@barndoors.internal'
       )
     )
  then
    raise exception
      'FPO seed is local-only and this database already has barn data. Never run supabase/seed.sql against production. Use a local `supabase db reset` only.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lookup lists (starting set, not hardcoded enums). Managers can add more in
-- the app. Kept from the original seed so a local reset still has feed types
-- and turnout locations even without the FPO rows below.
-- -----------------------------------------------------------------------------

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

-- Unused by the app (chore_lists replaced this model) but the tables still
-- exist, so keep the original lookup rows.
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

-- -----------------------------------------------------------------------------
-- Local logins. Password for every FPO account: fpo-local-only
--   Manager tab:  manager@fpo.local
--   Manager tab:  admin@fpo.local   (same permissions; also schedulable)
--   Hand tab:     password only — email is the shared HAND_LOGIN_EMAIL
--
-- One DO block on purpose: the CLI sends seed.sql in batches on separate
-- sessions, so a pg_temp helper created in one statement is gone by the next
-- (`schema "pg_temp" does not exist`). Committed public/auth rows are fine
-- across batches; session-local objects are not.
-- handle_new_user() inserts a profiles row (role = hand) for each auth user.
-- -----------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select * from (values
      (
        '00000000-f0f0-4000-8000-000000000001'::uuid,
        'manager@fpo.local',
        'Robin Hale'
      ),
      (
        '00000000-f0f0-4000-8000-000000000002'::uuid,
        'admin@fpo.local',
        'Dana West'
      ),
      (
        '00000000-f0f0-4000-8000-000000000003'::uuid,
        'hand@barndoors.internal',
        'Shared hand login'
      )
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      email_change_token_current,
      recovery_token,
      phone_change,
      phone_change_token,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      r.id,
      'authenticated',
      'authenticated',
      r.email,
      extensions.crypt('fpo-local-only', extensions.gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', r.full_name),
      now(),
      now()
    );

    insert into auth.identities (
      id,
      user_id,
      provider,
      provider_id,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      r.id,
      'email',
      r.id::text,
      jsonb_build_object('sub', r.id::text, 'email', r.email),
      now(),
      now(),
      now()
    );
  end loop;
end;
$$;

update public.profiles
set
  role = 'manager',
  name = 'Robin Hale',
  phone = '5550101001',
  email = 'manager@fpo.local',
  status = 'active'
where id = '00000000-f0f0-4000-8000-000000000001';

update public.profiles
set
  role = 'admin',
  name = 'Dana West',
  phone = '5550101002',
  email = 'admin@fpo.local',
  status = 'active'
where id = '00000000-f0f0-4000-8000-000000000002';

-- Shared Hand login: must exist so /login Hand works, but keep it off the
-- roster so screenshots show named people only.
update public.profiles
set
  role = 'hand',
  name = 'Shared hand login',
  email = 'hand@barndoors.internal',
  status = 'inactive'
where id = '00000000-f0f0-4000-8000-000000000003';

-- Named hands are directory records only — no auth.users row.
insert into public.profiles (id, role, name, phone, email, status) values
  ('00000000-f0f0-4000-8000-000000000011', 'hand', 'Casey Quinn',   '5550102011', 'casey.quinn@fpo.local',   'active'),
  ('00000000-f0f0-4000-8000-000000000012', 'hand', 'Morgan Ellis',  '5550102012', 'morgan.ellis@fpo.local',  'active'),
  ('00000000-f0f0-4000-8000-000000000013', 'hand', 'Jules Navarro', '5550102013', 'jules.navarro@fpo.local', 'active'),
  ('00000000-f0f0-4000-8000-000000000014', 'hand', 'Harper Dune',   '5550102014', 'harper.dune@fpo.local',   'active'),
  ('00000000-f0f0-4000-8000-000000000015', 'hand', 'Quinn Pebble',  '5550102015', 'quinn.pebble@fpo.local',  'active');

-- -----------------------------------------------------------------------------
-- Herd — invented animals, no photos (placeholder icon in the app).
-- -----------------------------------------------------------------------------

insert into public.head (
  id, name, species, breed, sex, birth_date, status, acquired_date,
  feed_notes, turnout_notes, notes, sort_order
) values
  ('00000000-f0f0-4000-8000-000000000101', 'Buttercup', 'Horse', 'Palomino', 'mare',    '2012-04-03', 'active', '2018-06-01',
   'Easy keeper — skip grain if she looks pudgy.', 'Goes out with Marmalade.', 'Loves a scratch on the withers. Fake FPO horse.', 1),
  ('00000000-f0f0-4000-8000-000000000102', 'Pixel',     'Horse', 'Bay',      'gelding', '2015-08-19', 'active', '2020-03-12',
   'Needs wet beet pulp mixed into grain.', 'Buddy is Comet.', 'Wiggly at the gate. Fake FPO horse.', 2),
  ('00000000-f0f0-4000-8000-000000000103', 'Marmalade', 'Horse', 'Chestnut', 'mare',    '2010-02-11', 'active', '2016-09-20',
   'Senior mash in the evening only.', 'Stays with Buttercup.', 'Nap queen. Fake FPO horse.', 3),
  ('00000000-f0f0-4000-8000-000000000104', 'Comet',     'Horse', 'Grey',     'gelding', '2014-11-02', 'active', '2019-04-08',
   'No molasses in grain.', 'Buddy is Pixel.', 'Spooks at tarps. Fake FPO horse.', 4),
  ('00000000-f0f0-4000-8000-000000000105', 'Noodle',    'Pony',  'Welsh',    'gelding', '2018-05-22', 'active', '2021-07-15',
   'Half flake — he will steal the rest.', 'Pony paddock with Puddle.', 'Lead by the wither, not the face. Fake FPO pony.', 5),
  ('00000000-f0f0-4000-8000-000000000106', 'Puddle',    'Pony',  'Shetland', 'mare',    '2016-01-30', 'active', '2021-07-15',
   'Calf Manna pinch on grain.', 'Pony paddock with Noodle.', 'Tiny but in charge. Fake FPO pony.', 6),
  ('00000000-f0f0-4000-8000-000000000107', 'Junebug',   'Horse', 'Roan',     'mare',    '2013-07-09', 'active', '2017-05-04',
   'Hay before grain or she dives.', 'Often solo in Side paddock.', 'Talks the whole time you brush. Fake FPO horse.', 7),
  ('00000000-f0f0-4000-8000-000000000108', 'Biscuit',   'Horse', 'Paint',    'gelding', '2011-09-14', 'active', '2015-10-01',
   'Soaked hay cubes if dusty.', 'Large paddock weekdays.', 'Pocket-seeker. Fake FPO horse.', 8),
  ('00000000-f0f0-4000-8000-000000000109', 'Sparrow',   'Horse', 'Black',    'mare',    '2017-03-28', 'active', '2022-02-18',
   'One extra flake on cold mornings.', 'Arena pair on weekends.', 'Quiet on trails. Fake FPO horse.', 9),
  ('00000000-f0f0-4000-8000-000000000110', 'Pickle',    'Horse', 'Dun',      'gelding', '2009-12-05', 'active', '2014-08-22',
   'Joint powder on grain (already mixed).', 'Likes the back fence.', 'Senior, still game. Fake FPO horse.', 10),
  ('00000000-f0f0-4000-8000-000000000111', 'Cinder',    'Horse', 'Liver chestnut', 'mare', '2016-06-17', 'active', '2023-01-09',
   'No alfalfa after noon.', 'Mixes with the mare group some days.', 'Ear-pinner until you scratch her neck. Fake FPO horse.', 11),
  ('00000000-f0f0-4000-8000-000000000112', 'Waffles',   'Horse', 'Appaloosa', 'gelding', '2019-10-21', 'active', '2024-04-02',
   'Greenest of the bunch — start slow on grain.', 'Young horse, often with Biscuit.', 'Clicks his teeth when happy. Fake FPO horse.', 12);

select setval(
  'public.head_sort_order_seq',
  coalesce((select max(sort_order) from public.head), 1)
);

-- Standing feed plans (not a log). Dual-unit items use flakes + lbs;
-- everything else uses amount + unit.
insert into public.head_feed_plan (head_id, feed_item_id, amount_flakes, amount_lbs, amount, unit, updated_by)
select h.id, f.id, x.amount_flakes, x.amount_lbs, x.amount, x.unit,
       '00000000-f0f0-4000-8000-000000000001'
from (
  values
    ('00000000-f0f0-4000-8000-000000000101'::uuid, 'Alfalfa',   2::numeric, 4::numeric, null::numeric, null),
    ('00000000-f0f0-4000-8000-000000000101',       'Grain',     null,       null,       1,            'scoop'),
    ('00000000-f0f0-4000-8000-000000000101',       'SimpliFly', null,       null,       1,            'scoop'),
    ('00000000-f0f0-4000-8000-000000000102',       'Grass',     3,          6,          null,         null),
    ('00000000-f0f0-4000-8000-000000000102',       'Grain',     null,       null,       2,            'scoop'),
    ('00000000-f0f0-4000-8000-000000000102',       'SR Pro',    null,       null,       0.5,          'cup'),
    ('00000000-f0f0-4000-8000-000000000103',       'Grass',     2,          4,          null,         null),
    ('00000000-f0f0-4000-8000-000000000103',       'Alfalfa',   1,          2,          null,         null),
    ('00000000-f0f0-4000-8000-000000000103',       'Calf Manna',null,       null,       1,            'handful'),
    ('00000000-f0f0-4000-8000-000000000104',       'Grass',     3,          5,          null,         null),
    ('00000000-f0f0-4000-8000-000000000104',       'Grain',     null,       null,       1.5,          'scoop'),
    ('00000000-f0f0-4000-8000-000000000105',       'Grass',     1,          2,          null,         null),
    ('00000000-f0f0-4000-8000-000000000105',       'Grain',     null,       null,       0.5,          'scoop'),
    ('00000000-f0f0-4000-8000-000000000106',       'Grass',     1,          1.5,        null,         null),
    ('00000000-f0f0-4000-8000-000000000106',       'Calf Manna',null,       null,       1,            'handful'),
    ('00000000-f0f0-4000-8000-000000000107',       'Alfalfa',   2,          3.5,        null,         null),
    ('00000000-f0f0-4000-8000-000000000107',       'Grain',     null,       null,       1,            'scoop'),
    ('00000000-f0f0-4000-8000-000000000108',       'Grass',     2,          4,          null,         null),
    ('00000000-f0f0-4000-8000-000000000108',       'Alfalfa',   1,          2,          null,         null),
    ('00000000-f0f0-4000-8000-000000000108',       'SR Pro',    null,       null,       1,            'scoop'),
    ('00000000-f0f0-4000-8000-000000000109',       'Grass',     2,          4,          null,         null),
    ('00000000-f0f0-4000-8000-000000000109',       'Grain',     null,       null,       1,            'scoop'),
    ('00000000-f0f0-4000-8000-000000000109',       'SimpliFly', null,       null,       1,            'scoop'),
    ('00000000-f0f0-4000-8000-000000000110',       'Grass',     2,          3,          null,         null),
    ('00000000-f0f0-4000-8000-000000000110',       'Calf Manna',null,       null,       2,            'handful'),
    ('00000000-f0f0-4000-8000-000000000111',       'Grass',     2,          4,          null,         null),
    ('00000000-f0f0-4000-8000-000000000111',       'Grain',     null,       null,       1,            'scoop'),
    ('00000000-f0f0-4000-8000-000000000112',       'Alfalfa',   1,          2,          null,         null),
    ('00000000-f0f0-4000-8000-000000000112',       'Grain',     null,       null,       1,            'scoop')
) as x(head_id, feed_name, amount_flakes, amount_lbs, amount, unit)
join public.head h on h.id = x.head_id
join public.feed_items f on f.name = x.feed_name;

-- Standing turnout groups (location + days + members).
insert into public.turnout_groups (id, location_id, name, days_of_week, updated_by)
select '00000000-f0f0-4000-8000-000000000501', id, 'Morning mares',
       array['mon','tue','wed','thu','fri']::text[],
       '00000000-f0f0-4000-8000-000000000001'
from public.turnout_locations where name = 'Back paddock';

insert into public.turnout_groups (id, location_id, name, days_of_week, updated_by)
select '00000000-f0f0-4000-8000-000000000502', id, 'Weekday geldings',
       array['mon','tue','wed','thu','fri']::text[],
       '00000000-f0f0-4000-8000-000000000001'
from public.turnout_locations where name = 'Large paddock';

insert into public.turnout_groups (id, location_id, name, days_of_week, updated_by)
select '00000000-f0f0-4000-8000-000000000503', id, 'Pony pair',
       array['sat','sun']::text[],
       '00000000-f0f0-4000-8000-000000000001'
from public.turnout_locations where name = 'Small paddock';

insert into public.turnout_groups (id, location_id, name, days_of_week, updated_by)
select '00000000-f0f0-4000-8000-000000000504', id, 'Junebug solo',
       array['tue','thu']::text[],
       '00000000-f0f0-4000-8000-000000000001'
from public.turnout_locations where name = 'Side paddock';

insert into public.turnout_groups (id, location_id, name, days_of_week, updated_by)
select '00000000-f0f0-4000-8000-000000000505', id, 'Weekend arena',
       array['sat','sun']::text[],
       '00000000-f0f0-4000-8000-000000000001'
from public.turnout_locations where name = 'Alley/Arena';

insert into public.turnout_group_members (group_id, head_id) values
  ('00000000-f0f0-4000-8000-000000000501', '00000000-f0f0-4000-8000-000000000101'), -- Buttercup
  ('00000000-f0f0-4000-8000-000000000501', '00000000-f0f0-4000-8000-000000000103'), -- Marmalade
  ('00000000-f0f0-4000-8000-000000000501', '00000000-f0f0-4000-8000-000000000111'), -- Cinder
  ('00000000-f0f0-4000-8000-000000000502', '00000000-f0f0-4000-8000-000000000102'), -- Pixel
  ('00000000-f0f0-4000-8000-000000000502', '00000000-f0f0-4000-8000-000000000104'), -- Comet
  ('00000000-f0f0-4000-8000-000000000502', '00000000-f0f0-4000-8000-000000000108'), -- Biscuit
  ('00000000-f0f0-4000-8000-000000000502', '00000000-f0f0-4000-8000-000000000112'), -- Waffles
  ('00000000-f0f0-4000-8000-000000000503', '00000000-f0f0-4000-8000-000000000105'), -- Noodle
  ('00000000-f0f0-4000-8000-000000000503', '00000000-f0f0-4000-8000-000000000106'), -- Puddle
  ('00000000-f0f0-4000-8000-000000000504', '00000000-f0f0-4000-8000-000000000107'), -- Junebug
  ('00000000-f0f0-4000-8000-000000000505', '00000000-f0f0-4000-8000-000000000109'), -- Sparrow
  ('00000000-f0f0-4000-8000-000000000505', '00000000-f0f0-4000-8000-000000000110'); -- Pickle

-- -----------------------------------------------------------------------------
-- Wranglers — clearly fake kid names, no photos. "No photos" is informational
-- only (do not photograph at events); it does not hide a profile photo.
-- -----------------------------------------------------------------------------

insert into public.wranglers (
  id, first_name, last_initial, age, birthdate, notes, no_photos, status, updated_by
) values
  ('00000000-f0f0-4000-8000-000000000201', 'Pip',     'M', 9,  '2017-04-12', 'Made-up FPO wrangler. Loves Buttercup.', true,  'active', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000202', 'Scout',   'T', 11, '2015-01-08', 'Made-up FPO wrangler. Always early.',    false, 'active', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000203', 'Willa',   'P', 10, '2016-09-02', 'Made-up FPO wrangler.',                  true,  'active', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000204', 'Finn',    'O', 12, '2014-06-19', 'Made-up FPO wrangler. Working days too.', false, 'active', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000205', 'Clover',  'B', 8,  '2018-02-27', 'Made-up FPO wrangler. Pony kid.',        false, 'active', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000206', 'Juniper', 'K', 13, '2013-11-15', 'Made-up FPO wrangler.',                  false, 'active', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000207', 'Reed',    'S', 9,  '2017-08-03', 'Made-up FPO wrangler.',                  false, 'active', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000208', 'Maple',   'H', 10, '2016-05-21', 'Made-up FPO wrangler.',                  true,  'active', '00000000-f0f0-4000-8000-000000000001');

-- Day-specific time slots. name + sort_order match what the app derives from
-- start/end (formatTimeRange / minutesSinceMidnight).
insert into public.wrangler_time_slots (id, name, day_of_week, start_time, end_time, sort_order, active) values
  ('00000000-f0f0-4000-8000-000000000301', '5:30 – 6:30 PM', 'mon', '17:30', '18:30', 1050, true),
  ('00000000-f0f0-4000-8000-000000000302', '7 – 8 PM',       'mon', '19:00', '20:00', 1140, true),
  ('00000000-f0f0-4000-8000-000000000303', '5:30 – 6:30 PM', 'tue', '17:30', '18:30', 1050, true),
  ('00000000-f0f0-4000-8000-000000000304', '7 – 8 PM',       'tue', '19:00', '20:00', 1140, true),
  ('00000000-f0f0-4000-8000-000000000305', '5:30 – 6:30 PM', 'wed', '17:30', '18:30', 1050, true),
  ('00000000-f0f0-4000-8000-000000000306', '7 – 8 PM',       'wed', '19:00', '20:00', 1140, true),
  ('00000000-f0f0-4000-8000-000000000307', '5:30 – 6:30 PM', 'thu', '17:30', '18:30', 1050, true),
  ('00000000-f0f0-4000-8000-000000000308', '7 – 8 PM',       'thu', '19:00', '20:00', 1140, true),
  ('00000000-f0f0-4000-8000-000000000309', '5:30 – 6:30 PM', 'fri', '17:30', '18:30', 1050, true),
  ('00000000-f0f0-4000-8000-000000000310', '7 – 8 PM',       'fri', '19:00', '20:00', 1140, true),
  ('00000000-f0f0-4000-8000-000000000311', '7 – 9 AM',       'sat', '07:00', '09:00',  420, true),
  ('00000000-f0f0-4000-8000-000000000312', '9 – 11 AM',      'sat', '09:00', '11:00',  540, true),
  ('00000000-f0f0-4000-8000-000000000313', '2 – 3 PM',       'sun', '14:00', '15:00',  840, true);

insert into public.wrangler_recurring_assignments (
  id, wrangler_id, time_slot_id, activity, horse_id, updated_by
) values
  ('00000000-f0f0-4000-8000-000000000321', '00000000-f0f0-4000-8000-000000000201', '00000000-f0f0-4000-8000-000000000301', 'riding',  '00000000-f0f0-4000-8000-000000000101', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000322', '00000000-f0f0-4000-8000-000000000201', '00000000-f0f0-4000-8000-000000000305', 'riding',  '00000000-f0f0-4000-8000-000000000101', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000323', '00000000-f0f0-4000-8000-000000000202', '00000000-f0f0-4000-8000-000000000302', 'working', null,                                         '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000324', '00000000-f0f0-4000-8000-000000000202', '00000000-f0f0-4000-8000-000000000307', 'riding',  '00000000-f0f0-4000-8000-000000000102', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000325', '00000000-f0f0-4000-8000-000000000203', '00000000-f0f0-4000-8000-000000000303', 'riding',  '00000000-f0f0-4000-8000-000000000103', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000326', '00000000-f0f0-4000-8000-000000000204', '00000000-f0f0-4000-8000-000000000304', 'working', null,                                         '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000327', '00000000-f0f0-4000-8000-000000000204', '00000000-f0f0-4000-8000-000000000309', 'riding',  '00000000-f0f0-4000-8000-000000000104', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000328', '00000000-f0f0-4000-8000-000000000205', '00000000-f0f0-4000-8000-000000000306', 'working', null,                                         '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000329', '00000000-f0f0-4000-8000-000000000205', '00000000-f0f0-4000-8000-000000000311', 'riding',  '00000000-f0f0-4000-8000-000000000105', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000330', '00000000-f0f0-4000-8000-000000000206', '00000000-f0f0-4000-8000-000000000308', 'riding',  '00000000-f0f0-4000-8000-000000000108', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000331', '00000000-f0f0-4000-8000-000000000206', '00000000-f0f0-4000-8000-000000000312', 'working', null,                                         '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000332', '00000000-f0f0-4000-8000-000000000207', '00000000-f0f0-4000-8000-000000000310', 'working', null,                                         '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000333', '00000000-f0f0-4000-8000-000000000207', '00000000-f0f0-4000-8000-000000000313', 'riding',  '00000000-f0f0-4000-8000-000000000109', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000334', '00000000-f0f0-4000-8000-000000000208', '00000000-f0f0-4000-8000-000000000305', 'riding',  '00000000-f0f0-4000-8000-000000000107', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000335', '00000000-f0f0-4000-8000-000000000208', '00000000-f0f0-4000-8000-000000000311', 'working', null,                                         '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000336', '00000000-f0f0-4000-8000-000000000203', '00000000-f0f0-4000-8000-000000000309', 'working', null,                                         '00000000-f0f0-4000-8000-000000000001');

-- Skip one standing occurrence; pair a one-off fill-in on a different day.
insert into public.wrangler_recurring_skips (recurring_assignment_id, date) values
  ('00000000-f0f0-4000-8000-000000000321', '2026-09-21'); -- Pip off that Monday

insert into public.wrangler_assignments (
  wrangler_id, date, time_slot_id, activity, horse_id, updated_by
) values
  ('00000000-f0f0-4000-8000-000000000205', '2026-09-18', '00000000-f0f0-4000-8000-000000000310', 'working', null, '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000202', '2026-09-25', '00000000-f0f0-4000-8000-000000000309', 'riding', '00000000-f0f0-4000-8000-000000000102', '00000000-f0f0-4000-8000-000000000001');

insert into public.wrangler_calendar_notes (note_date, note_month, body, updated_by) values
  (null, '2026-09-01', 'Fall clinic month — extra helpers on Saturdays.', '00000000-f0f0-4000-8000-000000000001'),
  ('2026-09-17', null, 'Bring extra hay nets.', '00000000-f0f0-4000-8000-000000000001'),
  ('2026-09-26', null, 'Gymkhana — trailers leave at 7.', '00000000-f0f0-4000-8000-000000000001');

-- -----------------------------------------------------------------------------
-- Hand scheduling. Default AM/PM × 7 days already exist from the migration.
-- Add one extra type so the Shift types page looks manager-extended.
-- -----------------------------------------------------------------------------

insert into public.hand_shift_types (name, day_of_week, sort_order)
values ('Overnight', 'sat', 2);

insert into public.hand_recurring_shifts (profile_id, shift_type_id, updated_by)
select x.profile_id, t.id, '00000000-f0f0-4000-8000-000000000001'
from (
  values
    ('00000000-f0f0-4000-8000-000000000011'::uuid, 'AM', 'mon'),
    ('00000000-f0f0-4000-8000-000000000011',       'AM', 'wed'),
    ('00000000-f0f0-4000-8000-000000000011',       'AM', 'fri'),
    ('00000000-f0f0-4000-8000-000000000011',       'PM', 'sun'),
    ('00000000-f0f0-4000-8000-000000000012',       'PM', 'mon'),
    ('00000000-f0f0-4000-8000-000000000012',       'AM', 'tue'),
    ('00000000-f0f0-4000-8000-000000000012',       'PM', 'thu'),
    ('00000000-f0f0-4000-8000-000000000012',       'AM', 'sat'),
    ('00000000-f0f0-4000-8000-000000000013',       'PM', 'tue'),
    ('00000000-f0f0-4000-8000-000000000013',       'AM', 'thu'),
    ('00000000-f0f0-4000-8000-000000000014',       'PM', 'wed'),
    ('00000000-f0f0-4000-8000-000000000014',       'PM', 'fri'),
    ('00000000-f0f0-4000-8000-000000000014',       'AM', 'sun'),
    ('00000000-f0f0-4000-8000-000000000015',       'AM', 'tue'),
    ('00000000-f0f0-4000-8000-000000000015',       'AM', 'thu'),
    ('00000000-f0f0-4000-8000-000000000015',       'PM', 'sat'),
    ('00000000-f0f0-4000-8000-000000000002',       'AM', 'mon'), -- Dana (admin) also works
    ('00000000-f0f0-4000-8000-000000000002',       'PM', 'fri')
) as x(profile_id, type_name, dow)
join public.hand_shift_types t
  on t.name = x.type_name and t.day_of_week = x.dow and t.active;

-- Jules: Saturday AM every other week, starting the week of Aug 30 2026.
insert into public.hand_recurring_shifts (
  profile_id, shift_type_id, biweekly, biweekly_start_date, updated_by
)
select
  '00000000-f0f0-4000-8000-000000000013',
  t.id,
  true,
  '2026-08-30',
  '00000000-f0f0-4000-8000-000000000001'
from public.hand_shift_types t
where t.name = 'AM' and t.day_of_week = 'sat' and t.active;

insert into public.hand_recurring_shift_skips (recurring_shift_id, date)
select s.id, '2026-09-18'
from public.hand_recurring_shifts s
join public.hand_shift_types t on t.id = s.shift_type_id
where s.profile_id = '00000000-f0f0-4000-8000-000000000011'
  and t.name = 'AM' and t.day_of_week = 'fri';

insert into public.hand_vacations (profile_id, start_date, end_date, updated_by) values
  ('00000000-f0f0-4000-8000-000000000014', '2026-09-16', '2026-09-20', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000015', '2026-09-28', '2026-10-04', '00000000-f0f0-4000-8000-000000000001');

insert into public.hand_shift_events (id, title, event_date, event_time, notes, updated_by) values
  ('00000000-f0f0-4000-8000-000000000601', 'Clinic setup', '2026-09-18', '4pm',
   'Move jumps and set the arena. Fake FPO event.', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000602', 'Farrier day', '2026-09-22', '10am',
   'Pixel and Comet first. Fake FPO event.', '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000603', 'Gymkhana', '2026-09-26', '8am',
   'Groom for event. Meet at the barn or the venue. Fake FPO event.', '00000000-f0f0-4000-8000-000000000001');

insert into public.hand_shift_event_members (event_id, profile_id) values
  ('00000000-f0f0-4000-8000-000000000601', '00000000-f0f0-4000-8000-000000000012'),
  ('00000000-f0f0-4000-8000-000000000601', '00000000-f0f0-4000-8000-000000000015'),
  ('00000000-f0f0-4000-8000-000000000602', '00000000-f0f0-4000-8000-000000000014'),
  ('00000000-f0f0-4000-8000-000000000602', '00000000-f0f0-4000-8000-000000000013'),
  ('00000000-f0f0-4000-8000-000000000603', '00000000-f0f0-4000-8000-000000000011'),
  ('00000000-f0f0-4000-8000-000000000603', '00000000-f0f0-4000-8000-000000000012'),
  ('00000000-f0f0-4000-8000-000000000603', '00000000-f0f0-4000-8000-000000000002');

-- -----------------------------------------------------------------------------
-- Chore lists — written outlines, not a catalog. Nested to depth 2.
-- -----------------------------------------------------------------------------

insert into public.chore_lists (id, name, description, status, sort_order, updated_by) values
  ('00000000-f0f0-4000-8000-000000000401', 'AM Chores',
   'Morning barn, before turnout. Made-up FPO list.', 'active', 0,
   '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000402', 'PM Chores',
   'Evening barn, after horses are in. Made-up FPO list.', 'active', 1,
   '00000000-f0f0-4000-8000-000000000001'),
  ('00000000-f0f0-4000-8000-000000000403', 'Weekend extras',
   'Saturday add-ons. Made-up FPO list.', 'active', 2,
   '00000000-f0f0-4000-8000-000000000001');

insert into public.chore_items (id, list_id, section_id, parent_id, depth, body, note, sort_order) values
  -- AM
  ('00000000-f0f0-4000-8000-000000000411', '00000000-f0f0-4000-8000-000000000401', null, null, 0,
   'Initial barn check', 'Walk the aisle before anyone eats.', 0),
  ('00000000-f0f0-4000-8000-000000000412', '00000000-f0f0-4000-8000-000000000401', null,
   '00000000-f0f0-4000-8000-000000000411', 1, 'Lights and doors', 'Open the north sliding door first.', 1),
  ('00000000-f0f0-4000-8000-000000000413', '00000000-f0f0-4000-8000-000000000401', null,
   '00000000-f0f0-4000-8000-000000000411', 1, 'Quick look at every stall', null, 2),
  ('00000000-f0f0-4000-8000-000000000414', '00000000-f0f0-4000-8000-000000000401', null,
   '00000000-f0f0-4000-8000-000000000413', 2, 'Water full', null, 3),
  ('00000000-f0f0-4000-8000-000000000415', '00000000-f0f0-4000-8000-000000000401', null,
   '00000000-f0f0-4000-8000-000000000413', 2, 'Horse standing / moving okay', null, 4),
  ('00000000-f0f0-4000-8000-000000000416', '00000000-f0f0-4000-8000-000000000401', null, null, 0,
   'Grain', 'Look over horses while you grain.', 5),
  ('00000000-f0f0-4000-8000-000000000417', '00000000-f0f0-4000-8000-000000000401', null,
   '00000000-f0f0-4000-8000-000000000416', 1, 'Mix buckets from the board', null, 6),
  ('00000000-f0f0-4000-8000-000000000418', '00000000-f0f0-4000-8000-000000000401', null,
   '00000000-f0f0-4000-8000-000000000416', 1, 'Feed left aisle first', 'Buttercup waits if you start on the right.', 7),
  ('00000000-f0f0-4000-8000-000000000419', '00000000-f0f0-4000-8000-000000000401', null, null, 0,
   'Hay', null, 8),
  ('00000000-f0f0-4000-8000-00000000041a', '00000000-f0f0-4000-8000-000000000401', null,
   '00000000-f0f0-4000-8000-000000000419', 1, 'Flake count is on the feed board', null, 9),
  ('00000000-f0f0-4000-8000-00000000041b', '00000000-f0f0-4000-8000-000000000401', null, null, 0,
   'Turnout', 'Groups go out in this order, not by whoever is ready.', 10),
  ('00000000-f0f0-4000-8000-00000000041c', '00000000-f0f0-4000-8000-000000000401', null,
   '00000000-f0f0-4000-8000-00000000041b', 1, 'Fly masks on', null, 11),
  ('00000000-f0f0-4000-8000-00000000041d', '00000000-f0f0-4000-8000-000000000401', null,
   '00000000-f0f0-4000-8000-00000000041c', 2, 'Noodle last — he steals others', null, 12),
  ('00000000-f0f0-4000-8000-00000000041e', '00000000-f0f0-4000-8000-000000000401', null,
   '00000000-f0f0-4000-8000-00000000041b', 1, 'Halters and lead to paddocks', null, 13),
  ('00000000-f0f0-4000-8000-00000000041f', '00000000-f0f0-4000-8000-000000000401', null, null, 0,
   'Waters and aisle', null, 14),
  ('00000000-f0f0-4000-8000-000000000420', '00000000-f0f0-4000-8000-000000000401', null,
   '00000000-f0f0-4000-8000-00000000041f', 1, 'Dump and refill stall waters', null, 15),
  ('00000000-f0f0-4000-8000-000000000421', '00000000-f0f0-4000-8000-000000000401', null,
   '00000000-f0f0-4000-8000-00000000041f', 1, 'Sweep aisle and take trash', null, 16),

  -- PM
  ('00000000-f0f0-4000-8000-000000000431', '00000000-f0f0-4000-8000-000000000402', null, null, 0,
   'Bring horses in', 'Same group order as morning, reversed.', 0),
  ('00000000-f0f0-4000-8000-000000000432', '00000000-f0f0-4000-8000-000000000402', null,
   '00000000-f0f0-4000-8000-000000000431', 1, 'Fly masks off, hang on the hook', null, 1),
  ('00000000-f0f0-4000-8000-000000000433', '00000000-f0f0-4000-8000-000000000402', null,
   '00000000-f0f0-4000-8000-000000000431', 1, 'Quick legs-and-eyes check', null, 2),
  ('00000000-f0f0-4000-8000-000000000434', '00000000-f0f0-4000-8000-000000000402', null, null, 0,
   'Evening grain and hay', 'Marmalade gets her mash last.', 3),
  ('00000000-f0f0-4000-8000-000000000435', '00000000-f0f0-4000-8000-000000000402', null,
   '00000000-f0f0-4000-8000-000000000434', 1, 'Mix from the board again', null, 4),
  ('00000000-f0f0-4000-8000-000000000436', '00000000-f0f0-4000-8000-000000000402', null, null, 0,
   'Close up', null, 5),
  ('00000000-f0f0-4000-8000-000000000437', '00000000-f0f0-4000-8000-000000000402', null,
   '00000000-f0f0-4000-8000-000000000436', 1, 'Lights off, north door latched', null, 6),
  ('00000000-f0f0-4000-8000-000000000438', '00000000-f0f0-4000-8000-000000000402', null,
   '00000000-f0f0-4000-8000-000000000436', 1, 'Radio on the charger', null, 7),

  -- Weekend
  ('00000000-f0f0-4000-8000-000000000441', '00000000-f0f0-4000-8000-000000000403', null, null, 0,
   'Deep clean on Saturdays', 'Skip if Gymkhana is that morning.', 0),
  ('00000000-f0f0-4000-8000-000000000442', '00000000-f0f0-4000-8000-000000000403', null,
   '00000000-f0f0-4000-8000-000000000441', 1, 'Blow / sweep the barn', null, 1),
  ('00000000-f0f0-4000-8000-000000000443', '00000000-f0f0-4000-8000-000000000403', null,
   '00000000-f0f0-4000-8000-000000000441', 1, 'Replace fly traps', null, 2),
  ('00000000-f0f0-4000-8000-000000000444', '00000000-f0f0-4000-8000-000000000403', null, null, 0,
   'Arena tidy', null, 3),
  ('00000000-f0f0-4000-8000-000000000445', '00000000-f0f0-4000-8000-000000000403', null,
   '00000000-f0f0-4000-8000-000000000444', 1, 'Pick manure, stack standards', null, 4);
