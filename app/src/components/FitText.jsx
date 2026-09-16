import { useLayoutEffect, useRef, useState } from 'react'

// Name-sized heading text that steps down through smaller sizes until it
// fits on one line, instead of truncating — so a long name stays fully
// readable rather than getting cut off with an ellipsis. Falls back to
// truncating only at the smallest size, as a last resort.
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
