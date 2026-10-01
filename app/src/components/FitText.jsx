import { useLayoutEffect, useRef, useState } from 'react'

// Name-sized heading text that steps down through smaller sizes until it
// fits on one line, instead of truncating — so a long name stays fully
// readable rather than getting cut off with an ellipsis. Falls back to
// truncating only at the smallest size, as a last resort.
//
// Re-fits from the largest size whenever the available width changes or web
// fonts finish loading. Without that, a sibling measured before its font loads
// (e.g. an icon-font glyph briefly rendered as its wide ligature name) could
// squeeze the name down once and leave it stuck small for good.
const SIZES = ['text-xl', 'text-lg', 'text-base', 'text-sm']

export default function FitText({ text, className = '' }) {
  const ref = useRef(null)
  const [sizeIndex, setSizeIndex] = useState(0)

  useLayoutEffect(() => {
    setSizeIndex(0)
  }, [text])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let lastWidth = el.clientWidth
    const refit = () => setSizeIndex(0)
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth
        refit()
      }
    })
    observer.observe(el)
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) refit()
    })
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.scrollWidth > el.clientWidth && sizeIndex < SIZES.length - 1) {
      setSizeIndex((current) => current + 1)
    }
  }, [sizeIndex, text])

  return (
    <span
      ref={ref}
      className={`block truncate whitespace-nowrap font-semibold text-ink-900 ${SIZES[sizeIndex]} ${className}`}
    >
      {text}
    </span>
  )
}
