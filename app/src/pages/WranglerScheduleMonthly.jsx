import { useMemo } from 'react'
import MonthCalendar from '../components/MonthCalendar'
import LandscapeContent from '../components/LandscapeContent'
import NoPhotosIcon from '../components/NoPhotosIcon'
import { printableArea } from '../lib/pageSetup'
import {
  isoDate,
  monthLabel,
  monthGridWeeks,
  CALENDAR_WEEKDAY_LABELS,
  buildPrintLines,
  effectiveAssignmentsForDate,
  wranglerShortName,
  ACTIVITY_LABELS,
  assignmentRowKey,
  groupAssignmentsBySlot,
} from '../lib/wranglerSchedule'

// Monthly print paginates a fixed number of week-rows per physical page so
// every assignment shows (no per-day truncation) — content grows naturally
// via CSS Grid's default row-stretch, same as the on-screen Monthly cell.
// 5 is confirmed by an actual print test at this font/border sizing — most
// months (4-5 week-rows) land on one sheet; a 6-row month spills one week
// onto a second page. Retune if the row content (font size, borders) changes.
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

// Monthly cells are now a read-only summary — tapping one drills into the
// Weekly view for that day, where all editing happens. Grouped by time
// slot/activity (same grouping as Weekly) so the cell reads as "when, then
// who & on what" at a glance, with no other data (notes, source) cluttering
// it — the cell grows to fit its own day's list; CSS grid auto-sizes each
// week-row to its tallest cell, so a busy day doesn't clip, it just makes
// that whole row taller.
export function WranglerScheduleMonthly({
  year,
  month,
  today,
  isManager,
  wranglersById,
  timeSlotsById,
  headsById,
  recurring,
  skipsByRecurringId,
  oneOffByDate,
  onDayClick,
  onAddClick,
}) {
  function renderDay(date, inMonth) {
    const iso = isoDate(date)
    const assignments = effectiveAssignmentsForDate(date, recurring, skipsByRecurringId, oneOffByDate, timeSlotsById)
    const groups = groupAssignmentsBySlot(assignments, timeSlotsById)
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
              aria-label="Add assignment"
              className="material-symbols-outlined text-[14px] text-ink-300 active:text-accent-bright"
            >
              add
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {groups.map((group) => {
            const slot = timeSlotsById[group.time_slot_id]
            return (
              <div key={`${group.time_slot_id}-${group.activity}`} className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-1 px-0.5">
                  <span className="truncate text-2xs font-bold text-ink-600">{slot?.name ?? '—'}</span>
                  <span className="flex-shrink-0 text-2xs font-semibold text-ink-400">
                    {ACTIVITY_LABELS[group.activity]}
                  </span>
                </div>
                {group.items.map((assignment) => {
                  const wrangler = wranglersById[assignment.wrangler_id]
                  const horse = assignment.horse_id ? headsById[assignment.horse_id] : null
                  return (
                    <div
                      key={assignmentRowKey(assignment)}
                      className={`flex items-center justify-between gap-1 rounded-sm px-1 py-0.5 text-2xs text-chip-fg ${
                        group.activity === 'working' ? 'bg-[#fff6ed]' : 'bg-chip-bg'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-0.5 truncate">
                        <span className="truncate">{wranglerShortName(wrangler)}</span>
                        {wrangler?.no_photos && <NoPhotosIcon className="text-[11px]" />}
                      </span>
                      <span className="flex-shrink-0">{horse?.name ?? '--'}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
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

export function WranglerScheduleMonthlyPrint({
  year,
  month,
  monthNote,
  wranglersById,
  timeSlotsById,
  headsById,
  recurring,
  skipsByRecurringId,
  oneOffByDate,
  dayNotesByDate,
}) {
  const monthWeeks = useMemo(() => monthGridWeeks(year, month), [year, month])
  const printPages = []
  for (let i = 0; i < monthWeeks.length; i += PRINT_WEEKS_PER_PAGE) {
    printPages.push(monthWeeks.slice(i, i + PRINT_WEEKS_PER_PAGE))
  }

  // Grouped by time slot, same as the on-screen Monthly cell —
  // the slot/activity sits as its own header line above the names assigned
  // to it, rather than repeating that info on every name's own line.
  function renderPrintDay(date, inMonth) {
    const iso = isoDate(date)
    const assignments = effectiveAssignmentsForDate(date, recurring, skipsByRecurringId, oneOffByDate, timeSlotsById)
    const dayNote = dayNotesByDate[iso]
    const groups = groupAssignmentsBySlot(assignments, timeSlotsById)
    // No cap — print shows everyone, no truncation (unlike the old
    // PRINT_MAX_ITEMS_PER_DAY + "+N more" behavior this replaces).
    const { lines } = buildPrintLines(groups, Infinity)

    return (
      <div className="flex h-full flex-col gap-px overflow-hidden px-1 py-0.5" style={{ opacity: inMonth ? 1 : 0.35 }}>
        <span className="font-bold text-gray-900">{date.getDate()}</span>
        {dayNote && <span className="truncate italic text-gray-600">{dayNote.body}</span>}
        {lines.map((line) => {
          if (line.type === 'header') {
            const slot = timeSlotsById[line.group.time_slot_id]
            return (
              <div key={`header-${line.group.time_slot_id}-${line.group.activity}`} className="flex items-baseline gap-1">
                <span className="truncate font-bold text-gray-900">{slot?.name ?? '—'}</span>
                <span className="flex-shrink-0 font-bold text-gray-600">&middot; {ACTIVITY_LABELS[line.group.activity]}</span>
              </div>
            )
          }
          const assignment = line.item
          const wrangler = wranglersById[assignment.wrangler_id]
          const horse = assignment.horse_id ? headsById[assignment.horse_id] : null
          return (
            <span key={assignmentRowKey(assignment)} className="truncate text-gray-800">
              {wranglerShortName(wrangler)}
              {horse ? ` · ${horse.name}` : ''}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className="wrangler-schedule-print hidden w-full flex-col bg-white print:flex"
      style={{ width: `${printableArea('landscape').width}px` }}
    >
      {printPages.map((weeks, pageIndex) => (
        <div key={pageIndex} className="flex w-full flex-col gap-2 break-after-page pb-4">
          <div className="flex items-baseline justify-between pb-1">
            <h2 className="text-xl font-bold text-gray-900">Wrangler schedule &middot; {monthLabel(year, month)}</h2>
            <span className="text-sm font-semibold text-gray-700">{printPageRangeLabel(weeks)}</span>
          </div>
          {pageIndex === 0 && monthNote && <p className="pb-1 text-sm italic text-gray-700">{monthNote.body}</p>}
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
