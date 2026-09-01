import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  DndContext,
  MouseSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TopNav from '../components/TopNav'
import HerdCardBody from '../components/HerdCardBody'
import { useAuth } from '../lib/AuthContext'
import { ScrollFriendlyTouchSensor } from '../lib/ScrollFriendlyTouchSensor'
import { supabase } from '../lib/supabaseClient'
import { formatAge } from '../lib/formatAge'

const EXPAND_MS = 200

function Chevron({ open }) {
  return (
    <span className="material-symbols-outlined flex-shrink-0 text-[22px] text-ink-300">
      {open ? 'expand_less' : 'expand_more'}
    </span>
  )
}

function GripIcon() {
  return <span className="material-symbols-outlined text-[20px] text-ink-200">drag_indicator</span>
}

function HerdListItem({
  animal,
  photoUrl,
  age,
  isExpanded,
  showContent,
  isManager,
  onToggleExpand,
  onGridTransitionEnd,
  registerRef,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: animal.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={(element) => {
        setNodeRef(element)
        registerRef(animal.id, element)
      }}
      style={style}
      className={`scroll-mt-4 ${isDragging ? 'relative z-10' : ''}`}
    >
      <div
        className={`flex items-stretch overflow-hidden transition-shadow ${
          isExpanded
            ? 'rounded-md border border-border-card bg-white shadow-card'
            : 'border-b border-border-divider'
        } ${isDragging ? '-translate-y-1 rounded-md shadow-card ring-1 ring-border-card' : ''}`}
      >
        {isManager && !isExpanded && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Hold and drag to reorder"
            style={{ touchAction: 'pan-y' }}
            className="flex w-10 flex-shrink-0 cursor-grab items-center justify-center text-ink-200 active:cursor-grabbing active:bg-surface-canvas"
          >
            <GripIcon />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => onToggleExpand(animal.id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-canvas"
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={animal.name || 'Animal'}
                className={`flex-shrink-0 rounded-md object-cover ${
                  isExpanded ? 'h-[140px] w-[140px]' : 'h-[100px] w-[100px]'
                }`}
              />
            ) : (
              <div
                className={`flex flex-shrink-0 items-center justify-center rounded-md bg-placeholder-tan-2 text-2xl ${
                  isExpanded ? 'h-[140px] w-[140px]' : 'h-[100px] w-[100px]'
                }`}
              >
                🐴
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className={`truncate text-ink-900 ${
                  isExpanded ? 'font-display text-2xl font-semibold' : 'text-xl font-semibold'
                }`}
              >
                {animal.name || 'Unnamed'}
              </span>
              <span className="text-[15px] text-ink-400">
                {[age, animal.sex, animal.breed].filter(Boolean).join(' · ') ||
                  'No details yet'}
              </span>
            </div>
            <Chevron open={isExpanded} />
          </button>

          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
            style={{ transitionDuration: `${EXPAND_MS}ms` }}
            onTransitionEnd={(event) => onGridTransitionEnd(animal.id, event)}
          >
            <div className="min-h-0 overflow-hidden">
              {showContent && <HerdCardBody animalId={animal.id} isManager={isManager} />}
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

export default function Herd() {
  const { isManager } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [head, setHead] = useState([])
  const [photosByHeadId, setPhotosByHeadId] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [contentByCard, setContentByCard] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const cardRefs = useRef({})
  const scrollTargetId = useRef(null)

  // Mouse: small drag distance starts reorder. Touch: long-press on the grip
  // then drag. ScrollFriendlyTouchSensor keeps touchmove passive during the
  // delay so a thumb starting on the grip can still scroll the list.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(ScrollFriendlyTouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
  )

  useEffect(() => {
    let active = true

    supabase
      .from('head')
      .select('id, name, sex, breed, birth_date, sort_order')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .then(async ({ data, error: fetchError }) => {
        if (!active) return
        if (fetchError) {
          setError(fetchError.message)
          setLoading(false)
          return
        }

        setHead(data)

        const ids = data.map((animal) => animal.id)
        if (ids.length > 0) {
          const { data: photos, error: photoError } = await supabase
            .from('head_photos')
            .select('head_id, photo_url')
            .in('head_id', ids)

          if (active && !photoError && photos) {
            setPhotosByHeadId(
              Object.fromEntries(photos.map((photo) => [photo.head_id, photo.photo_url])),
            )
          }
        }

        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const expandParam = searchParams.get('expand')
    if (!expandParam || loading || !head.some((animal) => animal.id === expandParam)) return

    scrollTargetId.current = expandParam
    setExpandedId(expandParam)
    setContentByCard((current) => ({ ...current, [expandParam]: true }))
    setSearchParams({}, { replace: true })
  }, [searchParams, loading, head, setSearchParams])

  useEffect(() => {
    if (!expandedId) return
    setContentByCard((current) => ({ ...current, [expandedId]: true }))
  }, [expandedId])

  const scrollCardToTop = useCallback((animalId) => {
    const element = cardRefs.current[animalId]
    if (!element) return

    const top = element.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top, behavior: 'smooth' })
  }, [])

  useLayoutEffect(() => {
    if (!scrollTargetId.current) return

    const animalId = scrollTargetId.current
    scrollTargetId.current = null

    scrollCardToTop(animalId)

    const timer = window.setTimeout(() => {
      scrollCardToTop(animalId)
    }, EXPAND_MS)

    return () => window.clearTimeout(timer)
  }, [expandedId, scrollCardToTop])

  function handleGridTransitionEnd(animalId, event) {
    if (event.propertyName !== 'grid-template-rows') return

    if (expandedId === animalId) {
      scrollCardToTop(animalId)
      return
    }

    setContentByCard((current) => {
      if (!current[animalId]) return current
      const next = { ...current }
      delete next[animalId]
      return next
    })
  }

  function toggleExpand(animalId) {
    if (expandedId === animalId) {
      setExpandedId(null)
      return
    }

    setExpandedId(animalId)
    scrollTargetId.current = animalId
  }

  async function persistOrder(reordered, previous) {
    const results = await Promise.all(
      reordered.map((animal, index) =>
        supabase.from('head').update({ sort_order: index }).eq('id', animal.id),
      ),
    )

    const failed = results.find((result) => result.error)
    if (failed) {
      setError(failed.error.message)
      setHead(previous)
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = head.findIndex((animal) => animal.id === active.id)
    const newIndex = head.findIndex((animal) => animal.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const previous = head
    const reordered = arrayMove(head, oldIndex, newIndex)
    setHead(reordered)
    persistOrder(reordered, previous)
  }

  function registerCardRef(animalId, element) {
    cardRefs.current[animalId] = element
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav />

      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-light text-ink-900">Herd</h1>
          {isManager && (
            <Link
              to="/herd/new"
              className="flex h-11 items-center justify-center rounded-md bg-accent-bright px-4 text-[15px] font-semibold text-white active:opacity-90"
            >
              Add animal
            </Link>
          )}
        </div>

        {loading && <p className="text-[15px] text-ink-400">Loading…</p>}
        {error && <p className="text-[15px] text-red-600">{error}</p>}

        {!loading && !error && head.length === 0 && (
          <p className="text-[15px] text-ink-400">No animals yet.</p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={head.map((animal) => animal.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-3">
              {head.map((animal) => {
                const photoUrl = photosByHeadId[animal.id]
                const age = formatAge(animal.birth_date)
                const isExpanded = expandedId === animal.id
                const showContent = Boolean(contentByCard[animal.id])

                return (
                  <HerdListItem
                    key={animal.id}
                    animal={animal}
                    photoUrl={photoUrl}
                    age={age}
                    isExpanded={isExpanded}
                    showContent={showContent}
                    isManager={isManager}
                    onToggleExpand={toggleExpand}
                    onGridTransitionEnd={handleGridTransitionEnd}
                    registerRef={registerCardRef}
                  />
                )
              })}
            </ul>
          </SortableContext>
        </DndContext>
      </main>
    </div>
  )
}
