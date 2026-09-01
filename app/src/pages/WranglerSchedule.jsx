import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'
import MonthCalendar from '../components/MonthCalendar'
import ConfirmDialog from '../components/ConfirmDialog'
import { TextAreaField, SelectField } from '../components/FormField'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
  isoDate,
  weekdayKey,
  monthKey,
  monthLabel,
  monthGridRange,
  weekRowsInMonth,
  startOfWeek,
  addDays,
  weekdayDateLabel,
  weekRangeLabel,
  effectiveAssignmentsForDate,
  wranglerShortName,
} from '../lib/wranglerSchedule'

const ACTIVITY_LABELS = { riding: 'Riding', working: 'Working' }

// Print sizing follows the same letter-landscape @page rule (index.css) and
// row-budget approach as the other reports, but the grid shape here is
// always 7 columns × however many week-rows the month needs, so — unlike the
// feed reports — there's no need to also derive a column-based font size.
// Print always renders the month grid regardless of which view is on
// screen — a weekly print layout isn't part of this pass.
const PX_PER_IN = 96
const PAGE_HEIGHT_IN = 8.5
const PAGE_WIDTH_IN = 11
const MARGIN_IN = 0.35
const PAGE_HEIGHT_PX = (PAGE_HEIGHT_IN - MARGIN_IN * 2) * PX_PER_IN
const USABLE_WIDTH_PX = (PAGE_WIDTH_IN - MARGIN_IN * 2) * PX_PER_IN
const PRINT_MAX_ITEMS_PER_DAY = 4

// Everything above the day grid has to be budgeted out of the page height,
// or the grid ends up taller than what's left and spills a near-empty
// second page — which is exactly what happened when the old fixed
// TITLE_BLOCK_PX didn't account for the weekday-header row (rendered by
// MonthCalendar above the grid, sized by its own text-2xs/py-1 styling, not
// by the grid's own gridStyle) or the month note's variable height.
const TITLE_ROW_PX = 40
const MONTH_NOTE_ROW_PX = 32
const WEEKDAY_HEADER_ROW_PX = 24
const PRINT_SAFETY_BUFFER_PX = 12

function blankAssignmentForm() {
  return {
    wrangler_id: '',
    activity: 'working',
    time_slot_id: '',
    horse_id: '',
  }
}

function groupAssignmentsBySlot(assignments, timeSlotsById) {
  const groups = {}
  for (const assignment of assignments) {
    const key = `${assignment.time_slot_id}-${assignment.activity}`
    if (!groups[key]) groups[key] = { time_slot_id: assignment.time_slot_id, activity: assignment.activity, items: [] }
    groups[key].items.push(assignment)
  }
  return Object.values(groups).sort((a, b) => {
    const orderA = timeSlotsById[a.time_slot_id]?.sort_order ?? 0
    const orderB = timeSlotsById[b.time_slot_id]?.sort_order ?? 0
    if (orderA !== orderB) return orderA - orderB
    return a.activity.localeCompare(b.activity)
  })
}

export default function WranglerSchedule() {
  const { isManager } = useAuth()
  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState('monthly') // 'monthly' | 'weekly'
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const [expandedDays, setExpandedDays] = useState(() => new Set())

  const [wranglers, setWranglers] = useState([])
  const [timeSlots, setTimeSlots] = useState([])
  const [heads, setHeads] = useState([])
  const [recurring, setRecurring] = useState([])
  const [skips, setSkips] = useState([])
  const [oneOff, setOneOff] = useState([])
  const [dayNotes, setDayNotes] = useState([])
  const [monthNote, setMonthNote] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [addDate, setAddDate] = useState(null)
  const [assignmentForm, setAssignmentForm] = useState(null)
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')

  const [editingDayNoteIso, setEditingDayNoteIso] = useState(null)
  const [dayNoteDraft, setDayNoteDraft] = useState('')
  const [editingMonthNote, setEditingMonthNote] = useState(false)
  const [monthNoteDraft, setMonthNoteDraft] = useState('')

  const [viewingNotesFor, setViewingNotesFor] = useState(null)
  const [deletingAssignment, setDeletingAssignment] = useState(null)

  const wranglersById = useMemo(() => Object.fromEntries(wranglers.map((w) => [w.id, w])), [wranglers])
  const timeSlotsById = useMemo(() => Object.fromEntries(timeSlots.map((s) => [s.id, s])), [timeSlots])
  const headsById = useMemo(() => Object.fromEntries(heads.map((h) => [h.id, h])), [heads])

  const skipsByRecurringId = useMemo(() => {
    const map = {}
    for (const skip of skips) {
      if (!map[skip.recurring_assignment_id]) map[skip.recurring_assignment_id] = new Set()
      map[skip.recurring_assignment_id].add(skip.date)
    }
    return map
  }, [skips])

  const oneOffByDate = useMemo(() => {
    const map = {}
    for (const row of oneOff) {
      if (!map[row.date]) map[row.date] = []
      map[row.date].push(row)
    }
    return map
  }, [oneOff])

  const dayNotesByDate = useMemo(
    () => Object.fromEntries(dayNotes.map((note) => [note.note_date, note])),
    [dayNotes],
  )

  useEffect(() => {
    let active = true

    async function loadAll() {
      setLoading(true)
      setError('')

      const { start, end } = view === 'weekly' ? { start: weekStart, end: addDays(weekStart, 6) } : monthGridRange(year, month)
      const startIso = isoDate(start)
      const endIso = isoDate(end)
      const monthIso = monthKey(year, month)

      const [
        wranglersResult,
        slotsResult,
        headsResult,
        recurringResult,
        skipsResult,
        oneOffResult,
        dayNotesResult,
        monthNoteResult,
      ] = await Promise.all([
        supabase
          .from('wranglers')
          .select('id, first_name, last_initial, notes')
          .eq('status', 'active')
          .order('first_name'),
        supabase
          .from('wrangler_time_slots')
          .select('id, name, day_of_week, sort_order')
          .eq('active', true)
          .order('sort_order'),
        supabase.from('head').select('id, name').eq('status', 'active').order('name'),
        supabase
          .from('wrangler_recurring_assignments')
          .select('id, wrangler_id, time_slot_id, activity, horse_id'),
        supabase.from('wrangler_recurring_skips').select('id, recurring_assignment_id, date'),
        supabase
          .from('wrangler_assignments')
          .select('id, wrangler_id, date, time_slot_id, activity, horse_id')
          .gte('date', startIso)
          .lte('date', endIso),
        supabase
          .from('wrangler_calendar_notes')
          .select('id, note_date, body')
          .gte('note_date', startIso)
          .lte('note_date', endIso),
        supabase.from('wrangler_calendar_notes').select('id, body').eq('note_month', monthIso).maybeSingle(),
      ])

      if (!active) return

      const firstError = [
        wranglersResult,
        slotsResult,
        headsResult,
        recurringResult,
        skipsResult,
        oneOffResult,
        dayNotesResult,
      ].find((result) => result.error)?.error

      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      setWranglers(wranglersResult.data ?? [])
      setTimeSlots(slotsResult.data ?? [])
      setHeads(headsResult.data ?? [])
      setRecurring(recurringResult.data ?? [])
      setSkips(skipsResult.data ?? [])
      setOneOff(oneOffResult.data ?? [])
      setDayNotes(dayNotesResult.data ?? [])
      setMonthNote(monthNoteResult.data ?? null)
      setLoading(false)
    }

    loadAll()

    return () => {
      active = false
    }
  }, [year, month, view, weekStart, reloadToken])

  function reload() {
    setReloadToken((current) => current + 1)
  }

  function changeMonth(delta) {
    let nextMonth = month + delta
    let nextYear = year
    if (nextMonth < 0) {
      nextMonth = 11
      nextYear -= 1
    }
    if (nextMonth > 11) {
      nextMonth = 0
      nextYear += 1
    }
    setMonth(nextMonth)
    setYear(nextYear)
  }

  function changeWeek(delta) {
    setWeekStart((current) => addDays(current, delta * 7))
  }

  function switchToWeekly() {
    const base = today.getFullYear() === year && today.getMonth() === month ? today : new Date(year, month, 1)
    setWeekStart(startOfWeek(base))
    setExpandedDays(new Set())
    setView('weekly')
  }

  function switchToMonthly() {
    setYear(weekStart.getFullYear())
    setMonth(weekStart.getMonth())
    setView('monthly')
  }

  function goToWeekFor(date) {
    setWeekStart(startOfWeek(date))
    setExpandedDays(new Set([isoDate(date)]))
    setView('weekly')
  }

  function handleMonthlyDayClick(date) {
    goToWeekFor(date)
  }

  function handleMonthlyAddClick(date, event) {
    event.stopPropagation()
    goToWeekFor(date)
    openAddForm(date)
  }

  function toggleDayExpanded(iso) {
    setExpandedDays((current) => {
      const next = new Set(current)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  function openAddForm(date) {
    setAddDate(date)
    setAssignmentForm(blankAssignmentForm())
    setAssignmentError('')
  }

  function closeAddForm() {
    setAddDate(null)
    setAssignmentForm(null)
    setAssignmentError('')
  }

  function updateAssignmentForm(field, value) {
    setAssignmentForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSaveAssignment(event) {
    event.preventDefault()
    if (!assignmentForm.wrangler_id || !assignmentForm.time_slot_id) {
      setAssignmentError('Choose a wrangler and a time slot.')
      return
    }

    setSavingAssignment(true)
    setAssignmentError('')

    const horseId = assignmentForm.activity === 'riding' && assignmentForm.horse_id ? assignmentForm.horse_id : null

    const { error: saveError } = await supabase.from('wrangler_assignments').insert({
      wrangler_id: assignmentForm.wrangler_id,
      date: isoDate(addDate),
      time_slot_id: assignmentForm.time_slot_id,
      activity: assignmentForm.activity,
      horse_id: horseId,
    })

    setSavingAssignment(false)

    if (saveError) {
      setAssignmentError(saveError.message)
      return
    }

    closeAddForm()
    reload()
  }

  async function handleConfirmDelete() {
    if (!deletingAssignment) return
    const { assignment, date } = deletingAssignment

    if (assignment.source === 'recurring') {
      await supabase
        .from('wrangler_recurring_skips')
        .insert({ recurring_assignment_id: assignment.recurringAssignmentId, date: isoDate(date) })
    } else {
      await supabase.from('wrangler_assignments').delete().eq('id', assignment.id)
    }

    setDeletingAssignment(null)
    reload()
  }

  function deleteDialogMessage() {
    if (!deletingAssignment) return ''
    const { assignment, date } = deletingAssignment
    const wrangler = wranglersById[assignment.wrangler_id]
    const slot = timeSlotsById[assignment.time_slot_id]
    const horse = assignment.horse_id ? headsById[assignment.horse_id] : null
    const name = wranglerShortName(wrangler)
    const activityText = assignment.activity === 'riding' ? `riding${horse ? ` ${horse.name}` : ''}` : 'working'
    const dateText = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    const base = `${name} ${activityText} on ${dateText}, ${slot?.name ?? ''}.`
    const hint =
      assignment.source === 'recurring'
        ? ` This only removes this one date — to remove the standing weekly assignment entirely, edit it from ${name}'s profile.`
        : ''
    return base + hint
  }

  function openDayNoteEditor(iso) {
    setEditingDayNoteIso(iso)
    setDayNoteDraft(dayNotesByDate[iso]?.body ?? '')
  }

  async function handleSaveDayNote() {
    const existing = dayNotesByDate[editingDayNoteIso]
    const body = dayNoteDraft.trim()

    if (!body && existing) {
      await supabase.from('wrangler_calendar_notes').delete().eq('id', existing.id)
    } else if (body && existing) {
      await supabase
        .from('wrangler_calendar_notes')
        .update({ body, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else if (body) {
      await supabase.from('wrangler_calendar_notes').insert({ note_date: editingDayNoteIso, body })
    }

    setEditingDayNoteIso(null)
    reload()
  }

  function openMonthNoteEditor() {
    setMonthNoteDraft(monthNote?.body ?? '')
    setEditingMonthNote(true)
  }

  async function handleSaveMonthNote() {
    const body = monthNoteDraft.trim()
    const monthIso = monthKey(year, month)

    if (!body && monthNote) {
      await supabase.from('wrangler_calendar_notes').delete().eq('id', monthNote.id)
    } else if (body && monthNote) {
      await supabase
        .from('wrangler_calendar_notes')
        .update({ body, updated_at: new Date().toISOString() })
        .eq('id', monthNote.id)
    } else if (body) {
      await supabase.from('wrangler_calendar_notes').insert({ note_month: monthIso, body })
    }

    setEditingMonthNote(false)
    reload()
  }

  function assignmentLabel(assignment) {
    const wrangler = wranglersById[assignment.wrangler_id]
    const slot = timeSlotsById[assignment.time_slot_id]
    const horse = assignment.horse_id ? headsById[assignment.horse_id] : null
    return `${wranglerShortName(wrangler)} · ${slot?.name ?? '—'} · ${ACTIVITY_LABELS[assignment.activity]}${
      horse ? ` · ${horse.name}` : ''
    }`
  }

  // Monthly cells are now a read-only summary — tapping one drills into the
  // Weekly view for that day, where all editing happens.
  function renderDay(date, inMonth) {
    const iso = isoDate(date)
    const assignments = effectiveAssignmentsForDate(date, recurring, skipsByRecurringId, oneOffByDate, timeSlotsById)
    const isToday = iso === isoDate(today)

    return (
      <div
        role={inMonth ? 'button' : undefined}
        tabIndex={inMonth ? 0 : undefined}
        onClick={inMonth ? () => handleMonthlyDayClick(date) : undefined}
        className={`flex min-h-[92px] flex-col gap-0.5 p-1 text-left ${inMonth ? 'cursor-pointer active:bg-surface-canvas' : ''}`}
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
              onClick={(event) => handleMonthlyAddClick(date, event)}
              aria-label="Add assignment"
              className="material-symbols-outlined text-[14px] text-ink-300 active:text-accent-bright"
            >
              add
            </button>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          {assignments.map((assignment) => {
            const key = `${assignment.source}-${assignment.id ?? assignment.recurringAssignmentId}`
            return (
              <div key={key} className="truncate rounded-sm bg-chip-bg px-1 py-0.5 text-2xs text-chip-fg">
                {assignmentLabel(assignment)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderPrintDay(date, inMonth) {
    const iso = isoDate(date)
    const assignments = effectiveAssignmentsForDate(date, recurring, skipsByRecurringId, oneOffByDate, timeSlotsById)
    const dayNote = dayNotesByDate[iso]
    const shown = assignments.slice(0, PRINT_MAX_ITEMS_PER_DAY)
    const hiddenCount = assignments.length - shown.length

    return (
      <div className="flex h-full flex-col gap-0.5 overflow-hidden p-1" style={{ opacity: inMonth ? 1 : 0.35 }}>
        <span className="font-bold text-gray-900">{date.getDate()}</span>
        {dayNote && <span className="truncate italic text-gray-600">{dayNote.body}</span>}
        {shown.map((assignment) => {
          const key = `${assignment.source}-${assignment.id ?? assignment.recurringAssignmentId}`
          return (
            <span key={key} className="truncate text-gray-800">
              {assignmentLabel(assignment)}
            </span>
          )
        })}
        {hiddenCount > 0 && <span className="text-gray-500">+{hiddenCount} more</span>}
      </div>
    )
  }

  const printTitleBlockPx =
    TITLE_ROW_PX + (monthNote ? MONTH_NOTE_ROW_PX : 0) + WEEKDAY_HEADER_ROW_PX + PRINT_SAFETY_BUFFER_PX
  const rowHeightPx = (PAGE_HEIGHT_PX - printTitleBlockPx) / weekRowsInMonth(year, month)
  const addDaySlots = addDate ? timeSlots.filter((slot) => slot.day_of_week === weekdayKey(addDate)) : []
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas print:bg-white">
      <div className="print:hidden">
        <TopNav backTo="/wranglers" backLabel="Wranglers" />
      </div>

      <main className="flex flex-1 flex-col items-center gap-3 px-4 py-6 print:p-0 sm:px-6">
        <div className="flex w-full max-w-4xl items-center justify-between print:hidden">
          <span className="font-display text-3xl font-light text-ink-900">
            {view === 'monthly' ? 'Monthly View' : 'Weekly View'}
          </span>
          <div className="flex items-center gap-3">
            {view === 'monthly' ? (
              <button
                type="button"
                onClick={switchToWeekly}
                className="text-[14px] font-semibold text-ink-600 underline active:text-ink-900"
              >
                Weekly View
              </button>
            ) : (
              <button
                type="button"
                onClick={switchToMonthly}
                className="text-[14px] font-semibold text-ink-600 underline active:text-ink-900"
              >
                Monthly View
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading || Boolean(error)}
              className="flex h-12 items-center justify-center rounded-md bg-accent-bright px-5 text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50"
            >
              Print
            </button>
          </div>
        </div>

        {view === 'monthly' ? (
          <div className="flex w-full max-w-4xl items-center justify-between print:hidden">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border-input bg-white text-ink-600 active:bg-surface-canvas"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="font-display text-xl font-semibold text-ink-900">{monthLabel(year, month)}</span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Next month"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border-input bg-white text-ink-600 active:bg-surface-canvas"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        ) : (
          <div className="flex w-full max-w-4xl items-center justify-between print:hidden">
            <button
              type="button"
              onClick={() => changeWeek(-1)}
              aria-label="Previous week"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border-input bg-white text-ink-600 active:bg-surface-canvas"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="font-display text-xl font-semibold text-ink-900">{weekRangeLabel(weekStart)}</span>
            <button
              type="button"
              onClick={() => changeWeek(1)}
              aria-label="Next week"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border-input bg-white text-ink-600 active:bg-surface-canvas"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        )}

        {view === 'monthly' && (
          <div className="flex w-full max-w-4xl items-center justify-between gap-3 rounded-md border border-border-card bg-white px-3 py-2 print:hidden">
            {monthNote ? (
              <p className="flex-1 text-[14px] italic text-ink-600">{monthNote.body}</p>
            ) : (
              <p className="flex-1 text-[14px] text-ink-300">No standing note for this month</p>
            )}
            {isManager && (
              <button
                type="button"
                onClick={openMonthNoteEditor}
                className="text-[14px] font-semibold text-accent-bright active:opacity-70"
              >
                Edit
              </button>
            )}
          </div>
        )}

        {loading && <p className="text-[15px] text-ink-400 print:hidden">Loading…</p>}
        {error && <p className="text-[15px] text-red-600 print:hidden">{error}</p>}

        {!loading && !error && view === 'monthly' && (
          <MonthCalendar year={year} month={month} renderDay={renderDay} className="w-full max-w-4xl print:hidden" />
        )}

        {!loading && !error && view === 'weekly' && (
          <div className="flex w-full max-w-4xl flex-col gap-3 print:hidden">
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
                <div key={iso} className="overflow-hidden rounded-md border border-border-card bg-white">
                  <button
                    type="button"
                    onClick={() => toggleDayExpanded(iso)}
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
                          onClick={() => openDayNoteEditor(iso)}
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
                        onClick={() => openDayNoteEditor(iso)}
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
                        onClick={() => openAddForm(date)}
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
                              const key = `${assignment.source}-${assignment.id ?? assignment.recurringAssignmentId}`
                              return (
                                <div key={key} className="flex items-center justify-between gap-2 py-0.5">
                                  <span className="min-w-0 truncate text-[15px] text-ink-900">
                                    {wranglerShortName(wrangler)}
                                    {horse ? ` · ${horse.name}` : ''}
                                  </span>
                                  <div className="flex flex-shrink-0 items-center gap-1">
                                    {wrangler?.notes && (
                                      <button
                                        type="button"
                                        onClick={() => setViewingNotesFor(wrangler)}
                                        aria-label={`${wranglerShortName(wrangler)}'s notes`}
                                        className="material-symbols-outlined text-[16px] text-accent-bright"
                                      >
                                        notifications
                                      </button>
                                    )}
                                    {isManager && (
                                      <button
                                        type="button"
                                        onClick={() => setDeletingAssignment({ assignment, date })}
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
        )}

        {!loading && !error && (
          <div
            className="wrangler-schedule-print hidden w-full flex-col overflow-hidden bg-white print:flex"
            style={{ height: `${PAGE_HEIGHT_PX}px` }}
          >
            <div className="flex items-baseline justify-between pb-2">
              <h2 className="text-xl font-bold text-gray-900">Wrangler schedule &middot; {monthLabel(year, month)}</h2>
            </div>
            {monthNote && <p className="pb-2 text-sm italic text-gray-700">{monthNote.body}</p>}
            <MonthCalendar
              year={year}
              month={month}
              renderDay={renderPrintDay}
              gridStyle={{ gridAutoRows: `${rowHeightPx}px`, fontSize: '8px', width: `${USABLE_WIDTH_PX}px` }}
            />
          </div>
        )}
      </main>

      {assignmentForm && (
        <div
          role="presentation"
          onClick={closeAddForm}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4 print:hidden"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="fscroll flex max-h-[90vh] w-full max-w-sm flex-col gap-3 overflow-auto rounded-md bg-white p-5 shadow-card"
          >
            <h2 className="font-display text-xl font-semibold text-ink-900">Add one-off assignment</h2>
            <p className="text-sm text-ink-400">
              {isoDate(addDate)} — for a standing weekly assignment, edit it on the wrangler's own profile instead.
            </p>

            <form onSubmit={handleSaveAssignment} className="flex flex-col gap-3">
              <SelectField
                label="Wrangler"
                required
                value={assignmentForm.wrangler_id}
                onChange={(event) => updateAssignmentForm('wrangler_id', event.target.value)}
              >
                <option value="" disabled>
                  Select…
                </option>
                {wranglers.map((wrangler) => (
                  <option key={wrangler.id} value={wrangler.id}>
                    {wranglerShortName(wrangler)}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Time slot"
                required
                value={assignmentForm.time_slot_id}
                onChange={(event) => updateAssignmentForm('time_slot_id', event.target.value)}
              >
                <option value="" disabled>
                  {addDaySlots.length === 0 ? 'No time slots for this day' : 'Select…'}
                </option>
                {addDaySlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.name}
                  </option>
                ))}
              </SelectField>

              {addDaySlots.length === 0 && (
                <p className="text-sm text-ink-300">
                  No time slots are configured for this day yet.{' '}
                  <Link to="/wranglers/time-slots" className="underline" onClick={closeAddForm}>
                    Add one
                  </Link>
                  .
                </p>
              )}

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-[15px] text-ink-900">
                  <input
                    type="radio"
                    name="activity"
                    checked={assignmentForm.activity === 'working'}
                    onChange={() => updateAssignmentForm('activity', 'working')}
                  />
                  Working
                </label>
                <label className="flex items-center gap-2 text-[15px] text-ink-900">
                  <input
                    type="radio"
                    name="activity"
                    checked={assignmentForm.activity === 'riding'}
                    onChange={() => updateAssignmentForm('activity', 'riding')}
                  />
                  Riding
                </label>
              </div>

              {assignmentForm.activity === 'riding' && (
                <SelectField
                  label="Horse (optional)"
                  value={assignmentForm.horse_id}
                  onChange={(event) => updateAssignmentForm('horse_id', event.target.value)}
                >
                  <option value="">None</option>
                  {heads.map((head) => (
                    <option key={head.id} value={head.id}>
                      {head.name}
                    </option>
                  ))}
                </SelectField>
              )}

              {assignmentError && <p className="text-[15px] text-red-600">{assignmentError}</p>}

              <div className="mt-1 flex gap-3">
                <button
                  type="button"
                  onClick={closeAddForm}
                  className="flex h-11 flex-1 items-center justify-center rounded-md border border-border-input bg-white text-[15px] font-semibold text-ink-600 active:bg-surface-canvas"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssignment}
                  className="flex h-11 flex-1 items-center justify-center rounded-md bg-accent-bright text-[15px] font-bold text-white active:opacity-90 disabled:opacity-50"
                >
                  {savingAssignment ? 'Saving…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingDayNoteIso && (
        <div
          role="presentation"
          onClick={() => setEditingDayNoteIso(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4 print:hidden"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-md bg-white p-5 shadow-card"
          >
            <h2 className="font-display text-xl font-semibold text-ink-900">Note for {editingDayNoteIso}</h2>
            <TextAreaField label="Note" value={dayNoteDraft} onChange={(event) => setDayNoteDraft(event.target.value)} />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditingDayNoteIso(null)}
                className="flex h-11 flex-1 items-center justify-center rounded-md border border-border-input bg-white text-[15px] font-semibold text-ink-600 active:bg-surface-canvas"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDayNote}
                className="flex h-11 flex-1 items-center justify-center rounded-md bg-accent-bright text-[15px] font-bold text-white active:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMonthNote && (
        <div
          role="presentation"
          onClick={() => setEditingMonthNote(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4 print:hidden"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-md bg-white p-5 shadow-card"
          >
            <h2 className="font-display text-xl font-semibold text-ink-900">Note for {monthLabel(year, month)}</h2>
            <TextAreaField
              label="Standing note"
              value={monthNoteDraft}
              onChange={(event) => setMonthNoteDraft(event.target.value)}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditingMonthNote(false)}
                className="flex h-11 flex-1 items-center justify-center rounded-md border border-border-input bg-white text-[15px] font-semibold text-ink-600 active:bg-surface-canvas"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMonthNote}
                className="flex h-11 flex-1 items-center justify-center rounded-md bg-accent-bright text-[15px] font-bold text-white active:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingNotesFor && (
        <div
          role="presentation"
          onClick={() => setViewingNotesFor(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4 print:hidden"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-md bg-white p-5 shadow-card"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold text-ink-900">{wranglerShortName(viewingNotesFor)}</h2>
              {isManager && (
                <Link
                  to={`/wranglers/${viewingNotesFor.id}`}
                  aria-label="Edit wrangler"
                  className="material-symbols-outlined text-[18px] text-ink-400"
                >
                  edit
                </Link>
              )}
            </div>
            <p className="whitespace-pre-line text-[15px] text-ink-600">{viewingNotesFor.notes}</p>
            <button
              type="button"
              onClick={() => setViewingNotesFor(null)}
              className="flex h-11 items-center justify-center rounded-md border border-border-input bg-white text-[15px] font-semibold text-ink-600 active:bg-surface-canvas"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletingAssignment)}
        title="Delete this wrangler event?"
        message={deleteDialogMessage()}
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingAssignment(null)}
      />
    </div>
  )
}
