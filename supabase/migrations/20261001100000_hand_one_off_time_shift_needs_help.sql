-- Hand one-off shifts: structured time, optional link to an existing shift,
-- a "Needs Help" flag, and an optional title.
--
-- A one-off's "when" used to be free text (event_time, e.g. "8am"). It's
-- now one of two things, picked in the form:
--   * start_time    -- a real time from a native time picker, or
--   * shift_type_id -- one of that weekday's existing shifts ("AM", "PM"),
--                      in which case the one-off shows inside that shift's
--                      group on the calendar instead of as its own entry.
-- Never both (check constraint below). The form requires one of them on
-- every save; legacy rows (see backfill) have neither until next edited.
--
-- title is now optional: a one-off can be just "5 PM" or just sit inside
-- the AM shift with its hands listed.
--
-- needs_help marks an unstaffed one-off: it shows as "OPEN SHIFT" instead
-- of hand names. Either/or with assigned hands -- the app clears
-- hand_shift_event_members when needs_help is saved as true.
alter table public.hand_shift_events
  add column start_time time,
  add column shift_type_id uuid references public.hand_shift_types (id) on delete restrict,
  add column needs_help boolean not null default false;

alter table public.hand_shift_events
  alter column title drop not null;

alter table public.hand_shift_events
  add constraint hand_shift_events_time_or_shift
  check (start_time is null or shift_type_id is null);

-- Legacy free-text times can't be parsed reliably ("8am", "after lunch",
-- "10-ish"), so they move into the title verbatim, e.g. "Gymkhana · 8am",
-- rather than being guessed at. event_time is kept (nullable, no longer
-- read or written by the app -- same precedent as head.tag_id) so a
-- frontend still on the old build during deploy doesn't break.
alter table public.hand_shift_events
  alter column event_time drop not null;

update public.hand_shift_events
set title = title || ' · ' || btrim(event_time),
    event_time = null
where btrim(coalesce(event_time, '')) <> '';

-- ---------------------------------------------------------------------------
-- Save a one-off and its hands in one transaction. Editing used to update
-- the event, delete every member, then re-insert -- a dropped connection
-- after the delete left a member-less, non-Needs-Help event that renders
-- nowhere and can't be reached to fix or delete. Adding had a client-side
-- cleanup for the same case. Both now go through this function, so a save
-- either fully lands or changes nothing.
--
-- p_event_id null = add (returns the new id), otherwise edit. Needs Help
-- always saves with no members. security invoker -- managers-only RLS on
-- both tables is the authorization, same as save_turnout_schedule_for_head.
-- Do not change it to security definer.
-- ---------------------------------------------------------------------------
create or replace function public.save_hand_shift_event(
  p_event_id uuid,
  p_title text,
  p_event_date date,
  p_start_time time,
  p_shift_type_id uuid,
  p_needs_help boolean,
  p_notes text,
  p_member_ids uuid[],
  p_updated_by uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event_id uuid := p_event_id;
  v_member_ids uuid[] := case when coalesce(p_needs_help, false) then '{}'::uuid[]
                              else coalesce(p_member_ids, '{}'::uuid[]) end;
begin
  if p_event_date is null then
    raise exception 'A date is required';
  end if;
  if p_start_time is null and p_shift_type_id is null then
    raise exception 'Pick a time or a shift';
  end if;
  if not coalesce(p_needs_help, false) and cardinality(v_member_ids) = 0 then
    raise exception 'Select at least one hand, or check Needs Help';
  end if;

  if v_event_id is null then
    insert into public.hand_shift_events
      (title, event_date, start_time, shift_type_id, needs_help, notes, updated_by)
    values
      (nullif(btrim(p_title), ''), p_event_date, p_start_time, p_shift_type_id,
       coalesce(p_needs_help, false), nullif(btrim(p_notes), ''), coalesce(p_updated_by, auth.uid()))
    returning id into v_event_id;
  else
    update public.hand_shift_events
    set title = nullif(btrim(p_title), ''),
        event_date = p_event_date,
        start_time = p_start_time,
        shift_type_id = p_shift_type_id,
        needs_help = coalesce(p_needs_help, false),
        notes = nullif(btrim(p_notes), ''),
        updated_by = coalesce(p_updated_by, auth.uid()),
        updated_at = now()
    where id = v_event_id;
    if not found then
      raise exception 'That one-off no longer exists';
    end if;

    delete from public.hand_shift_event_members where event_id = v_event_id;
  end if;

  insert into public.hand_shift_event_members (event_id, profile_id)
  select v_event_id, m from (select distinct unnest(v_member_ids) as m) members;

  return v_event_id;
end;
$$;

comment on function public.save_hand_shift_event(uuid, text, date, time, uuid, boolean, text, uuid[], uuid) is
  'Atomically adds or edits one Hand one-off and replaces its members. security invoker — managers-only RLS is the authorization.';

revoke execute on function public.save_hand_shift_event(uuid, text, date, time, uuid, boolean, text, uuid[], uuid) from anon;
revoke execute on function public.save_hand_shift_event(uuid, text, date, time, uuid, boolean, text, uuid[], uuid) from public;
grant execute on function public.save_hand_shift_event(uuid, text, date, time, uuid, boolean, text, uuid[], uuid) to authenticated;
