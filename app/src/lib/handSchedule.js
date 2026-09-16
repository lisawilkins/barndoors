import { isoDate, weekdayKey } from './calendarSchedule'

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
        return orderA - orderB
      }
      return (a.event_time ?? '').localeCompare(b.event_time ?? '')
    })
}

// True if `date` falls within any of profileId's vacation ranges. A visual
// overlay only — callers still render the shift, just dimmed with a 🌴.
export function isOnVacation(profileId, date, vacationsByProfileId) {
  const iso = isoDate(date)
  const ranges = vacationsByProfileId[profileId]
  if (!ranges) return false
  return ranges.some((range) => iso >= range.start_date && iso <= range.end_date)
}
