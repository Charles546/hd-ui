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

  it('applies a 1px border to the bubble with the alignment side dropped', () => {
    // jsdom normalizes the hex color in the border shorthand to rgb().
    // The alignment-side border is dropped so the bubble connects flush to the
    // history-box border without a doubled 2px line.
    render(<MessageBubble msg={{ Role: 'agent', content: 'Hello' }} />)
    const agentBubble = screen.getByTestId('msg-bubble')
    // Left-aligned agent: top/bottom/right borders present, left (alignment side) dropped.
    expect(agentBubble.style.borderTopWidth).toBe('1px')
    expect(agentBubble.style.borderTopStyle).toBe('solid')
    expect(agentBubble.style.borderTopColor).toBe('rgb(45, 49, 72)')
    expect(agentBubble.style.borderRightWidth).toBe('1px')
    expect(agentBubble.style.borderRightStyle).toBe('solid')
    expect(agentBubble.style.borderLeftStyle).toBe('none')
    expect(agentBubble.style.borderLeftWidth).toBe('medium')

    cleanup()
    // Right-aligned user: top/bottom/left borders present, right (alignment side) dropped.
    render(<MessageBubble msg={{ Role: 'user', content: 'Hello' }} />)
    const userBubble = screen.getByTestId('msg-bubble')
    expect(userBubble.style.borderTopWidth).toBe('1px')
    expect(userBubble.style.borderTopStyle).toBe('solid')
    expect(userBubble.style.borderTopColor).toBe('rgb(45, 49, 72)')
    expect(userBubble.style.borderLeftWidth).toBe('1px')
    expect(userBubble.style.borderLeftStyle).toBe('solid')
    expect(userBubble.style.borderRightStyle).toBe('none')
    expect(userBubble.style.borderRightWidth).toBe('medium')
  })

  it('keeps 8px 12px bubble padding', () => {
    render(<MessageBubble msg={{ Role: 'agent', content: 'Hello' }} />)
    const bubble = screen.getByTestId('msg-bubble')
    expect(bubble.style.paddingTop).toBe('8px')
    expect(bubble.style.paddingBottom).toBe('8px')
    expect(bubble.style.paddingLeft).toBe('12px')
    expect(bubble.style.paddingRight).toBe('12px')
  })

  it('squares the alignment-side corners', () => {
    // Left-aligned roles (agent, system, tool, unknown) square the left corners.
    render(<MessageBubble msg={{ Role: 'agent', content: 'Agent hello' }} />)
    const agentBubble = screen.getByTestId('msg-bubble')
    expect(agentBubble.style.borderRadius).toBe('0 8px 8px 0')
    expect(agentBubble).toHaveStyle({ borderRadius: '0 8px 8px 0' })

    cleanup()
    // Right-aligned role (user) squares the right corners.
    render(<MessageBubble msg={{ Role: 'user', content: 'User hello' }} />)
    const userBubble = screen.getByTestId('msg-bubble')
    expect(userBubble.style.borderRadius).toBe('8px 0 0 8px')
    expect(userBubble).toHaveStyle({ borderRadius: '8px 0 0 8px' })

    cleanup()
    // Non-user, non-agent roles are also left-aligned.
    render(<MessageBubble msg={{ Role: 'system', content: 'System hello' }} />)
    expect(screen.getByTestId('msg-bubble').style.borderRadius).toBe('0 8px 8px 0')
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

  it('drops the alignment-side border on mobile so bubbles connect flush to the borderless history box', () => {
    installMatchMedia(true)

    // Left-aligned agent: top/bottom/right borders stay, left (alignment side) dropped.
    render(<MessageBubble msg={{ Role: 'agent', content: 'Agent hello' }} />)
    const agentBubble = screen.getByTestId('msg-bubble')
    expect(agentBubble.style.borderTopStyle).toBe('solid')
    expect(agentBubble.style.borderBottomStyle).toBe('solid')
    expect(agentBubble.style.borderRightStyle).toBe('solid')
    expect(agentBubble.style.borderLeftStyle).toBe('none')

    cleanup()
    // Right-aligned user: top/bottom/left borders stay, right (alignment side) dropped.
    render(<MessageBubble msg={{ Role: 'user', content: 'User hello' }} />)
    const userBubble = screen.getByTestId('msg-bubble')
    expect(userBubble.style.borderTopStyle).toBe('solid')
    expect(userBubble.style.borderBottomStyle).toBe('solid')
    expect(userBubble.style.borderLeftStyle).toBe('solid')
    expect(userBubble.style.borderRightStyle).toBe('none')
  })
})
