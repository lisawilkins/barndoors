import { groupForPrint, itemNumbers } from '../lib/choreOutline'

// The printed sheet is a different document, not the web view with its buttons
// hidden: it has physical checkboxes to tick with a pen, and SubSubItems are
// collapsed onto one line under their Subitem to save vertical space. The
// printout is the primary artifact in the barn, so nothing competes with the
// instructions themselves.

export default function ChoreListPrint({ title, description, nodes, includeDescription = true }) {
  const rows = groupForPrint(nodes)
  const numbers = itemNumbers(nodes)

  return (
    <div className="flex flex-col gap-4 border border-gray-200 px-5 py-[22px] print:border-0 print:p-0">
      <div className="border-b-2 border-gray-900 pb-[9px]">
        <span className="text-[21px] font-bold tracking-tight">{title}</span>
      </div>

      {includeDescription && description?.trim() && (
        <p className="m-0 text-[11.5px] leading-relaxed text-gray-700">{description}</p>
      )}

      <div className="flex flex-col gap-[11px]">
        {rows.map((row) => {
          if (row.depth === 1) {
            return (
              <div key={row.id} className="flex flex-col gap-[7px] break-inside-avoid">
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
              <div key={row.id} className="flex gap-[9px] break-inside-avoid pl-[22px]">
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
  )
}
