import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'

const SECTIONS = [
  { label: 'Heard', to: '/heard' },
  { label: 'Hands', to: '/hands' },
  { label: 'Chores', to: '/chores' },
  { label: 'Reports', to: '/reports' },
]

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TopNav />

      <main className="flex flex-1 flex-col justify-center gap-4 px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SECTIONS.map(({ label, to }) => (
            <Link
              key={label}
              to={to}
              className="flex h-32 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-2xl font-semibold text-gray-900 shadow-sm active:bg-gray-100"
            >
              {label}
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
