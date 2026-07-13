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

        <ul className="flex flex-col gap-3">
          {chores.map((chore) => {
            const content = (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-semibold text-gray-900">
                    {chore.chore_type?.name ?? 'Untitled chore'}
                  </span>
                  <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700">
                    {chore.period}
                  </span>
                </div>
                <span className="text-lg text-gray-500">
                  {chore.assignment_type === 'open' ? 'Open' : chore.assignee?.name ?? 'Assigned'}
                  {' · '}
                  {RECURRENCE_LABEL[chore.recurrence] ?? chore.recurrence}
                </span>
              </>
            )

            return (
              <li key={chore.id}>
                {isManager ? (
                  <Link
                    to={`/chores/${chore.id}`}
                    className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    {content}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
