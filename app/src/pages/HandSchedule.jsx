import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav'
import ConfirmDialog from '../components/ConfirmDialog'
import { ScheduleViewHeader, SchedulePeriodNav } from '../components/ScheduleChrome'
import { HandScheduleMonthly, HandScheduleMonthlyPrint } from './HandScheduleMonthly'
import { HandScheduleWeekly, HandScheduleWeeklyPrint } from './HandScheduleWeekly'
import HandScheduleAddForm from './HandScheduleAddForm'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { usePageOrientation } from '../lib/pageSetup'
import { useCalendarView } from '../lib/calendarView'
import { isoDate, monthGridRange, addDays } from '../lib/calendarSchedule'
import { SCHEDULABLE_ROLES } from '../lib/handSchedule'

export default function HandSchedule() {
  const { isManager, profile } = useAuth()
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

  const [hands, setHands] = useState([])
  const [shiftTypes, setShiftTypes] = useState([])
  const [recurring, setRecurring] = useState([])
  const [skips, setSkips] = useState([])
  const [events, setEvents] = useState([])
  const [vacations, setVacations] = useState([])

  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [addDate, setAddDate] = useState(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const [eventError, setEventError] = useState('')

  const [deletingShift, setDeletingShift] = useState(null)
  const [actionError, setActionError] = useState('')

  // Weekly print is one page per day (portrait); Monthly print keeps the
  // letter-landscape default set in index.css.
  usePageOrientation(view === 'weekly' ? 'portrait' : undefined)

  const handsById = useMemo(() => Object.fromEntries(hands.map((h) => [h.id, h])), [hands])
  const shiftTypesById = useMemo(() => Object.fromEntries(shiftTypes.map((t) => [t.id, t])), [shiftTypes])

  const skipsByRecurringId = useMemo(() => {
    const map = {}
    for (const skip of skips) {
      if (!map[skip.recurring_shift_id]) map[skip.recurring_shift_id] = new Set()
      map[skip.recurring_shift_id].add(skip.date)
    }
    return map
  }, [skips])

  const eventsByDate = useMemo(() => {
    const map = {}
    for (const event of events) {
      if (!map[event.event_date]) map[event.event_date] = []
      map[event.event_date].push(event)
    }
    return map
  }, [events])

  const vacationsByProfileId = useMemo(() => {
    const map = {}
    for (const vacation of vacations) {
      if (!map[vacation.profile_id]) map[vacation.profile_id] = []
      map[vacation.profile_id].push(vacation)
    }
    return map
  }, [vacations])

  useEffect(() => {
    let active = true

    async function loadAll() {
      setLoading(true)
      setError('')

      const { start, end } = view === 'weekly' ? { start: weekStart, end: addDays(weekStart, 6) } : monthGridRange(year, month)
      const startIso = isoDate(start)
      const endIso = isoDate(end)

      const [handsResult, typesResult, recurringResult, skipsResult, eventsResult, vacationsResult] = await Promise.all([
        supabase.from('profiles').select('id, name').in('role', SCHEDULABLE_ROLES).eq('status', 'active').order('name'),
        // Not filtered to active — an archived type must still resolve
        // correctly for any existing recurring shift that references it
        // (archiving retires it from new picks, it doesn't erase history).
        // This page never offers a shift-type picker, so there's no
        // active-only requirement to preserve here.
        supabase.from('hand_shift_types').select('id, name, day_of_week, sort_order').order('sort_order'),
        supabase
          .from('hand_recurring_shifts')
          .select('id, profile_id, shift_type_id, biweekly, biweekly_start_date'),
        supabase.from('hand_recurring_shift_skips').select('id, recurring_shift_id, date'),
        supabase
          .from('hand_shift_events')
          .select('id, title, event_date, event_time, notes, hand_shift_event_members(profile_id)')
          .gte('event_date', startIso)
          .lte('event_date', endIso),
        supabase.from('hand_vacations').select('id, profile_id, start_date, end_date'),
      ])

      if (!active) return

      const firstError = [handsResult, typesResult, recurringResult, skipsResult, eventsResult, vacationsResult].find(
        (result) => result.error,
      )?.error

      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      setHands(handsResult.data ?? [])
      setShiftTypes(typesResult.data ?? [])
      setRecurring(recurringResult.data ?? [])
      setSkips(skipsResult.data ?? [])
      setEvents(
        (eventsResult.data ?? []).map((event) => ({
          ...event,
          members: (event.hand_shift_event_members ?? []).map((member) => member.profile_id),
        })),
      )
      setVacations(vacationsResult.data ?? [])
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
    setEventError('')
  }

  function closeAddForm() {
    setAddDate(null)
    setEventError('')
  }

  async function handleSaveEvent(eventForm) {
    if (!eventForm.title.trim() || !eventForm.event_time.trim()) {
      setEventError('Enter a title and time.')
      return
    }
    if (eventForm.member_ids.length === 0) {
      setEventError('Select at least one hand.')
      return
    }

    setSavingEvent(true)
    setEventError('')

    const { data: inserted, error: insertError } = await supabase
      .from('hand_shift_events')
      .insert({
        title: eventForm.title.trim(),
        event_date: isoDate(addDate),
        event_time: eventForm.event_time.trim(),
        notes: eventForm.notes.trim() || null,
        updated_by: profile?.id ?? null,
      })
      .select('id')
      .single()

    if (insertError) {
      setEventError(insertError.message)
      setSavingEvent(false)
      return
    }

    const { error: membersError } = await supabase
      .from('hand_shift_event_members')
      .insert(eventForm.member_ids.map((profileId) => ({ event_id: inserted.id, profile_id: profileId })))

    setSavingEvent(false)

    if (membersError) {
      // Don't leave a member-less event behind — it would render nowhere
      // (effectiveShiftsForDate expands events by member) and have no UI
      // path to find or delete it.
      await supabase.from('hand_shift_events').delete().eq('id', inserted.id)
      setEventError(membersError.message)
      return
    }

    closeAddForm()
    reload()
  }

  async function handleConfirmDelete() {
    if (!deletingShift) return
    const { shift, date } = deletingShift

    let opError = null

    if (shift.source === 'recurring') {
      const { error: skipError } = await supabase
        .from('hand_recurring_shift_skips')
        .insert({ recurring_shift_id: shift.recurringShiftId, date: isoDate(date) })
      opError = skipError
    } else {
      const { error: memberError } = await supabase
        .from('hand_shift_event_members')
        .delete()
        .eq('event_id', shift.eventId)
        .eq('profile_id', shift.profile_id)
      opError = memberError

      if (!opError) {
        // Check the live count, not local state — another manager could
        // have changed this event's members in the meantime.
        const { count, error: countError } = await supabase
          .from('hand_shift_event_members')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', shift.eventId)
        opError = countError
        if (!opError && (count ?? 0) === 0) {
          const { error: eventDeleteError } = await supabase.from('hand_shift_events').delete().eq('id', shift.eventId)
          opError = eventDeleteError
        }
      }
    }

    setDeletingShift(null)
    setActionError(opError ? opError.message : '')
    reload()
  }

  function deleteDialogMessage() {
    if (!deletingShift) return ''
    const { shift, date } = deletingShift
    const hand = handsById[shift.profile_id]
    const name = hand?.name ?? 'Unknown'
    const dateText = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })

    if (shift.source === 'recurring') {
      const type = shiftTypesById[shift.shift_type_id]
      return `${name}'s ${type?.name ?? 'shift'} on ${dateText}. This only removes this one date — to remove the standing shift entirely, edit it from ${name}'s profile.`
    }
    return `Remove ${name} from "${shift.title}" on ${dateText}? Other assigned hands are unaffected.`
  }

  const monthlyProps = {
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
  }

  const weeklyProps = {
    weekDays,
    weekStart,
    today,
    expandedDays,
    isManager,
    handsById,
    shiftTypesById,
    recurring,
    skipsByRecurringId,
    eventsByDate,
    vacationsByProfileId,
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas print:bg-white">
      <div className="print:hidden">
        <TopNav backTo="/hands" backLabel="Hands" />
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

        {loading && <p className="text-[15px] text-ink-400 print:hidden">Loading…</p>}
        {error && <p className="text-[15px] text-red-600 print:hidden">{error}</p>}
        {actionError && <p className="text-[15px] text-red-600 print:hidden">{actionError}</p>}

        {!loading && !error && view === 'monthly' && (
          <HandScheduleMonthly
            {...monthlyProps}
            onDayClick={handleMonthlyDayClick}
            onAddClick={handleMonthlyAddClick}
          />
        )}

        {!loading && !error && view === 'weekly' && (
          <HandScheduleWeekly
            {...weeklyProps}
            onToggleDay={toggleDayExpanded}
            onOpenAdd={openAddForm}
            onDeleteShift={setDeletingShift}
          />
        )}

        {!loading && !error && view === 'monthly' && <HandScheduleMonthlyPrint {...monthlyProps} />}

        {!loading && !error && view === 'weekly' && <HandScheduleWeeklyPrint {...weeklyProps} />}
      </main>

      {addDate && (
        <HandScheduleAddForm
          date={addDate}
          hands={hands}
          handsById={handsById}
          saving={savingEvent}
          error={eventError}
          onSubmit={handleSaveEvent}
          onClose={closeAddForm}
        />
      )}

      <ConfirmDialog
        open={Boolean(deletingShift)}
        title="Remove this hand shift?"
        message={deleteDialogMessage()}
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingShift(null)}
      />
    </div>
  )
}
