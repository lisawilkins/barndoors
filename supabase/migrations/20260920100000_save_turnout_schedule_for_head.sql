-- Turnout save used to delete this animal from every group, then look for a
-- matching group (location + days + exact member set). The animal was already
-- gone, so the match never succeeded: every Herd Save created a duplicate
-- group, buddy horses grew extra rows, and empty leftovers piled up. A dropped
-- connection after the delete could also wipe the animal's turnout entirely.
--
-- This RPC does the lookup *before* removing any memberships, drops only
-- memberships the new form state doesn't keep, and runs as one transaction
-- (security invoker — managers-only RLS on the two tables is the authorization,
-- same as save_chore_list_items). Do not change it to security definer.

create or replace function public.save_turnout_schedule_for_head(
  p_head_id uuid,
  p_rows jsonb,
  p_updated_by uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_weekdays text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  v_row jsonb;
  v_location_id uuid;
  v_days text[];
  v_buddy_ids uuid[];
  v_member_ids uuid[];
  v_group_id uuid;
  v_keep_ids uuid[] := '{}';
  v_drop_ids uuid[];
  v_updated_by uuid;
  v_now timestamptz := now();
begin
  if p_head_id is null then
    raise exception 'p_head_id is required';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  v_updated_by := coalesce(p_updated_by, auth.uid());

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_group_id := null;

    if jsonb_typeof(v_row) <> 'object' then
      continue;
    end if;

    v_location_id := nullif(v_row ->> 'location_id', '')::uuid;

    if jsonb_typeof(coalesce(v_row -> 'days', '[]'::jsonb)) <> 'array' then
      continue;
    end if;

    select coalesce(
      array_agg(d order by array_position(v_weekdays, d)),
      '{}'::text[]
    )
    into v_days
    from (
      select distinct d
      from jsonb_array_elements_text(coalesce(v_row -> 'days', '[]'::jsonb)) as d
      where d = any (v_weekdays)
    ) unique_days;

    if v_location_id is null or v_days = '{}'::text[] then
      continue;
    end if;

    if jsonb_typeof(coalesce(v_row -> 'buddy_ids', '[]'::jsonb)) <> 'array' then
      v_buddy_ids := '{}'::uuid[];
    else
      select coalesce(array_agg(distinct x::uuid), '{}'::uuid[])
      into v_buddy_ids
      from jsonb_array_elements_text(coalesce(v_row -> 'buddy_ids', '[]'::jsonb)) as x
      where x is not null and x <> '';
    end if;

    select coalesce(array_agg(m order by m), array[p_head_id])
    into v_member_ids
    from (
      select distinct m
      from unnest(array[p_head_id] || v_buddy_ids) as m
    ) unique_members;

    select g.id
    into v_group_id
    from public.turnout_groups g
    where g.location_id = v_location_id
      and (
        select coalesce(array_agg(d order by array_position(v_weekdays, d)), '{}'::text[])
        from unnest(g.days_of_week) d
        where d = any (v_weekdays)
      ) = v_days
      and (
        select coalesce(array_agg(m.head_id order by m.head_id), '{}'::uuid[])
        from public.turnout_group_members m
        where m.group_id = g.id
      ) = v_member_ids
    order by g.created_at, g.id
    limit 1;

    if v_group_id is null then
      insert into public.turnout_groups (
        location_id,
        days_of_week,
        updated_by,
        updated_at
      )
      values (
        v_location_id,
        v_days,
        v_updated_by,
        v_now
      )
      returning id into v_group_id;

      insert into public.turnout_group_members (group_id, head_id)
      select v_group_id, m
      from unnest(v_member_ids) as m;
    end if;

    v_keep_ids := array_append(v_keep_ids, v_group_id);
  end loop;

  select coalesce(array_agg(group_id), '{}'::uuid[])
  into v_drop_ids
  from public.turnout_group_members
  where head_id = p_head_id
    and not (group_id = any (v_keep_ids));

  delete from public.turnout_group_members
  where head_id = p_head_id
    and group_id = any (v_drop_ids);

  -- Last member left this group as a result of this save — don't leave an
  -- empty leftover behind. Historical empties are cleaned below.
  delete from public.turnout_groups g
  where g.id = any (v_drop_ids)
    and not exists (
      select 1 from public.turnout_group_members m where m.group_id = g.id
    );
end;
$$;

comment on function public.save_turnout_schedule_for_head(uuid, jsonb, uuid) is
  'Atomically saves one animal''s turnout rows. Matches an existing group (location + days + exact members) before removing any memberships. security invoker — managers-only RLS is the authorization.';

revoke execute on function public.save_turnout_schedule_for_head(uuid, jsonb, uuid) from anon;
revoke execute on function public.save_turnout_schedule_for_head(uuid, jsonb, uuid) from public;
grant execute on function public.save_turnout_schedule_for_head(uuid, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- One-time leftover cleanup from the old delete-then-match save path.
-- Idempotent: a second run affects 0 rows.
-- Counted on the linked project (SELECT only, 2026-09-17): 70 groups, 11
-- memberships, 61 empty groups, 4 proper-subset leftovers (Dundee/Raven and
-- Ranger/Rojo each showing Side paddock twice). Not executed against that
-- live database from the machine that added this file — it runs when this
-- migration is applied.
-- ---------------------------------------------------------------------------

-- 1. Empty groups left after the animal was removed and a duplicate created.
delete from public.turnout_groups g
where not exists (
  select 1 from public.turnout_group_members m where m.group_id = g.id
);

-- 2. Identical copies of the same arrangement (same location, days, members).
--    Keep the oldest row. Empty groups are already gone from step 1.
with normalized as (
  select
    g.id,
    g.location_id,
    g.created_at,
    (
      select coalesce(array_agg(d order by d), '{}'::text[])
      from unnest(g.days_of_week) d
    ) as days_sorted,
    (
      select coalesce(array_agg(m.head_id order by m.head_id), '{}'::uuid[])
      from public.turnout_group_members m
      where m.group_id = g.id
    ) as members_sorted
  from public.turnout_groups g
),
ranked as (
  select
    id,
    row_number() over (
      partition by location_id, days_sorted, members_sorted
      order by created_at, id
    ) as rn
  from normalized
)
delete from public.turnout_groups
where id in (select id from ranked where rn > 1);

-- 3. Proper-subset leftovers at the same location and days — e.g. Dundee-only
--    and Raven-only rows left behind after a Dundee+Raven group was created.
--    The animals stay in the larger group. Solo animals with no larger match
--    (no buddy group at the same location and days) are kept.
with normalized as (
  select
    g.id,
    g.location_id,
    (
      select coalesce(array_agg(d order by d), '{}'::text[])
      from unnest(g.days_of_week) d
    ) as days_sorted,
    (
      select coalesce(array_agg(m.head_id order by m.head_id), '{}'::uuid[])
      from public.turnout_group_members m
      where m.group_id = g.id
    ) as members_sorted
  from public.turnout_groups g
)
delete from public.turnout_groups g
using normalized child, normalized parent
where g.id = child.id
  and parent.id <> child.id
  and parent.location_id = child.location_id
  and parent.days_sorted = child.days_sorted
  and cardinality(child.members_sorted) > 0
  and child.members_sorted <@ parent.members_sorted
  and cardinality(parent.members_sorted) > cardinality(child.members_sorted);
