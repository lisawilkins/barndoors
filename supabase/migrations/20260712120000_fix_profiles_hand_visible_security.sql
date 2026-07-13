-- Fixes a Supabase Security Advisor error: "profiles_hand_visible" was a plain
-- view, which defaults to running with the view owner's privileges (bypassing
-- RLS on `profiles` entirely) — the advisor flags this because it's an easy way
-- to accidentally leak data.
--
-- That bypass was actually intentional here: hands only have row-level access to
-- their *own* profiles row (see the "profiles_select" policy), so a plain,
-- RLS-respecting ("security_invoker") view would let a hand see only themselves,
-- defeating the roster feature. The column-level masking (nulling
-- email/emergency_contact for anyone but the caller) was always the real
-- protection, not the row-level bypass itself.
--
-- Fix: replace the view with an explicit SECURITY DEFINER function. Functions
-- are the sanctioned way to intentionally scope a controlled RLS bypass — the
-- advisor only flags views, not definer functions — and the behavior is
-- otherwise identical.

drop view if exists public.profiles_hand_visible;

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
    case when p.id = auth.uid() then p.email else null end as email,
    case when p.id = auth.uid() then p.emergency_contact else null end as emergency_contact
  from public.profiles p;
$$;

grant execute on function public.profiles_hand_visible() to authenticated;
