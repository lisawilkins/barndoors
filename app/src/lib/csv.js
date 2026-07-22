// Minimal client-side CSV export — no new dependency. Builds an RFC
// 4180-ish CSV string and triggers a browser download via a temporary link.

function escapeCsvField(value) {
  const text = value == null ? '' : String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function rowsToCsv(rows) {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n')
}

export function downloadCsv(filename, rows) {
  const csv = rowsToCsv(rows)
  // Leading BOM so Excel opens UTF-8 content (curly quotes, etc.) correctly.
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
