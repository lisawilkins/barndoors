import { isoDate, weekdayKey, startOfWeek, dateFromIso, daysSinceEpoch } from './calendarSchedule'
import { formatTime, minutesSinceMidnight } from './formatTime'

function weekIndex(date) {
  return Math.floor(daysSinceEpoch(startOfWeek(date)) / 7)
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
// one-off events for that date. `source` lets the UI offer "skip this one"
// only on recurring rows, and branch the remove flow differently for one-off
// entries (which removes just that hand's membership, not a whole recurring
// pattern). A recurring row's day comes from its shift type
// (`shiftTypesById[row.shift_type_id].day_of_week`) — shift types are
// day-specific, so there's no separate day column on the recurring row
// itself. A one-off event expands into one entry per assigned hand, or a
// single `openShift` entry (no hand) when it's marked Needs Help.
export function effectiveShiftsForDate(date, recurring, skipsByRecurringId, eventsByDate, shiftTypesById) {
  const iso = isoDate(date)
  const weekday = weekdayKey(date)

  const fromRecurring = recurring
    .filter((row) => shiftTypesById[row.shift_type_id]?.day_of_week === weekday)
    .filter((row) => occursOnCadence(row, date))
    .filter((row) => !(skipsByRecurringId[row.id] ?? new Set()).has(iso))
    .map((row) => ({ ...row, source: 'recurring', recurringShiftId: row.id }))

  const fromEvents = (eventsByDate[iso] ?? []).flatMap((event) => {
    const base = { source: 'oneoff', eventId: event.id, event }
    if (event.needs_help) return [{ ...base, profile_id: null, openShift: true }]
    return (event.members ?? []).map((profileId) => ({ ...base, profile_id: profileId, openShift: false }))
  })

  return [...fromRecurring, ...fromEvents]
}

// Two kinds of group:
//   * `shift` — one per shift type ("AM", "PM"). `items` are the recurring
//     hands; `events` are one-offs that picked this shift instead of a time,
//     so they show inside the shift they belong to.
//   * `event` — a one-off with its own start time (or a legacy one-off with
//     neither), shown as its own entry.
// Each one-off is an "event block": { eventId, event, items }, where items
// are its hands (or the single open-shift entry).
export function groupEffectiveShifts(shifts, shiftTypesById) {
  const groups = {}
  const order = []

  function ensureGroup(key, init) {
    if (!groups[key]) {
      groups[key] = { key, ...init }
      order.push(key)
    }
    return groups[key]
  }

  for (const shift of shifts) {
    if (shift.source === 'recurring') {
      ensureGroup(`type-${shift.shift_type_id}`, { kind: 'shift', shift_type_id: shift.shift_type_id, items: [], events: [] }).items.push(shift)
      continue
    }

    const { event } = shift
    const blockOwner = event.shift_type_id
      ? ensureGroup(`type-${event.shift_type_id}`, { kind: 'shift', shift_type_id: event.shift_type_id, items: [], events: [] })
      : ensureGroup(`event-${event.id}`, { kind: 'event', events: [] })
    let block = blockOwner.events.find((candidate) => candidate.eventId === event.id)
    if (!block) {
      block = { eventId: event.id, event, items: [] }
      blockOwner.events.push(block)
    }
    block.items.push(shift)
  }

  return order
    .map((key) => groups[key])
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'shift' ? -1 : 1
      if (a.kind === 'shift') {
        const orderA = shiftTypesById[a.shift_type_id]?.sort_order ?? 0
        const orderB = shiftTypesById[b.shift_type_id]?.sort_order ?? 0
        if (orderA !== orderB) return orderA - orderB
        const nameA = shiftTypesById[a.shift_type_id]?.name ?? ''
        const nameB = shiftTypesById[b.shift_type_id]?.name ?? ''
        return nameA.localeCompare(nameB)
      }
      // Timed one-offs in time order; legacy ones with no time last.
      const eventA = a.events[0].event
      const eventB = b.events[0].event
      const minutesA = eventA.start_time ? minutesSinceMidnight(eventA.start_time) : Infinity
      const minutesB = eventB.start_time ? minutesSinceMidnight(eventB.start_time) : Infinity
      if (minutesA !== minutesB) return minutesA - minutesB
      return eventA.title.localeCompare(eventB.title)
    })
}

export function groupHeaderLabel(group, shiftTypesById) {
  return shiftTypesById[group.shift_type_id]?.name ?? '—'
}

// "Gymkhana · 8 AM" for a timed one-off; just the title otherwise (a
// shift-based one-off already sits under its shift's header).
export function eventLabel(event) {
  return event.start_time ? `${event.title} · ${formatTime(event.start_time)}` : event.title
}

export const OPEN_SHIFT_LABEL = 'OPEN SHIFT'

// Background for a one-off: Needs Help is pink, every other one-off is
// lavender. Recurring entries keep their own existing styling.
export function eventBgClass(event) {
  return event.needs_help ? 'bg-open-shift-bg' : 'bg-oneoff-bg'
}

export function shiftRowKey(shift) {
  if (shift.source === 'recurring') return `recurring-${shift.recurringShiftId}`
  return `oneoff-${shift.eventId}-${shift.profile_id ?? 'open'}`
}

// True if `date` falls within any of profileId's vacation ranges. A visual
// overlay only — callers still render the shift, just dimmed with a 🌴.
export function isOnVacation(profileId, date, vacationsByProfileId) {
  const iso = isoDate(date)
  const ranges = vacationsByProfileId[profileId]
  if (!ranges) return false
  return ranges.some((range) => iso >= range.start_date && iso <= range.end_date)
}
