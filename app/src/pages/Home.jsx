import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'

const SECTIONS = [
  { label: 'Herd', to: '/herd' },
  { label: 'Hands', to: '/hands' },
  { label: 'Chores', to: '/chores' },
  { label: 'Reports', to: '/reports' },
]

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav />

      <main className="flex flex-1 flex-col justify-center gap-4 px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SECTIONS.map(({ label, to }) => (
            <Link
              key={label}
              to={to}
              className="flex h-32 items-center justify-center rounded-md border border-border-card bg-surface-card font-display text-xl font-semibold text-ink-900 active:bg-white"
            >
              {label}
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
