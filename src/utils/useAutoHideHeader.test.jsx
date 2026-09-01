import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useRef, useState } from 'react'
import useAutoHideHeader from './useAutoHideHeader'

/**
 * Minimal harness that mounts a scroll container and surfaces the current
 * collapsed state + the callback invocation count via the DOM so tests can
 * assert behavior without touching React internals.
 */
function Harness({ active = true, thresholds, initialScrollTop = 0, onCollapse = vi.fn() }) {
  const ref = useRef(null)
  const [collapsed, setCollapsed] = useState(false)

  // Seed the container's scrollTop so the hook's initial "at top" detection
  // and velocity math are deterministic.
  const attachRef = (node) => {
    if (node) {
      node.scrollTop = initialScrollTop
      Object.defineProperty(node, 'scrollTop', {
        configurable: true,
        get: () => node.__scrollTop,
        set: (v) => { node.__scrollTop = v },
      })
      node.__scrollTop = initialScrollTop
    }
    ref.current = node
  }

  useAutoHideHeader({
    containerRef: ref,
    active,
    onCollapsedChange: (value) => {
      setCollapsed(value)
      onCollapse(value)
    },
    thresholds,
  })

  return (
    <div ref={attachRef} data-testid="scroller">
      <span data-testid="collapsed">{String(collapsed)}</span>
    </div>
  )
}

function getScroller() {
  return screen.getByTestId('scroller')
}

// Fire a scroll event on a container with a given scrollTop, advancing the
// fake clock so the hook can compute velocity.
function scrollTo(container, scrollTop) {
  container.scrollTop = scrollTop
  fireEvent.scroll(container)
}

/** Reset scrollTop to 0 and drop scroll position to the top. */
function goToTop(container) {
  container.scrollTop = 0
  fireEvent.scroll(container)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useAutoHideHeader', () => {
  it('keeps headers expanded at the top', () => {
    render(<Harness />)
    expect(screen.getByTestId('collapsed').textContent).toBe('false')
  })

  it('collapses on forward scroll beyond the distance threshold', () => {
    render(<Harness initialScrollTop={0} />)
    const scroller = getScroller()

    // Forward scroll well past the 6px hide threshold while clearly not at
    // the top (scrollTop > 2).
    scrollTo(scroller, 40)

    expect(screen.getByTestId('collapsed').textContent).toBe('true')
  })

  it('does not collapse for tiny / hesitant forward scrolls', () => {
    render(<Harness initialScrollTop={0} />)
    const scroller = getScroller()

    // Forward scroll smaller than the 6px hide threshold.
    scrollTo(scroller, 4)

    expect(screen.getByTestId('collapsed').textContent).toBe('false')
  })

  it('shows headers when the container reaches the top', () => {
    render(<Harness initialScrollTop={0} />)
    const scroller = getScroller()

    // Collapse first.
    scrollTo(scroller, 40)
    expect(screen.getByTestId('collapsed').textContent).toBe('true')

    // Reach the top → revealed.
    goToTop(scroller)
    expect(screen.getByTestId('collapsed').textContent).toBe('false')
  })

  it('stays hidden on slow upward drag (matches browser address bar)', () => {
    render(<Harness initialScrollTop={100} />)
    const scroller = getScroller()

    // Collapse first from a deep position.
    scrollTo(scroller, 200)
    expect(screen.getByTestId('collapsed').textContent).toBe('true')

    // A slow upward drag: small delta over a long time → velocity near 0,
    // not below showVelocity (-0.5 px/ms), so headers stay hidden.
    vi.useFakeTimers()
    vi.advanceTimersByTime(1000)
    scrollTo(scroller, 150) // delta -50 over ~1000ms → velocity -0.05
    expect(screen.getByTestId('collapsed').textContent).toBe('true')
  })

  it('shows headers on fast upward scroll', () => {
    render(<Harness initialScrollTop={100} />)
    const scroller = getScroller()

    // Collapse first.
    scrollTo(scroller, 200)
    expect(screen.getByTestId('collapsed').textContent).toBe('true')

    // Fast upward scroll: large negative delta over a short time → velocity
    // below showVelocity (-0.5 px/ms).
    vi.useFakeTimers()
    vi.advanceTimersByTime(20)
    scrollTo(scroller, 180) // delta -20 over ~20ms → velocity -1.0
    expect(screen.getByTestId('collapsed').textContent).toBe('false')
  })

  it('only notifies when the collapsed boolean actually changes', () => {
    const onCollapse = vi.fn()
    render(<Harness initialScrollTop={0} onCollapse={onCollapse} />)
    const scroller = getScroller()

    // Two forward scrolls both collapse → only one transition notification
    // (true). The initial value this.onCollapse ref is false and there is no
    // change on mount, so no mount-time callback is emitted.
    scrollTo(scroller, 50)
    scrollTo(scroller, 80)
    expect(screen.getByTestId('collapsed').textContent).toBe('true')
    expect(onCollapse).toHaveBeenCalledTimes(1) // only the true transition

    // Additional scroll while still collapsed → no new callback.
    scrollTo(scroller, 120)
    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it('keeps headers expanded when active is false (desktop / overlay open)', () => {
    render(<Harness active={false} initialScrollTop={0} />)
    const scroller = getScroller()

    // Even a strong forward scroll must not collapse while inactive.
    scrollTo(scroller, 80)
    expect(screen.getByTestId('collapsed').textContent).toBe('false')
  })
})
