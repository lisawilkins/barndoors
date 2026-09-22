import { useLayoutEffect } from 'react'

// Printed-page geometry and orientation, shared by every printable screen.
//
// One house rule for anything that has to run onto a second sheet: the
// element the pages flow through is a plain block, never a flex or grid
// container. WebKit — Safari, and so every browser on an iPhone — treats a
// column flex container as one indivisible box when it paginates, so a
// multi-page printout collapses to a single clipped page (WebKit bug
// 101814). Rows and cells inside a page can still be flex; it's the
// container the page breaks fall in that has to stay a block.

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
