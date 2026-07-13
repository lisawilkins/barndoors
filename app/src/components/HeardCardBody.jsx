import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SelectField } from './FormField'
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

function formatAge(birthDate) {
  if (!birthDate) return null
  const birth = new Date(`${birthDate}T00:00:00`)
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years -= 1
  }
  if (years < 1) return '< 1 yr'
  return `${years} yr${years === 1 ? '' : 's'}`
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
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-medium text-gray-700">{title}</h2>
      {showEdit && editTo && (
        <Link
          to={editTo}
          aria-label={`Edit ${title.toLowerCase()}`}
          className="flex h-12 w-12 items-center justify-center rounded-lg text-gray-700 active:bg-gray-100"
        >
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
        </Link>
      )}
    </div>
  )
}

export default function HeardCardBody({ animalId, isManager, onArchived }) {
  const [animal, setAnimal] = useState(null)
  const [feedPlan, setFeedPlan] = useState([])
  const [turnoutSchedule, setTurnoutSchedule] = useState([])
  const [status, setStatus] = useState('active')
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)
  const [error, setError] = useState('')
  const [statusError, setStatusError] = useState('')

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
            'group_id, turnout_groups ( id, days_of_week, turnout_locations ( name ), turnout_group_members ( head_id, head ( name, tag_id ) ) )',
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
      setStatus(headResult.data.status)

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
              .map((member) => member.head?.name || member.head?.tag_id)
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

  async function handleStatusSave() {
    setSavingStatus(true)
    setStatusError('')

    const today = new Date().toISOString().slice(0, 10)
    const payload = {
      status,
      status_date: status === 'active' ? null : today,
    }

    const { error: saveError } = await supabase.from('head').update(payload).eq('id', animalId)
    setSavingStatus(false)

    if (saveError) {
      setStatusError(saveError.message)
      return
    }

    if (status !== 'active') {
      onArchived?.(animalId)
      return
    }

    setAnimal((current) => (current ? { ...current, ...payload } : current))
  }

  if (loading) {
    return <p className="px-4 pb-4 text-lg text-gray-500">Loading…</p>
  }

  if (error || !animal) {
    return <p className="px-4 pb-4 text-lg text-red-600">{error || 'Could not load animal.'}</p>
  }

  const age = formatAge(animal.birth_date)
  const feedNotes = noteLines(animal.feed_notes)
  const turnoutNotes = noteLines(animal.turnout_notes)
  const editPath = `/heard/${animalId}/edit`
  const subtitle = [age, animal.breed].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-4 border-t border-gray-200 px-4 pb-4 pt-3">
      {subtitle && <p className="text-lg text-gray-500">{subtitle}</p>}

      <section className="flex flex-col gap-3">
        <SectionHeader title="Feed" editTo={editPath} showEdit={isManager} />

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          {feedPlan.length === 0 ? (
            <p className="text-lg text-gray-500">No feed plan yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {feedPlan.map((row) => (
                <li key={row.id} className="flex flex-col gap-1">
                  <span className="text-xl font-semibold text-gray-900">
                    {row.feed_items?.name ?? '—'}
                  </span>
                  <span className="text-lg text-gray-500">
                    {[formatFeedPrimary(row), formatFeedSecondary(row)]
                      .filter((part) => part !== '—')
                      .join(' · ') || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-medium text-gray-700">Feed notes</h3>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            {feedNotes.length === 0 ? (
              <p className="text-lg text-gray-500">No feed notes.</p>
            ) : (
              <ul className="list-disc space-y-2 pl-5 text-lg text-gray-900">
                {feedNotes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Turnout" editTo={editPath} showEdit={isManager} />

        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          {turnoutSchedule.length === 0 ? (
            <p className="text-lg text-gray-500">No turnout schedule yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {turnoutSchedule.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1">
                  <span className="text-xl font-semibold text-gray-900">{entry.location}</span>
                  <span className="text-lg text-gray-500">
                    {[entry.days, entry.buddies !== '—' ? `Buddies: ${entry.buddies}` : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-medium text-gray-700">Turnout notes</h3>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            {turnoutNotes.length === 0 ? (
              <p className="text-lg text-gray-500">No turnout notes.</p>
            ) : (
              <ul className="list-disc space-y-2 pl-5 text-lg text-gray-900">
                {turnoutNotes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {isManager && (
        <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <SelectField
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="deceased">Deceased</option>
            <option value="archived">Archived (hidden from list)</option>
          </SelectField>
          <p className="text-lg text-gray-500">
            To remove a duplicate, set status to Archived. The record stays in the database but
            no longer appears on the Heard list.
          </p>
          {statusError && <p className="text-lg text-red-600">{statusError}</p>}
          <button
            type="button"
            onClick={handleStatusSave}
            disabled={savingStatus || status === animal.status}
            className="flex h-14 items-center justify-center rounded-lg bg-gray-900 text-lg font-semibold text-white active:bg-gray-700 disabled:opacity-50"
          >
            {savingStatus ? 'Saving…' : 'Save status'}
          </button>
        </section>
      )}
    </div>
  )
}

export { STATUS_LABEL }
