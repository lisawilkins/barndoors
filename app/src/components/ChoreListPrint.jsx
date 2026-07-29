import { useLayoutEffect, useRef, useState } from 'react'
import { groupForPrint, itemNumbers } from '../lib/choreOutline'
import { printableArea } from '../lib/pageSetup'

// The printed sheet is a different document, not the web view with its buttons
// hidden: it has physical checkboxes to tick with a pen, and SubSubItems are
// collapsed onto one line under their Subitem to save vertical space. The
// printout is the primary artifact in the barn, so nothing competes with the
// instructions themselves.
//
// The sheet is laid out at the true printable pixel size for the chosen
// orientation, so the preview is what comes out of the printer and the fit
// measurement below is taken at the size that actually matters.

// Below this a sheet stops being readable at arm's length in a barn, so a list
// that still doesn't fit runs onto a second page rather than shrinking further.
// Two legible pages beat one nobody can read.
const MIN_SCALE = 0.55

export default function ChoreListPrint({
  title,
  description,
  nodes,
  orientation = 'portrait',
  includeDescription = true,
}) {
  const rows = groupForPrint(nodes)
  const numbers = itemNumbers(nodes)
  const page = printableArea(orientation)

  const contentRef = useRef(null)
  const [scale, setScale] = useState(1)

  // Measure unscaled, then shrink to fit the page height. Re-runs whenever the
  // content or the page shape changes.
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return

    el.style.zoom = '1'
    const contentHeight = el.scrollHeight
    const next = contentHeight > page.height ? Math.max(MIN_SCALE, page.height / contentHeight) : 1

    setScale(next)
    el.style.zoom = String(next)
  }, [rows.length, title, description, orientation, page.height, includeDescription])

  return (
    <div className="chore-sheet bg-white" style={{ width: page.width, minHeight: page.height }}>
      <div ref={contentRef} style={{ zoom: scale }}>
        <div className="flex flex-col gap-4">
          <div className="border-b-2 border-gray-900 pb-[9px]">
            <span className="text-[21px] font-bold tracking-tight">{title}</span>
          </div>

          {includeDescription && description?.trim() && (
            <p className="m-0 text-[11.5px] leading-relaxed text-gray-700">{description}</p>
          )}

          <div
            className="flex flex-col gap-[11px]"
            // Landscape is nearly a third wider than it is tall, so a single
            // column leaves most of the sheet empty and the lines run
            // uncomfortably long. Two columns use the width and roughly halve
            // the height, which is usually what makes a long list fit at all.
            style={orientation === 'landscape' ? { columnCount: 2, columnGap: '28px' } : undefined}
          >
            {rows.map((row) => {
              if (row.depth === 1) {
                return (
                  <div key={row.id} className="flex break-inside-avoid flex-col gap-[7px]">
                    <div className="flex items-baseline gap-2 border-b border-gray-300 pb-1">
                      <span className="text-sm font-bold">{numbers.get(row.id)}.</span>
                      <span className="text-sm font-bold">{row.text}</span>
                    </div>
                    {row.note?.trim() && (
                      <div className="pl-[22px] text-[11px] italic leading-relaxed text-gray-700">
                        NOTE: {row.note}
                      </div>
                    )}
                  </div>
                )
              }

              if (row.depth === 2) {
                return (
                  <div key={row.id} className="flex break-inside-avoid gap-[9px] pl-[22px]">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 block h-[11px] w-[11px] flex-shrink-0 border border-gray-500"
                    />
                    <div className="flex flex-col gap-[3px]">
                      <span className="text-xs leading-snug">{row.text}</span>
                      {row.details.length > 0 && (
                        <div className="flex flex-wrap gap-x-3.5 pl-0.5 text-[11px] text-gray-700">
                          {row.details.map((detail, i) => (
                            <span key={i}>– {detail}</span>
                          ))}
                        </div>
                      )}
                      {row.note?.trim() && (
                        <div className="text-[11px] italic leading-relaxed text-gray-700">
                          NOTE: {row.note}
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              // A SubSubItem only reaches here if it had no Subitem to attach to.
              return (
                <div key={row.id} className="pl-[38px] text-[11px] leading-snug text-gray-700">
                  – {row.text}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
