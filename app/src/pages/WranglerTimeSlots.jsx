import { useEffect, useState } from 'react'
import TopNav from '../components/TopNav'
import { TextField, SelectField } from '../components/FormField'
import { supabase } from '../lib/supabaseClient'
import { WEEKDAYS } from '../lib/turnoutSchedule'

function blankAddForm() {
  return { day: 'mon', name: '' }
}

// Time slots are day-specific ("Mon 5:30–6:30 PM"), managed here rather than
// inline on a wrangler's profile — one manager-facing list grouped by day,
// so it reads the way a manager would actually think about it ("what times
// do we offer on Monday?"). Adding is one action for the whole page (pick a
// day + a time), not a separate add row per day; editing an existing slot
// (renaming it, or archiving it so it stops appearing on future days) goes
// through a popup reached via the row's edit icon.
export default function WranglerTimeSlots() {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [addForm, setAddForm] = useState(null)
  const [savingAdd, setSavingAdd] = useState(false)
  const [addError, setAddError] = useState('')

  const [editingSlot, setEditingSlot] = useState(null)
  const [editNameDraft, setEditNameDraft] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('wrangler_time_slots')
      .select('id, name, day_of_week, sort_order, active')
      .eq('active', true)
      .order('sort_order')

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setSlots(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function openAddModal() {
    setAddForm(blankAddForm())
    setAddError('')
  }

  function closeAddModal() {
    setAddForm(null)
    setAddError('')
  }

  async function handleAddSlot(event) {
    event.preventDefault()
    const name = addForm.name.trim()
    if (!name) {
      setAddError('Enter a time.')
      return
    }

    setSavingAdd(true)
    setAddError('')

    const sortOrder = slots.filter((slot) => slot.day_of_week === addForm.day).length

    const { error: insertError } = await supabase
      .from('wrangler_time_slots')
      .insert({ name, day_of_week: addForm.day, sort_order: sortOrder })

    setSavingAdd(false)

    if (insertError) {
      setAddError(insertError.message)
      return
    }

    closeAddModal()
    load()
  }

  function openEditModal(slot) {
    setEditingSlot(slot)
    setEditNameDraft(slot.name)
    setEditError('')
  }

  function closeEditModal() {
    setEditingSlot(null)
    setEditError('')
  }

  async function handleSaveEditedName() {
    const name = editNameDraft.trim()
    if (!name) {
      setEditError('Enter a time.')
      return
    }

    setSavingEdit(true)
    setEditError('')

    const { error: updateError } = await supabase
      .from('wrangler_time_slots')
      .update({ name })
      .eq('id', editingSlot.id)

    setSavingEdit(false)

    if (updateError) {
      setEditError(updateError.message)
      return
    }

    closeEditModal()
    load()
  }

  async function handleArchive() {
    setSavingEdit(true)
    setEditError('')

    const { error: updateError } = await supabase
      .from('wrangler_time_slots')
      .update({ active: false })
      .eq('id', editingSlot.id)

    setSavingEdit(false)

    if (updateError) {
      setEditError(updateError.message)
      return
    }

    closeEditModal()
    load()
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav backTo="/wranglers" backLabel="Wranglers" />

      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-light text-ink-900">Time slots</h1>
          <button
            type="button"
            onClick={openAddModal}
            aria-label="Add a time slot"
            className="material-symbols-outlined text-[24px] text-ink-600 active:text-accent-bright"
          >
            add
          </button>
        </div>

        {loading && <p className="text-[15px] text-ink-400">Loading…</p>}
        {error && <p className="text-[15px] text-red-600">{error}</p>}

        {!loading && (
          <div className="flex flex-col gap-3">
            {WEEKDAYS.map((day) => {
              const daySlots = slots.filter((slot) => slot.day_of_week === day.value)
              return (
                <div key={day.value} className="flex flex-col gap-2 rounded-md border border-border-card bg-white p-3.5">
                  <span className="text-[15px] font-bold text-ink-900">{day.label}</span>

                  {daySlots.length === 0 && <p className="text-sm text-ink-300">No time slots yet.</p>}

                  {daySlots.length > 0 && (
                    <ul className="flex flex-col">
                      {daySlots.map((slot) => (
                        <li
                          key={slot.id}
                          className="flex items-center justify-between gap-3 border-b border-border-hairline py-2 last:border-0"
                        >
                          <span className="text-[15px] font-medium text-ink-900">{slot.name}</span>
                          <button
                            type="button"
                            onClick={() => openEditModal(slot)}
                            aria-label={`Edit ${slot.name}`}
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-ink-400 active:bg-surface-canvas"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {addForm && (
        <div
          role="presentation"
          onClick={closeAddModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-md bg-white p-5 shadow-card"
          >
            <h2 className="font-display text-xl font-semibold text-ink-900">Add a time slot</h2>

            <form onSubmit={handleAddSlot} className="flex flex-col gap-3">
              <SelectField
                label="Day"
                value={addForm.day}
                onChange={(event) => setAddForm((current) => ({ ...current, day: event.target.value }))}
              >
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </SelectField>

              <TextField
                label="Time"
                required
                autoFocus
                placeholder="e.g. 5:30–6:30 PM"
                value={addForm.name}
                onChange={(event) => setAddForm((current) => ({ ...current, name: event.target.value }))}
              />

              {addError && <p className="text-[15px] text-red-600">{addError}</p>}

              <div className="mt-1 flex gap-3">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="flex h-11 flex-1 items-center justify-center rounded-md border border-border-input bg-white text-[15px] font-semibold text-ink-600 active:bg-surface-canvas"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdd}
                  className="flex h-11 flex-1 items-center justify-center rounded-md bg-accent-bright text-[15px] font-bold text-white active:opacity-90 disabled:opacity-50"
                >
                  {savingAdd ? 'Saving…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingSlot && (
        <div
          role="presentation"
          onClick={closeEditModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-md bg-white p-5 shadow-card"
          >
            <h2 className="font-display text-xl font-semibold text-ink-900">
              Edit {WEEKDAYS.find((day) => day.value === editingSlot.day_of_week)?.label} slot
            </h2>

            <TextField label="Time" value={editNameDraft} onChange={(event) => setEditNameDraft(event.target.value)} />
            <p className="text-sm text-ink-400">Changing the time updates it everywhere it's used, going forward.</p>

            {editError && <p className="text-[15px] text-red-600">{editError}</p>}

            <div className="mt-1 flex gap-3">
              <button
                type="button"
                onClick={closeEditModal}
                className="flex h-11 flex-1 items-center justify-center rounded-md border border-border-input bg-white text-[15px] font-semibold text-ink-600 active:bg-surface-canvas"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedName}
                disabled={savingEdit}
                className="flex h-11 flex-1 items-center justify-center rounded-md bg-accent-bright text-[15px] font-bold text-white active:opacity-90 disabled:opacity-50"
              >
                Save
              </button>
            </div>

            <button
              type="button"
              onClick={handleArchive}
              disabled={savingEdit}
              className="flex h-11 items-center justify-center rounded-md border border-border-input bg-white text-[15px] font-semibold text-ink-600 active:bg-surface-canvas disabled:opacity-50"
            >
              Archive — stop showing on future days
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
