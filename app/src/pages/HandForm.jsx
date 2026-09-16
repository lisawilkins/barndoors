import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { TextField, SelectField, DateField } from '../components/FormField'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { sanitizeEmail, isValidEmail } from '../lib/email'
import { WEEKDAYS } from '../lib/turnoutSchedule'
import { isSchedulable } from '../lib/handSchedule'

const BLANK = { name: '', phone: '', email: '', role: 'hand', status: 'active' }

function blankShiftRow() {
  return { key: crypto.randomUUID(), id: null, day: 'mon', shift_type_id: '', biweekly: false, biweekly_start_date: '' }
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
// Recurring Shifts and Vacations apply to anyone schedulable — Hands and
// Admins, per isSchedulable() — but never Managers, so both sections only
// render for those roles.
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
  // Tracks a profile created by an earlier, partially-failed Save on this
  // same /hands/new visit — id from useParams() never changes mid-session,
  // so without this a retry after the profile insert succeeds but a later
  // shift/vacation write fails would insert a second, orphaned profile row.
  const createdProfileIdRef = useRef(null)

  useEffect(() => {
    let active = true

    async function load() {
      const [typesResult, profileResult, shiftsResult, vacationsResult] = await Promise.all([
        // Not filtered to active — an existing row can reference an
        // archived type, and it needs to resolve correctly (right day,
        // visible in the Shift dropdown) rather than silently corrupt.
        supabase.from('hand_shift_types').select('id, name, day_of_week, active').order('sort_order'),
        isEdit
          ? supabase.from('profiles').select('name, phone, email, role, status').eq('id', id).single()
          : Promise.resolve({ data: null }),
        isEdit
          ? supabase
              .from('hand_recurring_shifts')
              .select('id, shift_type_id, biweekly, biweekly_start_date')
              .eq('profile_id', id)
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
              biweekly: row.biweekly,
              biweekly_start_date: row.biweekly_start_date ?? '',
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
        if (field === 'biweekly') return { ...row, biweekly: value, biweekly_start_date: value ? row.biweekly_start_date : '' }
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

    for (const row of shiftRows) {
      if (row.biweekly && !row.shift_type_id) {
        setError('Select a shift for the every-2-weeks row, or remove the row.')
        setSaving(false)
        return
      }
      if (row.shift_type_id && row.biweekly && !row.biweekly_start_date) {
        setError('Enter a "Beginning on" date for the every-2-weeks shift, or uncheck it.')
        setSaving(false)
        return
      }
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

    const existingProfileId = id ?? createdProfileIdRef.current
    let profileId = existingProfileId

    if (existingProfileId) {
      const { error: saveError } = await supabase
        .from('profiles')
        .update({ name, phone, email, status })
        .eq('id', existingProfileId)
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
      createdProfileIdRef.current = inserted.id
    }

    if (isSchedulable(form.role)) {
      // Deletes run first and are awaited before any insert/update — a
      // manager swapping a row for a new one on the same day+shift-type
      // would otherwise race the new insert against the old row's delete
      // and could spuriously trip hand_recurring_shifts' unique constraint.
      const deleteRequests = [
        ...removedShiftRowIds.map((rowId) => supabase.from('hand_recurring_shifts').delete().eq('id', rowId)),
        ...removedVacationRowIds.map((rowId) => supabase.from('hand_vacations').delete().eq('id', rowId)),
      ]

      if (deleteRequests.length > 0) {
        const deleteResults = await Promise.all(deleteRequests)
        const deleteError = deleteResults.find((result) => result.error)
        if (deleteError) {
          setError(deleteError.error.message)
          setSaving(false)
          return
        }
      }

      const upsertRequests = []

      for (const row of shiftRows) {
        if (!row.shift_type_id) continue
        const payload = {
          profile_id: profileId,
          shift_type_id: row.shift_type_id,
          biweekly: row.biweekly,
          biweekly_start_date: row.biweekly ? row.biweekly_start_date : null,
          updated_by: profile?.id ?? null,
          updated_at: new Date().toISOString(),
        }
        upsertRequests.push(
          row.id
            ? supabase.from('hand_recurring_shifts').update(payload).eq('id', row.id)
            : supabase.from('hand_recurring_shifts').insert(payload),
        )
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
        upsertRequests.push(
          row.id
            ? supabase.from('hand_vacations').update(payload).eq('id', row.id)
            : supabase.from('hand_vacations').insert(payload),
        )
      }

      if (upsertRequests.length > 0) {
        const upsertResults = await Promise.all(upsertRequests)
        const upsertError = upsertResults.find((result) => result.error)
        if (upsertError) {
          setError(upsertError.error.message)
          setSaving(false)
          return
        }
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

          {isSchedulable(form.role) && (
            <div className="flex flex-col gap-3 border-t border-border-hairline pt-3">
              <span className="text-xs font-semibold text-ink-400">Recurring shifts</span>

              {shiftRows.length === 0 && <p className="text-[15px] text-ink-400">No recurring shifts yet.</p>}

              {shiftRows.map((row) => {
                // Active types for this day, plus the row's own current
                // selection even if it's since been archived — an archived
                // type must stay visible/selected on the row that already
                // has it, just not offered for a fresh pick.
                const dayTypes = shiftTypes.filter(
                  (type) => type.day_of_week === row.day && (type.active || type.id === row.shift_type_id),
                )
                return (
                  <div
                    key={row.key}
                    className="flex flex-col gap-2 rounded-md border border-border-divider bg-surface-canvas p-3"
                  >
                    <div className="flex items-end gap-2">
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
                            {!type.active ? ' (archived)' : ''}
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

                    <label className="flex items-center gap-2 text-[15px] text-ink-900">
                      <input
                        type="checkbox"
                        checked={row.biweekly}
                        onChange={(event) => updateShiftRow(row.key, 'biweekly', event.target.checked)}
                      />
                      Every 2 weeks
                    </label>

                    {row.biweekly && (
                      <DateField
                        label="Beginning on"
                        value={row.biweekly_start_date}
                        onChange={(value) => updateShiftRow(row.key, 'biweekly_start_date', value)}
                      />
                    )}
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

              {shiftTypes.every((type) => !type.active) && (
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

          {isSchedulable(form.role) && (
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
