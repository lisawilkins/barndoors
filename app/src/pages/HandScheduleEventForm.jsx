import { useState } from 'react'
import { TextField, TextAreaField, DateField, SelectField } from '../components/FormField'
import { isoDate, dateFromIso, weekdayKey } from '../lib/calendarSchedule'

// "HH:MM:SS" from Postgres -> "HH:MM" for <input type="time">.
function toTimeInputValue(time) {
  return time ? time.slice(0, 5) : ''
}

function initialForm(date, event) {
  if (!event) {
    return { title: '', event_date: isoDate(date), start_time: '', shift_type_id: '', notes: '', needs_help: false, member_ids: [] }
  }
  return {
    title: event.title ?? '',
    event_date: event.event_date,
    start_time: toTimeInputValue(event.start_time),
    shift_type_id: event.shift_type_id ?? '',
    notes: event.notes ?? '',
    needs_help: event.needs_help,
    member_ids: event.members ?? [],
  }
}

// Add or edit a one-off. `event` is null when adding. The "when" is either a
// start time or one of that weekday's shifts — picking one clears the
// other. Staffing is either Needs Help (shows as OPEN SHIFT) or chosen
// hands — checking Needs Help hides and clears the hand picker.
export default function HandScheduleEventForm({
  date,
  event,
  hands,
  handsById,
  shiftTypes,
  saving,
  error,
  onSubmit,
  onClose,
}) {
  const [form, setForm] = useState(() => initialForm(date, event))
  const isEdit = Boolean(event)

  const weekday = form.event_date ? weekdayKey(dateFromIso(form.event_date)) : null
  // That weekday's active shifts, plus the currently picked one even if it
  // has since been archived, so an existing one-off still shows its shift.
  const shiftOptions = shiftTypes.filter(
    (type) => type.day_of_week === weekday && (type.active || type.id === form.shift_type_id),
  )

  function updateDate(nextIso) {
    setForm((current) => {
      const next = { ...current, event_date: nextIso }
      // A shift belongs to one weekday — drop it if the new date isn't that day.
      const picked = shiftTypes.find((type) => type.id === current.shift_type_id)
      if (picked && (!nextIso || picked.day_of_week !== weekdayKey(dateFromIso(nextIso)))) next.shift_type_id = ''
      return next
    })
  }
  const [handPickerOpen, setHandPickerOpen] = useState(false)
  const [handFilter, setHandFilter] = useState('')

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function toggleEventMember(profileId) {
    setForm((current) => {
      const memberIds = current.member_ids.includes(profileId)
        ? current.member_ids.filter((value) => value !== profileId)
        : [...current.member_ids, profileId]
      return { ...current, member_ids: memberIds }
    })
  }

  function handleSubmit(submitEvent) {
    submitEvent.preventDefault()
    onSubmit(form)
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4 print:hidden"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className="fscroll flex max-h-[90vh] w-full max-w-sm flex-col gap-3 overflow-auto rounded-md bg-white p-5 shadow-card"
      >
        <h2 className="font-display text-xl font-semibold text-ink-900">
          {isEdit ? 'Edit one-off shift' : 'Add one-off shift'}
        </h2>
        <p className="text-sm text-ink-400">
          For a standing weekly shift, edit it on the hand's own profile instead.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <TextField
            label="Title (optional)"
            autoFocus
            placeholder="e.g. Gymkhana"
            value={form.title}
            onChange={(event) => updateForm('title', event.target.value)}
          />
          <DateField label="Date" value={form.event_date} onChange={updateDate} />

          <div className="flex items-end gap-2">
            <TextField
              label="Time"
              type="time"
              className="flex-1"
              value={form.start_time}
              onChange={(changeEvent) =>
                setForm((current) => ({
                  ...current,
                  start_time: changeEvent.target.value,
                  shift_type_id: changeEvent.target.value ? '' : current.shift_type_id,
                }))
              }
            />
            <span className="flex h-14 items-center text-sm font-semibold text-ink-400">or</span>
            <SelectField
              label="Shift"
              className="flex-1"
              value={form.shift_type_id}
              onChange={(changeEvent) =>
                setForm((current) => ({
                  ...current,
                  shift_type_id: changeEvent.target.value,
                  start_time: changeEvent.target.value ? '' : current.start_time,
                }))
              }
            >
              <option value="">Choose…</option>
              {shiftOptions.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </SelectField>
          </div>
          <TextAreaField
            label="Notes"
            placeholder="e.g. Groom for event. Meet at SA or event venue."
            value={form.notes}
            onChange={(event) => updateForm('notes', event.target.value)}
          />

          <label className="flex min-h-12 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.needs_help}
              onChange={(changeEvent) => {
                const checked = changeEvent.target.checked
                setForm((current) => ({ ...current, needs_help: checked, member_ids: checked ? [] : current.member_ids }))
                if (checked) setHandPickerOpen(false)
              }}
              className="h-6 w-6 flex-shrink-0 accent-accent-bright"
            />
            <span className="text-[15px] font-semibold text-ink-900">Needs Help</span>
            <span className="text-sm text-ink-400">shows as OPEN SHIFT</span>
          </label>

          {!form.needs_help && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-400">Hands</span>

              {hands.length === 0 ? (
                <p className="text-[15px] text-ink-400">No active hands to add yet.</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setHandPickerOpen((current) => !current)
                      setHandFilter('')
                    }}
                    className="flex min-h-12 items-center justify-between gap-2 rounded-md border border-border-input bg-white px-2.5 py-1.5"
                  >
                    <span className="flex flex-1 flex-wrap gap-1.5">
                      {form.member_ids.length === 0 ? (
                        <span className="text-[15px] text-ink-300">Select hands</span>
                      ) : (
                        form.member_ids.map((memberId) => {
                          const hand = handsById[memberId]
                          return (
                            <span
                              key={memberId}
                              className="flex h-[30px] items-center gap-1.5 rounded-full bg-chip-bg px-2.5 text-[13px] font-semibold text-chip-fg"
                            >
                              {hand?.name ?? 'Unknown'}
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label={`Remove ${hand?.name ?? 'hand'}`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  toggleEventMember(memberId)
                                }}
                                className="material-symbols-outlined text-[14px] text-placeholder-tan-1"
                              >
                                close
                              </span>
                            </span>
                          )
                        })
                      )}
                    </span>
                    <span className="material-symbols-outlined flex-shrink-0 text-[16px] text-ink-300">expand_more</span>
                  </button>

                  {handPickerOpen && (
                    <div className="overflow-hidden rounded-md border border-border-input bg-white shadow-card">
                      <div className="flex items-center gap-2 border-b border-border-hairline px-2.5 py-2">
                        <span className="material-symbols-outlined text-[16px] text-ink-300">search</span>
                        <input
                          type="text"
                          autoFocus
                          value={handFilter}
                          onChange={(event) => setHandFilter(event.target.value)}
                          placeholder="Filter hands"
                          className="flex-1 border-0 bg-transparent text-[14px] text-ink-900 outline-none placeholder:text-ink-300"
                        />
                      </div>
                      <div className="fscroll max-h-44 overflow-auto">
                        {hands
                          .filter((hand) => (hand.name || '').toLowerCase().includes(handFilter.toLowerCase()))
                          .map((hand) => {
                            const selected = form.member_ids.includes(hand.id)
                            return (
                              <div
                                key={hand.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleEventMember(hand.id)}
                                className="flex cursor-pointer items-center gap-2.5 border-b border-border-hairline-2 px-2.5 py-2 last:border-0"
                              >
                                <span
                                  className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${
                                    selected ? 'border-accent-bright bg-accent-bright' : 'border-ink-200 bg-white'
                                  }`}
                                >
                                  {selected && <span className="material-symbols-outlined text-[14px] text-white">check</span>}
                                </span>
                                <span className="text-[15px] text-ink-900">{hand.name}</span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {error && <p className="text-[15px] text-red-600">{error}</p>}

          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 flex-1 items-center justify-center rounded-md border border-border-input bg-white text-[15px] font-semibold text-ink-600 active:bg-surface-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex h-11 flex-1 items-center justify-center rounded-md bg-accent-bright text-[15px] font-bold text-white active:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
