import { Link } from 'react-router-dom'

// "Add Hand" / "Add Manager" tabs across the top of the two add-person forms,
// so the Hands list needs just one "+Add Hand" link instead of two buttons.
// Each tab is its own route (/hands/new, /hands/new-manager) — `replace` keeps
// switching tabs from piling up history, so Back still returns to Hands.
const TABS = [
  { to: '/hands/new', label: 'Add Hand' },
  { to: '/hands/new-manager', label: 'Add Manager' },
]

export default function AddPersonTabs({ active }) {
  return (
    <div className="border-b border-border-divider bg-surface-card">
      <div role="tablist" className="mx-auto flex w-full max-w-[800px] px-4 pt-3 sm:px-6">
        {TABS.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            replace
            role="tab"
            aria-selected={active === to}
            className={`flex-1 border-b-2 pb-3 text-center text-[15px] font-semibold ${
              active === to
                ? 'border-accent-bright text-ink-900'
                : 'border-transparent text-ink-400 active:text-ink-600'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
