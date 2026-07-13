import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

export default function Hands() {
  const { isManager, loading: authLoading } = useAuth()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    let active = true

    // Managers see the base table directly (full access); hands go through the
    // profiles_hand_visible() function, which nulls out email/emergency_contact
    // for anyone but themselves — see barndoors-schema.md's field-level
    // visibility rule. (A SECURITY DEFINER function, not a view — Supabase's
    // security advisor flags definer views but not definer functions, since
    // functions are the sanctioned way to intentionally scope an RLS bypass.)
    const query = isManager
      ? supabase.from('profiles').select('id, name, role, phone, status')
      : supabase.rpc('profiles_hand_visible').select('id, name, role, phone, status')

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

        {(loading || authLoading) && <p className="text-lg text-gray-500">Loading…</p>}
        {error && <p className="text-lg text-red-600">{error}</p>}

        {!loading && !authLoading && !error && people.length === 0 && (
          <p className="text-lg text-gray-500">No people yet.</p>
        )}

        <ul className="flex flex-col gap-3">
          {people.map((person) => {
            const content = (
              <>
                <div className="flex flex-col">
                  <span className="text-xl font-semibold text-gray-900">{person.name}</span>
                  {person.phone && <span className="text-lg text-gray-500">{person.phone}</span>}
                </div>
                <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-medium capitalize text-gray-700">
                  {person.role}
                </span>
              </>
            )

            return (
              <li key={person.id}>
                {isManager ? (
                  <Link
                    to={`/hands/${person.id}`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:bg-gray-100"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
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
