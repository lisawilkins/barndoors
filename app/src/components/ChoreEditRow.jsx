import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// One row of the live outline. Every row is already a text field — Return makes
// the next row, Tab indents it, Backspace on an empty row deletes it. No
// per-row buttons appear until you focus a row, so a 60-line list isn't 60
// toolbars.

const PAD = { 1: 'pl-0', 2: 'pl-5', 3: 'pl-10' }

const HANDLE_COLOR = { 1: 'text-gray-400', 2: 'text-gray-300', 3: 'text-gray-200' }

const TEXT_STYLE = {
  1: 'text-[17px] font-semibold',
  2: 'text-[15.5px]',
  3: 'text-[14.5px] text-gray-700 bg-gray-50 border-gray-100',
}

const PLACEHOLDER = { 1: 'Item name', 2: 'Add a step…', 3: 'Add a detail…' }

function GripIcon() {
  return (
    <svg viewBox="0 0 10 16" className="h-[19px] w-3" aria-hidden="true">
      {[3, 8, 13].map((cy) => (
        <g key={cy}>
          <circle cx="2" cy={cy} r="1.3" fill="currentColor" />
          <circle cx="8" cy={cy} r="1.3" fill="currentColor" />
        </g>
      ))}
    </svg>
  )
}

function keyButton(enabled) {
  return `flex h-9 items-center whitespace-nowrap rounded-[7px] px-[11px] text-[13px] font-semibold ${
    enabled ? 'bg-gray-100 text-gray-700 active:bg-gray-200' : 'bg-gray-50 text-gray-300'
  }`
}

export default function ChoreEditRow({
  node,
  isFocused,
  menuOpen,
  canIndent,
  canOutdent,
  descendants,
  registerInput,
  registerNote,
  onFocus,
  onTextChange,
  onNoteChange,
  onNoteBlur,
  onKeyDown,
  onNewLine,
  onIndent,
  onOutdent,
  onToggleNote,
  onToggleMenu,
  onDuplicate,
  onDelete,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  })

  const hasNote = node.note !== null && node.note !== undefined
  const canHaveNote = node.depth < 3

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-1.5 ${PAD[node.depth]} ${isDragging ? 'relative z-10 opacity-90' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${node.text || 'this line'}`}
          // 44pt hit area around a 12pt glyph, per the design's control spec.
          // pan-y keeps a thumb-drag that starts here scrolling the page.
          style={{ touchAction: 'pan-y' }}
          className={`flex min-h-11 w-5 flex-shrink-0 cursor-grab items-center justify-center active:cursor-grabbing ${HANDLE_COLOR[node.depth]}`}
        >
          <GripIcon />
        </button>

        <textarea
          ref={registerInput}
          value={node.text}
          onChange={(event) => onTextChange(event.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={PLACEHOLDER[node.depth]}
          className={`w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg leading-snug outline-none ${
            TEXT_STYLE[node.depth]
          } ${
            isFocused
              ? 'border-2 border-[#E0A32E] px-[11px] py-2 shadow-[0_0_0_3px_rgba(224,163,46,0.16)]'
              : 'border border-gray-200 px-3 py-[9px]'
          }`}
        />
      </div>

      {hasNote && (
        <div className="flex items-stretch gap-2 pl-5">
          <span
            aria-hidden="true"
            className={`block w-[3px] flex-shrink-0 rounded-sm ${isFocused ? 'bg-[#E0A32E]' : 'bg-[#F0DDB0]'}`}
          />
          <textarea
            ref={registerNote}
            value={node.note ?? ''}
            onChange={(event) => onNoteChange(event.target.value)}
            onFocus={onFocus}
            onBlur={onNoteBlur}
            rows={1}
            placeholder="Note for whoever works this list"
            className="w-full min-w-0 flex-1 resize-none overflow-hidden border-none px-1 py-1.5 text-[14.5px] italic leading-relaxed text-gray-500 outline-none"
          />
        </div>
      )}

      {isFocused && (
        <div className="flex flex-wrap gap-1.5 pl-7">
          <button type="button" onClick={onNewLine} className={keyButton(true)}>
            ↵ new line
          </button>
          <button
            type="button"
            onClick={onOutdent}
            disabled={!canOutdent}
            className={keyButton(canOutdent)}
          >
            ⇤ out
          </button>
          <button
            type="button"
            onClick={onIndent}
            disabled={!canIndent}
            className={keyButton(canIndent)}
          >
            ⇥ in
          </button>
          <button
            type="button"
            onClick={onToggleNote}
            disabled={!canHaveNote}
            className={keyButton(canHaveNote)}
          >
            ＋ note
          </button>
          <button
            type="button"
            onClick={onToggleMenu}
            aria-label="More actions"
            className={`${keyButton(true)} w-9 justify-center px-0 text-[15px]`}
          >
            ⋯
          </button>
        </div>
      )}

      {menuOpen && (
        <div className="flex w-60 flex-col self-end overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-[0_12px_30px_rgba(17,24,39,0.18)]">
          <button
            type="button"
            onClick={onDuplicate}
            className="border-b border-gray-100 px-4 py-[13px] text-left text-[15.5px] text-gray-900 active:bg-gray-50"
          >
            Duplicate
          </button>
          {canHaveNote && (
            <button
              type="button"
              onClick={onToggleNote}
              className="border-b border-gray-100 px-4 py-[13px] text-left text-[15.5px] text-gray-900 active:bg-gray-50"
            >
              {hasNote ? 'Remove note' : 'Add a note'}
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-[13px] text-left text-[15.5px] text-red-700 active:bg-red-50"
          >
            {descendants
              ? `Delete and its ${descendants} nested ${descendants === 1 ? 'line' : 'lines'}`
              : 'Delete this line'}
          </button>
        </div>
      )}
    </div>
  )
}
