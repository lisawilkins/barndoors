import { useEffect, useMemo, useState } from 'react'
import TopNav from '../components/TopNav'
import MonthCalendar from '../components/MonthCalendar'
import LandscapeContent from '../components/LandscapeContent'
import ConfirmDialog from '../components/ConfirmDialog'
import { TextField, TextAreaField } from '../components/FormField'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
  isoDate,
  monthLabel,
  monthGridRange,
  startOfWeek,
  addDays,
  weekdayDateLabel,
  weekRangeLabel,
} from '../lib/calendarSchedule'
import { effectiveShiftsForDate, groupEffectiveShifts, isOnVacation } from '../lib/handSchedule'

function blankEventForm() {
  return { title: '', event_time: '', notes: '', member_ids: [] }
}

function groupHeaderLabel(group, shiftTypesById) {
  if (group.source === 'recurring') return shiftTypesById[group.shift_type_id]?.name ?? '—'
  return group.title
}

export default function HandSchedule() {
  const { isManager, profile } = useAuth()
  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState('monthly') // 'monthly' | 'weekly'
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const [expandedDays, setExpandedDays] = useState(() => new Set())

  const [hands, setHands] = useState([])
  const [shiftTypes, setShiftTypes] = useState([])
  const [recurring, setRecurring] = useState([])
  const [skips, setSkips] = useState([])
  const [events, setEvents] = useState([])
  const [vacations, setVacations] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [addDate, setAddDate] = useState(null)
  const [eventForm, setEventForm] = useState(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const [eventError, setEventError] = useState('')
  const [handPickerOpen, setHandPickerOpen] = useState(false)
  const [handFilter, setHandFilter] = useState('')

  const [deletingShift, setDeletingShift] = useState(null)
  const [scrollToIso, setScrollToIso] = useState(null)

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
        supabase.from('profiles').select('id, name').eq('role', 'hand').eq('status', 'active').order('name'),
        supabase.from('hand_shift_types').select('id, name, day_of_week, sort_order').eq('active', true).order('sort_order'),
        supabase.from('hand_recurring_shifts').select('id, profile_id, shift_type_id'),
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
    window.scrollTo({ top: 0 })
  }

  function switchToMonthly() {
    // weekStart is always a Sunday, which can land in the previous month from
    // most of the days actually on screen (e.g. tapping Sep 1 sets weekStart
    // to Aug 30) — anchor on the week's Wednesday instead so this lands on
    // whichever month owns most of the visible week, not just its first day.
    const monthAnchor = addDays(weekStart, 3)
    setYear(monthAnchor.getFullYear())
    setMonth(monthAnchor.getMonth())
    setView('monthly')
    window.scrollTo({ top: 0 })
  }

  function goToWeekFor(date) {
    const iso = isoDate(date)
    setWeekStart(startOfWeek(date))
    setExpandedDays(new Set([iso]))
    setScrollToIso(iso)
    setView('weekly')
  }

  // Tapping a Monthly day should land the user on that day's card, not just
  // the top of the week — scroll it into view once the Weekly list has
  // rendered (data load finishes async, so this can't happen inline with
  // goToWeekFor above).
  useEffect(() => {
    if (view !== 'weekly' || loading || !scrollToIso) return
    const el = document.querySelector(`[data-day-iso="${scrollToIso}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setScrollToIso(null)
  }, [view, loading, scrollToIso])

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
    setEventForm(blankEventForm())
    setEventError('')
    setHandPickerOpen(false)
    setHandFilter('')
  }

  function closeAddForm() {
    setAddDate(null)
    setEventForm(null)
    setEventError('')
    setHandPickerOpen(false)
    setHandFilter('')
  }

  function updateEventForm(field, value) {
    setEventForm((current) => ({ ...current, [field]: value }))
  }

  function toggleEventMember(profileId) {
    setEventForm((current) => {
      const memberIds = current.member_ids.includes(profileId)
        ? current.member_ids.filter((value) => value !== profileId)
        : [...current.member_ids, profileId]
      return { ...current, member_ids: memberIds }
    })
  }

  async function handleSaveEvent(event) {
    event.preventDefault()
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
      setEventError(membersError.message)
      return
    }

    closeAddForm()
    reload()
  }

  async function handleConfirmDelete() {
    if (!deletingShift) return
    const { shift, date } = deletingShift

    if (shift.source === 'recurring') {
      await supabase
        .from('hand_recurring_shift_skips')
        .insert({ recurring_shift_id: shift.recurringShiftId, date: isoDate(date) })
    } else {
      await supabase
        .from('hand_shift_event_members')
        .delete()
        .eq('event_id', shift.eventId)
        .eq('profile_id', shift.profile_id)

      const event = events.find((e) => e.id === shift.eventId)
      if (event && (event.members?.length ?? 0) <= 1) {
        await supabase.from('hand_shift_events').delete().eq('id', shift.eventId)
      }
    }

    setDeletingShift(null)
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

  // Monthly cells are a read-only summary — tapping one drills into the
  // Weekly view for that day, where all editing happens. Grouped by shift
  // type (recurring) or by event (one-off) so the cell reads as "when, then
  // who" at a glance. A hand on vacation still shows here — just dimmed with
  // a 🌴 — never omitted.
  function renderDay(date, inMonth) {
    const iso = isoDate(date)
    const shifts = effectiveShiftsForDate(date, recurring, skipsByRecurringId, eventsByDate, shiftTypesById)
    const groups = groupEffectiveShifts(shifts, shiftTypesById)
    const isToday = iso === isoDate(today)

    return (
      <div
        role={inMonth ? 'button' : undefined}
        tabIndex={inMonth ? 0 : undefined}
        onClick={inMonth ? () => handleMonthlyDayClick(date) : undefined}
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
              onClick={(event) => handleMonthlyAddClick(date, event)}
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
                const key =
                  shift.source === 'recurring' ? `recurring-${shift.recurringShiftId}` : `oneoff-${shift.eventId}-${shift.profile_id}`
                return (
                  <div
                    key={key}
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

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav backTo="/hands" backLabel="Hands" />

      <main className="flex flex-1 flex-col items-center gap-3 px-4 py-6 sm:px-6">
        <div className="flex w-full max-w-[800px] items-center justify-between">
          <span className="font-display text-3xl font-light text-ink-900">
            {view === 'monthly' ? 'Monthly View' : 'Weekly View'}
          </span>
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
        </div>

        {view === 'monthly' ? (
          <div className="flex w-full max-w-[800px] items-center justify-between">
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
          <div className="flex w-full max-w-[800px] items-center justify-between">
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

        {loading && <p className="text-[15px] text-ink-400">Loading…</p>}
        {error && <p className="text-[15px] text-red-600">{error}</p>}

        {!loading && !error && view === 'monthly' && (
          <LandscapeContent>
            <MonthCalendar year={year} month={month} renderDay={renderDay} className="w-full" />
          </LandscapeContent>
        )}

        {!loading && !error && view === 'weekly' && (
          <div className="flex w-full max-w-[800px] flex-col gap-3">
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

                  {isManager && expanded && (
                    <div className="flex items-center justify-end gap-2 px-3.5 pb-3">
                      <button
                        type="button"
                        onClick={() => openAddForm(date)}
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
                            const key =
                              shift.source === 'recurring'
                                ? `recurring-${shift.recurringShiftId}`
                                : `oneoff-${shift.eventId}-${shift.profile_id}`
                            return (
                              <div key={key} className="flex items-center justify-between gap-2 py-0.5">
                                <span
                                  className={`min-w-0 truncate text-[15px] text-ink-900 ${onVacation ? 'opacity-50' : ''}`}
                                >
                                  {hand?.name ?? 'Unknown'}
                                  {onVacation && ' 🌴'}
                                </span>
                                {isManager && (
                                  <button
                                    type="button"
                                    onClick={() => setDeletingShift({ shift, date })}
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
        )}
      </main>

      {eventForm && (
        <div
          role="presentation"
          onClick={closeAddForm}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="fscroll flex max-h-[90vh] w-full max-w-sm flex-col gap-3 overflow-auto rounded-md bg-white p-5 shadow-card"
          >
            <h2 className="font-display text-xl font-semibold text-ink-900">Add one-off shift</h2>
            <p className="text-sm text-ink-400">
              {isoDate(addDate)} — for a standing weekly shift, edit it on the hand's own profile instead.
            </p>

            <form onSubmit={handleSaveEvent} className="flex flex-col gap-3">
              <TextField
                label="Title"
                required
                autoFocus
                placeholder="e.g. Gymkhana"
                value={eventForm.title}
                onChange={(event) => updateEventForm('title', event.target.value)}
              />
              <TextField
                label="Time"
                required
                placeholder="e.g. 8am"
                value={eventForm.event_time}
                onChange={(event) => updateEventForm('event_time', event.target.value)}
              />
              <TextAreaField
                label="Notes"
                placeholder="e.g. Groom for event. Meet at SA or event venue."
                value={eventForm.notes}
                onChange={(event) => updateEventForm('notes', event.target.value)}
              />

              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-ink-400">Hands</span>

                {hands.length === 0 ? (
                  <p className="text-[15px] text-ink-400">No active hands to add yet.</p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setHandPickerOpen((current) => !current)
                        setHandFilter('')
                      }}
                      className="flex min-h-12 items-center justify-between gap-2 rounded-md border border-border-input bg-white px-2.5 py-1.5"
                    >
                      <span className="flex flex-1 flex-wrap gap-1.5">
                        {eventForm.member_ids.length === 0 ? (
                          <span className="text-[15px] text-ink-300">Select hands</span>
                        ) : (
                          eventForm.member_ids.map((memberId) => {
                            const hand = handsById[memberId]
                            return (
                              <span
                                key={memberId}
                                className="flex h-[30px] items-center gap-1.5 rounded-full bg-chip-bg px-2.5 text-[13px] font-semibold text-chip-fg"
                              >
                                {hand?.name ?? 'Unknown'}
                                <span
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Remove ${hand?.name ?? 'hand'}`}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    toggleEventMember(memberId)
                                  }}
                                  className="material-symbols-outlined text-[14px] text-placeholder-tan-1"
                                >
                                  close
                                </span>
                              </span>
                            )
                          })
                        )}
                      </span>
                      <span className="material-symbols-outlined flex-shrink-0 text-[16px] text-ink-300">expand_more</span>
                    </button>

                    {handPickerOpen && (
                      <div className="overflow-hidden rounded-md border border-border-input bg-white shadow-card">
                        <div className="flex items-center gap-2 border-b border-border-hairline px-2.5 py-2">
                          <span className="material-symbols-outlined text-[16px] text-ink-300">search</span>
                          <input
                            type="text"
                            autoFocus
                            value={handFilter}
                            onChange={(event) => setHandFilter(event.target.value)}
                            placeholder="Filter hands"
                            className="flex-1 border-0 bg-transparent text-[14px] text-ink-900 outline-none placeholder:text-ink-300"
                          />
                        </div>
                        <div className="fscroll max-h-44 overflow-auto">
                          {hands
                            .filter((hand) => (hand.name || '').toLowerCase().includes(handFilter.toLowerCase()))
                            .map((hand) => {
                              const selected = eventForm.member_ids.includes(hand.id)
                              return (
                                <div
                                  key={hand.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => toggleEventMember(hand.id)}
                                  className="flex cursor-pointer items-center gap-2.5 border-b border-border-hairline-2 px-2.5 py-2 last:border-0"
                                >
                                  <span
                                    className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${
                                      selected ? 'border-accent-bright bg-accent-bright' : 'border-ink-200 bg-white'
                                    }`}
                                  >
                                    {selected && <span className="material-symbols-outlined text-[14px] text-white">check</span>}
                                  </span>
                                  <span className="text-[15px] text-ink-900">{hand.name}</span>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {eventError && <p className="text-[15px] text-red-600">{eventError}</p>}

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
                  disabled={savingEvent}
                  className="flex h-11 flex-1 items-center justify-center rounded-md bg-accent-bright text-[15px] font-bold text-white active:opacity-90 disabled:opacity-50"
                >
                  {savingEvent ? 'Saving…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
