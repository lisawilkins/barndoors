import NoPhotosIcon from '../components/NoPhotosIcon'
import { printableArea } from '../lib/pageSetup'
import {
  isoDate,
  weekdayDateLabel,
  weekRangeLabel,
  effectiveAssignmentsForDate,
  wranglerShortName,
  ACTIVITY_LABELS,
  assignmentRowKey,
  groupAssignmentsBySlot,
} from '../lib/wranglerSchedule'

export function WranglerScheduleWeekly({
  weekDays,
  today,
  expandedDays,
  isManager,
  wranglersById,
  timeSlotsById,
  headsById,
  recurring,
  skipsByRecurringId,
  oneOffByDate,
  dayNotesByDate,
  onToggleDay,
  onOpenDayNote,
  onOpenAdd,
  onViewNotes,
  onDeleteAssignment,
}) {
  return (
    <div className="flex w-full max-w-[800px] flex-col gap-3 print:hidden">
      {weekDays.map((date) => {
        const iso = isoDate(date)
        const expanded = expandedDays.has(iso)
        const dayNote = dayNotesByDate[iso]
        const assignments = effectiveAssignmentsForDate(
          date,
          recurring,
          skipsByRecurringId,
          oneOffByDate,
          timeSlotsById,
        )
        const groups = groupAssignmentsBySlot(assignments, timeSlotsById)
        const isToday = iso === isoDate(today)

        return (
          <div key={iso} data-day-iso={iso} className="overflow-hidden rounded-md border border-border-card bg-white">
            <button
              type="button"
              onClick={() => onToggleDay(iso)}
              className="flex w-full items-center justify-between px-3.5 py-3"
            >
              <span className={`font-display text-lg font-semibold ${isToday ? 'text-accent-bright' : 'text-ink-900'}`}>
                {weekdayDateLabel(date)}
              </span>
              <span className="material-symbols-outlined text-[18px] text-ink-300">
                {expanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            <div className="flex items-center justify-between gap-2 px-3.5 pb-3">
              {dayNote ? (
                isManager ? (
                  <button
                    type="button"
                    onClick={() => onOpenDayNote(iso)}
                    className="min-w-0 flex-1 truncate text-left text-sm italic text-ink-600"
                  >
                    {dayNote.body}
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm italic text-ink-600">{dayNote.body}</span>
                )
              ) : isManager ? (
                <button
                  type="button"
                  onClick={() => onOpenDayNote(iso)}
                  className="text-sm font-medium text-accent-bright underline active:opacity-70"
                >
                  Add note
                </button>
              ) : (
                <span />
              )}
              {isManager && expanded && (
                <button
                  type="button"
                  onClick={() => onOpenAdd(date)}
                  aria-label="Add assignment"
                  className="material-symbols-outlined flex-shrink-0 text-[18px] text-ink-300 active:text-accent-bright"
                >
                  add
                </button>
              )}
            </div>

            {expanded && (
              <div className="flex flex-col gap-3 border-t border-border-hairline px-3.5 py-3">
                {groups.length === 0 && <p className="text-sm text-ink-300">No assignments.</p>}
                {groups.map((group) => {
                  const slot = timeSlotsById[group.time_slot_id]
                  return (
                    <div key={`${group.time_slot_id}-${group.activity}`} className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-ink-900">
                        {slot?.name ?? '—'} · {ACTIVITY_LABELS[group.activity]}
                      </span>
                      {group.items.map((assignment) => {
                        const wrangler = wranglersById[assignment.wrangler_id]
                        const horse = assignment.horse_id ? headsById[assignment.horse_id] : null
                        return (
                          <div key={assignmentRowKey(assignment)} className="flex items-center justify-between gap-2 py-0.5">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="w-28 flex-shrink-0 truncate text-[15px] text-ink-900">
                                {wranglerShortName(wrangler)}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[15px] text-ink-600">
                                {horse?.name ?? ''}
                              </span>
                              {wrangler?.no_photos && <NoPhotosIcon />}
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-1">
                              {wrangler?.notes && (
                                <button
                                  type="button"
                                  onClick={() => onViewNotes(wrangler)}
                                  aria-label={`${wranglerShortName(wrangler)}'s notes`}
                                  className="material-symbols-outlined text-[16px] text-accent-bright"
                                >
                                  sticky_note_2
                                </button>
                              )}
                              {isManager && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteAssignment({ assignment, date })}
                                  aria-label="Remove this assignment"
                                  className="material-symbols-outlined text-[16px] text-ink-300"
                                >
                                  delete
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// One page per day: a bold date header, then each time slot's assignments
// as a plain Wrangler/Horse/Notes table — no bell or trash icons, since
// those are screen-only controls. Type is a fixed, readable size and never
// shrunk to fit, same as the chore sheet (ChoreListPrint.jsx) — a day with
// an unusually long list simply runs onto a second page instead.
export function WranglerScheduleWeeklyPrint({
  weekDays,
  weekStart,
  wranglersById,
  timeSlotsById,
  headsById,
  recurring,
  skipsByRecurringId,
  oneOffByDate,
  dayNotesByDate,
}) {
  function renderWeeklyPrintDay(date) {
    const iso = isoDate(date)
    const assignments = effectiveAssignmentsForDate(date, recurring, skipsByRecurringId, oneOffByDate, timeSlotsById)
    const groups = groupAssignmentsBySlot(assignments, timeSlotsById)
    const dayNote = dayNotesByDate[iso]

    return (
      <div key={iso} className="flex w-full flex-col gap-3 break-after-page pb-6">
        <div className="flex flex-col gap-0.5 border-b-2 border-gray-900 pb-2">
          <span className="text-sm font-bold text-gray-900">{weekRangeLabel(weekStart)}</span>
          <span className="text-lg font-bold text-gray-900">{weekdayDateLabel(date)}</span>
          {dayNote && <span className="text-sm italic text-gray-600">{dayNote.body}</span>}
        </div>

        {groups.map((group) => {
          const slot = timeSlotsById[group.time_slot_id]
          return (
            <div key={`${group.time_slot_id}-${group.activity}`} className="flex flex-col">
              <div className="flex items-baseline justify-between border-b border-gray-400 pb-1">
                <span className="text-sm font-bold text-gray-900">{slot?.name ?? '—'}</span>
                <span className="text-sm font-bold text-gray-900">{ACTIVITY_LABELS[group.activity]}</span>
              </div>
              {group.items.map((assignment) => {
                const wrangler = wranglersById[assignment.wrangler_id]
                const horse = assignment.horse_id ? headsById[assignment.horse_id] : null
                return (
                  <div key={assignmentRowKey(assignment)} className="flex break-inside-avoid gap-2 border-b border-gray-200 py-1 text-sm">
                    <span className="w-28 flex-shrink-0 text-gray-900">{wranglerShortName(wrangler)}</span>
                    <span className="w-20 flex-shrink-0 text-gray-900">{horse?.name ?? '--'}</span>
                    <span className="flex flex-1 gap-1 text-gray-600">
                      <span className="w-4 flex-shrink-0">
                        {wrangler?.no_photos && (
                          <span className="material-symbols-outlined text-[14px] text-gray-600" title="No photos">
                            no_photography
                          </span>
                        )}
                      </span>
                      <span>{wrangler?.notes || '--'}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className="wrangler-schedule-print-week hidden flex-col bg-white print:flex"
      style={{ width: `${printableArea('portrait').width}px` }}
    >
      {weekDays
        .filter(
          (date) =>
            effectiveAssignmentsForDate(date, recurring, skipsByRecurringId, oneOffByDate, timeSlotsById)
              .length > 0,
        )
        .map((date) => renderWeeklyPrintDay(date))}
    </div>
  )
}
