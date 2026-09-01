// Weekday helpers for the calendar grid (Sun-first, matching the standard US
// calendar layout) — distinct from turnoutSchedule.js's Mon-first WEEKDAYS
// list, which orders a day-toggle row rather than a calendar grid.
export const CALENDAR_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const CALENDAR_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function isoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function weekdayKey(date) {
  return CALENDAR_WEEKDAYS[date.getDay()]
}

// First-of-month ISO date, used as the scope key for a whole-month note.
export function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
}

function weekRowsInMonth(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return Math.ceil((firstWeekday + daysInMonth) / 7)
}

export { weekRowsInMonth }

// The full set of dates shown on the grid, including leading/trailing days
// borrowed from adjacent months — used to bound date-range queries (one-off
// assignments, day notes) so notes on a padding day still show up.
export function monthGridRange(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const rows = weekRowsInMonth(year, month)
  const start = new Date(year, month, 1 - firstWeekday)
  const end = new Date(year, month, 1 - firstWeekday + rows * 7 - 1)
  return { start, end }
}

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

// Sunday of the week containing `date` — the calendar grid and the weekly
// view both treat Sunday as the first day of the week.
export function startOfWeek(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay())
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function weekdayDateLabel(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function weekRangeLabel(weekStart) {
  const end = addDays(weekStart, 6)
  const startLabel = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel =
    weekStart.getMonth() === end.getMonth()
      ? end.toLocaleDateString(undefined, { day: 'numeric' })
      : end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

export function wranglerShortName(wrangler) {
  if (!wrangler) return 'Unknown'
  return [wrangler.first_name, wrangler.last_initial ? `${wrangler.last_initial}.` : null]
    .filter(Boolean)
    .join(' ')
}
