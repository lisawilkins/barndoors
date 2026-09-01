import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'

const SECTIONS = [
  { label: 'Herd', to: '/herd' },
  { label: 'Wranglers', to: '/wranglers' },
  { label: 'Chores', to: '/chores' },
  { label: 'Hands', to: '/hands' },
  { label: 'Reports', to: '/reports' },
]

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav />

      <main className="flex flex-1 flex-col justify-start gap-4 px-4 py-8 sm:px-6">
        <ul className="flex flex-col gap-3">
          {SECTIONS.map(({ label, to }) => (
            <li key={label}>
              <Link
                to={to}
                className="flex h-16 items-center justify-between rounded-md border border-border-card bg-surface-card px-4 font-display text-xl font-semibold text-ink-900 active:bg-white"
              >
                {label}
                <span className="material-symbols-outlined text-[22px] text-ink-300">
                  chevron_right
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
