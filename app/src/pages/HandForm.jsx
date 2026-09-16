import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { TextField, SelectField, DateField } from '../components/FormField'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { sanitizeEmail, isValidEmail } from '../lib/email'
import { WEEKDAYS } from '../lib/turnoutSchedule'

const BLANK = { name: '', phone: '', email: '', role: 'hand', status: 'active' }

function blankShiftRow() {
  return { key: crypto.randomUUID(), id: null, day: 'mon', shift_type_id: '' }
}

function blankVacationRow() {
  return { key: crypto.randomUUID(), id: null, start_date: '', end_date: '' }
}

// Hands are plain directory records (no login account) — a manager can
// create one directly here. Managers are different: they need a real
// Supabase Auth login, so new manager accounts are created on the separate
// "Add manager" screen (which calls the create-manager Edge Function)
// instead of through this form. Because of that, role isn't editable here —
// changing an existing person's role away from what they were created as
// wouldn't add or remove a login account, so it could leave a "manager" row
// with no way to sign in, or a "hand" row that's actually still a live
// manager login.
//
// Recurring Shifts and Vacations are Hand-only concepts (scheduling doesn't
// apply to managers/admins), so both sections only render when
// form.role === 'hand'.
export default function HandForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [form, setForm] = useState(BLANK)
  const [shiftTypes, setShiftTypes] = useState([])
  const [shiftRows, setShiftRows] = useState([])
  const [removedShiftRowIds, setRemovedShiftRowIds] = useState([])
  const [vacationRows, setVacationRows] = useState([])
  const [removedVacationRowIds, setRemovedVacationRowIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const initialStatusRef = useRef('active')

  useEffect(() => {
    let active = true

    async function load() {
      const [typesResult, profileResult, shiftsResult, vacationsResult] = await Promise.all([
        supabase.from('hand_shift_types').select('id, name, day_of_week').eq('active', true).order('sort_order'),
        isEdit
          ? supabase.from('profiles').select('name, phone, email, role, status').eq('id', id).single()
          : Promise.resolve({ data: null }),
        isEdit
          ? supabase.from('hand_recurring_shifts').select('id, shift_type_id').eq('profile_id', id)
          : Promise.resolve({ data: [] }),
        isEdit
          ? supabase.from('hand_vacations').select('id, start_date, end_date').eq('profile_id', id)
          : Promise.resolve({ data: [] }),
      ])

      if (!active) return

      if (typesResult.error) {
        setError(typesResult.error.message)
      } else {
        setShiftTypes(typesResult.data ?? [])
      }

      if (isEdit) {
        if (profileResult.error) {
          setError(profileResult.error.message)
        } else if (profileResult.data) {
          setForm({ ...profileResult.data, phone: profileResult.data.phone ?? '', email: profileResult.data.email ?? '' })
          initialStatusRef.current = profileResult.data.status
        }

        if (shiftsResult.error) {
          setError(shiftsResult.error.message)
        } else {
          const typesById = Object.fromEntries((typesResult.data ?? []).map((type) => [type.id, type]))
          setShiftRows(
            (shiftsResult.data ?? []).map((row) => ({
              key: row.id,
              id: row.id,
              day: typesById[row.shift_type_id]?.day_of_week ?? 'mon',
              shift_type_id: row.shift_type_id,
            })),
          )
        }

        if (vacationsResult.error) {
          setError(vacationsResult.error.message)
        } else {
          setVacationRows(
            (vacationsResult.data ?? []).map((row) => ({
              key: row.id,
              id: row.id,
              start_date: row.start_date,
              end_date: row.end_date,
            })),
          )
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

  function updateShiftRow(key, field, value) {
    setShiftRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row
        if (field === 'day') return { ...row, day: value, shift_type_id: '' }
        return { ...row, [field]: value }
      }),
    )
  }

  function addShiftRow() {
    setShiftRows((current) => [...current, blankShiftRow()])
  }

  function removeShiftRow(key) {
    setShiftRows((current) => {
      const row = current.find((item) => item.key === key)
      if (row?.id) setRemovedShiftRowIds((ids) => [...ids, row.id])
      return current.filter((item) => item.key !== key)
    })
  }

  function updateVacationRow(key, field, value) {
    setVacationRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)))
  }

  function addVacationRow() {
    setVacationRows((current) => [...current, blankVacationRow()])
  }

  function removeVacationRow(key) {
    setVacationRows((current) => {
      const row = current.find((item) => item.key === key)
      if (row?.id) setRemovedVacationRowIds((ids) => [...ids, row.id])
      return current.filter((item) => item.key !== key)
    })
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

    for (const row of vacationRows) {
      if (!row.start_date && !row.end_date) continue
      if (!row.start_date || !row.end_date) {
        setError('Each vacation needs both a start and end date.')
        setSaving(false)
        return
      }
      if (row.end_date < row.start_date) {
        setError('A vacation’s end date must be on or after its start date.')
        setSaving(false)
        return
      }
    }

    let profileId = id

    if (isEdit) {
      const { error: saveError } = await supabase.from('profiles').update({ name, phone, email, status }).eq('id', id)
      if (saveError) {
        setError(saveError.message)
        setSaving(false)
        return
      }
    } else {
      const { data: inserted, error: saveError } = await supabase
        .from('profiles')
        .insert({ name, phone, email, status, role: 'hand' })
        .select('id')
        .single()
      if (saveError) {
        setError(saveError.message)
        setSaving(false)
        return
      }
      profileId = inserted.id
    }

    if (form.role === 'hand') {
      const requests = []

      for (const row of shiftRows) {
        if (!row.shift_type_id) continue
        const payload = {
          profile_id: profileId,
          shift_type_id: row.shift_type_id,
          updated_by: profile?.id ?? null,
          updated_at: new Date().toISOString(),
        }
        requests.push(
          row.id
            ? supabase.from('hand_recurring_shifts').update(payload).eq('id', row.id)
            : supabase.from('hand_recurring_shifts').insert(payload),
        )
      }
      for (const rowId of removedShiftRowIds) {
        requests.push(supabase.from('hand_recurring_shifts').delete().eq('id', rowId))
      }

      for (const row of vacationRows) {
        if (!row.start_date || !row.end_date) continue
        const payload = {
          profile_id: profileId,
          start_date: row.start_date,
          end_date: row.end_date,
          updated_by: profile?.id ?? null,
          updated_at: new Date().toISOString(),
        }
        requests.push(
          row.id
            ? supabase.from('hand_vacations').update(payload).eq('id', row.id)
            : supabase.from('hand_vacations').insert(payload),
        )
      }
      for (const rowId of removedVacationRowIds) {
        requests.push(supabase.from('hand_vacations').delete().eq('id', rowId))
      }

      const results = await Promise.all(requests)
      const firstError = results.find((result) => result.error)
      if (firstError) {
        setError(firstError.error.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    navigate('/hands')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-canvas">
        <TopNav backTo="/hands" backLabel="Hands" />
        <p className="mx-auto w-full max-w-[800px] px-4 py-6 text-[15px] text-ink-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav backTo="/hands" backLabel="Hands" />

      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="font-display text-3xl font-light text-ink-900">
          {isEdit ? 'Edit hand' : 'Add hand'}
        </h1>

        {isEdit && (
          <p className="text-[15px] text-ink-400">
            Role: <span className="font-medium capitalize text-ink-900">{form.role}</span>
            {(form.role === 'manager' || form.role === 'admin') &&
              ' (has their own login — this can’t be changed here)'}
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

          {form.role === 'hand' && (
            <div className="flex flex-col gap-3 border-t border-border-hairline pt-3">
              <span className="text-xs font-semibold text-ink-400">Recurring shifts</span>

              {shiftRows.length === 0 && <p className="text-[15px] text-ink-400">No recurring shifts yet.</p>}

              {shiftRows.map((row) => {
                const dayTypes = shiftTypes.filter((type) => type.day_of_week === row.day)
                return (
                  <div
                    key={row.key}
                    className="flex items-end gap-2 rounded-md border border-border-divider bg-surface-canvas p-3"
                  >
                    <SelectField
                      label="Day"
                      className="flex-1"
                      value={row.day}
                      onChange={(event) => updateShiftRow(row.key, 'day', event.target.value)}
                    >
                      {WEEKDAYS.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label="Shift"
                      className="flex-1"
                      value={row.shift_type_id}
                      onChange={(event) => updateShiftRow(row.key, 'shift_type_id', event.target.value)}
                    >
                      <option value="" disabled>
                        {dayTypes.length === 0 ? 'No shift types for this day' : 'Select…'}
                      </option>
                      {dayTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </SelectField>
                    <button
                      type="button"
                      onClick={() => removeShiftRow(row.key)}
                      aria-label="Remove recurring shift"
                      className="mb-[1px] flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border border-border-input bg-white text-ink-300 active:bg-surface-canvas"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                )
              })}

              <button
                type="button"
                onClick={addShiftRow}
                className="self-start text-[14px] font-semibold text-accent-bright active:opacity-70"
              >
                + Add recurring shift
              </button>

              {shiftTypes.length === 0 && (
                <p className="text-sm text-ink-300">
                  No shift types configured yet.{' '}
                  <Link to="/hands/shift-types" className="underline">
                    Add some
                  </Link>{' '}
                  before building a schedule.
                </p>
              )}
            </div>
          )}

          {form.role === 'hand' && (
            <div className="flex flex-col gap-3 border-t border-border-hairline pt-3">
              <span className="text-xs font-semibold text-ink-400">Vacations</span>

              {vacationRows.length === 0 && <p className="text-[15px] text-ink-400">No vacations on file.</p>}

              {vacationRows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-end gap-2 rounded-md border border-border-divider bg-surface-canvas p-3"
                >
                  <DateField
                    label="Start date"
                    className="flex-1"
                    value={row.start_date}
                    onChange={(value) => updateVacationRow(row.key, 'start_date', value)}
                  />
                  <DateField
                    label="End date"
                    className="flex-1"
                    value={row.end_date}
                    onChange={(value) => updateVacationRow(row.key, 'end_date', value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeVacationRow(row.key)}
                    aria-label="Remove vacation"
                    className="mb-[1px] flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border border-border-input bg-white text-ink-300 active:bg-surface-canvas"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addVacationRow}
                className="self-start text-[14px] font-semibold text-accent-bright active:opacity-70"
              >
                + Add vacation
              </button>
            </div>
          )}

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
