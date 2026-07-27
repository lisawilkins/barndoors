import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

const RECURRENCE_LABEL = {
  none: 'One time',
  daily: 'Daily',
  weekly: 'Weekly',
  'semi-monthly': 'Twice a month',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

// Most frequent first, so everyday chores sit at the top of the list.
const RECURRENCE_ORDER = ['daily', 'weekly', 'semi-monthly', 'monthly', 'quarterly', 'none']

// Each recurrence is split into a morning and evening section, e.g. "Daily: AM".
const PERIODS = ['AM', 'PM']

function sortChores(a, b) {
  const nameA = a.chore_type?.name ?? ''
  const nameB = b.chore_type?.name ?? ''
  return nameA.localeCompare(nameB)
}

export default function Chores() {
  const { isManager } = useAuth()
  const [chores, setChores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    supabase
      .from('chores')
      .select(
        'id, period, assignment_type, recurrence, status, ' +
          'chore_type:chore_types(name), ' +
          'assignee:profiles!chores_assigned_to_fkey(name)',
      )
      .eq('status', 'active')
      .order('period', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (!active) return
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setChores(data)
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TopNav />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-gray-900">Chores</h1>
          {isManager && (
            <Link
              to="/chores/new"
              className="flex h-12 items-center justify-center rounded-lg bg-gray-900 px-5 text-lg font-semibold text-white active:bg-gray-700"
            >
              Add chore
            </Link>
          )}
        </div>

        {loading && <p className="text-lg text-gray-500">Loading…</p>}
        {error && <p className="text-lg text-red-600">{error}</p>}

        {!loading && !error && chores.length === 0 && (
          <p className="text-lg text-gray-500">No chores yet.</p>
        )}

        {!loading && !error && chores.length > 0 && (
          <div className="flex flex-col gap-8">
            {RECURRENCE_ORDER.flatMap((recurrence) =>
              PERIODS.map((period) => {
                const group = chores
                  .filter((chore) => chore.recurrence === recurrence && chore.period === period)
                  .sort(sortChores)
                if (group.length === 0) return null

                return (
                  <section key={`${recurrence}-${period}`} className="flex flex-col">
                    <h2 className="mb-2 border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wider text-gray-500">
                      {RECURRENCE_LABEL[recurrence] ?? recurrence}: {period}
                    </h2>
                    <ul className="flex flex-col divide-y divide-gray-100 pl-6">
                      {group.map((chore) => (
                        <li key={chore.id}>
                          <ChoreItem chore={chore} isManager={isManager} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              }),
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function ChoreItem({ chore, isManager }) {
  const title = chore.chore_type?.name ?? 'Untitled chore'
  const assignee = chore.assignment_type === 'open' ? null : chore.assignee?.name

  return (
    <div className="flex flex-col gap-1 py-3">
      {isManager ? (
        <Link
          to={`/chores/${chore.id}`}
          className="text-lg font-semibold text-gray-900 underline-offset-4 active:underline"
        >
          {title}
        </Link>
      ) : (
        <span className="text-lg font-semibold text-gray-900">{title}</span>
      )}
      {assignee && <span className="text-lg text-gray-500">{assignee}</span>}
    </div>
  )
}
