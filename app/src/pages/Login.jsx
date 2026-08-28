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

// Non-interactive here — the role was already picked on the splash screen.
// Just shows which one this form is for.
function RolePills({ active }) {
  return (
    <div className="flex w-full gap-1 rounded-md bg-surface-canvas p-1">
      <span
        className={`flex h-11 flex-1 items-center justify-center rounded-sm text-[15px] font-bold ${
          active === 'manager' ? 'bg-accent-deep text-surface-card' : 'text-ink-400'
        }`}
      >
        Manager
      </span>
      <span
        className={`flex h-11 flex-1 items-center justify-center rounded-sm text-[15px] font-bold ${
          active === 'hand' ? 'bg-accent-deep text-surface-card' : 'text-ink-400'
        }`}
      >
        Hand
      </span>
    </div>
  )
}

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className="flex h-11 w-11 items-center justify-center self-start rounded-md text-ink-400 active:bg-surface-canvas"
    >
      <span className="material-symbols-outlined text-[22px]">arrow_back</span>
    </button>
  )
}

export default function Login() {
  const { session, signIn, signInAsHand } = useAuth()
  const location = useLocation()
  const [step, setStep] = useState('splash') // 'splash' | 'manager' | 'hand'
  const [role, setRole] = useState('manager')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    const from = location.state?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  function goToSplash() {
    setStep('splash')
    setError('')
    setPassword('')
  }

  function handleContinue() {
    setStep(role)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const { error: authError } =
      step === 'manager' ? await signIn(email, password) : await signInAsHand(password)

    setSubmitting(false)

    if (authError) {
      setError(
        step === 'manager' ? authError.message : 'Incorrect password. Ask a manager for the current one.',
      )
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-canvas px-4 py-8">
      <div className="w-full max-w-sm">
        {step === 'splash' && (
          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <span className="font-display text-5xl font-light text-ink-900">Barn Doors</span>
              <span className="text-[15px] text-ink-400">Login below</span>
            </div>

            <div className="flex w-full flex-col gap-6">
              <div className="flex w-full gap-1 rounded-md bg-surface-card p-1">
                <button
                  type="button"
                  onClick={() => setRole('manager')}
                  className={`flex h-11 flex-1 items-center justify-center rounded-sm text-[15px] font-bold ${
                    role === 'manager' ? 'bg-accent-deep text-surface-card' : 'text-ink-400'
                  }`}
                >
                  Manager
                </button>
                <button
                  type="button"
                  onClick={() => setRole('hand')}
                  className={`flex h-11 flex-1 items-center justify-center rounded-sm text-[15px] font-bold ${
                    role === 'hand' ? 'bg-accent-deep text-surface-card' : 'text-ink-400'
                  }`}
                >
                  Hand
                </button>
              </div>

              <button
                type="button"
                onClick={handleContinue}
                className="flex h-12 items-center justify-center rounded-md bg-accent-bright text-[16px] font-bold text-white active:opacity-90"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'manager' && (
          <div className="flex flex-col gap-6">
            <BackButton onClick={goToSplash} />
            <span className="font-display text-2xl font-light text-ink-900">Barn Doors</span>
            <RolePills active="manager" />

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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

              {error && <p className="text-[15px] text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 flex h-12 items-center justify-center rounded-md bg-accent-bright text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        )}

        {step === 'hand' && (
          <div className="flex flex-col gap-6">
            <BackButton onClick={goToSplash} />
            <span className="font-display text-2xl font-light text-ink-900">Barn Doors</span>
            <RolePills active="hand" />

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <PasswordField label="Password" value={password} onChange={setPassword} autoFocus />

              {error && <p className="text-[15px] text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 flex h-12 items-center justify-center rounded-md bg-accent-bright text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Please wait…' : 'Sign in'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
