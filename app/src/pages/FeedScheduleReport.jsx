import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { supabase } from '../lib/supabaseClient'
import { formatFeedAmount, orderFeedItems } from '../lib/feedFormat'
import { downloadCsv } from '../lib/csv'

// Tuned for the printed table specifically: US Letter, landscape, printed
// via the @page rule in index.css (8.5in x 11in, 0.35in margins). Font size
// is derived twice — once from how many rows (horses) need to fit in the
// page height, once from how many feed-item columns need to fit in the page
// width without wrapping — and we use whichever comes out smaller. That way
// adding more horses *or* more feed items both shrink the sheet gracefully
// instead of only one axis being "safe."
const PX_PER_IN = 96
const PAGE_HEIGHT_IN = 8.5
const PAGE_WIDTH_IN = 11
const MARGIN_IN = 0.35
const TITLE_BLOCK_PX = 50
const USABLE_TABLE_HEIGHT_PX = (PAGE_HEIGHT_IN - MARGIN_IN * 2) * PX_PER_IN - TITLE_BLOCK_PX
const USABLE_TABLE_WIDTH_PX = (PAGE_WIDTH_IN - MARGIN_IN * 2) * PX_PER_IN

// Column width split — kept in sync with the <colgroup> below.
const NAME_COL_PCT = 15
const NOTES_COL_PCT = 22
const FEED_COLS_PCT = 100 - NAME_COL_PCT - NOTES_COL_PCT

// line-height + top/bottom cell padding, expressed as a multiple of font-size.
const ROW_HEIGHT_FACTOR = 1.75
// Assumed worst-case feed-amount text ("4 flakes, 6 lbs"), expressed as
// em-width (avg char width + left/right cell padding), used to keep feed
// column values from wrapping as columns get narrower.
const FEED_CELL_EM_WIDTH = 7.2
const MIN_FONT_PX = 9
const MAX_FONT_PX = 20

function computeRowBasedFontSizePx(rowCount) {
  const rowHeightPx = USABLE_TABLE_HEIGHT_PX / (rowCount + 1)
  return rowHeightPx / ROW_HEIGHT_FACTOR
}

function computeColBasedFontSizePx(feedItemCount) {
  const feedColWidthPx = (USABLE_TABLE_WIDTH_PX * FEED_COLS_PCT) / 100 / Math.max(1, feedItemCount)
  return feedColWidthPx / FEED_CELL_EM_WIDTH
}

function computeFontSizePx(rowCount, feedItemCount) {
  const naturalSizePx = Math.min(
    computeRowBasedFontSizePx(rowCount),
    computeColBasedFontSizePx(feedItemCount),
  )
  return Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, naturalSizePx))
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function buildCsvRows(head, feedItems, planByHead) {
  const header = ['Horse name', ...feedItems.map((item) => item.name), 'Feed notes']

  const dataRows = head.map((animal) => [
    animal.name || animal.tag_id || 'Unnamed',
    ...feedItems.map((item) => formatFeedAmount(planByHead[animal.id]?.[item.id], item)),
    animal.feed_notes?.trim() || '',
  ])

  return [header, ...dataRows]
}

export default function FeedScheduleReport() {
  const [head, setHead] = useState([])
  const [feedItems, setFeedItems] = useState([])
  const [planByHead, setPlanByHead] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      const [headResult, feedItemsResult, planResult] = await Promise.all([
        supabase
          .from('head')
          .select('id, name, tag_id, feed_notes')
          .eq('status', 'active')
          .order('name', { ascending: true }),
        supabase.from('feed_items').select('id, name, dual_unit').eq('active', true),
        supabase
          .from('head_feed_plan')
          .select('head_id, feed_item_id, amount_flakes, amount_lbs, amount, unit'),
      ])

      if (!active) return

      const firstError = headResult.error || feedItemsResult.error || planResult.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      const byHead = {}
      for (const row of planResult.data ?? []) {
        if (!byHead[row.head_id]) byHead[row.head_id] = {}
        byHead[row.head_id][row.feed_item_id] = row
      }

      setHead(headResult.data ?? [])
      setFeedItems(orderFeedItems(feedItemsResult.data ?? []))
      setPlanByHead(byHead)
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [])

  const fontSizePx = useMemo(
    () => computeFontSizePx(head.length || 1, feedItems.length || 1),
    [head.length, feedItems.length],
  )
  const today = useMemo(() => formatDate(new Date()), [])

  function handleDownloadCsv() {
    const rows = buildCsvRows(head, feedItems, planByHead)
    downloadCsv(`feed-schedule-${isoDate(new Date())}.csv`, rows)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 print:bg-white">
      <div className="print:hidden">
        <TopNav />
      </div>

      <main className="flex flex-1 flex-col items-center gap-4 px-4 py-6 print:p-0 sm:px-6">
        <div className="flex w-full max-w-5xl items-center justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Feed schedule</h1>
            <Link to="/reports" className="text-lg text-gray-500 underline">
              Back to reports
            </Link>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={loading || Boolean(error)}
              className="flex h-12 items-center justify-center rounded-lg border border-gray-300 px-5 text-lg font-semibold text-gray-900 active:bg-gray-100 disabled:opacity-50"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading || Boolean(error)}
              className="flex h-12 items-center justify-center rounded-lg bg-gray-900 px-5 text-lg font-semibold text-white active:bg-gray-700 disabled:opacity-50"
            >
              Print
            </button>
          </div>
        </div>

        {loading && <p className="text-lg text-gray-500 print:hidden">Loading…</p>}
        {error && <p className="text-lg text-red-600 print:hidden">{error}</p>}

        {!loading && !error && (
          <div className="feed-report-page flex w-full max-w-5xl flex-col bg-white p-6 shadow-md print:max-w-none print:p-0 print:shadow-none">
            <div className="flex items-baseline justify-between pb-2">
              <h2 className="text-xl font-bold text-gray-900">Feed schedule</h2>
              <span className="text-sm text-gray-500">{today}</span>
            </div>

            {head.length === 0 ? (
              <p className="text-lg text-gray-500">No active animals yet.</p>
            ) : (
              <div className="flex flex-1 flex-col justify-center">
                <table
                  className="feed-report-table w-full border-collapse"
                  style={{ fontSize: `${fontSizePx}px` }}
                >
                  <colgroup>
                    <col style={{ width: `${NAME_COL_PCT}%` }} />
                    {feedItems.map((item) => (
                      <col
                        key={item.id}
                        style={{ width: `${FEED_COLS_PCT / Math.max(1, feedItems.length)}%` }}
                      />
                    ))}
                    <col style={{ width: `${NOTES_COL_PCT}%` }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="feed-report-th text-left">Horse name</th>
                      {feedItems.map((item) => (
                        <th key={item.id} className="feed-report-th text-left">
                          {item.name}
                        </th>
                      ))}
                      <th className="feed-report-th text-left">Feed notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {head.map((animal, index) => (
                      <tr key={animal.id} className={index % 2 === 1 ? 'bg-gray-50' : undefined}>
                        <td className="feed-report-td font-semibold text-gray-900">
                          {animal.name || animal.tag_id || 'Unnamed'}
                        </td>
                        {feedItems.map((item) => {
                          const planRow = planByHead[animal.id]?.[item.id]
                          return (
                            <td key={item.id} className="feed-report-td text-gray-700">
                              {formatFeedAmount(planRow, item)}
                            </td>
                          )
                        })}
                        <td className="feed-report-td whitespace-pre-line text-gray-700">
                          {animal.feed_notes?.trim() || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
