-- Server-side enforcement of the isSchedulable() rule (see
-- app/src/lib/handSchedule.js): only 'hand' and 'admin' profiles can be
-- referenced by a Hand Scheduling row. Previously enforced only in app
-- code — nothing at the database layer stopped a direct API call, or a
-- future UI bug that bypassed isSchedulable(), from writing a standing
-- shift, vacation, or one-off event membership against a manager's own
-- profile. Not SECURITY DEFINER: only managers/admins can reach these
-- inserts/updates at all (apply_standard_policies' insert/update_managers_only
-- policies), and profiles_select already lets a manager/admin SELECT any
-- profile row, so the function's own SELECT works under ordinary RLS.
create or replace function public.assert_profile_is_schedulable()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  profile_role text;
begin
  select role into profile_role from public.profiles where id = new.profile_id;
  if profile_role is null or profile_role not in ('hand', 'admin') then
    raise exception 'profile % is not schedulable (role = %)', new.profile_id, profile_role;
  end if;
  return new;
end;
$$;

create trigger hand_recurring_shifts_profile_schedulable
  before insert or update of profile_id on public.hand_recurring_shifts
  for each row execute function public.assert_profile_is_schedulable();

create trigger hand_vacations_profile_schedulable
  before insert or update of profile_id on public.hand_vacations
  for each row execute function public.assert_profile_is_schedulable();

create trigger hand_shift_event_members_profile_schedulable
  before insert or update of profile_id on public.hand_shift_event_members
  for each row execute function public.assert_profile_is_schedulable();
