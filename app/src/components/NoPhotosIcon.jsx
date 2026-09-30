export default function NoPhotosIcon({ className = 'text-[14px]' }) {
  // Fixed 1em box: before the icon font loads, the raw ligature text
  // ("no_photography") would otherwise render full-width and crowd whatever
  // shares the line.
  return (
    <span
      className={`material-symbols-outlined inline-block w-[1em] flex-shrink-0 overflow-hidden text-ink-400 ${className}`}
      title="No photos"
      aria-label="No photos"
    >
      no_photography
    </span>
  )
}
