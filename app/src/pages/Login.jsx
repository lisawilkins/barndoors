import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const inputClass = 'h-14 rounded-lg border border-gray-300 px-4 text-lg text-gray-900'

function EyeIcon({ off }) {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      {off ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
        />
      ) : (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </>
      )}
    </svg>
  )
}

// A password field you can peek at. Worth having here specifically: the shared
// hand password gets typed one-handed, outdoors, often in gloves and bad light,
// and a mistyped character is invisible otherwise.
function PasswordField({ label, value, onChange, autoFocus, minLength }) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="flex flex-col gap-1">
      <span className="text-lg font-medium text-gray-700">{label}</span>
      <div className="relative flex items-center">
        <input
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          autoFocus={autoFocus}
          autoComplete="current-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} w-full pr-14`}
        />
        <button
          type="button"
          // Keeps the cursor where it was — without this, tapping the icon
          // blurs the field and a one-handed user has to tap back into it.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-0 flex h-14 w-14 items-center justify-center rounded-lg text-gray-500 active:bg-gray-100 active:text-gray-900"
        >
          <EyeIcon off={visible} />
        </button>
      </div>
    </label>
  )
}

export default function Login() {
  const { session, signIn, signInAsHand } = useAuth()
  const location = useLocation()
  const [selection, setSelection] = useState(null) // null | 'manager' | 'hand'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    const from = location.state?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  function selectRole(role) {
    setSelection(role)
    setError('')
    setPassword('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const { error: authError } =
      selection === 'manager' ? await signIn(email, password) : await signInAsHand(password)

    setSubmitting(false)

    if (authError) {
      setError(
        selection === 'manager' ? authError.message : 'Incorrect password. Ask a manager for the current one.',
      )
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-3xl font-bold text-gray-900">BarnDoors</h1>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => selectRole('manager')}
            className={`flex h-16 items-center justify-center rounded-xl border text-xl font-semibold ${
              selection === 'manager'
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 bg-white text-gray-900 active:bg-gray-100'
            }`}
          >
            Manager
          </button>

          {selection === 'manager' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
              <label className="flex flex-col gap-1">
                <span className="text-lg font-medium text-gray-700">Email</span>
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

              <PasswordField
                label="Password"
                value={password}
                onChange={setPassword}
                minLength={6}
              />

              {error && <p className="text-lg text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="flex h-14 items-center justify-center rounded-lg bg-gray-900 text-lg font-semibold text-white active:bg-gray-700 disabled:opacity-50"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => selectRole('hand')}
            className={`flex h-16 items-center justify-center rounded-xl border text-xl font-semibold ${
              selection === 'hand'
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 bg-white text-gray-900 active:bg-gray-100'
            }`}
          >
            Hand
          </button>

          {selection === 'hand' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
              <PasswordField label="Password" value={password} onChange={setPassword} autoFocus />

              {error && <p className="text-lg text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="flex h-14 items-center justify-center rounded-lg bg-gray-900 text-lg font-semibold text-white active:bg-gray-700 disabled:opacity-50"
              >
                {submitting ? 'Please wait…' : 'Enter'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
