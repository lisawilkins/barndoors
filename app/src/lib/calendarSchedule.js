// Generic Sun-first calendar-grid date math, shared by any feature with a
// Monthly/Weekly calendar view (Wrangler Schedule, Hand Schedule) — distinct
// from turnoutSchedule.js's Mon-first WEEKDAYS list, which orders a
// day-toggle row rather than a calendar grid.
export const CALENDAR_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const CALENDAR_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function isoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Inverse of isoDate — builds a local-midnight Date from a stored
// YYYY-MM-DD string (never `new Date(iso)`, which parses as UTC and can
// land on the wrong calendar day depending on the viewer's timezone).
export function dateFromIso(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Whole calendar days since a fixed reference point, computed via Date.UTC
// so it's immune to DST (local-midnight ms differences aren't always exact
// 24h multiples across a DST change; UTC ms always are).
export function daysSinceEpoch(date) {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
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

// Same cell math as MonthCalendar's own grid loop, grouped into week-rows
// instead of a flat cell list — lets a caller paginate a month a few weeks
// at a time (Wrangler Monthly print). Deliberately not extracted from
// MonthCalendar itself (small accepted duplication) so MonthCalendar.jsx —
// shared by on-screen Wrangler/Hand and Hand's print — stays untouched.
export function monthGridWeeks(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const rows = weekRowsInMonth(year, month)
  const weeks = []
  for (let row = 0; row < rows; row++) {
    const week = []
    for (let col = 0; col < 7; col++) {
      const i = row * 7 + col
      const date = new Date(year, month, i - firstWeekday + 1)
      week.push({ date, inMonth: date.getMonth() === month })
    }
    weeks.push(week)
  }
  return weeks
}

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

// Flattens grouped calendar entries (each group: { items: [...] }) into a
// print-friendly list of header/item lines, capped at maxItems total items
// (headers don't count against the cap) — used by the Monthly print day
// cells for both Wrangler and Hand schedules so a time/shift-type header
// always sits above its own list of names, matching the on-screen Monthly
// grouping, instead of one flattened line per assignment. A busy day still
// truncates gracefully (a trailing header with nothing shown under it is
// dropped) rather than overflowing the fixed print row height.
export function buildPrintLines(groups, maxItems) {
  const lines = []
  let shownCount = 0
  for (const group of groups) {
    if (shownCount >= maxItems) break
    lines.push({ type: 'header', group })
    for (const item of group.items) {
      if (shownCount >= maxItems) break
      lines.push({ type: 'item', group, item })
      shownCount++
    }
  }
  while (lines.length && lines[lines.length - 1].type === 'header') lines.pop()
  return { lines, shownCount }
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
