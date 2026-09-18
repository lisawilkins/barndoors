import { useMemo } from 'react'
import MonthCalendar from '../components/MonthCalendar'
import LandscapeContent from '../components/LandscapeContent'
import { printableArea } from '../lib/pageSetup'
import { isoDate, monthLabel, monthGridWeeks, CALENDAR_WEEKDAY_LABELS, buildPrintLines } from '../lib/calendarSchedule'
import {
  effectiveShiftsForDate,
  groupEffectiveShifts,
  isOnVacation,
  groupHeaderLabel,
  shiftRowKey,
} from '../lib/handSchedule'

// Monthly print paginates a fixed number of week-rows per physical page so
// every shift shows (no per-day truncation) — content grows naturally via
// CSS Grid's default row-stretch, same as the on-screen Monthly cell.
// Mirrors WranglerSchedule's Monthly print exactly (5 weeks/page, bordered
// grid, 10px type, confirmed by an actual print test) — see
// WranglerScheduleMonthly.jsx. Hands have no month/day standing notes
// (unlike Wranglers), so there's no note row here.
const PRINT_WEEKS_PER_PAGE = 5

function printPageRangeLabel(weekRows) {
  const start = weekRows[0][0].date
  const end = weekRows[weekRows.length - 1][6].date
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel =
    start.getMonth() === end.getMonth()
      ? end.toLocaleDateString(undefined, { day: 'numeric' })
      : end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

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
// cell and Wrangler's Monthly print — the shift type or event title sits as
// its own header line above the hands assigned to it. No cap — print shows
// everyone, no truncation (unlike the old PRINT_MAX_ITEMS_PER_DAY +
// "+N more" behavior this replaces).
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
  const monthWeeks = useMemo(() => monthGridWeeks(year, month), [year, month])
  const printPages = []
  for (let i = 0; i < monthWeeks.length; i += PRINT_WEEKS_PER_PAGE) {
    printPages.push(monthWeeks.slice(i, i + PRINT_WEEKS_PER_PAGE))
  }

  function renderPrintDay(date, inMonth) {
    const shifts = effectiveShiftsForDate(date, recurring, skipsByRecurringId, eventsByDate, shiftTypesById)
    const groups = groupEffectiveShifts(shifts, shiftTypesById)
    const { lines } = buildPrintLines(groups, Infinity)

    return (
      <div className="flex h-full flex-col gap-px overflow-hidden px-1 py-0.5" style={{ opacity: inMonth ? 1 : 0.35 }}>
        <span className="font-bold text-gray-900">{date.getDate()}</span>
        {lines.map((line) => {
          if (line.type === 'header') {
            return (
              <div key={`header-${line.group.key}`} className="flex items-baseline justify-between gap-1">
                <span className="truncate font-bold text-gray-900">{groupHeaderLabel(line.group, shiftTypesById)}</span>
                {line.group.source === 'oneoff' && line.group.event_time && (
                  <span className="flex-shrink-0 font-bold text-gray-600">{line.group.event_time}</span>
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
      </div>
    )
  }

  return (
    <div
      className="hand-schedule-print hidden w-full flex-col bg-white print:flex"
      style={{ width: `${printableArea('landscape').width}px` }}
    >
      {printPages.map((weeks, pageIndex) => (
        <div key={pageIndex} className="flex w-full flex-col gap-2 break-after-page pb-4">
          <div className="flex items-baseline justify-between pb-1">
            <h2 className="text-xl font-bold text-gray-900">Hand schedule &middot; {monthLabel(year, month)}</h2>
            <span className="text-sm font-semibold text-gray-700">{printPageRangeLabel(weeks)}</span>
          </div>
          <div className="grid grid-cols-7">
            {CALENDAR_WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-1 py-1 text-center text-2xs font-bold uppercase tracking-wider text-ink-300"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l border-t border-gray-300 text-[10px] leading-[1.2]">
            {weeks.flat().map(({ date, inMonth }) => (
              <div
                key={isoDate(date)}
                className={`min-w-0 overflow-hidden border-b border-r border-gray-300 bg-white ${inMonth ? '' : 'bg-surface-canvas'}`}
              >
                {renderPrintDay(date, inMonth)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
