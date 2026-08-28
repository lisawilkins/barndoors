import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'

const REPORTS = [
  { label: 'Feed schedule', to: '/reports/feed-schedule' },
  { label: 'Feed schedule - Card view', to: '/reports/feed-schedule-cards' },
]

export default function Reports() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <TopNav />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="font-display text-3xl font-light text-ink-900">Reports</h1>

        <ul className="flex flex-col gap-3">
          {REPORTS.map(({ label, to }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex h-16 items-center justify-between rounded-md border border-border-card bg-white px-4 text-xl font-semibold text-ink-900 active:bg-surface-canvas"
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
