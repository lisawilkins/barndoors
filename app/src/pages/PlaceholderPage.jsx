import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'

// Generic stub used for section pages until each one's real content is built.
export default function PlaceholderPage({ title }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TopNav />

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center sm:px-6">
        <h1 className="text-3xl font-semibold text-gray-900">{title}</h1>
        <p className="max-w-xs text-lg text-gray-500">
          This screen is coming soon.
        </p>
        <Link
          to="/"
          className="mt-4 flex h-12 items-center justify-center rounded-lg border border-gray-200 px-6 text-lg font-medium text-gray-700 active:bg-gray-100"
        >
          Back to home
        </Link>
      </main>
    </div>
  )
}
