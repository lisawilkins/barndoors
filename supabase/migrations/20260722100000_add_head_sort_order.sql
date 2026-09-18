-- Manager-controlled display order for the Herd list (drag-and-drop reorder).
-- Existing rows are backfilled in their current alphabetical order so the
-- list doesn't visibly jump the first time this ships. New rows default to
-- "append at the end" via a sequence, so newly added animals show up last
-- until a manager drags them elsewhere.

alter table public.head add column sort_order integer;

with ordered as (
  select id, row_number() over (order by name asc nulls last, id asc) as rn
  from public.head
)
update public.head
set sort_order = ordered.rn
from ordered
where public.head.id = ordered.id;

alter table public.head alter column sort_order set not null;

create sequence if not exists public.head_sort_order_seq;
-- Sequences reject 0 (minvalue is 1). An empty `head` table — local
-- `supabase start` / `db reset` with no live barn rows — made
-- coalesce(max, 0) fail. Keep nextval at max+1 when rows exist; on an
-- empty table is_called=false so the first animal still gets 1.
select setval(
  'public.head_sort_order_seq',
  coalesce((select max(sort_order) from public.head), 1),
  exists (select 1 from public.head)
);
alter table public.head alter column sort_order set default nextval('public.head_sort_order_seq');

create index head_sort_order_idx on public.head (sort_order);
