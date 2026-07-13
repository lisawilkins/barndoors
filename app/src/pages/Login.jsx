import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { session, signIn, signUp } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    const from = location.state?.from?.pathname ?? '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)

    const { error: authError } =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password, name)

    setSubmitting(false)

    if (authError) {
      setError(authError.message)
      return
    }

    if (mode === 'signup') {
      setInfo('Account created. You can sign in below once confirmed.')
      setMode('signin')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-3xl font-bold text-gray-900">BarnDoors</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <label className="flex flex-col gap-1">
              <span className="text-lg font-medium text-gray-700">Name</span>
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-14 rounded-lg border border-gray-300 px-4 text-lg text-gray-900"
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-lg font-medium text-gray-700">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-14 rounded-lg border border-gray-300 px-4 text-lg text-gray-900"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-lg font-medium text-gray-700">Password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-14 rounded-lg border border-gray-300 px-4 text-lg text-gray-900"
            />
          </label>

          {error && <p className="text-lg text-red-600">{error}</p>}
          {info && <p className="text-lg text-green-700">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex h-14 items-center justify-center rounded-lg bg-gray-900 text-lg font-semibold text-white active:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((current) => (current === 'signin' ? 'signup' : 'signin'))
            setError('')
            setInfo('')
          }}
          className="mt-6 flex h-12 w-full items-center justify-center text-lg text-gray-600 underline"
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
