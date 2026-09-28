import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DndContext, MouseSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TopNav from '../components/TopNav'
import { useAuth } from '../lib/AuthContext'
import { ScrollFriendlyTouchSensor } from '../lib/ScrollFriendlyTouchSensor'
import { supabase } from '../lib/supabaseClient'
import { fetchLists } from '../lib/choreLists'

// The Chores index: every list a manager has written. A list is one printable
// sheet — "AM Chores", "PM Chores", "Grooming" — and tapping one opens it.
// Managers can drag lists into order by the grip on the left, same as the Herd list.

function ChoreListCard({ list, isManager }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li ref={setNodeRef} style={style} className={isDragging ? 'relative z-10' : ''}>
      <div
        className={`flex items-stretch overflow-hidden rounded-md border border-border-card bg-white ${
          isDragging ? '-translate-y-1 shadow-card' : ''
        }`}
      >
        {isManager && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Hold and drag to reorder"
            style={{ touchAction: 'pan-y' }}
            className="flex w-10 flex-shrink-0 cursor-grab select-none items-center justify-center text-ink-200 [-webkit-touch-callout:none] active:cursor-grabbing active:bg-surface-canvas"
          >
            <span className="material-symbols-outlined text-[20px] text-ink-200">drag_indicator</span>
          </button>
        )}

        <Link
          to={`/chores/${list.id}`}
          className={`flex min-h-[60px] min-w-0 flex-1 flex-col justify-center gap-1 py-3 pr-4 active:bg-surface-canvas ${
            isManager ? 'pl-0' : 'pl-4'
          }`}
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
      </div>
    </li>
  )
}

export default function Chores() {
  const { isManager } = useAuth()
  const navigate = useNavigate()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Mouse: small drag distance starts reorder. Touch: long-press on the grip
  // then drag, so a thumb starting on the grip can still scroll the page.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(ScrollFriendlyTouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
  )

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

  async function persistOrder(reordered, previous) {
    const results = await Promise.all(
      reordered.map((list, index) =>
        supabase.from('chore_lists').update({ sort_order: index }).eq('id', list.id),
      ),
    )

    const failed = results.find((result) => result.error)
    if (failed) {
      setError(failed.error.message)
      setLists(previous)
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = lists.findIndex((list) => list.id === active.id)
    const newIndex = lists.findIndex((list) => list.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const previous = lists
    const reordered = arrayMove(lists, oldIndex, newIndex)
    setLists(reordered)
    persistOrder(reordered, previous)
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav />

      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col gap-4 px-4 py-5">
        <div className="flex items-center justify-between">
          <h1 className="m-0 font-display text-3xl font-light text-ink-900">Chores</h1>
          {isManager && (
            <button
              type="button"
              onClick={handleNewList}
              disabled={creating || loading}
              className="flex h-11 items-center justify-center rounded-md bg-accent-bright px-4 text-[15px] font-semibold text-white active:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Adding…' : '+ Add'}
            </button>
          )}
        </div>

        {error && <p className="text-[15px] text-red-600">{error}</p>}
        {loading && <p className="text-[15px] text-ink-400">Loading…</p>}

        {!loading && lists.length === 0 && (
          <p className="text-[15.5px] italic text-ink-300">No chore lists yet.</p>
        )}

        {!loading && lists.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={lists.map((list) => list.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2.5">
                {lists.map((list) => (
                  <ChoreListCard key={list.id} list={list} isManager={isManager} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  )
}
