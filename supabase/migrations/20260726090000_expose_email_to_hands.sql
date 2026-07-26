-- Product change: hands can now see everyone's email address on the Hands
-- roster (so they can tap it to send an email, same as phone-to-call). This
-- reverses part of the restriction added in
-- 20260721100000_decouple_hand_profiles_from_auth.sql — that migration hid
-- email for every row once hand logins became shared, since there was no
-- longer an "own profile" self-match to key off of. `emergency_contact`
-- stays hidden from hands; only `email` is now exposed.
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
    p.email,
    null::text as emergency_contact
  from public.profiles p;
$$;
