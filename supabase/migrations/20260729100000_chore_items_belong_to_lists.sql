-- Chore items hang directly off a list.
--
-- The redesign (Claude Design project "Barndoors Chores Redesign") settles the
-- structure at four levels with no section layer:
--
--   List        level 0 — title, description, items[]   "AM Chores"
--     Item        level 1 — text, note, subitems[]        "Initial Barn Check"
--       Subitem     level 2 — text, note, subsubitems[]     "Turn on lights…"
--         SubSubItem  level 3 — text only, nesting stops     "Fly mask on"
--
-- chore_items previously required a chore_sections parent. This adds a direct
-- list_id instead. Deliberately additive: chore_sections is left in place and
-- section_id merely becomes nullable, so nothing is dropped and this is
-- reversible. If sections turn out to be genuinely unused later, removing them
-- is a separate, flagged decision.
--
-- Depth mapping: the design's levels 1/2/3 are stored as depth 0/1/2, which the
-- existing `check (depth between 0 and 2)` constraint already covers.

alter table public.chore_items
  add column list_id uuid references public.chore_lists (id) on delete cascade;

alter table public.chore_items
  alter column section_id drop not null;

-- Every row belongs to exactly one parent — a list (new) or a section (old).
alter table public.chore_items
  add constraint chore_items_has_one_owner check (
    (list_id is not null and section_id is null)
    or (list_id is null and section_id is not null)
  );

create index chore_items_list_idx on public.chore_items (list_id, parent_id, sort_order);

comment on column public.chore_items.list_id is
  'The list this row belongs to. Levels: depth 0 = Item, 1 = Subitem, 2 = SubSubItem.';
comment on column public.chore_items.note is
  'Optional note. Design allows a note on Items and Subitems only — never on a SubSubItem (depth 2).';

-- ---------------------------------------------------------------------------
-- save_chore_list_items — replace a list's outline in one transaction.
--
-- Same contract as save_chore_section_items, keyed on the list instead. The
-- editor holds the whole outline in memory and saves it as a unit; writing it
-- row-by-row from the browser would leave a half-applied tree if one request
-- failed.
--
-- security INVOKER (the default) on purpose: RLS still applies, so the existing
-- managers-only write policies on chore_items are what authorize this. Do not
-- change it to security definer — that would let hands rewrite chore lists.
--
-- p_items is a JSON array in display order of:
--   { "key": "<client id>", "parent_key": "<client id or null>",
--     "depth": 0-2, "body": "...", "note": "..." }
-- ---------------------------------------------------------------------------
create or replace function public.save_chore_list_items(
  p_list_id uuid,
  p_items jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  -- v_ prefixes on purpose: a plpgsql variable sharing a name with a column of
  -- a table in the statement is an ambiguity error at runtime.
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

  -- Matches zero rows under RLS for a hand, so a non-manager call is a no-op
  -- rather than data loss. Inserts below then fail outright.
  delete from public.chore_items where list_id = p_list_id;

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

    insert into public.chore_items (list_id, section_id, parent_id, depth, body, note, sort_order)
    values (
      p_list_id,
      null,
      v_parent_id,
      v_depth,
      coalesce(v_item ->> 'body', ''),
      -- Only Items and Subitems carry a note; a SubSubItem never does.
      case when v_depth >= 2 then null
           else nullif(btrim(coalesce(v_item ->> 'note', '')), '') end,
      v_position
    )
    returning id into v_new_id;

    v_key_map := v_key_map || jsonb_build_object(v_item ->> 'key', v_new_id::text);
    v_position := v_position + 1;
  end loop;

  update public.chore_lists
  set updated_at = now(), updated_by = auth.uid()
  where id = p_list_id;
end;
$$;

comment on function public.save_chore_list_items(uuid, jsonb) is
  'Atomically replaces one chore list''s items. security invoker — managers-only RLS on chore_items is the authorization.';

-- Postgres grants EXECUTE on a new function to PUBLIC by default, and Supabase's
-- ALTER DEFAULT PRIVILEGES additionally grants it to anon *by name* — so both
-- have to be revoked for the grant below to actually narrow anything. RLS is
-- still the load-bearing check; this is defence in depth.
revoke execute on function public.save_chore_list_items(uuid, jsonb) from anon;
revoke execute on function public.save_chore_list_items(uuid, jsonb) from public;
grant execute on function public.save_chore_list_items(uuid, jsonb) to authenticated;
