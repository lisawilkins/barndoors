import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-lg text-gray-500">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
