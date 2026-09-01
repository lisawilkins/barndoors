import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { TextField, TextAreaField, SelectField } from '../components/FormField'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { WEEKDAYS } from '../lib/turnoutSchedule'

const BLANK = { first_name: '', last_initial: '', age: '', gender: '', notes: '', status: 'active' }

function blankScheduleRow() {
  return { key: crypto.randomUUID(), id: null, day: 'mon', time_slot_id: '', activity: 'working', horse_id: '' }
}

export default function WranglerForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [form, setForm] = useState(BLANK)
  const [timeSlots, setTimeSlots] = useState([])
  const [heads, setHeads] = useState([])
  const [scheduleRows, setScheduleRows] = useState([])
  const [removedScheduleRowIds, setRemovedScheduleRowIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const initialStatusRef = useRef('active')

  useEffect(() => {
    let active = true

    async function load() {
      const [slotsResult, headsResult, wranglerResult, scheduleResult] = await Promise.all([
        supabase.from('wrangler_time_slots').select('id, name, day_of_week').eq('active', true).order('sort_order'),
        supabase.from('head').select('id, name').eq('status', 'active').order('name'),
        isEdit
          ? supabase
              .from('wranglers')
              .select('first_name, last_initial, age, gender, notes, status')
              .eq('id', id)
              .single()
          : Promise.resolve({}),
        isEdit
          ? supabase
              .from('wrangler_recurring_assignments')
              .select('id, time_slot_id, activity, horse_id')
              .eq('wrangler_id', id)
          : Promise.resolve({ data: [] }),
      ])

      if (!active) return

      if (slotsResult.error) {
        setError(slotsResult.error.message)
      } else {
        setTimeSlots(slotsResult.data ?? [])
      }

      if (headsResult.error) {
        setError(headsResult.error.message)
      } else {
        setHeads(headsResult.data ?? [])
      }

      if (isEdit) {
        if (wranglerResult.error) {
          setError(wranglerResult.error.message)
        } else if (wranglerResult.data) {
          setForm({
            ...wranglerResult.data,
            age: wranglerResult.data.age ?? '',
            gender: wranglerResult.data.gender ?? '',
            notes: wranglerResult.data.notes ?? '',
          })
          initialStatusRef.current = wranglerResult.data.status
        }

        if (scheduleResult.error) {
          setError(scheduleResult.error.message)
        } else {
          const slotsById = Object.fromEntries((slotsResult.data ?? []).map((slot) => [slot.id, slot]))
          setScheduleRows(
            (scheduleResult.data ?? []).map((row) => ({
              key: row.id,
              id: row.id,
              day: slotsById[row.time_slot_id]?.day_of_week ?? 'mon',
              time_slot_id: row.time_slot_id,
              activity: row.activity,
              horse_id: row.horse_id ?? '',
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

  function updateScheduleRow(key, field, value) {
    setScheduleRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row
        if (field === 'day') return { ...row, day: value, time_slot_id: '' }
        if (field === 'activity') return { ...row, activity: value, horse_id: value === 'riding' ? row.horse_id : '' }
        return { ...row, [field]: value }
      }),
    )
  }

  function addScheduleRow() {
    setScheduleRows((current) => [...current, blankScheduleRow()])
  }

  function removeScheduleRow(key) {
    setScheduleRows((current) => {
      const row = current.find((item) => item.key === key)
      if (row?.id) setRemovedScheduleRowIds((ids) => [...ids, row.id])
      return current.filter((item) => item.key !== key)
    })
  }

  function isArchiving() {
    return isEdit && initialStatusRef.current !== 'archived' && form.status === 'archived'
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

    const payload = {
      first_name: form.first_name.trim(),
      last_initial: form.last_initial.trim(),
      age: form.age === '' ? null : Number(form.age),
      gender: form.gender.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      updated_by: profile?.id ?? null,
      updated_at: new Date().toISOString(),
    }

    if (!payload.first_name || !payload.last_initial) {
      setError('First name and last initial are required.')
      setSaving(false)
      return
    }

    let wranglerId = id

    if (isEdit) {
      const { error: saveError } = await supabase.from('wranglers').update(payload).eq('id', id)
      if (saveError) {
        setError(saveError.message)
        setSaving(false)
        return
      }
    } else {
      const { data: inserted, error: saveError } = await supabase
        .from('wranglers')
        .insert(payload)
        .select('id')
        .single()
      if (saveError) {
        setError(saveError.message)
        setSaving(false)
        return
      }
      wranglerId = inserted.id
    }

    const scheduleRequests = []

    for (const row of scheduleRows) {
      if (!row.time_slot_id) continue

      const schedulePayload = {
        wrangler_id: wranglerId,
        time_slot_id: row.time_slot_id,
        activity: row.activity,
        horse_id: row.activity === 'riding' && row.horse_id ? row.horse_id : null,
        updated_by: profile?.id ?? null,
        updated_at: new Date().toISOString(),
      }

      scheduleRequests.push(
        row.id
          ? supabase.from('wrangler_recurring_assignments').update(schedulePayload).eq('id', row.id)
          : supabase.from('wrangler_recurring_assignments').insert(schedulePayload),
      )
    }

    for (const rowId of removedScheduleRowIds) {
      scheduleRequests.push(supabase.from('wrangler_recurring_assignments').delete().eq('id', rowId))
    }

    const scheduleResults = await Promise.all(scheduleRequests)
    const scheduleError = scheduleResults.find((result) => result.error)
    if (scheduleError) {
      setError(scheduleError.error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    navigate('/wranglers')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-canvas">
        <TopNav backTo="/wranglers" backLabel="Wranglers" />
        <p className="px-4 py-6 text-[15px] text-ink-400">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav backTo="/wranglers" backLabel="Wranglers" />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="font-display text-3xl font-light text-ink-900">
          {isEdit ? 'Edit wrangler' : 'Add wrangler'}
        </h1>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-col gap-4 rounded-md border border-border-card bg-white p-4"
        >
          <div className="flex gap-3">
            <TextField
              label="First name"
              required
              className="flex-1"
              value={form.first_name}
              onChange={(event) => update('first_name', event.target.value)}
            />
            <TextField
              label="Last initial"
              required
              maxLength={1}
              className="w-24"
              value={form.last_initial}
              onChange={(event) => update('last_initial', event.target.value.slice(0, 1))}
            />
          </div>
          <div className="flex gap-3">
            <TextField
              label="Age"
              type="number"
              min="0"
              className="flex-1"
              value={form.age}
              onChange={(event) => update('age', event.target.value)}
            />
            <TextField
              label="Gender"
              className="flex-1"
              value={form.gender}
              onChange={(event) => update('gender', event.target.value)}
            />
          </div>
          <TextAreaField
            label="Notes"
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
          />

          <div className="flex flex-col gap-3 border-t border-border-hairline pt-3">
            <span className="text-xs font-semibold text-ink-400">Schedule</span>

            {scheduleRows.length === 0 && <p className="text-[15px] text-ink-400">No schedule yet.</p>}

            {scheduleRows.map((row) => {
              const daySlots = timeSlots.filter((slot) => slot.day_of_week === row.day)
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
                      onChange={(event) => updateScheduleRow(row.key, 'day', event.target.value)}
                    >
                      {WEEKDAYS.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </SelectField>
                    <div className="flex flex-col gap-1">
                      <span className="invisible text-xs font-semibold">Remove</span>
                      <button
                        type="button"
                        onClick={() => removeScheduleRow(row.key)}
                        aria-label="Remove schedule row"
                        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border border-border-input bg-white text-ink-300 active:bg-surface-canvas"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  </div>

                  <SelectField
                    label="Time slot"
                    value={row.time_slot_id}
                    onChange={(event) => updateScheduleRow(row.key, 'time_slot_id', event.target.value)}
                  >
                    <option value="" disabled>
                      {daySlots.length === 0 ? 'No time slots for this day' : 'Select…'}
                    </option>
                    {daySlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.name}
                      </option>
                    ))}
                  </SelectField>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-[15px] text-ink-900">
                      <input
                        type="radio"
                        name={`activity-${row.key}`}
                        checked={row.activity === 'working'}
                        onChange={() => updateScheduleRow(row.key, 'activity', 'working')}
                      />
                      Work
                    </label>
                    <label className="flex items-center gap-2 text-[15px] text-ink-900">
                      <input
                        type="radio"
                        name={`activity-${row.key}`}
                        checked={row.activity === 'riding'}
                        onChange={() => updateScheduleRow(row.key, 'activity', 'riding')}
                      />
                      Ride
                    </label>
                  </div>

                  {row.activity === 'riding' && (
                    <SelectField
                      label="Horse"
                      value={row.horse_id}
                      onChange={(event) => updateScheduleRow(row.key, 'horse_id', event.target.value)}
                    >
                      <option value="">None</option>
                      {heads.map((head) => (
                        <option key={head.id} value={head.id}>
                          {head.name}
                        </option>
                      ))}
                    </SelectField>
                  )}
                </div>
              )
            })}

            <button
              type="button"
              onClick={addScheduleRow}
              className="self-start text-[14px] font-semibold text-accent-bright active:opacity-70"
            >
              + Add schedule row
            </button>

            {timeSlots.length === 0 && (
              <p className="text-sm text-ink-300">
                No time slots configured yet.{' '}
                <Link to="/wranglers/time-slots" className="underline">
                  Add some
                </Link>{' '}
                before building a schedule.
              </p>
            )}
          </div>

          <SelectField
            label="Status"
            value={form.status}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </SelectField>

          {error && <p className="text-[15px] text-red-600">{error}</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/wranglers')}
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
        title={`Archive ${form.first_name || 'this wrangler'}?`}
        message="They'll be hidden from the Wranglers list, but their record and schedule history stay in the database — you can switch their status back anytime."
        confirmLabel="Archive"
        destructive={false}
        onConfirm={performSave}
        onCancel={() => setConfirmingArchive(false)}
      />
    </div>
  )
}
