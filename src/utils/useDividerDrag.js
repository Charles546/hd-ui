import { useCallback, useRef, useState } from 'react'

/**
 * Robust divider drag for both mouse and touch.
 *
 * The browser/OS normally captures a finger drag on the divider for page
 * scrolling. We override that with:
 *  1. `touchAction: 'none'` on the divider element (CSS, applied in style),
 *  2. a NATIVE, explicitly non-passive `touchmove` listener on the divider
 *     element with `preventDefault()`. React 18 registers synthetic
 *     `touchstart`/`touchmove`/`wheel` as passive at the root, so a React
 *     `onTouchMove` handler can never cancel the scroll; only a native
 *     non-passive listener can. This covers browsers (notably iOS Safari)
 *     that do not fully honor `touch-action`.
 *  3. `setPointerCapture(e.pointerId)` + move/up/cancel listeners attached to
 *     the divider element itself (NOT window), so the drag continues even when
 *     the pointer/finger leaves the element.
 *
 * A drag-guard ref prevents double-binding when a real device fires both
 * pointer and touch events for the same gesture; whichever fires first wins.
 *
 * @param {number} minHeight - clamp lower bound (px)
 * @param {number} maxHeight - clamp upper bound (px)
 * @param {number} initialHeight - starting height (px)
 * @returns {{
 *   isDragging: boolean,
 *   inputAreaHeight: number,
 *   dividerRef: React.RefObject,
 *   dividerHandlers: {
 *     onPointerDown: (e) => void,
 *     onTouchStart: (e) => void,
 *     onTouchMove: (e) => void,
 *     onTouchEnd: (e) => void,
 *     onTouchCancel: (e) => void,
 *   },
 *   inputAreaStyle: { height: number, flexShrink: 0, overflow: 'hidden' },
 * }}
 */
export default function useDividerDrag(minHeight, maxHeight, initialHeight) {
  const [inputAreaHeight, setInputAreaHeight] = useState(initialHeight)
  const [isDragging, setIsDragging] = useState(false)
  const dividerRef = useRef(null)
  const draggingRef = useRef(false)

  const beginDrag = useCallback((clientY, pointerId, target) => {
    // Guard: on touch devices a gesture fires both pointerdown and touchstart;
    // only the first one should start the drag and attach listeners.
    if (draggingRef.current || !target) return
    draggingRef.current = true

    const startY = clientY
    const startHeight = inputAreaHeight
    setIsDragging(true)

    const getY = (ev) =>
      ev.clientY !== undefined && ev.clientY !== null
        ? ev.clientY
        : ev.touches && ev.touches[0]
          ? ev.touches[0].clientY
          : 0

    const onMove = (ev) => {
      // Native element-level listener, registered non-passive below: this is
      // the ONLY way to cancel the browser's touch-scroll capture on iOS
      // Safari / older WebKit (React's synthetic onTouchMove is passive).
      ev.preventDefault()
      const delta = startY - getY(ev)
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + delta))
      setInputAreaHeight(newHeight)
    }

    const cleanup = () => {
      draggingRef.current = false
      setIsDragging(false)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', cleanup)
      target.removeEventListener('pointercancel', cleanup)
      target.removeEventListener('touchmove', onMove)
      target.removeEventListener('touchend', cleanup)
      target.removeEventListener('touchcancel', cleanup)
    }

    // Capture the pointer so move/up events keep targeting this element even
    // when the pointer/finger leaves it.
    if (pointerId !== undefined && typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(pointerId)
      } catch {
        // The pointer may already be gone; ignore.
      }
    }

    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', cleanup)
    target.addEventListener('pointercancel', cleanup)
    // Touch fallbacks for browsers where pointer events are unreliable. Must
    // be registered with `passive: false` so preventDefault can cancel the
    // browser's default touch-scroll/touch-action behavior.
    target.addEventListener('touchmove', onMove, { passive: false })
    target.addEventListener('touchend', cleanup)
    target.addEventListener('touchcancel', cleanup)
  }, [inputAreaHeight, minHeight, maxHeight])

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation()
    beginDrag(e.clientY, e.pointerId, e.currentTarget)
  }, [beginDrag])

  // Touch fallback: for browsers that deliver touch events but not reliable
  // pointer events, start the drag from the first touch point.
  const handleTouchStart = useCallback((e) => {
    const touch = e.touches && e.touches[0]
    if (!touch) return
    beginDrag(touch.clientY, undefined, e.currentTarget)
  }, [beginDrag])

  const handleTouchMove = useCallback((e) => {
    // Best-effort guard. NOTE: React 18 attaches synthetic touchmove as a
    // passive root listener, so this cannot block scrolling by itself; the
    // actual scroll-blocking is done by the native non-passive touchmove
    // listener attached during beginDrag. Keep it for browsers/tests where it
    // does work and as a forward-compat guard.
    e.preventDefault()
  }, [])

  const handleTouchEnd = useCallback(() => {}, [])
  const handleTouchCancel = useCallback(() => {}, [])

  return {
    isDragging,
    inputAreaHeight,
    dividerRef,
    dividerHandlers: {
      onPointerDown: handlePointerDown,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
    inputAreaStyle: { height: inputAreaHeight, flexShrink: 0, overflow: 'hidden' },
  }
}
