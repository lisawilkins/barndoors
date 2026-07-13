import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { SelectField } from '../components/FormField'
import { supabase } from '../lib/supabaseClient'

const BLANK = {
  chore_type_id: '',
  period: 'AM',
  assignment_type: 'open',
  assigned_to: '',
  recurrence: 'daily',
  status: 'active',
}

export default function ChoreForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState(BLANK)
  const [choreTypes, setChoreTypes] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      const [typesResult, peopleResult, choreResult] = await Promise.all([
        supabase.from('chore_types').select('id, name').eq('active', true).order('name'),
        supabase.from('profiles').select('id, name').eq('status', 'active').order('name'),
        isEdit ? supabase.from('chores').select('*').eq('id', id).single() : Promise.resolve({}),
      ])

      if (!active) return

      if (typesResult.error) {
        setError(typesResult.error.message)
      } else {
        setChoreTypes(typesResult.data)
      }

      if (peopleResult.error) {
        setError(peopleResult.error.message)
      } else {
        setPeople(peopleResult.data)
      }

      if (isEdit) {
        if (choreResult.error) {
          setError(choreResult.error.message)
        } else if (choreResult.data) {
          setForm({ ...BLANK, ...choreResult.data, assigned_to: choreResult.data.assigned_to ?? '' })
        }
      }

      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [id, isEdit])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      chore_type_id: form.chore_type_id,
      period: form.period,
      assignment_type: form.assignment_type,
      assigned_to: form.assignment_type === 'open' ? null : form.assigned_to || null,
      recurrence: form.recurrence,
      status: form.status,
    }

    const request = isEdit
      ? supabase.from('chores').update(payload).eq('id', id)
      : supabase.from('chores').insert(payload)

    const { error: saveError } = await request
    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    navigate('/chores')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <TopNav />
        <p className="px-4 py-6 text-lg text-gray-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TopNav />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="text-3xl font-semibold text-gray-900">
          {isEdit ? 'Edit chore' : 'Add chore'}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <SelectField
            label="Chore type"
            required
            value={form.chore_type_id}
            onChange={(event) => update('chore_type_id', event.target.value)}
          >
            <option value="" disabled>
              Select a chore type
            </option>
            {choreTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Period"
            value={form.period}
            onChange={(event) => update('period', event.target.value)}
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </SelectField>

          <SelectField
            label="Assignment"
            value={form.assignment_type}
            onChange={(event) => update('assignment_type', event.target.value)}
          >
            <option value="open">Open (anyone can do it)</option>
            <option value="assigned-once">Assigned once</option>
            <option value="assigned-recurring">Assigned recurring</option>
          </SelectField>

          {form.assignment_type !== 'open' && (
            <SelectField
              label="Assigned to"
              required
              value={form.assigned_to}
              onChange={(event) => update('assigned_to', event.target.value)}
            >
              <option value="" disabled>
                Select a person
              </option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </SelectField>
          )}

          <SelectField
            label="Recurrence"
            value={form.recurrence}
            onChange={(event) => update('recurrence', event.target.value)}
          >
            <option value="none">One time</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="semi-monthly">Twice a month</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </SelectField>

          <SelectField
            label="Status"
            value={form.status}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </SelectField>

          {error && <p className="text-lg text-red-600">{error}</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/chores')}
              className="flex h-14 flex-1 items-center justify-center rounded-lg border border-gray-300 text-lg font-medium text-gray-700 active:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex h-14 flex-1 items-center justify-center rounded-lg bg-gray-900 text-lg font-semibold text-white active:bg-gray-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
