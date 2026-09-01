import { CALENDAR_WEEKDAY_LABELS } from '../lib/wranglerSchedule'

// Generic month-grid shell: 7 columns, as many week-rows as the month needs,
// leading/trailing days from adjacent months included (dimmed) so every row
// stays a full week. No scheduling-specific logic lives here — a caller
// supplies cell content via `renderDay`, so this is reusable for any future
// month-view calendar (e.g. a Hands shift calendar) without duplicating the
// date math.
export default function MonthCalendar({
  year,
  month,
  renderDay,
  showWeekdayHeader = true,
  className = '',
  gridStyle,
}) {
  const firstOfMonth = new Date(year, month, 1)
  const firstWeekday = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  const cells = []
  for (let i = 0; i < totalCells; i++) {
    const date = new Date(year, month, i - firstWeekday + 1)
    cells.push({ date, inMonth: date.getMonth() === month })
  }

  return (
    <div className={className}>
      {showWeekdayHeader && (
        <div className="grid grid-cols-7">
          {CALENDAR_WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-1 py-1 text-center text-2xs font-bold uppercase tracking-wider text-ink-300">
              {label}
            </div>
          ))}
        </div>
      )}
      <div
        className="grid flex-1 grid-cols-7 gap-px overflow-hidden rounded-md border border-border-card bg-border-card"
        style={gridStyle}
      >
        {cells.map(({ date, inMonth }) => (
          <div
            key={date.toISOString()}
            className={`min-w-0 overflow-hidden bg-white ${inMonth ? '' : 'bg-surface-canvas'}`}
          >
            {renderDay(date, inMonth)}
          </div>
        ))}
      </div>
    </div>
  )
}
