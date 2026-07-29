import { useLayoutEffect } from 'react'

// US Letter, matching the @page margin in index.css.
export const PAGE_MARGIN_IN = 0.35
export const PX_PER_IN = 96

const LETTER_IN = { portrait: { w: 8.5, h: 11 }, landscape: { w: 11, h: 8.5 } }

/** Printable area in CSS pixels, once margins are taken off. */
export function printableArea(orientation) {
  const page = LETTER_IN[orientation] ?? LETTER_IN.portrait
  return {
    width: (page.w - PAGE_MARGIN_IN * 2) * PX_PER_IN,
    height: (page.h - PAGE_MARGIN_IN * 2) * PX_PER_IN,
  }
}

/**
 * Override the page orientation while a component is mounted.
 *
 * `@page` is a document-level rule — it can't be scoped to an element or set
 * from inline styles — so the only way to vary orientation per screen is to
 * append a rule that wins on source order, then remove it on unmount. Without
 * the cleanup the chore sheet's choice would leak into the feed schedule
 * report, which sets `landscape` globally in index.css and needs it.
 */
export function usePageOrientation(orientation) {
  useLayoutEffect(() => {
    if (!orientation) return undefined

    const style = document.createElement('style')
    style.dataset.pageOrientation = orientation
    style.textContent = `@media print { @page { size: letter ${orientation}; margin: ${PAGE_MARGIN_IN}in; } }`
    document.head.append(style)

    return () => style.remove()
  }, [orientation])
}
