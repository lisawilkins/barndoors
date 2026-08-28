-- Add an "admin" role: identical app permissions to "manager", but a
-- separate category for technology admin vs. barn manager (e.g. so a report
-- or people list can tell the two apart even though they can both do
-- everything a manager can). See AGENTS.md "Roles & permissions".

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('manager', 'hand', 'admin'));

-- is_manager() is the single gate every RLS write policy (and both storage
-- bucket policies) already calls, so widening it here is enough to give
-- admin full manager-equivalent access everywhere without touching another
-- policy.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('manager', 'admin')
  );
$$;

-- Recategorize the existing account per the project owner: technology admin,
-- not barn manager.
update public.profiles set role = 'admin'
where role = 'manager' and email = 'lisa@lisawilkins.com';
