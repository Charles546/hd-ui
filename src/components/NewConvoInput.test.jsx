import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import NewConvoInput from './NewConvoInput'

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

describe('NewConvoInput', () => {
  beforeEach(() => {
    installMatchMedia(false) // desktop by default
    // jsdom does not implement showPicker. Provide a function on the
    // prototype (backed by vi.fn) so the badge can call it and we can
    // assert it was invoked.
    Object.defineProperty(HTMLSelectElement.prototype, 'showPicker', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
  })

  const baseProps = {
    agents: ['agent1', 'agent2'],
    selectedAgent: 'agent1',
    onAgentChange: vi.fn(),
    engines: [
      { driver: 'openai', engine: 'hy3' },
      { driver: 'openai', engine: 'gpt-4' },
    ],
    selectedEngine: 'openai:hy3',
    onEngineChange: vi.fn(),
    onSend: vi.fn(),
    isSending: false,
  }

  it('T1: textarea is full-width and borderless', () => {
    render(<NewConvoInput {...baseProps} />)
    const ta = screen.getByPlaceholderText('Type your first message…')
    expect(ta.style.width).toBe('100%')
    expect(ta.style.borderWidth).toBe('0px')
    expect(ta.style.borderRadius).toBe('0px')
  })

  it('T1b: footer row has horizontal breathing room, bottom padding, and textarea stays full-bleed', () => {
    render(<NewConvoInput {...baseProps} />)
    const footer = screen.getByTestId('new-convo-composer-footer')
    // R1: footer has horizontal padding for side room and bottom padding
    // between the badges/button and the strip's bottom border.
    expect(footer.style.paddingLeft).toBe('12px')
    expect(footer.style.paddingRight).toBe('12px')
    expect(footer.style.paddingBottom).toBe('10px')

    // textarea still full-bleed / borderless
    const ta = screen.getByPlaceholderText('Type your first message…')
    expect(ta.style.borderWidth).toBe('0px')
    expect(ta.style.borderRadius).toBe('0px')
    expect(ta.style.width).toBe('100%')
  })

  it('T1c: textarea grows to fill (flex) while footer stays pinned to the bottom', () => {
    render(<NewConvoInput {...baseProps} />)
    const footer = screen.getByTestId('new-convo-composer-footer')
    const ta = screen.getByPlaceholderText('Type your first message…')

    // R2: footer pinned to bottom edge and never grows. The auto margin is
    // removed so the textarea's flex-grow absorbs all the divider-driven space.
    expect(footer.style.marginTop).not.toBe('auto')
    expect(footer.style.flexShrink).toBe('0')

    // R2: textarea is the flex child that absorbs height changes; no hardcoded height.
    expect(ta.style.flex).toMatch(/^1 /)
    expect(ta.style.height).toBe('')
    // R4: the max-height cap is removed so the textarea keeps growing on tall strips.
    expect(ta.style.maxHeight).toBe('')
  })

  it('T1d: textarea background matches the composer box for a seamless borderless look', () => {
    render(<NewConvoInput {...baseProps} />)
    const ta = screen.getByPlaceholderText('Type your first message…')
    // #11141c serializes to rgb(17, 20, 28) in jsdom
    expect(ta.style.backgroundColor).toBe('rgb(17, 20, 28)')
  })

  it('T1e: agent and engine badges are larger with a rounder pill look', () => {
    render(<NewConvoInput {...baseProps} />)
    const agentBadge = screen.getByRole('button', { name: /agent/i })
    expect(agentBadge.style.padding).toBe('6px 12px')
    expect(agentBadge.style.fontSize).toBe('12px')
    expect(agentBadge.style.borderRadius).toBe('14px')

    const engineBadge = screen.getByRole('button', { name: /engine/i })
    expect(engineBadge.style.padding).toBe('6px 12px')
    expect(engineBadge.style.fontSize).toBe('12px')
    expect(engineBadge.style.borderRadius).toBe('14px')
  })

  it('T2: footer has Agent + Engine badges and a circular Start button', () => {
    render(<NewConvoInput {...baseProps} />)
    expect(screen.getByRole('button', { name: /agent/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /engine/i })).toBeInTheDocument()
    const start = screen.getByRole('button', { name: 'Start' })
    expect(start).toBeInTheDocument()
    expect(start.style.borderRadius).toBe('50%')
  })

  it('T3: badge click opens the hidden select via showPicker and value is synced', () => {
    const { container } = render(<NewConvoInput {...baseProps} />)
    const engineSelect = container.querySelector('select[aria-label="Engine"]')
    const agentSelect = container.querySelector('select[aria-label="Agent"]')
    expect(engineSelect).not.toBeNull()
    expect(engineSelect.value).toBe('openai:hy3')
    expect(agentSelect.value).toBe('agent1')

    fireEvent.click(screen.getByRole('button', { name: /engine/i }))
    expect(HTMLSelectElement.prototype.showPicker).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /agent/i }))
    expect(HTMLSelectElement.prototype.showPicker).toHaveBeenCalledTimes(2)
  })

  it('T4: send disabled without text, without agent, and when sending', () => {
    const { rerender } = render(<NewConvoInput {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()

    const ta = screen.getByPlaceholderText('Type your first message…')
    fireEvent.change(ta, { target: { value: 'hello' } })
    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled()

    // no agent selected
    rerender(<NewConvoInput {...baseProps} selectedAgent={''} />)
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()

    // sending
    rerender(<NewConvoInput {...baseProps} isSending />)
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
  })

  it('T4b: submit calls onSend with agent, text, engine, driver and clears text', () => {
    const onSend = vi.fn()
    render(<NewConvoInput {...baseProps} onSend={onSend} />)
    const ta = screen.getByPlaceholderText('Type your first message…')
    fireEvent.change(ta, { target: { value: '  first msg  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onSend).toHaveBeenCalledWith('agent1', 'first msg', 'hy3', 'openai')
    expect(ta.value).toBe('')
  })

  it('desktop: Enter (no shift) submits with agent, text, engine, driver and clears text', () => {
    const onSend = vi.fn()
    render(<NewConvoInput {...baseProps} onSend={onSend} />)
    const ta = screen.getByPlaceholderText('Type your first message…')
    fireEvent.change(ta, { target: { value: 'hello' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('agent1', 'hello', 'hy3', 'openai')
    expect(ta.value).toBe('')
  })

  it('desktop: Shift+Enter inserts a newline without submitting', () => {
    const onSend = vi.fn()
    render(<NewConvoInput {...baseProps} onSend={onSend} />)
    const ta = screen.getByPlaceholderText('Type your first message…')
    fireEvent.change(ta, { target: { value: 'hello' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
    expect(ta.value).toBe('hello')
  })

  it('mobile: Enter inserts a newline without submitting (submit via circular button)', () => {
    installMatchMedia(true)
    const onSend = vi.fn()
    render(<NewConvoInput {...baseProps} onSend={onSend} />)
    const ta = screen.getByPlaceholderText('Type your first message…')
    fireEvent.change(ta, { target: { value: 'hello' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    // On mobile the handler does NOT intercept Enter, so no submit happens and
    // the textarea's native default inserts a newline.
    expect(onSend).not.toHaveBeenCalled()
    expect(ta.value).toBe('hello')
  })
})
