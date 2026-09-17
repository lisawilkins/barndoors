import { printableArea } from '../lib/pageSetup'
import { isoDate, weekdayDateLabel, weekRangeLabel } from '../lib/calendarSchedule'
import {
  effectiveShiftsForDate,
  groupEffectiveShifts,
  isOnVacation,
  groupHeaderLabel,
  shiftRowKey,
} from '../lib/handSchedule'

export function HandScheduleWeekly({
  weekDays,
  today,
  expandedDays,
  isManager,
  handsById,
  shiftTypesById,
  recurring,
  skipsByRecurringId,
  eventsByDate,
  vacationsByProfileId,
  onToggleDay,
  onOpenAdd,
  onDeleteShift,
}) {
  return (
    <div className="flex w-full max-w-[800px] flex-col gap-3 print:hidden">
      {weekDays.map((date) => {
        const iso = isoDate(date)
        const expanded = expandedDays.has(iso)
        const shifts = effectiveShiftsForDate(date, recurring, skipsByRecurringId, eventsByDate, shiftTypesById)
        const groups = groupEffectiveShifts(shifts, shiftTypesById)
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

            {isManager && expanded && (
              <div className="flex items-center justify-end gap-2 px-3.5 pb-3">
                <button
                  type="button"
                  onClick={() => onOpenAdd(date)}
                  aria-label="Add shift"
                  className="material-symbols-outlined flex-shrink-0 text-[18px] text-ink-300 active:text-accent-bright"
                >
                  add
                </button>
              </div>
            )}

            {expanded && (
              <div className="flex flex-col gap-3 border-t border-border-hairline px-3.5 py-3">
                {groups.length === 0 && <p className="text-sm text-ink-300">No shifts.</p>}
                {groups.map((group) => (
                  <div key={group.key} className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-ink-900">
                      {groupHeaderLabel(group, shiftTypesById)}
                      {group.source === 'oneoff' && group.event_time ? ` · ${group.event_time}` : ''}
                    </span>
                    {group.source === 'oneoff' && group.notes && (
                      <p className="text-sm text-ink-600">{group.notes}</p>
                    )}
                    {group.items.map((shift) => {
                      const hand = handsById[shift.profile_id]
                      const onVacation = isOnVacation(shift.profile_id, date, vacationsByProfileId)
                      return (
                        <div key={shiftRowKey(shift)} className="flex items-center justify-between gap-2 py-0.5">
                          <span
                            className={`min-w-0 truncate text-[15px] text-ink-900 ${onVacation ? 'opacity-50' : ''}`}
                          >
                            {hand?.name ?? 'Unknown'}
                            {onVacation && ' 🌴'}
                          </span>
                          {isManager && (
                            <button
                              type="button"
                              onClick={() => onDeleteShift({ shift, date })}
                              aria-label="Remove this shift"
                              className="material-symbols-outlined flex-shrink-0 text-[16px] text-ink-300"
                            >
                              delete
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// One page per day: a bold date header, then each shift type's (or one-off
// event's) hands as a plain list — no add/delete icons, since those are
// screen-only controls. Same fixed-size, never-shrunk approach as the
// Wrangler weekly print.
export function HandScheduleWeeklyPrint({
  weekDays,
  weekStart,
  handsById,
  shiftTypesById,
  recurring,
  skipsByRecurringId,
  eventsByDate,
  vacationsByProfileId,
}) {
  function renderWeeklyPrintDay(date) {
    const shifts = effectiveShiftsForDate(date, recurring, skipsByRecurringId, eventsByDate, shiftTypesById)
    const groups = groupEffectiveShifts(shifts, shiftTypesById)

    return (
      <div key={isoDate(date)} className="flex w-full flex-col gap-3 break-after-page pb-6">
        <div className="flex flex-col gap-0.5 border-b-2 border-gray-900 pb-2">
          <span className="text-sm font-bold text-gray-900">{weekRangeLabel(weekStart)}</span>
          <span className="text-lg font-bold text-gray-900">{weekdayDateLabel(date)}</span>
        </div>

        {groups.map((group) => (
          <div key={group.key} className="flex flex-col">
            <div className="flex items-baseline justify-between border-b border-gray-400 pb-1">
              <span className="text-sm font-bold text-gray-900">{groupHeaderLabel(group, shiftTypesById)}</span>
              {group.source === 'oneoff' && group.event_time && (
                <span className="text-sm font-bold text-gray-900">{group.event_time}</span>
              )}
            </div>
            {group.source === 'oneoff' && group.notes && (
              <p className="pt-1 text-sm italic text-gray-600">{group.notes}</p>
            )}
            {group.items.map((shift) => {
              const hand = handsById[shift.profile_id]
              const onVacation = isOnVacation(shift.profile_id, date, vacationsByProfileId)
              return (
                <div key={shiftRowKey(shift)} className="flex break-inside-avoid gap-2 border-b border-gray-200 py-1 text-sm">
                  <span className="flex-1 text-gray-900">{hand?.name ?? 'Unknown'}</span>
                  {onVacation && <span className="text-gray-600">🌴 vacation</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="hand-schedule-print-week hidden flex-col bg-white print:flex"
      style={{ width: `${printableArea('portrait').width}px` }}
    >
      {weekDays
        .filter(
          (date) =>
            effectiveShiftsForDate(date, recurring, skipsByRecurringId, eventsByDate, shiftTypesById).length > 0,
        )
        .map((date) => renderWeeklyPrintDay(date))}
    </div>
  )
}
