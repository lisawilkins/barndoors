import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
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
import HeardCardBody from '../components/HeardCardBody'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { formatAge } from '../lib/formatAge'

const EXPAND_MS = 200

function Chevron({ open }) {
  return (
    <svg
      className={`h-6 w-6 flex-shrink-0 text-gray-500 transition-transform duration-200 ease-out ${
        open ? 'rotate-180' : ''
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  )
}

function HeardListItem({
  animal,
  photoUrl,
  age,
  isExpanded,
  showContent,
  isManager,
  onToggleExpand,
  onGridTransitionEnd,
  onArchived,
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
        className={`flex items-stretch overflow-hidden rounded-xl border border-gray-200 bg-gray-50 ${
          isExpanded ? 'shadow-sm' : ''
        } ${isDragging ? 'shadow-md' : ''}`}
      >
        {isManager && !isExpanded && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            style={{ touchAction: 'none' }}
            className="flex w-10 flex-shrink-0 cursor-grab items-center justify-center text-gray-400 active:cursor-grabbing active:bg-gray-200"
          >
            <GripIcon />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => onToggleExpand(animal.id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-100"
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={animal.name || 'Animal'}
                className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200 text-2xl">
                🐴
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-xl font-semibold text-gray-900">
                {animal.name || 'Unnamed'}
              </span>
              <span className="truncate text-lg text-gray-500">
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
              {showContent && (
                <HeardCardBody
                  animalId={animal.id}
                  isManager={isManager}
                  onArchived={onArchived}
                  photoUrl={photoUrl}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

export default function Heard() {
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
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

  function handleArchived(animalId) {
    setHead((current) => current.filter((animal) => animal.id !== animalId))
    setExpandedId(null)
    setContentByCard((current) => {
      const next = { ...current }
      delete next[animalId]
      return next
    })
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
    <div className="flex min-h-screen flex-col bg-white">
      <TopNav />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-gray-900">Heard</h1>
          {isManager && (
            <Link
              to="/heard/new"
              className="flex h-12 items-center justify-center rounded-lg bg-gray-900 px-5 text-lg font-semibold text-white active:bg-gray-700"
            >
              Add animal
            </Link>
          )}
        </div>

        {loading && <p className="text-lg text-gray-500">Loading…</p>}
        {error && <p className="text-lg text-red-600">{error}</p>}

        {!loading && !error && head.length === 0 && (
          <p className="text-lg text-gray-500">No animals yet.</p>
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
                  <HeardListItem
                    key={animal.id}
                    animal={animal}
                    photoUrl={photoUrl}
                    age={age}
                    isExpanded={isExpanded}
                    showContent={showContent}
                    isManager={isManager}
                    onToggleExpand={toggleExpand}
                    onGridTransitionEnd={handleGridTransitionEnd}
                    onArchived={handleArchived}
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
