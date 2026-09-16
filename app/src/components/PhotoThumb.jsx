// Square photo thumbnail used on the Wranglers and Hands lists. With no
// photo, shows a generic person-icon placeholder instead — never blank.
// Only a real photo is tappable (there's nothing to view in the lightbox
// for a placeholder).
export default function PhotoThumb({ photoUrl, alt, onOpen, size = 60 }) {
  const dimension = `${size}px`

  if (!photoUrl) {
    return (
      <div
        className="flex flex-shrink-0 items-center justify-center rounded-md bg-placeholder-tan-2"
        style={{ width: dimension, height: dimension }}
      >
        <span className="material-symbols-outlined text-[28px] text-ink-300">person</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen({ url: photoUrl, alt })}
      aria-label={`View ${alt}'s photo`}
      className="flex-shrink-0 overflow-hidden rounded-md"
      style={{ width: dimension, height: dimension }}
    >
      <img src={photoUrl} alt={alt} className="h-full w-full object-cover" />
    </button>
  )
}
