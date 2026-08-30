import { render, screen, cleanup } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { MessageBubble } from './MessageBubble'

const originalMatchMedia = window.matchMedia

function installMatchMedia(matches) {
  const mqls = new Map()
  window.matchMedia = vi.fn((query) => {
    if (!mqls.has(query)) {
      const listeners = new Set()
      mqls.set(query, {
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
      })
    }
    return mqls.get(query)
  })
}

describe('MessageBubble - mobile responsiveness', () => {
  beforeEach(() => {
    installMatchMedia(false)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
  })

  it('renders an agent message', () => {
    render(<MessageBubble msg={{ Role: 'agent', content: 'Hi there' }} />)
    expect(screen.getByText('agent')).toBeInTheDocument()
    expect(screen.getByText('Hi there')).toBeInTheDocument()
  })

  it('keeps desktop maxWidth at 75% on non-mobile viewport', () => {
    installMatchMedia(false)
    render(<MessageBubble msg={{ Role: 'agent', content: 'Hello' }} />)
    const bubble = screen.getByTestId('msg-bubble')
    expect(bubble.style.maxWidth).toBe('75%')
  })

  it('relaxes maxWidth to 92% on mobile viewport', () => {
    installMatchMedia(true)
    render(<MessageBubble msg={{ Role: 'agent', content: 'Hello' }} />)
    const bubble = screen.getByTestId('msg-bubble')
    expect(bubble.style.maxWidth).toBe('92%')
  })
})
