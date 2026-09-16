// Calendar-grid date math (isoDate, weekdayKey, monthLabel, startOfWeek,
// etc.) lives in calendarSchedule.js — it's generic, shared with Hand
// Schedule. Only Wrangler-specific logic stays here.
export * from './calendarSchedule'

import { isoDate, weekdayKey } from './calendarSchedule'

// Folds a recurring weekly pattern together with its per-date skips and any
// standalone one-off assignment for that date. `source` lets the UI offer
// "skip this one" only on recurring rows. A recurring row's day comes from
// its time slot (`timeSlotsById[row.time_slot_id].day_of_week`) — time slots
// are day-specific, so there's no separate days_of_week/date-range on the
// assignment itself.
export function effectiveAssignmentsForDate(date, recurring, skipsByRecurringId, oneOffByDate, timeSlotsById) {
  const iso = isoDate(date)
  const weekday = weekdayKey(date)

  const fromRecurring = recurring
    .filter((row) => timeSlotsById[row.time_slot_id]?.day_of_week === weekday)
    .filter((row) => !(skipsByRecurringId[row.id] ?? new Set()).has(iso))
    .map((row) => ({ ...row, source: 'recurring', recurringAssignmentId: row.id }))

  const fromOneOff = (oneOffByDate[iso] ?? []).map((row) => ({ ...row, source: 'oneoff' }))

  return [...fromRecurring, ...fromOneOff]
}

export function wranglerShortName(wrangler) {
  if (!wrangler) return 'Unknown'
  return [wrangler.first_name, wrangler.last_initial ? `${wrangler.last_initial}.` : null]
    .filter(Boolean)
    .join(' ')
}
