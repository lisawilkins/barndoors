import { useEffect, useState } from 'react'
import TopNav from '../components/TopNav'
import { TextField, SelectField } from '../components/FormField'
import { supabase } from '../lib/supabaseClient'
import { WEEKDAYS } from '../lib/turnoutSchedule'

function blankAddForm() {
  return { day: 'mon', name: '' }
}

// Shift types are day-specific ("Mon AM"), managed here rather than inline
// on a hand's profile — one manager-facing list grouped by day, so it reads
// the way a manager would actually think about it ("what shifts do we run
// on Monday?"). A default set of 14 (AM + PM x every day) ships with the
// migration, so this page starts populated; managers can add more the same
// way Wrangler time slots work. Adding is one action for the whole page
// (pick a day + a name), not a separate add row per day; editing an
// existing type (renaming it, or archiving it so it stops appearing on
// future days) goes through a popup reached via the row's edit icon.
export default function HandShiftTypes() {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [addForm, setAddForm] = useState(null)
  const [savingAdd, setSavingAdd] = useState(false)
  const [addError, setAddError] = useState('')

  const [editingType, setEditingType] = useState(null)
  const [editNameDraft, setEditNameDraft] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('hand_shift_types')
      .select('id, name, day_of_week, sort_order, active')
      .eq('active', true)
      .order('sort_order')

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setTypes(data ?? [])
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

  async function handleAddType(event) {
    event.preventDefault()
    const name = addForm.name.trim()
    if (!name) {
      setAddError('Enter a name.')
      return
    }

    setSavingAdd(true)
    setAddError('')

    // One past the current max, not a count — a count collides with an
    // existing sort_order once an earlier same-day type has been archived
    // (e.g. archiving Mon AM(0) leaves only PM(1) active, so a plain count
    // of 1 would tie with PM instead of landing after it).
    const daySortOrders = types.filter((type) => type.day_of_week === addForm.day).map((type) => type.sort_order)
    const sortOrder = daySortOrders.length === 0 ? 0 : Math.max(...daySortOrders) + 1

    const { error: insertError } = await supabase
      .from('hand_shift_types')
      .insert({ name, day_of_week: addForm.day, sort_order: sortOrder })

    setSavingAdd(false)

    if (insertError) {
      setAddError(insertError.message)
      return
    }

    closeAddModal()
    load()
  }

  function openEditModal(type) {
    setEditingType(type)
    setEditNameDraft(type.name)
    setEditError('')
  }

  function closeEditModal() {
    setEditingType(null)
    setEditError('')
  }

  async function handleSaveEditedName() {
    const name = editNameDraft.trim()
    if (!name) {
      setEditError('Enter a name.')
      return
    }

    setSavingEdit(true)
    setEditError('')

    const { error: updateError } = await supabase.from('hand_shift_types').update({ name }).eq('id', editingType.id)

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
      .from('hand_shift_types')
      .update({ active: false })
      .eq('id', editingType.id)

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
      <TopNav backTo="/hands" backLabel="Hands" />

      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-light text-ink-900">Shift types</h1>
          <button
            type="button"
            onClick={openAddModal}
            aria-label="Add a shift type"
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
              const dayTypes = types.filter((type) => type.day_of_week === day.value)
              return (
                <div key={day.value} className="flex flex-col gap-2 rounded-md border border-border-card bg-white p-3.5">
                  <span className="text-[15px] font-bold text-ink-900">{day.label}</span>

                  {dayTypes.length === 0 && <p className="text-sm text-ink-300">No shift types yet.</p>}

                  {dayTypes.length > 0 && (
                    <ul className="flex flex-col">
                      {dayTypes.map((type) => (
                        <li
                          key={type.id}
                          className="flex items-center justify-between gap-3 border-b border-border-hairline py-2 last:border-0"
                        >
                          <span className="text-[15px] font-medium text-ink-900">{type.name}</span>
                          <button
                            type="button"
                            onClick={() => openEditModal(type)}
                            aria-label={`Edit ${type.name}`}
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
            <h2 className="font-display text-xl font-semibold text-ink-900">Add a shift type</h2>

            <form onSubmit={handleAddType} className="flex flex-col gap-3">
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
                label="Name"
                required
                autoFocus
                placeholder="e.g. AM, PM, or Overnight"
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

      {editingType && (
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
              Edit {WEEKDAYS.find((day) => day.value === editingType.day_of_week)?.label} shift type
            </h2>

            <TextField label="Name" value={editNameDraft} onChange={(event) => setEditNameDraft(event.target.value)} />
            <p className="text-sm text-ink-400">Changing the name updates it everywhere it's used, going forward.</p>

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
