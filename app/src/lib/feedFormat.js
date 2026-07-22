// Shared feed-amount formatting, mirrors the logic in HeardCardBody so the
// Heard detail view and printed feed reports always agree on wording.

const UNIT_SHORT = {
  cup: 'cup',
  scoop: 'scoop',
  handful: 'handful',
  lbs: 'lbs',
}

// Fixed column order requested for the printed feed schedule; anything not
// in this list (Calf Manna, plus any manager-added "New" feed items) is
// appended afterward, alphabetically.
const PINNED_FEED_ITEM_ORDER = ['alfalfa', 'grass', 'grain', 'sr pro', 'simplifly']

export function formatFeedAmount(planRow, feedItem) {
  if (!planRow) return ''

  if (feedItem?.dual_unit) {
    const parts = []
    if (planRow.amount_flakes != null) {
      parts.push(`${planRow.amount_flakes} flake${planRow.amount_flakes === 1 ? '' : 's'}`)
    }
    if (planRow.amount_lbs != null) {
      parts.push(`${planRow.amount_lbs} lbs`)
    }
    return parts.join(', ')
  }

  if (planRow.amount != null && planRow.unit) {
    return `${planRow.amount} ${UNIT_SHORT[planRow.unit] ?? planRow.unit}`
  }

  return ''
}

export function orderFeedItems(items) {
  const pinned = []
  const remaining = [...items]

  for (const name of PINNED_FEED_ITEM_ORDER) {
    const index = remaining.findIndex((item) => item.name.trim().toLowerCase() === name)
    if (index !== -1) {
      pinned.push(remaining[index])
      remaining.splice(index, 1)
    }
  }

  remaining.sort((a, b) => a.name.localeCompare(b.name))

  return [...pinned, ...remaining]
}
