/**
 * Touch sensor for scrollable lists: during the long-press delay, touchmove
 * listeners stay passive so the browser can scroll. Only after the delay
 * (finger held still) do we take over the gesture for dragging.
 *
 * Stock TouchSensor attaches non-passive touchmove on touchstart, which on
 * real phones often blocks scrolling when the touch begins on a drag handle.
 */

function getTouchCoords(event) {
  const touch = event.touches[0] ?? event.changedTouches[0]
  if (!touch) return { x: 0, y: 0 }
  return { x: touch.clientX, y: touch.clientY }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export class ScrollFriendlyTouchSensor {
  static activators = [
    {
      eventName: 'onTouchStart',
      handler: ({ nativeEvent: event }, { onActivation }) => {
        if (event.touches.length > 1) return false
        onActivation?.({ event })
        return true
      },
    },
  ]

  // Same iOS Safari workaround as dnd-kit's TouchSensor.setup()
  static setup() {
    const noop = () => {}
    window.addEventListener('touchmove', noop, { capture: false, passive: false })
    return () => window.removeEventListener('touchmove', noop)
  }

  autoScrollEnabled = true

  constructor(props) {
    this.props = props
    this.activated = false
    this.start = getTouchCoords(props.event)
    this.document = props.event.target?.ownerDocument ?? document
    this.timeoutId = null

    const constraint = props.options?.activationConstraint ?? {}
    this.delayMs = typeof constraint.delay === 'number' ? constraint.delay : 300
    this.tolerancePx = typeof constraint.tolerance === 'number' ? constraint.tolerance : 8

    this.onPassiveMove = (event) => {
      if (this.activated) return
      const current = getTouchCoords(event)
      if (distance(this.start, current) > this.tolerancePx) {
        this.cancel()
        return
      }
      props.onPending?.(
        props.active,
        { delay: this.delayMs, tolerance: this.tolerancePx },
        this.start,
        {
          x: this.start.x - current.x,
          y: this.start.y - current.y,
        },
      )
    }

    this.onPassiveEnd = () => {
      if (!this.activated) this.endBeforeActivation()
    }

    this.document.addEventListener('touchmove', this.onPassiveMove, { passive: true })
    this.document.addEventListener('touchend', this.onPassiveEnd, { passive: true })
    this.document.addEventListener('touchcancel', this.onPassiveEnd, { passive: true })

    props.onPending?.(props.active, { delay: this.delayMs, tolerance: this.tolerancePx }, this.start)

    this.timeoutId = setTimeout(() => {
      this.timeoutId = null
      this.activate()
    }, this.delayMs)
  }

  removePassive() {
    this.document.removeEventListener('touchmove', this.onPassiveMove)
    this.document.removeEventListener('touchend', this.onPassiveEnd)
    this.document.removeEventListener('touchcancel', this.onPassiveEnd)
  }

  removeActive() {
    if (!this.onActiveMove) return
    this.document.removeEventListener('touchmove', this.onActiveMove)
    this.document.removeEventListener('touchend', this.onActiveEnd)
    this.document.removeEventListener('touchcancel', this.onActiveEnd)
    this.onActiveMove = null
    this.onActiveEnd = null
  }

  clearTimer() {
    if (this.timeoutId != null) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  activate() {
    if (this.activated) return
    this.activated = true
    this.removePassive()

    const { onStart, onMove, onEnd } = this.props
    onStart(this.start)

    this.onActiveMove = (event) => {
      if (event.cancelable) event.preventDefault()
      onMove(getTouchCoords(event))
    }

    this.onActiveEnd = () => {
      this.removeActive()
      onEnd()
    }

    this.document.addEventListener('touchmove', this.onActiveMove, { passive: false })
    this.document.addEventListener('touchend', this.onActiveEnd, { passive: false })
    this.document.addEventListener('touchcancel', this.onActiveEnd, { passive: false })
  }

  cancel() {
    this.clearTimer()
    this.removePassive()
    this.removeActive()
    const { onAbort, onCancel, active } = this.props
    if (!this.activated) onAbort?.(active)
    onCancel()
  }

  endBeforeActivation() {
    this.clearTimer()
    this.removePassive()
    const { onAbort, onEnd, active } = this.props
    onAbort?.(active)
    onEnd()
  }
}
