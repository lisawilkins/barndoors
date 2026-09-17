import { useEffect, useMemo, useState } from 'react'
import { addDays, isoDate, startOfWeek } from './calendarSchedule'

// Shared month/week navigation for the Wrangler and Hand schedule screens.
// Chrome only — each page still owns what a day means (horses vs vacations,
// Ride/Work vs titled one-offs) and keeps its own route and product.
export function useCalendarView(loading) {
  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState('monthly') // 'monthly' | 'weekly'
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const [expandedDays, setExpandedDays] = useState(() => new Set())
  const [scrollToIso, setScrollToIso] = useState(null)

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

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

  function toggleDayExpanded(iso) {
    setExpandedDays((current) => {
      const next = new Set(current)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  return {
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
  }
}
