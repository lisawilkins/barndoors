// Opening the browser's print sheet in a way WebKit will actually honor.
//
// Safari — and therefore every browser on an iPhone, since they all run
// WebKit — throws away a `window.print()` call that arrives while the
// document still has any request in flight. `LocalDOMWindow::print()` sets
// an internal "print once loading finishes" flag and returns, and that flag
// is only ever acted on when the *main* document load completes. In a
// single-page app that finished loading minutes ago, that moment has long
// passed, so the tap is swallowed and no print sheet ever opens — silently,
// with nothing in the console. Chrome and Firefox print either way, which
// is why this only ever bit the iPhones.
//
// So: print immediately when the page is settled (what every browser did
// before), and wait for it to settle first when it isn't. WebKit doesn't
// require a user gesture for `print()` itself, so the deferred call still
// opens the sheet.

// Don't wait forever for a request that may never come back — a barn phone
// on one bar is exactly the case this is for. Printing a page whose last
// image is still loading beats a Print button that does nothing.
const SETTLE_TIMEOUT_MS = 4000

/**
 * Whether this browser can open a print sheet at all. iOS in-app browsers —
 * the ones that open when a link is tapped inside Messages, Gmail, Slack or
 * Facebook — leave `window.print` undefined, and there is no way for a page
 * to print itself from inside one.
 */
export function canPrint() {
  return typeof window !== 'undefined' && typeof window.print === 'function'
}

function isSettled() {
  return document.readyState === 'complete' && document.fonts?.status !== 'loading'
}

function whenSettled() {
  const loaded =
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise((resolve) => window.addEventListener('load', resolve, { once: true }))

  const settled = Promise.all([loaded, document.fonts?.ready]).then(() => undefined)
  const timedOut = new Promise((resolve) => setTimeout(resolve, SETTLE_TIMEOUT_MS))

  return Promise.race([settled, timedOut])
}

/**
 * Open the print sheet. Call this straight from the tap handler.
 *
 * Returns false when the browser has no print at all, so the caller can tell
 * the reader how to print by hand instead of leaving a dead button.
 */
export function printPage() {
  if (!canPrint()) return false

  if (isSettled()) {
    window.print()
    return true
  }

  whenSettled().then(() => window.print())
  return true
}
