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

  it('does not apply a border to the bubble', () => {
    render(<MessageBubble msg={{ Role: 'agent', content: 'Hello' }} />)
    const bubble = screen.getByTestId('msg-bubble')
    expect(bubble.style.border).toBe('')
    expect(bubble).not.toHaveStyle({ border: '1px solid #2d3148' })
  })

  it('preserves role-based background colors for agent and user messages', () => {
    render(<MessageBubble msg={{ Role: 'agent', content: 'Agent hello' }} />)
    const agentBubble = screen.getByTestId('msg-bubble')
    expect(agentBubble.style.background).toBe('rgb(18, 32, 26)')

    cleanup()
    render(<MessageBubble msg={{ Role: 'user', content: 'User hello' }} />)
    const userBubble = screen.getByTestId('msg-bubble')
    expect(userBubble.style.background).toBe('rgb(22, 32, 48)')
  })

  it('applies vertical-only padding of 8px 0', () => {
    render(<MessageBubble msg={{ Role: 'agent', content: 'Hello' }} />)
    const bubble = screen.getByTestId('msg-bubble')
    expect(bubble.style.paddingTop).toBe('8px')
    expect(bubble.style.paddingBottom).toBe('8px')
    expect(bubble.style.paddingLeft).toBe('0px')
    expect(bubble.style.paddingRight).toBe('0px')
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
