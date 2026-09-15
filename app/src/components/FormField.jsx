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
export function DateField({ label, value, onChange, className = '' }) {
  const [text, setText] = useState(() => formatDateUS(value))
  const [invalid, setInvalid] = useState(false)
  const nativeInputRef = useRef(null)

  useEffect(() => {
    setText(formatDateUS(value))
    setInvalid(false)
  }, [value])

  function commit(raw) {
    if (!raw.trim()) {
      setInvalid(false)
      onChange('')
      return
    }
    const iso = parseFlexibleDate(raw)
    if (!iso) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onChange(iso)
    setText(formatDateUS(iso))
  }

  function openPicker() {
    const input = nativeInputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    } else {
      input.focus()
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
        <button
          type="button"
          onClick={openPicker}
          aria-label={`Choose ${label.toLowerCase()} from calendar`}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-300"
        >
          <span className="material-symbols-outlined text-[20px]">calendar_month</span>
        </button>
        <input
          ref={nativeInputRef}
          type="date"
          value={value || ''}
          onChange={(event) => commit(event.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute left-0 top-0 h-px w-px overflow-hidden opacity-0"
        />
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
