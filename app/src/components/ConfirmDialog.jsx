// Shared confirmation modal for destructive/consequential actions — permanent
// deletes (chore lists) use the red, irreversible-warning styling; reversible
// actions (archiving a hand, manager, or animal) use the neutral styling so
// the tone matches what's actually at stake.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 px-4"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-4 rounded-md bg-white p-6 shadow-card"
      >
        <h2 id="confirm-dialog-title" className="font-display text-xl font-semibold text-ink-900">
          {title}
        </h2>
        <p className="text-[15px] leading-relaxed text-ink-600">{message}</p>

        <div className="mt-1 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-12 flex-1 items-center justify-center rounded-md border border-border-input bg-white text-[16px] font-semibold text-ink-600 active:bg-surface-canvas"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex h-12 flex-1 items-center justify-center rounded-md text-[16px] font-bold text-white active:opacity-90 ${
              destructive ? 'bg-red-600' : 'bg-ink-900'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
