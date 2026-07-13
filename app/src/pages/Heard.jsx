import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import HeardCardBody, { STATUS_LABEL } from '../components/HeardCardBody'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

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

  useEffect(() => {
    let active = true

    supabase
      .from('head')
      .select('id, tag_id, name, species, breed, status')
      .eq('status', 'active')
      .order('name', { ascending: true })
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

        <ul className="flex flex-col gap-3">
          {head.map((animal) => {
            const photoUrl = photosByHeadId[animal.id]
            const isExpanded = expandedId === animal.id
            const showContent = Boolean(contentByCard[animal.id])

            return (
              <li
                key={animal.id}
                ref={(element) => {
                  cardRefs.current[animal.id] = element
                }}
                className="scroll-mt-4"
              >
                <div
                  className={`overflow-hidden rounded-xl border border-gray-200 bg-gray-50 ${
                    isExpanded ? 'shadow-sm' : ''
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpand(animal.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-100"
                  >
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={animal.name || animal.tag_id || 'Animal'}
                        className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200 text-2xl">
                        🐴
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xl font-semibold text-gray-900">
                          {animal.name || animal.tag_id || 'Unnamed'}
                        </span>
                        <span className="flex-shrink-0 rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700">
                          {STATUS_LABEL[animal.status] ?? animal.status}
                        </span>
                      </div>
                      <span className="truncate text-lg text-gray-500">
                        {[animal.species, animal.breed].filter(Boolean).join(' · ') ||
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
                    onTransitionEnd={(event) => handleGridTransitionEnd(animal.id, event)}
                  >
                    <div className="min-h-0 overflow-hidden">
                      {showContent && (
                        <HeardCardBody
                          animalId={animal.id}
                          isManager={isManager}
                          onArchived={handleArchived}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
