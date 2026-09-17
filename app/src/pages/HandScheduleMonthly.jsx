import MonthCalendar from '../components/MonthCalendar'
import LandscapeContent from '../components/LandscapeContent'
import { isoDate, monthLabel, weekRowsInMonth, buildPrintLines } from '../lib/calendarSchedule'
import {
  effectiveShiftsForDate,
  groupEffectiveShifts,
  isOnVacation,
  groupHeaderLabel,
  shiftRowKey,
} from '../lib/handSchedule'

// Print sizing mirrors WranglerSchedule: same letter-landscape @page
// rule (index.css) for Monthly. Hands have no month/day standing
// notes (unlike Wranglers), so there's no note-row height to budget here.
const PX_PER_IN = 96
const PAGE_HEIGHT_IN = 8.5
const PAGE_WIDTH_IN = 11
const MARGIN_IN = 0.35
const PAGE_HEIGHT_PX = (PAGE_HEIGHT_IN - MARGIN_IN * 2) * PX_PER_IN
const USABLE_WIDTH_PX = (PAGE_WIDTH_IN - MARGIN_IN * 2) * PX_PER_IN
const PRINT_MAX_ITEMS_PER_DAY = 4
const TITLE_ROW_PX = 40
const WEEKDAY_HEADER_ROW_PX = 24
const PRINT_SAFETY_BUFFER_PX = 12

// Monthly cells are a read-only summary — tapping one drills into the
// Weekly view for that day, where all editing happens. Grouped by shift
// type (recurring) or by event (one-off) so the cell reads as "when, then
// who" at a glance. A hand on vacation still shows here — just dimmed with
// a 🌴 — never omitted.
export function HandScheduleMonthly({
  year,
  month,
  today,
  isManager,
  handsById,
  shiftTypesById,
  recurring,
  skipsByRecurringId,
  eventsByDate,
  vacationsByProfileId,
  onDayClick,
  onAddClick,
}) {
  function renderDay(date, inMonth) {
    const iso = isoDate(date)
    const shifts = effectiveShiftsForDate(date, recurring, skipsByRecurringId, eventsByDate, shiftTypesById)
    const groups = groupEffectiveShifts(shifts, shiftTypesById)
    const isToday = iso === isoDate(today)

    return (
      <div
        role={inMonth ? 'button' : undefined}
        tabIndex={inMonth ? 0 : undefined}
        onClick={inMonth ? () => onDayClick(date) : undefined}
        className={`flex min-h-[92px] flex-col gap-1 p-1 text-left ${inMonth ? 'cursor-pointer active:bg-surface-canvas' : ''}`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`text-[11px] font-semibold ${
              isToday ? 'text-accent-bright' : inMonth ? 'text-ink-900' : 'text-ink-300'
            }`}
          >
            {date.getDate()}
          </span>
          {isManager && inMonth && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onAddClick(date)
              }}
              aria-label="Add shift"
              className="material-symbols-outlined text-[14px] text-ink-300 active:text-accent-bright"
            >
              add
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-1 px-0.5">
                <span className="truncate text-2xs font-bold text-ink-600">{groupHeaderLabel(group, shiftTypesById)}</span>
                {group.source === 'oneoff' && group.event_time && (
                  <span className="flex-shrink-0 text-2xs font-semibold text-ink-400">{group.event_time}</span>
                )}
              </div>
              {group.items.map((shift) => {
                const hand = handsById[shift.profile_id]
                const onVacation = isOnVacation(shift.profile_id, date, vacationsByProfileId)
                return (
                  <div
                    key={shiftRowKey(shift)}
                    className={`flex items-center gap-1 rounded-sm bg-chip-bg px-1 py-0.5 text-2xs text-chip-fg ${
                      onVacation ? 'opacity-50' : ''
                    }`}
                  >
                    <span className="truncate">{hand?.name ?? 'Unknown'}</span>
                    {onVacation && <span className="flex-shrink-0">🌴</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <LandscapeContent className="print:hidden">
      <MonthCalendar year={year} month={month} renderDay={renderDay} className="w-full" />
    </LandscapeContent>
  )
}

// Grouped by shift type / one-off event, same as the on-screen Monthly
// cell — the shift type or event title sits as its own header
// line above the hands assigned to it, rather than repeating that info on
// every name's own line. Hands still cap at 4 names then "+N more"; wrangler
// monthly print shows everyone. That product difference is intentional.
export function HandScheduleMonthlyPrint({
  year,
  month,
  handsById,
  shiftTypesById,
  recurring,
  skipsByRecurringId,
  eventsByDate,
  vacationsByProfileId,
}) {
  const printTitleBlockPx = TITLE_ROW_PX + WEEKDAY_HEADER_ROW_PX + PRINT_SAFETY_BUFFER_PX
  const rowHeightPx = (PAGE_HEIGHT_PX - printTitleBlockPx) / weekRowsInMonth(year, month)

  function renderPrintDay(date, inMonth) {
    const shifts = effectiveShiftsForDate(date, recurring, skipsByRecurringId, eventsByDate, shiftTypesById)
    const groups = groupEffectiveShifts(shifts, shiftTypesById)
    const { lines, shownCount } = buildPrintLines(groups, PRINT_MAX_ITEMS_PER_DAY)
    const hiddenCount = shifts.length - shownCount

    return (
      <div className="flex h-full flex-col gap-0.5 overflow-hidden p-1" style={{ opacity: inMonth ? 1 : 0.35 }}>
        <span className="font-bold text-gray-900">{date.getDate()}</span>
        {lines.map((line) => {
          if (line.type === 'header') {
            return (
              <div key={`header-${line.group.key}`} className="flex items-baseline justify-between gap-1">
                <span className="truncate font-bold text-gray-900">{groupHeaderLabel(line.group, shiftTypesById)}</span>
                {line.group.source === 'oneoff' && line.group.event_time && (
                  <span className="flex-shrink-0 text-gray-600">{line.group.event_time}</span>
                )}
              </div>
            )
          }
          const shift = line.item
          const hand = handsById[shift.profile_id]
          const onVacation = isOnVacation(shift.profile_id, date, vacationsByProfileId)
          return (
            <span key={shiftRowKey(shift)} className="truncate text-gray-800">
              {hand?.name ?? 'Unknown'}
              {onVacation ? ' 🌴' : ''}
            </span>
          )
        })}
        {hiddenCount > 0 && <span className="text-gray-500">+{hiddenCount} more</span>}
      </div>
    )
  }

  return (
    <div
      className="hand-schedule-print hidden w-full flex-col overflow-hidden bg-white print:flex"
      style={{ height: `${PAGE_HEIGHT_PX}px` }}
    >
      <div className="flex items-baseline justify-between pb-2">
        <h2 className="text-xl font-bold text-gray-900">Hand schedule &middot; {monthLabel(year, month)}</h2>
      </div>
      <MonthCalendar
        year={year}
        month={month}
        renderDay={renderPrintDay}
        gridStyle={{ gridAutoRows: `${rowHeightPx}px`, fontSize: '8px', width: `${USABLE_WIDTH_PX}px` }}
      />
    </div>
  )
}
