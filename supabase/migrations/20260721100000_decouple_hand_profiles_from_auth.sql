-- Decouple hand "person" records from Supabase Auth accounts.
--
-- Product change: hands no longer get individual login accounts. Everyone now
-- signs in as either an individual manager (email + password, unchanged) or
-- a single shared "Hand" account (one universal password) — see AGENTS.md
-- "Auth" section.
--
-- profiles.id previously had to equal a live auth.users.id, via
-- `references auth.users (id) on delete cascade`. That made it unsafe to
-- delete a hand's auth account while keeping their person record: deleting
-- the auth user would cascade-delete their profiles row, which would in turn
-- cascade-delete their shift history (shifts.profile_id is also
-- `on delete cascade`) or be blocked outright by other FKs that reference
-- profiles(id) with no cascade at all (chores.assigned_to,
-- head_records.recorded_by, head_photos.uploaded_by,
-- head_feed_plan.updated_by, turnout_groups.updated_by). None of that is
-- viable now that hand auth accounts are going away while their person
-- records (name, phone, emergency contact, photo, shift schedule, chore
-- assignments) need to stick around for managers to keep using.
--
-- Manager rows are unaffected in practice — a manager's profiles.id still
-- equals their real auth.users.id (set by the handle_new_user trigger), it
-- just isn't *enforced* by a foreign key anymore. Hand person records can now
-- be created directly by a manager (a plain profiles insert) with no
-- auth.users row behind them at all.

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  alter column id set default gen_random_uuid();

comment on table public.profiles is
  'Managers (id matches the auth.users.id they sign in with) and hands (plain '
  'directory records for shift/chore assignment — no login account required; '
  'everyone signs in as a hand via one shared account). See AGENTS.md "Auth".';

-- There's no more "own profile" concept once hand logins are shared — a hand
-- session can never correspond to one specific named hand, so the previous
-- `case when p.id = auth.uid() ...` self-match no longer serves its purpose
-- (auth.uid() is always the one shared hand account, which never matches a
-- real person's row). Always hide these two restricted fields from the
-- hand-facing function; managers still see everything via the base table.
create or replace function public.profiles_hand_visible()
returns table (
  id uuid,
  role text,
  name text,
  photo_url text,
  phone text,
  status text,
  created_at timestamptz,
  email text,
  emergency_contact text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.role,
    p.name,
    p.photo_url,
    p.phone,
    p.status,
    p.created_at,
    null::text as email,
    null::text as emergency_contact
  from public.profiles p;
$$;
