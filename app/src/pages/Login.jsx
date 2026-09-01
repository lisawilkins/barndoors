import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const inputClass =
  'h-12 rounded-md border border-border-input bg-surface-input px-4 text-[15px] text-ink-900'

// A password field you can peek at. Worth having here specifically: the shared
// hand password gets typed one-handed, outdoors, often in gloves and bad light,
// and a mistyped character is invisible otherwise.
function PasswordField({ label, value, onChange, autoFocus, minLength }) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink-400">{label}</span>
      <div className="relative flex items-center">
        <input
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          autoFocus={autoFocus}
          autoComplete="current-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} w-full pr-12`}
        />
        <button
          type="button"
          // Keeps the cursor where it was — without this, tapping the icon
          // blurs the field and a one-handed user has to tap back into it.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-0 flex h-12 w-12 items-center justify-center rounded-md text-ink-300 active:bg-surface-canvas active:text-ink-900"
        >
          <span className="material-symbols-outlined text-[18px]">
            {visible ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
    </label>
  )
}

// Real tabs, not a segmented pill — switching roles just swaps which fields
// are shown below, no separate "continue" step in between.
function RoleTabs({ active, onSelect }) {
  return (
    <div className="flex w-full border-b border-border-divider">
      {[
        { value: 'manager', label: 'Manager' },
        { value: 'hand', label: 'Hand' },
      ].map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          aria-selected={active === value}
          role="tab"
          className={`flex-1 border-b-2 pb-3 text-[15px] font-bold ${
            active === value
              ? 'border-accent-bright text-ink-900'
              : 'border-transparent text-ink-400 active:text-ink-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function Login() {
  const { session, signIn, signInAsHand } = useAuth()
  const location = useLocation()
  const [role, setRole] = useState('manager')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    const from = location.state?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  function selectRole(nextRole) {
    if (nextRole === role) return
    setRole(nextRole)
    setEmail('')
    setPassword('')
    setError('')
  }

  const canSubmit = role === 'manager' ? email.trim() !== '' && password !== '' : password !== ''

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return

    setError('')
    setSubmitting(true)

    const { error: authError } = role === 'manager' ? await signIn(email, password) : await signInAsHand(password)

    setSubmitting(false)

    if (authError) {
      setError(
        role === 'manager' ? authError.message : 'Incorrect password. Ask a manager for the current one.',
      )
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-canvas px-4 py-8">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <span className="font-display text-5xl font-light text-ink-900">Barn Doors</span>
          <span className="text-[15px] text-ink-400">Login below</span>
        </div>

        <RoleTabs active={role} onSelect={selectRole} />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {role === 'manager' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-ink-400">Email</span>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClass}
                />
              </label>

              <PasswordField label="Password" value={password} onChange={setPassword} minLength={6} />
            </>
          )}

          {role === 'hand' && (
            <PasswordField label="Password" value={password} onChange={setPassword} />
          )}

          {error && <p className="text-[15px] text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="mt-1 flex h-12 items-center justify-center rounded-md bg-accent-bright text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
