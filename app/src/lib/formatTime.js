// Formats a stored 24-hour "HH:MM"(:SS) time for display, and derives the
// minutes-since-midnight sort key wrangler_time_slots.sort_order is set to
// on every save — keeping the sort key mechanically tied to the actual
// time instead of a separately hand-maintained integer that can drift.
function parseTimeParts(value) {
  const [hourStr, minuteStr] = value.split(':')
  const hour = Number(hourStr)
  const minute = Number(minuteStr)
  const period = hour < 12 ? 'AM' : 'PM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return { hour, minute, hour12, period }
}

function formatOnePart({ hour12, minute, period }, showPeriod) {
  const minutePart = minute ? `:${String(minute).padStart(2, '0')}` : ''
  return `${hour12}${minutePart}${showPeriod ? ` ${period}` : ''}`
}

export function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return ''
  const start = parseTimeParts(startTime)
  const end = parseTimeParts(endTime)
  const samePeriod = start.period === end.period
  return `${formatOnePart(start, !samePeriod)} – ${formatOnePart(end, true)}`
}

export function minutesSinceMidnight(time) {
  const { hour, minute } = parseTimeParts(time)
  return hour * 60 + minute
}
