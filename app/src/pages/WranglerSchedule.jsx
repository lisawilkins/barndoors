import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'
import ConfirmDialog from '../components/ConfirmDialog'
import NoPhotosIcon from '../components/NoPhotosIcon'
import { TextAreaField } from '../components/FormField'
import { ScheduleViewHeader, SchedulePeriodNav } from '../components/ScheduleChrome'
import { WranglerScheduleMonthly, WranglerScheduleMonthlyPrint } from './WranglerScheduleMonthly'
import { WranglerScheduleWeekly, WranglerScheduleWeeklyPrint } from './WranglerScheduleWeekly'
import WranglerScheduleAddForm from './WranglerScheduleAddForm'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { usePageOrientation } from '../lib/pageSetup'
import { useCalendarView } from '../lib/calendarView'
import {
  isoDate,
  monthKey,
  monthLabel,
  monthGridRange,
  addDays,
  wranglerShortName,
} from '../lib/wranglerSchedule'

export default function WranglerSchedule() {
  const { isManager } = useAuth()
  const [loading, setLoading] = useState(true)
  const {
    today,
    view,
    year,
    month,
    weekStart,
    weekDays,
    expandedDays,
    changeMonth,
    changeWeek,
    switchToWeekly,
    switchToMonthly,
    goToWeekFor,
    toggleDayExpanded,
  } = useCalendarView(loading)

  const [wranglers, setWranglers] = useState([])
  const [timeSlots, setTimeSlots] = useState([])
  const [heads, setHeads] = useState([])
  const [recurring, setRecurring] = useState([])
  const [skips, setSkips] = useState([])
  const [oneOff, setOneOff] = useState([])
  const [dayNotes, setDayNotes] = useState([])
  const [monthNote, setMonthNote] = useState(null)

  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [addDate, setAddDate] = useState(null)
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')

  const [editingDayNoteIso, setEditingDayNoteIso] = useState(null)
  const [dayNoteDraft, setDayNoteDraft] = useState('')
  const [editingMonthNote, setEditingMonthNote] = useState(false)
  const [monthNoteDraft, setMonthNoteDraft] = useState('')

  const [viewingNotesFor, setViewingNotesFor] = useState(null)
  const [deletingAssignment, setDeletingAssignment] = useState(null)
  const [actionError, setActionError] = useState('')

  // Weekly print is one page per day (portrait); Monthly print keeps the
  // letter-landscape default set in index.css.
  usePageOrientation(view === 'weekly' ? 'portrait' : undefined)

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
          .select('id, first_name, last_initial, notes, no_photos')
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

  function handleMonthlyDayClick(date) {
    goToWeekFor(date)
  }

  function handleMonthlyAddClick(date) {
    goToWeekFor(date)
    openAddForm(date)
  }

  function openAddForm(date) {
    setAddDate(date)
    setAssignmentError('')
  }

  function closeAddForm() {
    setAddDate(null)
    setAssignmentError('')
  }

  async function handleSaveAssignment(assignmentForm) {
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

    let opError = null

    if (assignment.source === 'recurring') {
      const { error: skipError } = await supabase
        .from('wrangler_recurring_skips')
        .insert({ recurring_assignment_id: assignment.recurringAssignmentId, date: isoDate(date) })
      opError = skipError
    } else {
      const { error: deleteError } = await supabase.from('wrangler_assignments').delete().eq('id', assignment.id)
      opError = deleteError
    }

    setDeletingAssignment(null)
    setActionError(opError ? opError.message : '')
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

    let opError = null

    if (!body && existing) {
      const { error: deleteError } = await supabase.from('wrangler_calendar_notes').delete().eq('id', existing.id)
      opError = deleteError
    } else if (body && existing) {
      const { error: updateError } = await supabase
        .from('wrangler_calendar_notes')
        .update({ body, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      opError = updateError
    } else if (body) {
      const { error: insertError } = await supabase
        .from('wrangler_calendar_notes')
        .insert({ note_date: editingDayNoteIso, body })
      opError = insertError
    }

    setEditingDayNoteIso(null)
    setActionError(opError ? opError.message : '')
    reload()
  }

  function openMonthNoteEditor() {
    setMonthNoteDraft(monthNote?.body ?? '')
    setEditingMonthNote(true)
  }

  async function handleSaveMonthNote() {
    const body = monthNoteDraft.trim()
    const monthIso = monthKey(year, month)

    let opError = null

    if (!body && monthNote) {
      const { error: deleteError } = await supabase.from('wrangler_calendar_notes').delete().eq('id', monthNote.id)
      opError = deleteError
    } else if (body && monthNote) {
      const { error: updateError } = await supabase
        .from('wrangler_calendar_notes')
        .update({ body, updated_at: new Date().toISOString() })
        .eq('id', monthNote.id)
      opError = updateError
    } else if (body) {
      const { error: insertError } = await supabase
        .from('wrangler_calendar_notes')
        .insert({ note_month: monthIso, body })
      opError = insertError
    }

    setEditingMonthNote(false)
    setActionError(opError ? opError.message : '')
    reload()
  }

  const monthlyProps = {
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
  }

  const weeklyProps = {
    weekDays,
    weekStart,
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
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas print:bg-white">
      <div className="print:hidden">
        <TopNav backTo="/wranglers" backLabel="Wranglers" />
      </div>

      <main className="flex flex-1 flex-col items-center gap-3 px-4 py-6 print:p-0 sm:px-6">
        <ScheduleViewHeader
          view={view}
          onSwitchToWeekly={switchToWeekly}
          onSwitchToMonthly={switchToMonthly}
          printDisabled={loading || Boolean(error)}
        />

        <SchedulePeriodNav
          view={view}
          year={year}
          month={month}
          weekStart={weekStart}
          onChangeMonth={changeMonth}
          onChangeWeek={changeWeek}
        />

        {view === 'monthly' && (
          <div className="flex w-full max-w-[800px] items-center justify-between gap-3 rounded-md border border-border-card bg-white px-3 py-2 print:hidden">
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
        {actionError && <p className="text-[15px] text-red-600 print:hidden">{actionError}</p>}

        {!loading && !error && view === 'monthly' && (
          <WranglerScheduleMonthly
            {...monthlyProps}
            onDayClick={handleMonthlyDayClick}
            onAddClick={handleMonthlyAddClick}
          />
        )}

        {!loading && !error && view === 'weekly' && (
          <WranglerScheduleWeekly
            {...weeklyProps}
            onToggleDay={toggleDayExpanded}
            onOpenDayNote={openDayNoteEditor}
            onOpenAdd={openAddForm}
            onViewNotes={setViewingNotesFor}
            onDeleteAssignment={setDeletingAssignment}
          />
        )}

        {!loading && !error && view === 'monthly' && (
          <WranglerScheduleMonthlyPrint {...monthlyProps} monthNote={monthNote} dayNotesByDate={dayNotesByDate} />
        )}

        {!loading && !error && view === 'weekly' && <WranglerScheduleWeeklyPrint {...weeklyProps} />}
      </main>

      {addDate && (
        <WranglerScheduleAddForm
          date={addDate}
          wranglers={wranglers}
          timeSlots={timeSlots}
          heads={heads}
          saving={savingAssignment}
          error={assignmentError}
          onSubmit={handleSaveAssignment}
          onClose={closeAddForm}
        />
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
              <h2 className="flex items-center gap-1.5 font-display text-xl font-semibold text-ink-900">
                {wranglerShortName(viewingNotesFor)}
                {viewingNotesFor?.no_photos && <NoPhotosIcon className="text-[18px]" />}
              </h2>
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
