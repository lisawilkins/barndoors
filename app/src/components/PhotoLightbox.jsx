// Full-screen photo viewer opened by tapping a PhotoThumb. Tapping the
// backdrop closes it (the image itself stops propagation so tapping the
// photo doesn't close it); the X button is a second, always-visible way out.
export default function PhotoLightbox({ photo, onClose }) {
  if (!photo) return null

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/80 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-ink-900/60 text-white active:bg-ink-900/80"
      >
        <span className="material-symbols-outlined text-[22px]">close</span>
      </button>
      <img
        src={photo.url}
        alt={photo.alt}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-md object-contain"
      />
    </div>
  )
}
