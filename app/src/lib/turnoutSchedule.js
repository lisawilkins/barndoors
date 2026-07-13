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

function daysKey(days) {
  return sortDays(days).join(',')
}

function memberKey(ids) {
  return [...ids].sort().join(',')
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
  const { error: removeError } = await supabase
    .from('turnout_group_members')
    .delete()
    .eq('head_id', headId)

  if (removeError) return removeError

  const validRows = rows.filter((row) => row.location_id && row.days.length > 0)

  for (const row of validRows) {
    const sortedDays = sortDays(row.days)
    const memberIds = [...new Set([headId, ...row.buddy_ids])]

    const { data: candidateGroups, error: groupsError } = await supabase
      .from('turnout_groups')
      .select('id, days_of_week, turnout_group_members ( head_id )')
      .eq('location_id', row.location_id)

    if (groupsError) return groupsError

    const targetDayKey = daysKey(sortedDays)
    const targetMemberKey = memberKey(memberIds)

    let group = candidateGroups?.find((candidate) => {
      const candidateDays = daysKey(candidate.days_of_week ?? [])
      const candidateMembers = memberKey(
        (candidate.turnout_group_members ?? []).map((member) => member.head_id),
      )
      return candidateDays === targetDayKey && candidateMembers === targetMemberKey
    })

    if (!group) {
      const { data: newGroup, error: insertError } = await supabase
        .from('turnout_groups')
        .insert({
          location_id: row.location_id,
          days_of_week: sortedDays,
          updated_by: profileId,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insertError) return insertError
      group = newGroup

      const { error: membersError } = await supabase.from('turnout_group_members').insert(
        memberIds.map((memberId) => ({ group_id: group.id, head_id: memberId })),
      )

      if (membersError) return membersError
    } else {
      for (const memberId of memberIds) {
        const { error: memberError } = await supabase.from('turnout_group_members').upsert(
          { group_id: group.id, head_id: memberId },
          { onConflict: 'group_id,head_id' },
        )
        if (memberError) return memberError
      }
    }
  }

  return null
}
