import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { TextField } from '../components/FormField'
import { supabase } from '../lib/supabaseClient'

// Creates a brand-new Manager login (real Supabase Auth account). This has
// to go through the create-manager Edge Function rather than a plain client
// call — see that function's header comment for why.
export default function ManagerForm() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const { data, error: invokeError } = await supabase.functions.invoke('create-manager', {
      body: { name, email, password },
    })

    setSaving(false)

    if (invokeError || data?.error) {
      setError(data?.error ?? invokeError.message)
      return
    }

    navigate('/hands')
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TopNav />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="text-3xl font-semibold text-gray-900">Add manager</h1>
        <p className="text-lg text-gray-500">
          Creates a new manager login. They'll sign in with the email and password below.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label="Name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && <p className="text-lg text-red-600">{error}</p>}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/hands')}
              className="flex h-14 flex-1 items-center justify-center rounded-lg border border-gray-300 text-lg font-medium text-gray-700 active:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex h-14 flex-1 items-center justify-center rounded-lg bg-gray-900 text-lg font-semibold text-white active:bg-gray-700 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create manager'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
