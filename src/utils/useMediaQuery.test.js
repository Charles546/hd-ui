import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import useMediaQuery from './useMediaQuery'

function createMockMatchMedia(initialMatches, query) {
  const listeners = new Set()
  let matches = initialMatches
  const mql = {
    get matches() {
      return matches
    },
    media: query,
    onchange: null,
    addEventListener: (type, listener) => {
      if (type === 'change') listeners.add(listener)
    },
    removeEventListener: (type, listener) => {
      if (type === 'change') listeners.delete(listener)
    },
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    // Test helper: flip the matches value and notify subscribers.
    __emitChange(next) {
      matches = next
      listeners.forEach((listener) => listener({ matches: next, media: query }))
    },
  }
  return mql
}

describe('useMediaQuery', () => {
  const originalMatchMedia = window.matchMedia
  let mql

  beforeEach(() => {
    mql = null
    window.matchMedia = vi.fn((query) => {
      mql = createMockMatchMedia(false, query)
      return mql
    })
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  it('returns the initial match state', () => {
    window.matchMedia = vi.fn(() => createMockMatchMedia(true, '(max-width: 768px)'))
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 768px)')
  })

  it('subscribes to change events and re-renders when the query flips', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(false)

    act(() => {
      mql.__emitChange(true)
    })
    expect(result.current).toBe(true)

    act(() => {
      mql.__emitChange(false)
    })
    expect(result.current).toBe(false)
  })

  it('cleans up its listener on unmount', () => {
    const removeEventListener = vi.fn()
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: '(max-width: 768px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))

    const { unmount } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('re-subscribes when the query changes', () => {
    const queries = []
    window.matchMedia = vi.fn((query) => {
      queries.push(query)
      return createMockMatchMedia(false, query)
    })

    const { rerender } = renderHook(({ query }) => useMediaQuery(query), {
      initialProps: { query: '(max-width: 768px)' },
    })
    // Called once by the lazy initializer and once by the effect that
    // subscribes to the media query list.
    expect(window.matchMedia).toHaveBeenCalledTimes(2)
    expect(queries).toEqual(['(max-width: 768px)', '(max-width: 768px)'])

    rerender({ query: '(min-width: 768px)' })
    expect(window.matchMedia).toHaveBeenCalledTimes(3)
    expect(queries).toEqual([
      '(max-width: 768px)',
      '(max-width: 768px)',
      '(min-width: 768px)',
    ])
  })
})
