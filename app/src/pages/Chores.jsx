import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { fetchLists } from '../lib/choreLists'

// The Chores index: every list a manager has written. A list is one printable
// sheet — "AM Chores", "PM Chores", "Grooming" — and tapping one opens it.

export default function Chores() {
  const { isManager } = useAuth()
  const navigate = useNavigate()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    fetchLists().then(({ data, error: fetchError }) => {
      if (!active) return
      if (fetchError) setError(fetchError.message)
      else setLists(data ?? [])
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [])

  // A new list is created empty and opens straight into the editor, so the
  // first thing a manager does is type its name rather than fill in a form.
  async function handleNewList() {
    setCreating(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('chore_lists')
      .insert({ name: '', sort_order: lists.length })
      .select('id')
      .single()

    setCreating(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    navigate(`/chores/${data.id}?edit=1`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav />

      <main className="flex flex-1 flex-col gap-4 px-4 py-5">
        <h1 className="m-0 font-display text-3xl font-light text-ink-900">Chores</h1>

        {error && <p className="text-[15px] text-red-600">{error}</p>}
        {loading && <p className="text-[15px] text-ink-400">Loading…</p>}

        {!loading && lists.length === 0 && (
          <p className="text-[15.5px] italic text-ink-300">
            {isManager ? 'No lists yet. Add one below.' : 'No chore lists yet.'}
          </p>
        )}

        {!loading && lists.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {lists.map((list) => (
              <li key={list.id}>
                <Link
                  to={`/chores/${list.id}`}
                  className="flex min-h-[60px] flex-col justify-center gap-1 rounded-md border border-border-card bg-white px-4 py-3 active:bg-surface-canvas"
                >
                  <span className="text-[17px] font-semibold leading-snug text-ink-900">
                    {list.name?.trim() || 'Untitled list'}
                  </span>
                  {list.description?.trim() && (
                    <span className="line-clamp-2 text-[14.5px] leading-snug text-ink-400">
                      {list.description}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {isManager && !loading && (
          <button
            type="button"
            onClick={handleNewList}
            disabled={creating}
            className="flex h-12 items-center gap-2 self-start rounded-md px-2.5 text-base font-semibold text-accent-bright active:opacity-70 disabled:opacity-50"
          >
            ＋&nbsp; {creating ? 'Adding…' : 'Add list'}
          </button>
        )}
      </main>
    </div>
  )
}
