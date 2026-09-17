import { useState } from 'react'
import { TextField, TextAreaField } from '../components/FormField'
import { isoDate } from '../lib/calendarSchedule'

function blankEventForm() {
  return { title: '', event_time: '', notes: '', member_ids: [] }
}

export default function HandScheduleAddForm({
  date,
  hands,
  handsById,
  saving,
  error,
  onSubmit,
  onClose,
}) {
  const [form, setForm] = useState(blankEventForm)
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
        <h2 className="font-display text-xl font-semibold text-ink-900">Add one-off shift</h2>
        <p className="text-sm text-ink-400">
          {isoDate(date)} — for a standing weekly shift, edit it on the hand's own profile instead.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <TextField
            label="Title"
            required
            autoFocus
            placeholder="e.g. Gymkhana"
            value={form.title}
            onChange={(event) => updateForm('title', event.target.value)}
          />
          <TextField
            label="Time"
            required
            placeholder="e.g. 8am"
            value={form.event_time}
            onChange={(event) => updateForm('event_time', event.target.value)}
          />
          <TextAreaField
            label="Notes"
            placeholder="e.g. Groom for event. Meet at SA or event venue."
            value={form.notes}
            onChange={(event) => updateForm('notes', event.target.value)}
          />

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
