import { useCallback, useEffect, useRef, useState } from 'react'
import { DndContext, MouseSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import ChoreEditRow from './ChoreEditRow'
import { ScrollFriendlyTouchSensor } from '../lib/ScrollFriendlyTouchSensor'
import {
  MAX_DEPTH,
  blankNode,
  canIndent as canIndentAt,
  canOutdent as canOutdentAt,
  descendantCount,
  duplicateNode,
  indexOfId,
  insertAfter,
  moveNode,
  removeNode,
  setDepth,
} from '../lib/choreOutline'

const TITLE_MAX = 60

function autosize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export default function ChoreListEdit({
  title,
  description,
  nodes,
  onTitleChange,
  onDescriptionChange,
  onNodesChange,
  onDeleteList,
  onToast,
}) {
  const [focusId, setFocusId] = useState(null)
  const [menuId, setMenuId] = useState(null)
  const [titleTouched, setTitleTouched] = useState(false)

  const inputs = useRef({})
  const notes = useRef({})
  const pendingFocus = useRef(null)
  const pendingNoteFocus = useRef(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Same sensor as the Herd list: long-press to drag, and a thumb that lands
    // on a handle can still scroll the page.
    useSensor(ScrollFriendlyTouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
  )

  // Focus lands on a row created by Return, Duplicate or Add item — after the
  // row exists in the DOM, hence the effect rather than doing it inline.
  useEffect(() => {
    if (pendingFocus.current != null) {
      const el = inputs.current[pendingFocus.current]
      pendingFocus.current = null
      if (el) {
        el.focus()
        const end = el.value.length
        try {
          el.setSelectionRange(end, end)
        } catch {
          /* not all inputs support selection */
        }
      }
    }
    if (pendingNoteFocus.current != null) {
      const el = notes.current[pendingNoteFocus.current]
      pendingNoteFocus.current = null
      el?.focus()
    }
  })

  const registerInput = useCallback(
    (id) => (el) => {
      if (el) {
        inputs.current[id] = el
        autosize(el)
      } else {
        delete inputs.current[id]
      }
    },
    [],
  )

  const registerNote = useCallback(
    (id) => (el) => {
      if (el) {
        notes.current[id] = el
        autosize(el)
      } else {
        delete notes.current[id]
      }
    },
    [],
  )

  function update(next) {
    onNodesChange(next)
  }

  function handleNewLine(node) {
    const { nodes: next, newId } = insertAfter(nodes, node.id, node.depth)
    update(next)
    setMenuId(null)
    setFocusId(newId)
    pendingFocus.current = newId
  }

  function handleDepth(node, delta) {
    update(setDepth(nodes, node.id, delta, MAX_DEPTH))
    setMenuId(null)
    pendingFocus.current = node.id
  }

  function handleDelete(node, { silent } = {}) {
    const { nodes: next, removed, index, previousId } = removeNode(nodes, node.id)
    if (index === -1) return
    update(next)
    setMenuId(null)
    setFocusId(previousId)
    // "Backspace on an empty row removes it and returns the cursor to the line
    // above" — so the cursor moves either way; only the toast is suppressed,
    // since deleting a blank line you just made isn't worth announcing.
    pendingFocus.current = previousId
    if (!silent) {
      const extra = removed.length - 1
      onToast(
        extra
          ? `Item and ${extra} nested ${extra === 1 ? 'line' : 'lines'} deleted`
          : 'Line deleted',
        { index, removed },
      )
    }
  }

  function handleToggleNote(node) {
    if (node.depth >= MAX_DEPTH) return
    const removing = node.note !== null && node.note !== undefined
    update(nodes.map((n) => (n.id === node.id ? { ...n, note: removing ? null : '' } : n)))
    setMenuId(null)
    if (!removing) pendingNoteFocus.current = node.id
  }

  // An emptied note removes itself rather than lingering as a blank amber rail.
  function handleNoteBlur(node) {
    if (node.note !== null && node.note !== undefined && node.note.trim() === '') {
      update(nodes.map((n) => (n.id === node.id ? { ...n, note: null } : n)))
    }
  }

  function handleDuplicate(node) {
    const { nodes: next, newId } = duplicateNode(nodes, node.id)
    update(next)
    setMenuId(null)
    setFocusId(newId)
    pendingFocus.current = newId
  }

  function handleKeyDown(event, node) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleNewLine(node)
    } else if (event.key === 'Tab') {
      event.preventDefault()
      handleDepth(node, event.shiftKey ? -1 : 1)
    } else if (event.key === 'Backspace' && event.target.value === '') {
      event.preventDefault()
      handleDelete(node, { silent: true })
    } else if (event.key === 'Escape') {
      event.target.blur()
      setFocusId(null)
      setMenuId(null)
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    update(moveNode(nodes, active.id, over.id, MAX_DEPTH))
    setMenuId(null)
  }

  function handleAddItem() {
    const node = blankNode(1)
    update([...nodes, node])
    setFocusId(node.id)
    pendingFocus.current = node.id
  }

  const titleError = titleTouched && !title.trim()

  return (
    <div className="flex flex-col gap-2.5 p-4">
      <div className="flex flex-col gap-1.5">
        <input
          value={title}
          maxLength={TITLE_MAX}
          onChange={(event) => onTitleChange(event.target.value)}
          onFocus={() => setFocusId('title')}
          onBlur={() => setTitleTouched(true)}
          placeholder="List name"
          aria-label="List name"
          className={`w-full rounded-lg text-[22px] font-bold tracking-tight outline-none ${
            titleError
              ? 'border-2 border-red-600 px-[11px] py-2'
              : focusId === 'title'
                ? 'border-2 border-[#E0A32E] px-[11px] py-2 shadow-[0_0_0_3px_rgba(224,163,46,0.16)]'
                : 'border border-border-input px-3 py-[9px]'
          }`}
        />
        {titleError && (
          <span className="text-[13.5px] text-red-700">
            A list needs a name before it can be printed or shared.
          </span>
        )}
        {title.length >= TITLE_MAX && (
          <span className="self-end text-[12.5px] font-semibold text-red-700">
            {title.length} / {TITLE_MAX}
          </span>
        )}
      </div>

      <textarea
        value={description}
        onChange={(event) => {
          onDescriptionChange(event.target.value)
          autosize(event.target)
        }}
        onFocus={() => setFocusId('desc')}
        ref={autosize}
        rows={2}
        placeholder="Add a description (optional)"
        aria-label="List description"
        className={`w-full resize-none overflow-hidden rounded-lg text-[15px] leading-snug text-ink-600 outline-none ${
          focusId === 'desc'
            ? 'border-2 border-[#E0A32E] px-[11px] py-2.5 shadow-[0_0_0_3px_rgba(224,163,46,0.16)]'
            : 'border border-border-input px-3 py-2.5'
        }`}
      />

      <div className="my-1 h-px bg-gray-200" />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2.5">
            {nodes.map((node) => {
              const index = indexOfId(nodes, node.id)
              return (
                <ChoreEditRow
                  key={node.id}
                  node={node}
                  isFocused={focusId === node.id}
                  menuOpen={menuId === node.id}
                  canIndent={canIndentAt(nodes, index, MAX_DEPTH)}
                  canOutdent={canOutdentAt(nodes, index)}
                  descendants={descendantCount(nodes, index)}
                  registerInput={registerInput(node.id)}
                  registerNote={registerNote(node.id)}
                  onFocus={() => setFocusId(node.id)}
                  onTextChange={(text) => {
                    update(nodes.map((n) => (n.id === node.id ? { ...n, text } : n)))
                    autosize(inputs.current[node.id])
                  }}
                  onNoteChange={(note) => {
                    update(nodes.map((n) => (n.id === node.id ? { ...n, note } : n)))
                    autosize(notes.current[node.id])
                  }}
                  onNoteBlur={() => handleNoteBlur(node)}
                  onKeyDown={(event) => handleKeyDown(event, node)}
                  onNewLine={() => handleNewLine(node)}
                  onIndent={() => handleDepth(node, 1)}
                  onOutdent={() => handleDepth(node, -1)}
                  onToggleNote={() => handleToggleNote(node)}
                  onToggleMenu={() => setMenuId((current) => (current === node.id ? null : node.id))}
                  onDuplicate={() => handleDuplicate(node)}
                  onDelete={() => handleDelete(node)}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={handleAddItem}
        className="flex h-12 items-center gap-2 rounded-md px-2.5 text-left text-base font-semibold text-accent-bright active:opacity-70"
      >
        ＋&nbsp; Add item
      </button>

      <div className="my-1.5 h-px bg-gray-200" />

      <button
        type="button"
        onClick={onDeleteList}
        className="flex h-12 items-center justify-center gap-2 rounded-[9px] border border-red-300 text-[15.5px] font-semibold text-red-700 active:bg-red-50"
      >
        ✕&nbsp; Delete list
      </button>
    </div>
  )
}
