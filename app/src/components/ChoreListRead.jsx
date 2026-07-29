import { itemNumbers, visibleNodes } from '../lib/choreOutline'

// Read view of a chore list — what a manager sees before tapping Edit, and what
// a hand sees while working. Same layout for both; the only difference is that
// a hand gets a checkbox on each Subitem.
//
// Those ticks are deliberately local to the page and never saved. This app has
// no completion tracking (AGENTS.md), so they're a scratch aid for keeping your
// place mid-shift, not a record. Whether they should survive a reload is an
// open question on the design doc.

function Note({ text }) {
  if (!text?.trim()) return null
  return (
    <span className="border-l-[3px] border-[#F0DDB0] pl-2.5 text-[14.5px] italic leading-relaxed text-gray-500">
      {text}
    </span>
  )
}

function Checkbox({ done, onToggle, label }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      aria-label={label}
      className={`mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[5px] text-sm text-white ${
        done ? 'border-none bg-gray-900' : 'border-2 border-gray-400 bg-transparent'
      }`}
    >
      {done ? '✓' : ''}
    </button>
  )
}

export default function ChoreListRead({ nodes, isWorker, checked, onToggleCheck }) {
  const rows = visibleNodes(nodes)
  const numbers = itemNumbers(nodes)

  if (rows.length === 0) {
    return <p className="text-[15.5px] italic text-gray-400">Nothing on this list yet.</p>
  }

  return (
    <div className="flex flex-col gap-[9px] pt-0.5">
      {rows.map((node, index) => {
        const checkable = isWorker && node.depth === 2
        const done = Boolean(checked[node.id])

        return (
          <div
            key={node.id}
            className={`flex items-start ${node.depth === 1 ? 'gap-3 pl-0' : 'gap-2.5'} ${
              node.depth === 2 ? 'pl-[18px]' : node.depth === 3 ? 'pl-10' : ''
            } ${node.depth === 1 && index > 0 ? 'pt-2.5' : ''} ${checkable ? 'min-h-10' : ''}`}
          >
            {checkable ? (
              <Checkbox
                done={done}
                onToggle={() => onToggleCheck(node.id)}
                label={`Mark "${node.text}" done`}
              />
            ) : (
              <span
                aria-hidden="true"
                className={`flex-shrink-0 ${
                  node.depth === 1
                    ? 'w-[18px] text-base font-bold text-gray-400'
                    : node.depth === 2
                      ? 'w-3 text-[15px] text-[#C09030]'
                      : 'w-3 text-[15px] text-gray-300'
                }`}
              >
                {node.depth === 1 ? numbers.get(node.id) : node.depth === 2 ? '•' : '–'}
              </span>
            )}

            <div className="flex flex-1 flex-col gap-1.5">
              <span
                className={
                  node.depth === 1
                    ? 'text-[17.5px] font-bold leading-tight'
                    : node.depth === 2
                      ? `text-[15.5px] leading-snug ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`
                      : 'text-[14.5px] leading-snug text-gray-600'
                }
              >
                {node.text}
              </span>
              <Note text={node.note} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
