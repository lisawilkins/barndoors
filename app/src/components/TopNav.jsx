import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const MENU_LINKS = [
  { label: 'Herd', to: '/herd' },
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
    <header className="relative flex items-center justify-between border-b border-border-divider bg-surface-card px-4 py-3 sm:px-6">
      <Link to="/" className="font-display text-xl font-light tracking-tight text-ink-900">
        BarnDoors
      </Link>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-12 w-12 items-center justify-center rounded-md text-ink-600 active:bg-surface-canvas"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-10 mt-2 w-56 rounded-md border border-border-card bg-surface-card py-2 shadow-card">
            {profile && (
              <div className="border-b border-border-divider px-5 py-3">
                <p className="text-[15px] font-medium text-ink-900">{profile.name}</p>
                <p className="text-sm capitalize text-ink-400">{profile.role}</p>
              </div>
            )}
            {MENU_LINKS.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                onClick={() => setMenuOpen(false)}
                className="block px-5 py-3 text-[15px] text-ink-600 active:bg-surface-canvas"
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleSignOut}
              className="block w-full border-t border-border-divider px-5 py-3 text-left text-[15px] text-ink-600 active:bg-surface-canvas"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
