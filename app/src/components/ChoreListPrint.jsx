import { itemNumbers, visibleNodes } from '../lib/choreOutline'
import { printableArea } from '../lib/pageSetup'

// The printed sheet is a different document, not the web view with its buttons
// hidden: it has physical checkboxes to tick with a pen. The printout is the
// primary artifact in the barn, so nothing competes with the instructions
// themselves.
//
// Type is a fixed size and the list runs onto as many pages as it needs. It is
// never shrunk to fit — a sheet you can't read at arm's length in bad light is
// worse than a second sheet. `break-inside-avoid` keeps an item and its steps
// from being split across a page boundary.
//
// The sheet is laid out at the true printable width for the chosen orientation,
// so the preview breaks lines exactly where the printer will.

export default function ChoreListPrint({
  title,
  description,
  nodes,
  orientation = 'portrait',
  includeDescription = true,
}) {
  const rows = visibleNodes(nodes)
  const numbers = itemNumbers(nodes)
  const page = printableArea(orientation)

  return (
    <div className="chore-sheet bg-white" style={{ width: page.width, minHeight: page.height }}>
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
          // column leaves most of the sheet empty and makes the lines
          // uncomfortably long to follow. Two columns use the width and cut the
          // page count roughly in half.
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
                    {row.note?.trim() && (
                      <div className="text-[11px] italic leading-relaxed text-gray-700">
                        NOTE: {row.note}
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            // SubSubItems get their own line, indented under the step they
            // belong to — aligned past the checkbox so the column of boxes to
            // tick stays unbroken down the page.
            return (
              <div
                key={row.id}
                className="flex break-inside-avoid gap-1.5 pl-[42px] text-[11px] leading-snug text-gray-700"
              >
                <span aria-hidden="true" className="flex-shrink-0">
                  –
                </span>
                <span>{row.text}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
