import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

// Client-side gate only, for UX (hiding controls hands shouldn't see). The
// real enforcement is the database's RLS policies — a hand hitting these
// routes directly still can't write anything, this just keeps them from
// landing on a form that would fail anyway.
export default function ManagerRoute({ children }) {
  const { isManager, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-lg text-gray-500">Loading…</p>
      </div>
    )
  }

  if (!isManager) {
    return <Navigate to="/" replace />
  }

  return children
}
