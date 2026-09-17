import { isoDate, weekdayKey, startOfWeek, dateFromIso, daysSinceEpoch } from './calendarSchedule'

function weekIndex(date) {
  return Math.floor(daysSinceEpoch(startOfWeek(date)) / 7)
}

// Minutes since midnight for a free-text event time like "8am", "10:30am",
// "2:15pm" — null if it doesn't match one of those shapes, so callers can
// fall back to a plain string comparison rather than breaking on unusual
// input (event_time is free text, not a validated time field).
function parseEventTimeMinutes(text) {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec((text ?? '').trim())
  if (!match) return null
  let hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  const meridiem = match[3]?.toLowerCase()
  if (meridiem === 'pm' && hours < 12) hours += 12
  if (meridiem === 'am' && hours === 12) hours = 0
  return hours * 60 + minutes
}

// True if a recurring row's cadence includes `date`. Non-biweekly rows
// always occur (the caller has already matched day-of-week). A biweekly row
// occurs every other calendar week (Sun-Sat), counting from the week that
// contains biweekly_start_date — and not at all before that date, since
// "Beginning on" means the pattern hasn't started yet.
function occursOnCadence(row, date) {
  if (!row.biweekly) return true
  if (!row.biweekly_start_date) return true
  if (isoDate(date) < row.biweekly_start_date) return false
  const weeksElapsed = weekIndex(date) - weekIndex(dateFromIso(row.biweekly_start_date))
  return weeksElapsed % 2 === 0
}

// Hands and Admins can be scheduled (recurring shifts, one-off events,
// vacations) — Admin is a technology-admin category layered on the same
// permissions as Manager, but unlike Manager, an Admin can also be a working
// staff member who needs a shift schedule. Managers are never schedulable.
export const SCHEDULABLE_ROLES = ['hand', 'admin']

export function isSchedulable(role) {
  return SCHEDULABLE_ROLES.includes(role)
}

// Folds a recurring weekly pattern together with its per-date skips and any
// one-off event members for that date. `source` lets the UI offer "skip
// this one" only on recurring rows, and branch the remove flow differently
// for one-off event members (which removes just that hand's membership, not
// a whole recurring pattern). A recurring row's day comes from its shift
// type (`shiftTypesById[row.shift_type_id].day_of_week`) — shift types are
// day-specific, so there's no separate day column on the recurring row
// itself. A one-off event expands into one entry per assigned hand.
export function effectiveShiftsForDate(date, recurring, skipsByRecurringId, eventsByDate, shiftTypesById) {
  const iso = isoDate(date)
  const weekday = weekdayKey(date)

  const fromRecurring = recurring
    .filter((row) => shiftTypesById[row.shift_type_id]?.day_of_week === weekday)
    .filter((row) => occursOnCadence(row, date))
    .filter((row) => !(skipsByRecurringId[row.id] ?? new Set()).has(iso))
    .map((row) => ({ ...row, source: 'recurring', recurringShiftId: row.id }))

  const fromEvents = (eventsByDate[iso] ?? []).flatMap((event) =>
    (event.members ?? []).map((profileId) => ({
      source: 'oneoff',
      eventId: event.id,
      profile_id: profileId,
      title: event.title,
      event_time: event.event_time,
      notes: event.notes,
    })),
  )

  return [...fromRecurring, ...fromEvents]
}

// Recurring entries group by shift_type_id (one group per shift type — "AM",
// "PM", etc). A one-off event has no shift type of its own, so each event is
// its own group instead, listing whichever hands are members.
export function groupEffectiveShifts(shifts, shiftTypesById) {
  const groups = {}
  const order = []

  for (const shift of shifts) {
    const key = shift.source === 'recurring' ? `type-${shift.shift_type_id}` : `event-${shift.eventId}`
    if (!groups[key]) {
      groups[key] = {
        key,
        source: shift.source,
        shift_type_id: shift.source === 'recurring' ? shift.shift_type_id : null,
        eventId: shift.source === 'oneoff' ? shift.eventId : null,
        title: shift.source === 'oneoff' ? shift.title : null,
        event_time: shift.source === 'oneoff' ? shift.event_time : null,
        notes: shift.source === 'oneoff' ? shift.notes : null,
        items: [],
      }
      order.push(key)
    }
    groups[key].items.push(shift)
  }

  return order
    .map((key) => groups[key])
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === 'recurring' ? -1 : 1
      if (a.source === 'recurring') {
        const orderA = shiftTypesById[a.shift_type_id]?.sort_order ?? 0
        const orderB = shiftTypesById[b.shift_type_id]?.sort_order ?? 0
        if (orderA !== orderB) return orderA - orderB
        const nameA = shiftTypesById[a.shift_type_id]?.name ?? ''
        const nameB = shiftTypesById[b.shift_type_id]?.name ?? ''
        return nameA.localeCompare(nameB)
      }
      const minutesA = parseEventTimeMinutes(a.event_time)
      const minutesB = parseEventTimeMinutes(b.event_time)
      if (minutesA !== null && minutesB !== null) return minutesA - minutesB
      return (a.event_time ?? '').localeCompare(b.event_time ?? '')
    })
}

export function groupHeaderLabel(group, shiftTypesById) {
  if (group.source === 'recurring') return shiftTypesById[group.shift_type_id]?.name ?? '—'
  return group.title
}

export function shiftRowKey(shift) {
  return shift.source === 'recurring' ? `recurring-${shift.recurringShiftId}` : `oneoff-${shift.eventId}-${shift.profile_id}`
}

// True if `date` falls within any of profileId's vacation ranges. A visual
// overlay only — callers still render the shift, just dimmed with a 🌴.
export function isOnVacation(profileId, date, vacationsByProfileId) {
  const iso = isoDate(date)
  const ranges = vacationsByProfileId[profileId]
  if (!ranges) return false
  return ranges.some((range) => iso >= range.start_date && iso <= range.end_date)
}
