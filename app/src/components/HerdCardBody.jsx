import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatDays } from '../lib/turnoutSchedule'

const STATUS_LABEL = {
  active: 'Active',
  sold: 'Sold',
  deceased: 'Deceased',
  archived: 'Archived',
}

const UNIT_SHORT = {
  cup: 'cup',
  scoop: 'scp',
  handful: 'handful',
  lbs: 'lbs',
}

function noteLines(text) {
  if (!text?.trim()) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function formatFeedPrimary(row) {
  const feedItem = row.feed_items
  if (!feedItem) return '—'

  if (feedItem.dual_unit) {
    if (row.amount_flakes != null) return `${row.amount_flakes} flake`
    return '—'
  }

  if (row.amount != null && row.unit) {
    return `${row.amount} ${UNIT_SHORT[row.unit] ?? row.unit}`
  }

  return '—'
}

function formatFeedSecondary(row) {
  const feedItem = row.feed_items
  if (!feedItem?.dual_unit) return '—'
  if (row.amount_lbs != null) return `${row.amount_lbs} lbs`
  return '—'
}

function SectionHeader({ title, editTo, showEdit }) {
  return (
    <div className="flex items-center justify-between border-b-[1.5px] border-ink-900 pb-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-ink-900">{title}</span>
      {showEdit && editTo && (
        <Link
          to={editTo}
          aria-label={`Edit ${title.toLowerCase()}`}
          className="text-sm font-semibold text-accent-bright active:opacity-70"
        >
          Edit
        </Link>
      )}
    </div>
  )
}

export default function HerdCardBody({ animalId, isManager }) {
  const [animal, setAnimal] = useState(null)
  const [feedPlan, setFeedPlan] = useState([])
  const [turnoutSchedule, setTurnoutSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      const [headResult, feedResult, membershipResult] = await Promise.all([
        supabase.from('head').select('*').eq('id', animalId).single(),
        supabase
          .from('head_feed_plan')
          .select('id, amount_flakes, amount_lbs, amount, unit, feed_items ( name, dual_unit )')
          .eq('head_id', animalId),
        supabase
          .from('turnout_group_members')
          .select(
            'group_id, turnout_groups ( id, days_of_week, turnout_locations ( name ), turnout_group_members ( head_id, head ( name ) ) )',
          )
          .eq('head_id', animalId),
      ])

      if (!active) return

      if (headResult.error) {
        setError(headResult.error.message)
        setLoading(false)
        return
      }

      setAnimal(headResult.data)

      if (feedResult.error) {
        setError(feedResult.error.message)
      } else {
        const rows = [...(feedResult.data ?? [])].sort((a, b) =>
          (a.feed_items?.name ?? '').localeCompare(b.feed_items?.name ?? ''),
        )
        setFeedPlan(rows)
      }

      if (membershipResult.error) {
        setError(membershipResult.error.message)
      } else {
        const schedule = (membershipResult.data ?? [])
          .map((membership) => {
            const group = membership.turnout_groups
            if (!group) return null

            const buddyNames = (group.turnout_group_members ?? [])
              .filter((member) => member.head_id !== animalId)
              .map((member) => member.head?.name)
              .filter(Boolean)

            return {
              id: group.id,
              location: group.turnout_locations?.name ?? '—',
              days: formatDays(group.days_of_week),
              buddies: buddyNames.join(', ') || '—',
            }
          })
          .filter(Boolean)

        setTurnoutSchedule(schedule)
      }

      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [animalId])

  if (loading) {
    return <p className="px-4 pb-4 text-[15px] text-ink-400">Loading…</p>
  }

  if (error || !animal) {
    return <p className="px-4 pb-4 text-[15px] text-red-600">{error || 'Could not load animal.'}</p>
  }

  const feedNotes = noteLines(animal.feed_notes)
  const turnoutNotes = noteLines(animal.turnout_notes)
  const notes = noteLines(animal.notes)
  const editPath = `/herd/${animalId}/edit`

  return (
    <div className="flex flex-col gap-5 px-4 pb-4 pt-2">
      <section className="flex flex-col gap-1">
        <SectionHeader title="Feed" editTo={editPath} showEdit={isManager} />

        {feedPlan.length === 0 ? (
          <p className="py-3 text-[15px] text-ink-400">No feed plan yet.</p>
        ) : (
          <ul className="flex flex-col">
            {feedPlan.map((row) => (
              <li
                key={row.id}
                className="flex items-baseline justify-between gap-3 border-b border-border-hairline py-[7px]"
              >
                <span className="font-semibold text-ink-900 break-words">
                  {row.feed_items?.name ?? '—'}
                </span>
                <span className="text-right text-[15px] font-bold capitalize text-ink-900 break-words">
                  {[formatFeedPrimary(row), formatFeedSecondary(row)]
                    .filter((part) => part !== '—')
                    .join(' · ') || '—'}
                </span>
              </li>
            ))}
          </ul>
        )}

        {feedNotes.length > 0 && (
          <p className="mt-0.5 border-l-2 border-placeholder-tan-1 pl-2.5 text-[14px] italic leading-relaxed text-ink-600">
            {feedNotes.join(' ')}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <SectionHeader title="Turnout" editTo={editPath} showEdit={isManager} />

        {turnoutSchedule.length === 0 ? (
          <p className="py-3 text-[15px] text-ink-400">No turnout schedule yet.</p>
        ) : (
          <ul className="flex flex-col">
            {turnoutSchedule.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline justify-between gap-4 border-b border-border-hairline py-[7px]"
              >
                <span className="font-semibold text-ink-900">{entry.location}</span>
                <span className="text-right text-[15px] text-ink-900">
                  {[entry.days, entry.buddies !== '—' ? `Buddies: ${entry.buddies}` : null]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </span>
              </li>
            ))}
          </ul>
        )}

        {turnoutNotes.length > 0 && (
          <p className="mt-0.5 border-l-2 border-placeholder-tan-1 pl-2.5 text-[14px] italic leading-relaxed text-ink-600">
            {turnoutNotes.join(' ')}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <SectionHeader title="Notes" editTo={editPath} showEdit={isManager} />
        <p className="py-1 text-[15px] leading-relaxed text-ink-600">
          {notes.length > 0 ? notes.join(' ') : 'No notes yet.'}
        </p>
      </section>

      <div className="flex items-center justify-between border-t border-border-divider pt-3 text-[15px]">
        <span className="text-ink-400">
          Status ·{' '}
          <span className="text-ink-900">{STATUS_LABEL[animal.status] ?? animal.status}</span>
        </span>
        {isManager && (
          <Link
            to={editPath}
            aria-label="Edit status"
            className="text-sm font-semibold text-accent-bright active:opacity-70"
          >
            Edit
          </Link>
        )}
      </div>
    </div>
  )
}
