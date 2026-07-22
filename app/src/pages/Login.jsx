import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const inputClass = 'h-14 rounded-lg border border-gray-300 px-4 text-lg text-gray-900'

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

              <label className="flex flex-col gap-1">
                <span className="text-lg font-medium text-gray-700">Password</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                />
              </label>

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
              <label className="flex flex-col gap-1">
                <span className="text-lg font-medium text-gray-700">Password</span>
                <input
                  type="password"
                  required
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                />
              </label>

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
