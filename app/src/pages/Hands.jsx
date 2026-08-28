import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { formatPhone, telHref } from '../lib/formatPhone'
import { isValidEmail } from '../lib/email'

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
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="font-display text-3xl font-light text-ink-900">Hands</h1>

        {isManager && (
          <div className="flex gap-3">
            <Link
              to="/hands/new"
              className="flex h-12 flex-1 items-center justify-center rounded-md border border-border-input bg-white text-[15px] font-semibold text-ink-600 active:bg-surface-canvas"
            >
              Add hand
            </Link>
            <Link
              to="/hands/new-manager"
              className="flex h-12 flex-1 items-center justify-center rounded-md border border-border-input bg-white text-[15px] font-semibold text-ink-600 active:bg-surface-canvas"
            >
              Add manager/admin
            </Link>
          </div>
        )}

        {(loading || authLoading) && <p className="text-[15px] text-ink-400">Loading…</p>}
        {error && <p className="text-[15px] text-red-600">{error}</p>}

        {!loading && !authLoading && !error && people.length === 0 && (
          <p className="text-[15px] text-ink-400">No people yet.</p>
        )}

        {people.length > 0 && (
          <ul className="flex flex-col overflow-hidden rounded-md border border-border-card bg-white">
            {people.map((person) => (
              <li
                key={person.id}
                className="flex items-center justify-between gap-2 border-b border-border-hairline px-4 py-3 last:border-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {(person.role === 'manager' || person.role === 'admin') && (
                    <span className="w-fit rounded-full bg-chip-bg px-2.5 py-0.5 text-xs font-semibold capitalize text-chip-fg">
                      {person.role}
                    </span>
                  )}
                  <span className="text-xl font-semibold text-ink-900">{person.name}</span>
                  {person.phone && (
                    <a href={telHref(person.phone)} className="text-[15px] text-accent-bright active:opacity-70">
                      {formatPhone(person.phone)}
                    </a>
                  )}
                  {person.email && isValidEmail(person.email) && (
                    <a
                      href={`mailto:${person.email}`}
                      className="truncate text-[15px] text-accent-bright active:opacity-70"
                    >
                      {person.email}
                    </a>
                  )}
                  {person.email && !isValidEmail(person.email) && (
                    <span className="truncate text-[15px] text-ink-600">{person.email}</span>
                  )}
                </div>

                {isManager && (
                  <Link
                    to={`/hands/${person.id}`}
                    aria-label={`Edit ${person.name}`}
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
