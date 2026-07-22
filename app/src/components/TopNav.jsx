import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const MENU_LINKS = [
  { label: 'Heard', to: '/heard' },
  { label: 'Hands', to: '/hands' },
  { label: 'Chores', to: '/chores' },
  { label: 'Reports', to: '/reports' },
]

export default function TopNav() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
    navigate('/login')
  }

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <header className="relative flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
      <Link
        to="/"
        className="text-xl font-bold tracking-tight text-gray-900"
      >
        BarnDoors
      </Link>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-12 w-12 items-center justify-center rounded-lg text-gray-700 active:bg-gray-100"
        >
          <svg
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
            />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
            {profile && (
              <div className="border-b border-gray-100 px-5 py-3">
                <p className="text-lg font-medium text-gray-900">{profile.name}</p>
                <p className="text-sm capitalize text-gray-500">{profile.role}</p>
              </div>
            )}
            {MENU_LINKS.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                onClick={() => setMenuOpen(false)}
                className="block px-5 py-3 text-lg text-gray-700 active:bg-gray-100"
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleSignOut}
              className="block w-full border-t border-gray-100 px-5 py-3 text-left text-lg text-gray-700 active:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
