import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { TextField, SelectField } from '../components/FormField'
import ConfirmDialog from '../components/ConfirmDialog'
import { supabase } from '../lib/supabaseClient'
import { sanitizeEmail, isValidEmail } from '../lib/email'

const BLANK = { name: '', phone: '', email: '', role: 'hand', status: 'active' }

// Hands are plain directory records (no login account) — a manager can
// create one directly here. Managers are different: they need a real
// Supabase Auth login, so new manager accounts are created on the separate
// "Add manager" screen (which calls the create-manager Edge Function)
// instead of through this form. Because of that, role isn't editable here —
// changing an existing person's role away from what they were created as
// wouldn't add or remove a login account, so it could leave a "manager" row
// with no way to sign in, or a "hand" row that's actually still a live
// manager login.
export default function HandForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState(BLANK)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const initialStatusRef = useRef('active')

  useEffect(() => {
    if (!isEdit) return
    let active = true

    supabase
      .from('profiles')
      .select('name, phone, email, role, status')
      .eq('id', id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (!active) return
        if (fetchError) {
          setError(fetchError.message)
        } else {
          setForm({ ...data, phone: data.phone ?? '', email: data.email ?? '' })
          initialStatusRef.current = data.status
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, isEdit])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function isArchiving() {
    return isEdit && initialStatusRef.current !== 'inactive' && form.status === 'inactive'
  }

  function handleFormSubmit(event) {
    event.preventDefault()
    if (isArchiving()) {
      setConfirmingArchive(true)
      return
    }
    performSave()
  }

  async function performSave() {
    setConfirmingArchive(false)
    setSaving(true)
    setError('')

    const { name, phone, status } = form
    const email = sanitizeEmail(form.email)

    if (email && !isValidEmail(email)) {
      setError('Enter a valid email address.')
      setSaving(false)
      return
    }

    const { error: saveError } = isEdit
      ? await supabase.from('profiles').update({ name, phone, email, status }).eq('id', id)
      : await supabase.from('profiles').insert({ name, phone, email, status, role: 'hand' })

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    navigate('/hands')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-canvas">
        <TopNav backTo="/hands" backLabel="Hands" />
        <p className="px-4 py-6 text-[15px] text-ink-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav backTo="/hands" backLabel="Hands" />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="font-display text-3xl font-light text-ink-900">
          {isEdit ? 'Edit hand' : 'Add hand'}
        </h1>

        {isEdit && (
          <p className="text-[15px] text-ink-400">
            Role: <span className="font-medium capitalize text-ink-900">{form.role}</span>
            {(form.role === 'manager' || form.role === 'admin') &&
              ' (has their own login — this can\u2019t be changed here)'}
          </p>
        )}

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-col gap-4 rounded-md border border-border-card bg-white p-4"
        >
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
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => update('email', sanitizeEmail(event.target.value))}
          />
          <SelectField
            label="Status"
            value={form.status}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SelectField>

          {error && <p className="text-[15px] text-red-600">{error}</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/hands')}
              className="flex h-12 flex-1 items-center justify-center rounded-md border border-border-input bg-white text-[16px] font-semibold text-ink-600 active:bg-surface-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex h-12 flex-1 items-center justify-center rounded-md bg-accent-bright text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </main>

      <ConfirmDialog
        open={confirmingArchive}
        title={`Set ${form.name || 'this person'} to inactive?`}
        message="They'll be hidden from the Hands list, but their record stays in the database — you can switch them back to Active anytime."
        confirmLabel="Set inactive"
        destructive={false}
        onConfirm={performSave}
        onCancel={() => setConfirmingArchive(false)}
      />
    </div>
  )
}
