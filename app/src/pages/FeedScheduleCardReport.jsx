import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TopNav from '../components/TopNav'
import { supabase } from '../lib/supabaseClient'
import { formatFeedAmount, orderFeedItems } from '../lib/feedFormat'

// Same physical page as the table report (letter landscape, 0.35in margin —
// see the shared @page rule in index.css). Card count and each card's row
// count both vary with the herd, so — like the table report — we size the
// grid first, then derive a single font size that makes the tallest card fit
// the row height every card gets. Long names/item labels are truncated with
// CSS ellipsis rather than shrunk further, so a single very long name can't
// force the whole sheet illegibly small.
const PX_PER_IN = 96
const PAGE_HEIGHT_IN = 8.5
const PAGE_WIDTH_IN = 11
const MARGIN_IN = 0.35
const TITLE_BLOCK_PX = 50
const USABLE_HEIGHT_PX = (PAGE_HEIGHT_IN - MARGIN_IN * 2) * PX_PER_IN - TITLE_BLOCK_PX
const USABLE_WIDTH_PX = (PAGE_WIDTH_IN - MARGIN_IN * 2) * PX_PER_IN

const ROW_GAP_PX = 6
const COL_GAP_PX = 10

// Card height budget, expressed as a multiple of font-size: the name line
// counts extra (larger, bold, plus the card's own padding), each feed line
// counts one.
const NAME_ROW_UNITS = 2
const ITEM_ROW_UNITS = 1.3
const MIN_FONT_PX = 7
const MAX_FONT_PX = 12

function computeColumns(cardCount) {
  if (cardCount <= 1) return 1
  const ideal = Math.sqrt(cardCount * (USABLE_WIDTH_PX / USABLE_HEIGHT_PX))
  return Math.min(8, Math.max(2, Math.round(ideal)))
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

// Amount left / right-aligned, feed type right / left-aligned — a grid (not
// flex) so each card's own column of amounts lines up on its own, whatever
// the longest amount in that particular card happens to be.
function CardFeedRows({ rows, amountClassName, labelClassName }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-1.5">
      {rows.map((row) => (
        <Fragment key={row.id}>
          <span className={`whitespace-nowrap text-right ${amountClassName}`}>{row.amount}</span>
          <span className={`min-w-0 truncate text-left ${labelClassName}`}>{row.label}</span>
        </Fragment>
      ))}
    </div>
  )
}

export default function FeedScheduleCardReport() {
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
          .select('id, name, tag_id')
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

  const today = useMemo(() => formatDate(new Date()), [])

  const cards = useMemo(
    () =>
      head.map((animal) => ({
        id: animal.id,
        name: animal.name || animal.tag_id || 'Unnamed',
        rows: feedItems
          .map((item) => ({
            id: item.id,
            label: item.name,
            amount: formatFeedAmount(planByHead[animal.id]?.[item.id], item),
          }))
          .filter((row) => row.amount !== ''),
      })),
    [head, feedItems, planByHead],
  )

  const columns = useMemo(() => computeColumns(cards.length), [cards.length])
  const rows = Math.max(1, Math.ceil(cards.length / columns))
  const maxItemRows = useMemo(
    () => cards.reduce((max, card) => Math.max(max, card.rows.length), 1),
    [cards],
  )

  const rowHeightPx = (USABLE_HEIGHT_PX - (rows - 1) * ROW_GAP_PX) / rows
  const fontSizePx = Math.min(
    MAX_FONT_PX,
    Math.max(MIN_FONT_PX, rowHeightPx / (NAME_ROW_UNITS + maxItemRows * ITEM_ROW_UNITS)),
  )

  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas print:bg-white">
      <div className="print:hidden">
        <TopNav backTo="/reports" backLabel="Reports" />
      </div>

      <main className="flex flex-1 flex-col items-center gap-4 px-4 py-6 print:p-0 sm:px-6">
        <div className="flex w-full max-w-[800px] items-center justify-between print:hidden">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-3xl font-light text-ink-900">
              Feed schedule &middot; Card view
            </h1>
          </div>
          <div className="flex gap-3">
            <Link
              to="/reports/feed-schedule"
              className="flex h-12 items-center justify-center rounded-md border border-border-input bg-white px-5 text-[16px] font-semibold text-ink-600 active:bg-surface-canvas"
            >
              View as table
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading || Boolean(error)}
              className="flex h-12 items-center justify-center rounded-md bg-accent-bright px-5 text-[16px] font-bold text-white active:opacity-90 disabled:opacity-50"
            >
              Print
            </button>
          </div>
        </div>

        {loading && <p className="text-[15px] text-ink-400 print:hidden">Loading…</p>}
        {error && <p className="text-[15px] text-red-600 print:hidden">{error}</p>}

        {!loading && !error && cards.length === 0 && (
          <p className="text-[15px] text-ink-400 print:hidden">No active animals yet.</p>
        )}

        {/* On-screen view: a normal responsive grid that scrolls with the
            page, styled like the rest of the app. 2-up on phones, up to 4-up
            once there's room — this is what people actually browse day to
            day, the print layout below is only for the printed sheet. */}
        {!loading && !error && cards.length > 0 && (
          <div className="grid w-full max-w-[800px] grid-cols-2 gap-3 print:hidden sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.id}
                className="flex min-w-0 flex-col gap-1 rounded-md border border-border-card bg-white p-3 shadow-card"
              >
                <div className="truncate font-display text-base font-semibold text-ink-900">
                  {card.name}
                </div>
                {card.rows.length === 0 ? (
                  <div className="text-sm text-ink-300">No feed plan</div>
                ) : (
                  <CardFeedRows
                    rows={card.rows}
                    amountClassName="text-sm font-medium text-ink-900"
                    labelClassName="text-sm text-ink-400"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && cards.length > 0 && (
          <div className="feed-card-page hidden w-full flex-col bg-white print:flex">
            <div className="flex items-baseline justify-between pb-2">
              <h2 className="text-xl font-bold text-gray-900">Feed schedule</h2>
              <span className="text-sm text-gray-500">{today}</span>
            </div>

            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gridAutoRows: `${rowHeightPx}px`,
                columnGap: `${COL_GAP_PX}px`,
                rowGap: `${ROW_GAP_PX}px`,
                fontSize: `${fontSizePx}px`,
              }}
            >
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="flex min-w-0 flex-col overflow-hidden border-b border-gray-300 pb-1"
                >
                  <div className="truncate font-bold text-gray-900" style={{ fontSize: '1.25em' }}>
                    {card.name}
                  </div>
                  {card.rows.length === 0 ? (
                    <div className="text-gray-400">No feed plan</div>
                  ) : (
                    <CardFeedRows
                      rows={card.rows}
                      amountClassName="text-gray-900"
                      labelClassName="text-gray-700"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
