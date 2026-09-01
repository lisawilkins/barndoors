import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { formatDays } from '../lib/turnoutSchedule'
import { wranglerShortName } from '../lib/wranglerSchedule'

export default function Wranglers() {
  const { isManager } = useAuth()
  const [wranglers, setWranglers] = useState([])
  const [daysByWrangler, setDaysByWrangler] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      const [wranglersResult, recurringResult, slotsResult] = await Promise.all([
        supabase
          .from('wranglers')
          .select('id, first_name, last_initial, gender')
          .eq('status', 'active')
          .order('first_name', { ascending: true }),
        supabase.from('wrangler_recurring_assignments').select('wrangler_id, time_slot_id'),
        supabase.from('wrangler_time_slots').select('id, day_of_week').eq('active', true),
      ])

      if (!active) return

      const firstError = wranglersResult.error || recurringResult.error || slotsResult.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      const dayBySlotId = Object.fromEntries((slotsResult.data ?? []).map((slot) => [slot.id, slot.day_of_week]))
      const days = {}
      for (const row of recurringResult.data ?? []) {
        const day = dayBySlotId[row.time_slot_id]
        if (!day) continue
        if (!days[row.wrangler_id]) days[row.wrangler_id] = new Set()
        days[row.wrangler_id].add(day)
      }

      setWranglers(wranglersResult.data ?? [])
      setDaysByWrangler(days)
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-3xl font-light text-ink-900">Wranglers</h1>
          <div className="flex gap-2">
            {isManager && (
              <Link
                to="/wranglers/time-slots"
                className="flex h-11 items-center justify-center rounded-md border border-border-input bg-white px-4 text-[15px] font-semibold text-ink-600 active:bg-surface-canvas"
              >
                Time slots
              </Link>
            )}
            <Link
              to="/wranglers/schedule"
              className="flex h-11 items-center justify-center rounded-md border border-border-input bg-white px-4 text-[15px] font-semibold text-ink-600 active:bg-surface-canvas"
            >
              Schedule
            </Link>
          </div>
        </div>

        {isManager && (
          <Link
            to="/wranglers/new"
            className="flex h-12 items-center justify-center rounded-md border border-border-input bg-white text-[15px] font-semibold text-ink-600 active:bg-surface-canvas"
          >
            Add wrangler
          </Link>
        )}

        {loading && <p className="text-[15px] text-ink-400">Loading…</p>}
        {error && <p className="text-[15px] text-red-600">{error}</p>}

        {!loading && !error && wranglers.length === 0 && (
          <p className="text-[15px] text-ink-400">No wranglers yet.</p>
        )}

        {wranglers.length > 0 && (
          <ul className="flex flex-col overflow-hidden rounded-md border border-border-card bg-white">
            {wranglers.map((wrangler) => (
              <li
                key={wrangler.id}
                className="flex items-center justify-between gap-2 border-b border-border-hairline px-4 py-3 last:border-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-xl font-semibold text-ink-900">
                    {wranglerShortName(wrangler)}
                  </span>
                  <span className="text-[15px] text-ink-400">
                    {[
                      daysByWrangler[wrangler.id] ? formatDays([...daysByWrangler[wrangler.id]]) : null,
                      wrangler.gender,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No schedule yet'}
                  </span>
                </div>

                {isManager && (
                  <Link
                    to={`/wranglers/${wrangler.id}`}
                    aria-label={`Edit ${wranglerShortName(wrangler)}`}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-ink-400 active:bg-surface-canvas"
                  >
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
