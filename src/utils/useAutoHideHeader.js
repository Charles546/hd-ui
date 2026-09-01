import { useEffect, useRef } from 'react'

/**
 * Auto-hide header rows on forward scroll, reveal them on fast backward scroll
 * or when the scroll container reaches the top — mobile-browser
 * address-bar-style collapse.
 *
 * Mirrors the shared-util pattern of useDividerDrag so that both
 * ConversationsPage and ConvoHistoryPage can collapse their title bar + nav
 * bar together with a single controlled instance per page.
 *
 * It attaches a PASSIVE scroll listener to the given scroll container (the
 * history scroll div, NOT the document body) and tracks the latest scrollTop
 * and time in refs to derive delta and velocity. Headers hide on forward scroll
 * past a distance threshold (when not near the top), and reappear on fast
 * upward scroll or when the container reaches the top. Tiny / slow drags are
 * ignored so the headers behave like a mobile browser address bar.
 *
 * Rapid state flips are throttled: onCollapsedChange is only invoked when the
 * collapsed boolean actually changes.
 *
 * @param {object} options
 * @param {import('react').MutableRefObject} options.containerRef - ref to the
 *   scroll container to observe (the history scroll div).
 * @param {boolean} [options.active=true] - when false (desktop layout, drawer
 *   open, modal open) the headers are forced expanded and no listener is kept.
 * @param {(collapsed: boolean) => void} [options.onCollapsedChange] - called
 *   only when the collapsed state actually changes.
 * @param {object} [options.thresholds] - overridable tuning params:
 *   hideDelta (px, default 6), topThreshold (px, default 2),
 *   showVelocity (px/ms, default -0.5).
 */
export default function useAutoHideHeader({
  containerRef,
  active = true,
  onCollapsedChange,
  thresholds = {},
}) {
  const {
    hideDelta = 6,
    topThreshold = 2,
    showVelocity = -0.5,
  } = thresholds

  const lastScrollTopRef = useRef(0)
  const lastScrollTimeRef = useRef(0)
  const collapsedRef = useRef(false)
  const onCollapsedChangeRef = useRef(onCollapsedChange)

  // Keep the latest callback without re-binding the scroll listener.
  useEffect(() => {
    onCollapsedChangeRef.current = onCollapsedChange
  }, [onCollapsedChange])

  useEffect(() => {
    const el = containerRef?.current
    const notify = (value) => {
      if (collapsedRef.current !== value) {
        collapsedRef.current = value
        onCollapsedChangeRef.current?.(value)
      }
    }

    // Force expanded whenever the feature is inactive: desktop layout, a modal
    // is open, the drawer is open, or the scroll container is not mounted.
    if (!active || !el) {
      notify(false)
      return undefined
    }

    // (Re)arm in the expanded state using the current scroll position.
    lastScrollTopRef.current = el.scrollTop
    lastScrollTimeRef.current = Date.now()
    notify(false)

    const onScroll = () => {
      const scrollTop = el.scrollTop
      const now = Date.now()
      // Guard against zero dt so velocity stays finite.
      const dt = Math.max(now - lastScrollTimeRef.current, 1)
      const delta = scrollTop - lastScrollTopRef.current
      const velocity = delta / dt
      const atTop = scrollTop <= topThreshold

      let next = collapsedRef.current
      if (atTop) {
        // Reached the top: always reveal.
        next = false
      } else if (delta > hideDelta && !next) {
        // Scrolling forward beyond the distance threshold: hide.
        next = true
      } else if (velocity < showVelocity && next) {
        // Fast upward scroll: reveal (slow upward drags are ignored).
        next = false
      }

      lastScrollTopRef.current = scrollTop
      lastScrollTimeRef.current = now
      notify(next)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
    }
  }, [containerRef, active, hideDelta, topThreshold, showVelocity])
}
