import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { TextField, SelectField } from '../components/FormField'
import { supabase } from '../lib/supabaseClient'

// Editing only — creating a person means them signing up on the Login page
// (Supabase Auth), which also creates their `profiles` row via a DB trigger.
// A manager promotes/edits that row here afterward.
export default function HandForm() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', phone: '', role: 'hand', status: 'active' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    supabase
      .from('profiles')
      .select('name, phone, role, status')
      .eq('id', id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (!active) return
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setForm({ ...data, phone: data.phone ?? '' })
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const { error: saveError } = await supabase.from('profiles').update(form).eq('id', id)
    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    navigate('/hands')
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
        <h1 className="text-3xl font-semibold text-gray-900">Edit person</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label="Name"
            required
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
          />
          <TextField
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
          />
          <SelectField
            label="Role"
            value={form.role}
            onChange={(event) => update('role', event.target.value)}
          >
            <option value="hand">Hand</option>
            <option value="manager">Manager</option>
          </SelectField>
          <SelectField
            label="Status"
            value={form.status}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SelectField>

          {error && <p className="text-lg text-red-600">{error}</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/hands')}
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
