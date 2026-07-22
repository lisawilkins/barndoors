import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'

const REPORTS = [{ label: 'Feed schedule', to: '/reports/feed-schedule' }]

export default function Reports() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TopNav />

      <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="text-3xl font-semibold text-gray-900">Reports</h1>

        <ul className="flex flex-col gap-3">
          {REPORTS.map(({ label, to }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex h-16 items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 text-xl font-semibold text-gray-900 active:bg-gray-100"
              >
                {label}
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
