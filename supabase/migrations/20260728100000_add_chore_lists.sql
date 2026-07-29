-- Chore lists — saved, ordered, nested chore procedures.
--
-- Replaces the flat `chores` / `chore_types` model (assignment + recurrence) with
-- named, savable lists that mirror how the barn manager actually writes chores:
-- an ordered procedure. See barndoors-schema.md Part 2.
--
--   chore_lists     "Summer", "Grooming", "Maintenance" — several active at once
--     chore_sections  "AM Barn Chores", "PM Barn Chores", "General Notes"
--       chore_items     depth 0 = numbered chore group
--                       depth 1 = step
--                       depth 2 = sub-detail
--
-- `chores` and `chore_types` are intentionally left in place — the app stops
-- reading them, but dropping them is a destructive change that gets flagged and
-- confirmed separately (AGENTS.md, "Conventions").

-- ---------------------------------------------------------------------------
-- chore_lists — one saved list
-- ---------------------------------------------------------------------------
create table public.chore_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

comment on table public.chore_lists is
  'A saved chore list, e.g. Summer or Grooming. Several may be active at once; the app shows active lists as tabs.';
comment on column public.chore_lists.sort_order is 'Tab order on the Chores screen.';

create index chore_lists_sort_order_idx on public.chore_lists (sort_order);

select public.apply_standard_policies('public.chore_lists');

-- ---------------------------------------------------------------------------
-- chore_sections — level 1 ("AM Barn Chores")
--
-- Deliberately a free-text title rather than an AM/PM enum: a Grooming or
-- Maintenance list doesn't split by shift, and the Summer list also has a
-- trailing "General Notes" section that isn't a shift either.
-- ---------------------------------------------------------------------------
create table public.chore_sections (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.chore_lists (id) on delete cascade,
  title text not null,
  intro text,
  numbered boolean not null default true,
  sort_order integer not null default 0
);

comment on column public.chore_sections.intro is
  'Optional lead-in paragraph, e.g. "Follow this order to ensure horses are moved in the correct order."';
comment on column public.chore_sections.numbered is
  'true = top-level items render as 1., 2., 3. false = plain bullets (used for "General Notes").';

create index chore_sections_list_idx on public.chore_sections (list_id, sort_order);

select public.apply_standard_policies('public.chore_sections');

-- ---------------------------------------------------------------------------
-- chore_items — levels 2, 3 and 4, self-referencing
--
-- The displayed number of a top-level item is NOT stored. It's derived from
-- sort_order at render time, so inserting or reordering renumbers automatically
-- and the numbers can never drift out of sync with the actual order.
-- ---------------------------------------------------------------------------
create table public.chore_items (
  id uuid primary key default gen_random_uuid(),
  -- Denormalized from parent_id so a whole section loads in one query.
  section_id uuid not null references public.chore_sections (id) on delete cascade,
  parent_id uuid references public.chore_items (id) on delete cascade,
  depth smallint not null default 0 check (depth between 0 and 2),
  body text not null,
  note text,
  sort_order integer not null default 0,
  -- Depth and parentage have to agree: only a depth-0 item may be parentless.
  constraint chore_items_depth_matches_parent check (
    (depth = 0 and parent_id is null) or (depth > 0 and parent_id is not null)
  )
);

comment on column public.chore_items.depth is
  '0 = numbered chore group, 1 = step, 2 = sub-detail.';
comment on column public.chore_items.note is
  'Optional NOTE callout shown under the item, e.g. "While graining, look over horses for lameness."';
comment on column public.chore_items.sort_order is
  'Document-order position within the section. Only compared between siblings, so a single increasing counter across the whole section orders every level correctly.';

create index chore_items_section_idx on public.chore_items (section_id, parent_id, sort_order);

select public.apply_standard_policies('public.chore_items');

-- ---------------------------------------------------------------------------
-- save_chore_section_items — replace a section's outline in one transaction.
--
-- The editor holds the whole outline in memory and saves it as a unit. Writing
-- it row-by-row from the browser would leave a half-applied tree if any single
-- request failed; one function call is atomic.
--
-- security INVOKER (the default) on purpose: RLS still applies, so the existing
-- managers-only write policies on chore_items are what authorize this. Do not
-- change it to security definer — that would let hands rewrite chore lists.
--
-- p_items is a JSON array, in display order, of:
--   { "key": "<client id>", "parent_key": "<client id or null>",
--     "depth": 0-2, "body": "...", "note": "..." }
-- Client-generated keys let the caller describe parent/child links before the
-- rows have database ids; they are mapped to real uuids as rows are inserted.
-- ---------------------------------------------------------------------------
create or replace function public.save_chore_section_items(
  p_section_id uuid,
  p_items jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  -- v_ prefixes on purpose: a plpgsql variable sharing a name with a column of
  -- a table in the statement (parent_id, depth, note...) is an ambiguity error
  -- at runtime, not at CREATE FUNCTION time.
  v_item jsonb;
  v_key_map jsonb := '{}'::jsonb;
  v_new_id uuid;
  v_parent_key text;
  v_parent_id uuid;
  v_depth smallint;
  v_position integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array';
  end if;

  -- Fails under RLS for a hand: no delete policy match, and the section itself
  -- isn't visible to write. Managers pass.
  delete from public.chore_items where section_id = p_section_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_depth := coalesce((v_item ->> 'depth')::smallint, 0);
    v_parent_key := v_item ->> 'parent_key';

    if v_depth = 0 or v_parent_key is null then
      v_depth := 0;
      v_parent_id := null;
    else
      v_parent_id := (v_key_map ->> v_parent_key)::uuid;
      if v_parent_id is null then
        raise exception 'Unknown parent_key "%" — parents must appear before their children', v_parent_key;
      end if;
    end if;

    insert into public.chore_items (section_id, parent_id, depth, body, note, sort_order)
    values (
      p_section_id,
      v_parent_id,
      v_depth,
      coalesce(v_item ->> 'body', ''),
      nullif(btrim(coalesce(v_item ->> 'note', '')), ''),
      v_position
    )
    returning id into v_new_id;

    v_key_map := v_key_map || jsonb_build_object(v_item ->> 'key', v_new_id::text);
    v_position := v_position + 1;
  end loop;

  update public.chore_lists
  set updated_at = now(), updated_by = auth.uid()
  where id = (select list_id from public.chore_sections where id = p_section_id);
end;
$$;

comment on function public.save_chore_section_items(uuid, jsonb) is
  'Atomically replaces one chore section''s items. security invoker — managers-only RLS on chore_items is the authorization.';

-- Postgres grants EXECUTE on a new function to PUBLIC by default, which would
-- let the `anon` (not-signed-in) role call this. RLS already makes that a
-- complete no-op — anon matches none of the `to authenticated` policies, so
-- every statement in the function affects zero rows — but closing the outer
-- door means a future mistake in the policies wouldn't be reachable without a
-- session. Belt and braces; RLS is still the load-bearing check.
--
-- Note this does NOT restrict hands: a hand is `authenticated` the same as a
-- manager as far as Postgres is concerned. There's no Postgres-level manager
-- role to grant to — manager lives in profiles.role, and RLS is the only layer
-- that knows the difference. Reading chore lists is unaffected either way; that
-- goes straight to the tables under the select policy, not through this
-- function.
revoke execute on function public.save_chore_section_items(uuid, jsonb) from public;
grant execute on function public.save_chore_section_items(uuid, jsonb) to authenticated;
