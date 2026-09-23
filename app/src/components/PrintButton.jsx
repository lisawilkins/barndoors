import { useState } from 'react'
import { printPage } from '../lib/print'

// The Print control every printable screen uses: the hand and wrangler
// schedules, the chore sheet, and both feed reports. Each screen passes its
// own styling, so this changes nothing about how the link or button looks —
// what it adds is the tap handling in lib/print.js, and a line of help for
// the phones that can't print at all (see `canPrint`), rather than a button
// that appears to do nothing.
export default function PrintButton({ className = '', disabled = false, children = 'Print' }) {
  const [unavailable, setUnavailable] = useState(false)

  return (
    <span className="flex flex-col items-end gap-1 print:hidden">
      <button
        type="button"
        onClick={() => setUnavailable(!printPage())}
        disabled={disabled}
        className={className}
      >
        {children}
      </button>
      {unavailable && (
        <span className="max-w-[220px] text-right text-xs leading-snug text-ink-600">
          This browser can’t start printing. Tap Share, then Print.
        </span>
      )}
    </span>
  )
}
