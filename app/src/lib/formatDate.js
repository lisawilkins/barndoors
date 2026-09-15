// Flexible date entry for fields like a wrangler's birthday: accepts several
// commonly-typed shapes, or the ISO value a native date picker hands back,
// and normalizes all of them to YYYY-MM-DD for storage. Display always
// renders MM/DD/YYYY regardless of how the date was entered.

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

function monthFromName(name) {
  const lower = name.toLowerCase().replace(/\.$/, '')
  const index = MONTH_NAMES.findIndex((month) => month === lower || month.startsWith(lower))
  return index === -1 ? null : index + 1
}

// Two-digit years are read the way people mean them for a birthdate: 00-49
// as 2000s, 50-99 as 1900s.
function normalizeYear(year) {
  if (year >= 100) return year
  return year <= 49 ? 2000 + year : 1900 + year
}

function toIsoIfValid(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Accepts "2019-09-10" (native date input), "9/10/2019", "9-10-19",
// "9.10.19", "Sep 10 2019", and "September 10, 2019". Returns YYYY-MM-DD, or
// null if the text doesn't parse as a real date.
export function parseFlexibleDate(input) {
  if (!input) return null
  const trimmed = String(input).trim()
  if (!trimmed) return null

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    return toIsoIfValid(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))
  }

  const numericMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (numericMatch) {
    const month = Number(numericMatch[1])
    const day = Number(numericMatch[2])
    const year = normalizeYear(Number(numericMatch[3]))
    return toIsoIfValid(year, month, day)
  }

  const monthNameMatch = trimmed.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})$/)
  if (monthNameMatch) {
    const month = monthFromName(monthNameMatch[1])
    if (!month) return null
    const day = Number(monthNameMatch[2])
    const year = normalizeYear(Number(monthNameMatch[3]))
    return toIsoIfValid(year, month, day)
  }

  return null
}

// isoDate is YYYY-MM-DD (what's stored and what a native date input uses).
export function formatDateUS(isoDate) {
  if (!isoDate) return ''
  const match = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  const [, year, month, day] = match
  return `${month}/${day}/${year}`
}
