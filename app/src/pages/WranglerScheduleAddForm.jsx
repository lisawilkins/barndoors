import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SelectField } from '../components/FormField'
import { isoDate, weekdayKey, wranglerShortName } from '../lib/wranglerSchedule'

function blankAssignmentForm() {
  return {
    wrangler_id: '',
    activity: 'working',
    time_slot_id: '',
    horse_id: '',
  }
}

export default function WranglerScheduleAddForm({
  date,
  wranglers,
  timeSlots,
  heads,
  saving,
  error,
  onSubmit,
  onClose,
}) {
  const [form, setForm] = useState(blankAssignmentForm)
  const addDaySlots = timeSlots.filter((slot) => slot.day_of_week === weekdayKey(date))

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
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
        <h2 className="font-display text-xl font-semibold text-ink-900">Add one-off assignment</h2>
        <p className="text-sm text-ink-400">
          {isoDate(date)} — for a standing weekly assignment, edit it on the wrangler's own profile instead.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <SelectField
            label="Wrangler"
            required
            value={form.wrangler_id}
            onChange={(event) => updateForm('wrangler_id', event.target.value)}
          >
            <option value="" disabled>
              Select…
            </option>
            {wranglers.map((wrangler) => (
              <option key={wrangler.id} value={wrangler.id}>
                {wranglerShortName(wrangler)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Time slot"
            required
            value={form.time_slot_id}
            onChange={(event) => updateForm('time_slot_id', event.target.value)}
          >
            <option value="" disabled>
              {addDaySlots.length === 0 ? 'No time slots for this day' : 'Select…'}
            </option>
            {addDaySlots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.name}
              </option>
            ))}
          </SelectField>

          {addDaySlots.length === 0 && (
            <p className="text-sm text-ink-300">
              No time slots are configured for this day yet.{' '}
              <Link to="/wranglers/time-slots" className="underline" onClick={onClose}>
                Add one
              </Link>
              .
            </p>
          )}

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-[15px] text-ink-900">
              <input
                type="radio"
                name="activity"
                checked={form.activity === 'working'}
                onChange={() => updateForm('activity', 'working')}
              />
              Working
            </label>
            <label className="flex items-center gap-2 text-[15px] text-ink-900">
              <input
                type="radio"
                name="activity"
                checked={form.activity === 'riding'}
                onChange={() => updateForm('activity', 'riding')}
              />
              Riding
            </label>
          </div>

          {form.activity === 'riding' && (
            <SelectField
              label="Horse (optional)"
              value={form.horse_id}
              onChange={(event) => updateForm('horse_id', event.target.value)}
            >
              <option value="">None</option>
              {heads.map((head) => (
                <option key={head.id} value={head.id}>
                  {head.name}
                </option>
              ))}
            </SelectField>
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
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
