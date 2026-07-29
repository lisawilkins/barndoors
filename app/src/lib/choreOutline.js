// Outline logic for a chore list. Ported from the "Live outline" prototype in
// the Barndoors Chores Redesign design project, so the behaviour here should
// match that prototype line for line.
//
// Levels, per the design:
//   1  Item        bold, numbered on the sheet, may carry a note
//   2  Subitem     the actual instruction a hand follows, may carry a note
//   3  SubSubItem  short qualifier, no note, nesting stops here
//
// Nodes are a FLAT array in display order — { id, depth, text, note } — with
// nesting expressed by depth alone. Flat is what makes Return/Tab/drag simple:
// every operation is an array splice plus a depth change.
//
// The database stores depth 0-2 (see chore_items); levels are 1-3 here to match
// the design. fromDbRows/toSavePayload are the only places that translate.

export const MAX_DEPTH = 3
export const NOTE_MAX_DEPTH = 2 // a SubSubItem never carries a note

let counter = 0
export function newNodeId() {
  counter += 1
  return `n${counter}_${Math.random().toString(36).slice(2, 8)}`
}

export function blankNode(depth = 1) {
  return { id: newNodeId(), depth, text: '', note: null }
}

// ---------------------------------------------------------------------------
// Subtree helpers — a node and everything nested under it move as one block
// ---------------------------------------------------------------------------

/** How many rows immediately after `index` are nested under nodes[index]. */
export function descendantCount(nodes, index) {
  let n = 0
  for (let j = index + 1; j < nodes.length; j += 1) {
    if (nodes[j].depth > nodes[index].depth) n += 1
    else break
  }
  return n
}

export function indexOfId(nodes, id) {
  return nodes.findIndex((n) => n.id === id)
}

// ---------------------------------------------------------------------------
// Structural edits — each returns a new array
// ---------------------------------------------------------------------------

/** Insert a blank row after `id`'s whole subtree, at `depth`. */
export function insertAfter(nodes, id, depth, newId) {
  const i = indexOfId(nodes, id)
  if (i === -1) return { nodes, newId: null }
  const skip = descendantCount(nodes, i)
  const node = { id: newId ?? newNodeId(), depth, text: '', note: null }
  const copy = nodes.slice()
  copy.splice(i + 1 + skip, 0, node)
  return { nodes: copy, newId: node.id }
}

export function canIndent(nodes, index, maxDepth = MAX_DEPTH) {
  const node = nodes[index]
  const prev = nodes[index - 1]
  if (!node || !prev) return false
  return node.depth + 1 <= Math.min(maxDepth, prev.depth + 1)
}

export function canOutdent(nodes, index) {
  return Boolean(nodes[index]) && nodes[index].depth > 1
}

/**
 * Shift a row (and its subtree) one level in or out. Indenting is only legal
 * when the row above can actually be its parent, which is what stops an
 * outline from growing a level that has nothing above it.
 */
export function setDepth(nodes, id, delta, maxDepth = MAX_DEPTH) {
  const i = indexOfId(nodes, id)
  if (i === -1) return nodes
  const node = nodes[i]
  const target = node.depth + delta
  if (target < 1 || target > maxDepth) return nodes
  if (delta > 0 && !canIndent(nodes, i, maxDepth)) return nodes

  const shift = target - node.depth
  const count = descendantCount(nodes, i)

  return nodes.map((n, j) => {
    if (j === i) {
      // A note can't survive a demotion to SubSubItem.
      return { ...n, depth: target, note: target > NOTE_MAX_DEPTH ? null : n.note }
    }
    if (j > i && j <= i + count) {
      const d = Math.min(n.depth + shift, maxDepth)
      return { ...n, depth: d, note: d > NOTE_MAX_DEPTH ? null : n.note }
    }
    return n
  })
}

/** Remove a row and everything under it. Returns the removed block for undo. */
export function removeNode(nodes, id) {
  const i = indexOfId(nodes, id)
  if (i === -1) return { nodes, removed: [], index: -1, previousId: null }
  const count = descendantCount(nodes, i)
  const removed = nodes.slice(i, i + 1 + count)
  const copy = nodes.slice()
  copy.splice(i, 1 + count)
  return { nodes: copy, removed, index: i, previousId: copy[i - 1]?.id ?? null }
}

export function restoreNodes(nodes, index, removed) {
  const copy = nodes.slice()
  copy.splice(index, 0, ...removed)
  return copy
}

export function duplicateNode(nodes, id, newId) {
  const i = indexOfId(nodes, id)
  if (i === -1) return { nodes, newId: null }
  const node = { ...nodes[i], id: newId ?? newNodeId() }
  const copy = nodes.slice()
  copy.splice(i + 1, 0, node)
  return { nodes: copy, newId: node.id }
}

/**
 * Move `dragId`'s subtree to sit after `overId`'s subtree, re-levelling the
 * block so its root lands at the drop target's depth. Dropping a row into its
 * own descendants is a no-op.
 */
export function moveNode(nodes, dragId, overId, maxDepth = MAX_DEPTH) {
  if (dragId === overId) return nodes
  const from = indexOfId(nodes, dragId)
  if (from === -1) return nodes

  const count = descendantCount(nodes, from)
  const block = nodes.slice(from, from + 1 + count)
  if (block.some((n) => n.id === overId)) return nodes

  const copy = nodes.slice()
  copy.splice(from, 1 + count)

  const to = indexOfId(copy, overId)
  if (to === -1) return nodes

  const overCount = descendantCount(copy, to)
  const shift = Math.min(copy[to].depth, block[0].depth) - block[0].depth
  const shifted = block.map((n) => {
    const d = Math.max(1, Math.min(maxDepth, n.depth + shift))
    return { ...n, depth: d, note: d > NOTE_MAX_DEPTH ? null : n.note }
  })

  copy.splice(to + 1 + overCount, 0, ...shifted)
  return copy
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** 1-based number of each level-1 Item, derived at render time so it can't drift. */
export function itemNumbers(nodes) {
  const numbers = new Map()
  let n = 0
  for (const node of nodes) {
    if (node.depth === 1) {
      n += 1
      numbers.set(node.id, n)
    }
  }
  return numbers
}

/** Rows that actually have content — what the reader and the sheet show. */
export function visibleNodes(nodes) {
  return nodes.filter((n) => n.text.trim() !== '')
}

// ---------------------------------------------------------------------------
// Database translation — design levels 1-3 <-> stored depth 0-2
// ---------------------------------------------------------------------------

export function fromDbRows(items) {
  const childrenByParent = new Map()
  for (const item of items) {
    const parent = item.parent_id ?? null
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, [])
    childrenByParent.get(parent).push(item)
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.sort_order - b.sort_order)
  }

  const nodes = []
  function walk(parentId, depth) {
    for (const item of childrenByParent.get(parentId) ?? []) {
      nodes.push({
        id: item.id,
        depth,
        text: item.body ?? '',
        note: depth > NOTE_MAX_DEPTH ? null : (item.note ?? null),
      })
      walk(item.id, Math.min(depth + 1, MAX_DEPTH))
    }
  }
  walk(null, 1)
  return nodes
}

/**
 * Build the payload for save_chore_list_items.
 *
 * Rows with no text are skipped — an outline in progress always has a blank
 * row at the cursor, and body is NOT NULL. Anything nested under a skipped row
 * is kept and reattached to the nearest ancestor that survived, rather than
 * discarded: the child usually has real text the manager typed, and silently
 * losing it because the line above happened to be blank would be worse than
 * moving it up a level.
 */
export function toSavePayload(nodes) {
  // Level -> the surviving row at that level, with the depth it was actually
  // stored at. Both halves matter: the stored depth has to be derived from the
  // resolved parent, not from the row's nominal level, or a reattached row
  // could end up at depth 1 with no parent — which the database rejects
  // (chore_items_depth_matches_parent).
  const keptByLevel = []
  const payload = []

  for (const node of nodes) {
    if (!node.text.trim()) continue

    // Walk up from this row's level so a gap — left by a skipped blank row, or
    // by a level that was never filled in — resolves to the closest real parent.
    let parent = null
    for (let level = node.depth - 1; level >= 1; level -= 1) {
      if (keptByLevel[level]) {
        parent = keptByLevel[level]
        break
      }
    }

    const depth = parent ? Math.min(parent.depth + 1, MAX_DEPTH - 1) : 0

    payload.push({
      key: node.id,
      parent_key: parent ? parent.key : null,
      depth, // stored 0-2; design levels are 1-3
      body: node.text.trim(),
      note: depth >= NOTE_MAX_DEPTH ? null : (node.note?.trim() || null),
    })

    keptByLevel[node.depth] = { key: node.id, depth }
    keptByLevel.length = node.depth + 1
  }

  return payload
}
