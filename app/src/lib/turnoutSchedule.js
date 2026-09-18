const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const WEEKDAYS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
]

export function sortDays(days) {
  return [...days].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b))
}

export function formatDays(days) {
  const labels = Object.fromEntries(WEEKDAYS.map((day) => [day.value, day.label]))
  return sortDays(days ?? [])
    .map((day) => labels[day] ?? day)
    .join(', ')
}

export function blankTurnoutRow() {
  return {
    key: crypto.randomUUID(),
    groupId: null,
    location_id: '',
    days: [],
    buddy_ids: [],
  }
}

export async function loadTurnoutRowsForHead(supabase, headId) {
  const { data, error } = await supabase
    .from('turnout_group_members')
    .select(
      'group_id, turnout_groups ( id, location_id, days_of_week, turnout_group_members ( head_id ) )',
    )
    .eq('head_id', headId)

  if (error) return { error, rows: [] }

  const rows = (data ?? []).map((membership) => {
    const group = membership.turnout_groups
    const buddyIds = (group.turnout_group_members ?? [])
      .map((member) => member.head_id)
      .filter((memberId) => memberId !== headId)

    return {
      key: group.id,
      groupId: group.id,
      location_id: group.location_id,
      days: group.days_of_week ?? [],
      buddy_ids: buddyIds,
    }
  })

  return { rows, error: null }
}

export async function saveTurnoutScheduleForHead(supabase, headId, rows, profileId) {
  // Match-then-drop, in one transaction (save_turnout_schedule_for_head). The
  // old path deleted this animal from every group *before* looking for a match,
  // so the match never succeeded and every Save created a duplicate group.
  const validRows = rows
    .filter((row) => row.location_id && row.days.length > 0)
    .map((row) => ({
      location_id: row.location_id,
      days: sortDays(row.days),
      buddy_ids: [...new Set(row.buddy_ids)],
    }))

  const { error } = await supabase.rpc('save_turnout_schedule_for_head', {
    p_head_id: headId,
    p_rows: validRows,
    p_updated_by: profileId,
  })

  return error ?? null
}
