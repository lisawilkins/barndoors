import PrintButton from './PrintButton'
import { monthLabel, weekRangeLabel } from '../lib/calendarSchedule'

const viewLinkClass =
  'self-start text-[14px] font-semibold text-accent-bright underline underline-offset-2 active:opacity-70'
// The same pink square as the calendar button on the Hands and Wranglers lists.
const printButtonClass =
  'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-accent-bright text-white active:opacity-90 disabled:opacity-50'
const chevronClass =
  'flex h-10 w-10 items-center justify-center rounded-md border border-border-input bg-white text-ink-600 active:bg-surface-canvas'

// Shared toolbar chrome for Wrangler Schedule and Hand Schedule — the
// Monthly/Weekly switch, Print, and period chevrons. Not a universal
// calendar: each page still renders its own day cells, weekly cards,
// print sheets, and add-forms.
export function ScheduleViewHeader({ view, onSwitchToWeekly, onSwitchToMonthly, printDisabled }) {
  return (
    <div className="flex w-full max-w-[800px] flex-col gap-1 print:hidden">
      <div className="flex w-full items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-light text-ink-900">
          {view === 'monthly' ? 'Monthly View' : 'Weekly View'}
        </h1>
        <PrintButton disabled={printDisabled} ariaLabel="Print" className={printButtonClass}>
          <span className="material-symbols-outlined text-[24px]">print</span>
        </PrintButton>
      </div>
      {view === 'monthly' ? (
        <button type="button" onClick={onSwitchToWeekly} className={viewLinkClass}>
          See Weekly View
        </button>
      ) : (
        <button type="button" onClick={onSwitchToMonthly} className={viewLinkClass}>
          See Monthly View
        </button>
      )}
    </div>
  )
}

export function SchedulePeriodNav({ view, year, month, weekStart, onChangeMonth, onChangeWeek }) {
  if (view === 'monthly') {
    return (
      <div className="flex w-full max-w-[800px] items-center justify-between print:hidden">
        <button
          type="button"
          onClick={() => onChangeMonth(-1)}
          aria-label="Previous month"
          className={chevronClass}
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        <span className="font-display text-xl font-semibold text-ink-900">{monthLabel(year, month)}</span>
        <button
          type="button"
          onClick={() => onChangeMonth(1)}
          aria-label="Next month"
          className={chevronClass}
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-[800px] items-center justify-between print:hidden">
      <button
        type="button"
        onClick={() => onChangeWeek(-1)}
        aria-label="Previous week"
        className={chevronClass}
      >
        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>
      <span className="font-display text-xl font-semibold text-ink-900">{weekRangeLabel(weekStart)}</span>
      <button
        type="button"
        onClick={() => onChangeWeek(1)}
        aria-label="Next week"
        className={chevronClass}
      >
        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>
    </div>
  )
}
