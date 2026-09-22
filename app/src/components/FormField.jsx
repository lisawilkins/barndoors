import { useEffect, useRef, useState } from 'react'
import { formatDateUS, parseFlexibleDate } from '../lib/formatDate'

const labelClass = 'text-xs font-semibold text-ink-400'
const controlClass =
  'rounded-md border border-border-input bg-surface-input px-4 text-[15px] text-ink-900'

export function TextField({ label, className = '', ...props }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className={labelClass}>{label}</span>
      <input {...props} className={`h-14 w-full min-w-0 ${controlClass}`} />
    </label>
  )
}

export function TextAreaField({ label, className = '', ...props }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className={labelClass}>{label}</span>
      <textarea {...props} rows={3} className={`w-full min-w-0 ${controlClass} py-3`} />
    </label>
  )
}

// A date field that takes typed text in several common shapes ("9/10/2019",
// "9-10-19", "Sep 10 2019") or a native date picker, and always displays
// MM/DD/YYYY once a valid date lands. `value`/`onChange` deal in YYYY-MM-DD
// (what's stored, and what the native date input uses) — only the on-screen
// text differs.
//
// The calendar corner is a real `input[type=date]` sitting on top of the
// icon, transparent but full size, so a tap lands on the date input itself.
// That is the only thing that opens the wheel on an iPhone: iOS Safari has
// never supported `showPicker()`, and `focus()` on an off-screen input does
// nothing there, so the old hidden one-pixel input left iPhone users with a
// field they could only type into. Browsers that do have `showPicker()`
// (Chrome, Firefox, Safari 17.4+ on the Mac) still need the explicit call,
// since clicking a date input doesn't open the picker on its own.
export function DateField({ label, value, onChange, className = '' }) {
  const [text, setText] = useState(() => formatDateUS(value))
  const [invalid, setInvalid] = useState(false)
  const dateInputRef = useRef(null)
  // The last value this field itself put out. Lets the effect below tell a
  // change coming from the form apart from the echo of our own onChange —
  // without it, reporting bad input as empty would immediately wipe the text
  // the reader typed and the error explaining it.
  const emittedValue = useRef(value)

  useEffect(() => {
    if (value === emittedValue.current) return
    emittedValue.current = value
    setText(formatDateUS(value))
    setInvalid(false)
  }, [value])

  function emit(next) {
    emittedValue.current = next
    onChange(next)
  }

  function commit(raw) {
    if (!raw.trim()) {
      setInvalid(false)
      setText('')
      emit('')
      return
    }
    const iso = parseFlexibleDate(raw)
    if (!iso) {
      // Don't leave the previous date sitting in the form behind text that
      // says something else — saving now would quietly store the old date.
      setInvalid(true)
      emit('')
      return
    }
    setInvalid(false)
    emit(iso)
    setText(formatDateUS(iso))
  }

  function openPicker() {
    const input = dateInputRef.current
    if (typeof input?.showPicker !== 'function') return
    // Throws if the browser decides this isn't a user gesture; the tap has
    // already focused the date input either way.
    try {
      input.showPicker()
    } catch {
      // Ignored on purpose — see above.
    }
  }

  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className={labelClass}>{label}</span>
      <span className="relative flex min-w-0">
        <input
          type="text"
          placeholder="MM/DD/YYYY"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          className={`h-14 w-full min-w-0 pr-12 ${controlClass} ${invalid ? 'border-red-500' : ''}`}
        />
        {/* Transparent, but a full 48x56 target — gloves, one hand, sunlight. */}
        <input
          ref={dateInputRef}
          type="date"
          value={value || ''}
          onChange={(event) => commit(event.target.value)}
          onClick={openPicker}
          aria-label={`Choose ${label.toLowerCase()} from calendar`}
          className="peer absolute inset-y-0 right-0 w-12 opacity-0"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-md text-ink-300 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent-bright"
        >
          <span className="material-symbols-outlined text-[20px]">calendar_month</span>
        </span>
      </span>
      {invalid && (
        <span className="text-xs text-red-600">Enter a date like 9/10/2019 or Sep 10, 2019.</span>
      )}
    </label>
  )
}

export function SelectField({ label, children, className = '', ...props }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className={labelClass}>{label}</span>
      <select {...props} className={`h-14 w-full min-w-0 ${controlClass}`}>
        {children}
      </select>
    </label>
  )
}
