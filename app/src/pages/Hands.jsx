import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { formatPhone, telHref } from '../lib/formatPhone'
import { isValidEmail } from '../lib/email'

function PencilIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  )
}

export default function Hands() {
  const { isManager, loading: authLoading } = useAuth()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    let active = true

    // Managers see the base table directly (full access); hands go through the
    // profiles_hand_visible() function, which nulls out emergency_contact for
    // every row (email is visible to both roles) — see barndoors-schema.md's
    // field-level visibility rule. (A SECURITY DEFINER function, not a view —
    // Supabase's security advisor flags definer views but not definer
    // functions, since functions are the sanctioned way to intentionally
    // scope an RLS bypass.)
    const query = isManager
      ? supabase.from('profiles').select('id, name, role, phone, email, status')
      : supabase.rpc('profiles_hand_visible').select('id, name, role, phone, email, status')

    query
      .eq('status', 'active')
      .order('name', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (!active) return
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setPeople(data)
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isManager, authLoading])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TopNav />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="text-3xl font-semibold text-gray-900">Hands</h1>

        {isManager && (
          <div className="flex gap-3">
            <Link
              to="/hands/new"
              className="flex h-14 flex-1 items-center justify-center rounded-lg border border-gray-300 text-lg font-medium text-gray-700 active:bg-gray-100"
            >
              Add hand
            </Link>
            <Link
              to="/hands/new-manager"
              className="flex h-14 flex-1 items-center justify-center rounded-lg border border-gray-300 text-lg font-medium text-gray-700 active:bg-gray-100"
            >
              Add manager
            </Link>
          </div>
        )}

        {(loading || authLoading) && <p className="text-lg text-gray-500">Loading…</p>}
        {error && <p className="text-lg text-red-600">{error}</p>}

        {!loading && !authLoading && !error && people.length === 0 && (
          <p className="text-lg text-gray-500">No people yet.</p>
        )}

        <ul className="flex flex-col gap-3">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {person.role === 'manager' && (
                  <span className="w-fit rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700">
                    Manager
                  </span>
                )}
                <span className="text-xl font-semibold text-gray-900">{person.name}</span>
                {person.phone && (
                  <a
                    href={telHref(person.phone)}
                    className="text-lg text-gray-600 underline active:text-gray-900"
                  >
                    {formatPhone(person.phone)}
                  </a>
                )}
                {person.email && isValidEmail(person.email) && (
                  <a
                    href={`mailto:${person.email}`}
                    className="truncate text-lg text-gray-600 underline active:text-gray-900"
                  >
                    {person.email}
                  </a>
                )}
                {person.email && !isValidEmail(person.email) && (
                  <span className="truncate text-lg text-gray-600">{person.email}</span>
                )}
              </div>

              {isManager && (
                <Link
                  to={`/hands/${person.id}`}
                  aria-label={`Edit ${person.name}`}
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-gray-700 active:bg-gray-100"
                >
                  <PencilIcon />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
