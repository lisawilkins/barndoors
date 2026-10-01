import { printableArea } from '../lib/pageSetup'
import { isoDate, weekdayDateLabel, weekRangeLabel } from '../lib/calendarSchedule'
import {
  effectiveShiftsForDate,
  groupEffectiveShifts,
  isOnVacation,
  groupHeaderLabel,
  eventLabel,
  eventBgClass,
  shiftRowKey,
  OPEN_SHIFT_LABEL,
} from '../lib/handSchedule'

// One hand (or the OPEN SHIFT line) on the Weekly screen, with the manager's
// trash icon. The trash stops the tap from also opening the one-off's edit
// form when the row sits inside a tappable one-off box.
function ShiftRow({ shift, date, isManager, handsById, vacationsByProfileId, onDeleteShift }) {
  const onVacation = !shift.openShift && isOnVacation(shift.profile_id, date, vacationsByProfileId)
  const label = shift.openShift ? OPEN_SHIFT_LABEL : (handsById[shift.profile_id]?.name ?? 'Unknown')
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span
        className={`min-w-0 truncate text-[15px] text-ink-900 ${shift.openShift ? 'font-bold' : ''} ${onVacation ? 'opacity-50' : ''}`}
      >
        {label}
        {onVacation && ' 🌴'}
      </span>
      {isManager && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDeleteShift({ shift, date })
          }}
          aria-label="Remove this shift"
          className="material-symbols-outlined flex-shrink-0 text-[16px] text-ink-300"
        >
          delete
        </button>
      )}
    </div>
  )
}

// A one-off: tinted box (pink when it Needs Help, lavender otherwise) with
// its title, notes, and hands. Managers tap anywhere on it to edit.
function EventBlock({ block, showTime, date, isManager, onEditEvent, ...rowProps }) {
  const { event } = block
  const editable = isManager && onEditEvent
  return (
    <div
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={editable ? `Edit ${event.title}` : undefined}
      onClick={editable ? () => onEditEvent(event) : undefined}
      onKeyDown={
        editable
          ? (keyEvent) => {
              if (keyEvent.target === keyEvent.currentTarget && (keyEvent.key === 'Enter' || keyEvent.key === ' ')) {
                keyEvent.preventDefault()
                onEditEvent(event)
              }
            }
          : undefined
      }
      className={`flex flex-col gap-1 rounded-md px-2.5 py-2 ${eventBgClass(event)} ${editable ? 'cursor-pointer active:opacity-80' : ''}`}
    >
      <span className="text-sm font-bold text-ink-900">{showTime ? eventLabel(event) : event.title}</span>
      {event.notes && <p className="whitespace-pre-line text-sm text-ink-600">{event.notes}</p>}
      {block.items.map((shift) => (
        <ShiftRow key={shiftRowKey(shift)} shift={shift} date={date} isManager={isManager} {...rowProps} />
      ))}
    </div>
  )
}

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
  onEditEvent,
  onDeleteShift,
}) {
  const rowProps = { isManager, handsById, vacationsByProfileId, onDeleteShift }
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
                {groups.map((group) =>
                  group.kind === 'shift' ? (
                    <div key={group.key} className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-ink-900">{groupHeaderLabel(group, shiftTypesById)}</span>
                      {group.items.map((shift) => (
                        <ShiftRow key={shiftRowKey(shift)} shift={shift} date={date} {...rowProps} />
                      ))}
                      {group.events.map((block) => (
                        <EventBlock
                          key={block.eventId}
                          block={block}
                          showTime={false}
                          date={date}
                          onEditEvent={onEditEvent}
                          {...rowProps}
                        />
                      ))}
                    </div>
                  ) : (
                    <EventBlock
                      key={group.key}
                      block={group.events[0]}
                      showTime
                      date={date}
                      onEditEvent={onEditEvent}
                      {...rowProps}
                    />
                  ),
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// A Hand's daily list is much shorter than a Wrangler's (a handful of names
// vs. multiple time-slotted activities), so unlike WranglerScheduleWeeklyPrint's
// fixed one-day-per-sheet layout, this gangs as many days as fit onto a
// page and only overflows to a new one when it runs out of room — plain CSS
// print pagination (`break-inside-avoid` per day) rather than a forced
// per-day split. No add/delete icons, since those are screen-only controls.
// The week itself is a block so those page breaks can happen — see the
// pagination note in lib/pageSetup.js.
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
  function renderPrintRow(shift, date) {
    if (shift.openShift) {
      return (
        <div key={shiftRowKey(shift)} className="flex break-inside-avoid gap-2 border-b border-gray-200 py-1 text-sm">
          <span className="font-bold text-gray-900">{OPEN_SHIFT_LABEL}</span>
        </div>
      )
    }
    const hand = handsById[shift.profile_id]
    const onVacation = isOnVacation(shift.profile_id, date, vacationsByProfileId)
    return (
      <div key={shiftRowKey(shift)} className="flex break-inside-avoid gap-2 border-b border-gray-200 py-1 text-sm">
        <span className="text-gray-900">{hand?.name ?? 'Unknown'}</span>
        {onVacation && <span className="text-gray-600">🌴 vacation</span>}
      </div>
    )
  }

  function renderWeeklyPrintDay(date) {
    const shifts = effectiveShiftsForDate(date, recurring, skipsByRecurringId, eventsByDate, shiftTypesById)
    const groups = groupEffectiveShifts(shifts, shiftTypesById)

    return (
      <div key={isoDate(date)} className="flex w-full break-inside-avoid flex-col gap-3 pb-5">
        <span className="border-b-2 border-gray-900 pb-2 text-lg font-bold text-gray-900">
          {weekdayDateLabel(date)}
        </span>

        {groups.map((group) => (
          <div key={group.key} className="flex flex-col">
            <div className="border-b border-gray-400 pb-1">
              <span className="text-sm font-bold text-gray-900">
                {group.kind === 'shift' ? groupHeaderLabel(group, shiftTypesById) : eventLabel(group.events[0].event)}
              </span>
            </div>
            {group.kind === 'shift' && group.items.map((shift) => renderPrintRow(shift, date))}
            {group.events.map((block) => (
              <div key={block.eventId} className="flex flex-col">
                {group.kind === 'shift' && (
                  <span className="pt-1 text-sm font-bold text-gray-900">{block.event.title}</span>
                )}
                {block.event.notes && (
                  <p className="whitespace-pre-line pt-1 text-sm italic text-gray-600">{block.event.notes}</p>
                )}
                {block.items.map((shift) => renderPrintRow(shift, date))}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="hand-schedule-print-week hidden w-full bg-white print:block"
      style={{ width: `${printableArea('portrait').width}px` }}
    >
      <div className="pb-3">
        <span className="text-sm font-bold text-gray-700">{weekRangeLabel(weekStart)}</span>
      </div>
      {weekDays
        .filter(
          (date) =>
            effectiveShiftsForDate(date, recurring, skipsByRecurringId, eventsByDate, shiftTypesById).length > 0,
        )
        .map((date) => renderWeeklyPrintDay(date))}
    </div>
  )
}
