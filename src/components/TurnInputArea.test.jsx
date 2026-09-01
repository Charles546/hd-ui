import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import TurnInputArea from './TurnInputArea'

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

describe('TurnInputArea', () => {
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
    onSubmit: vi.fn(),
    isSending: false,
    placeholder: 'Start a new turn…',
    buttonLabel: 'Send',
    engines: [
      { driver: 'openai', engine: 'hy3' },
      { driver: 'openai', engine: 'gpt-4' },
    ],
    selectedEngine: 'openai:hy3',
    onEngineChange: vi.fn(),
  }

  it('T1: textarea has no border, no radius and spans the container width', () => {
    render(<TurnInputArea {...baseProps} />)
    const ta = screen.getByPlaceholderText('Start a new turn…')
    expect(ta.style.borderWidth).toBe('0px')
    expect(ta.style.borderRadius).toBe('0px')
    expect(ta.style.width).toBe('100%')
  })

  it('T1b: footer row has horizontal breathing room, bottom padding, and textarea stays full-bleed', () => {
    render(<TurnInputArea {...baseProps} />)
    const footer = screen.getByTestId('turn-composer-footer')
    // R1: footer has horizontal padding for side room and bottom padding
    // between the badges/button and the strip's bottom border.
    expect(footer.style.paddingLeft).toBe('12px')
    expect(footer.style.paddingRight).toBe('12px')
    expect(footer.style.paddingBottom).toBe('10px')

    // textarea still full-bleed / borderless (no footer padding leaked onto it)
    const ta = screen.getByPlaceholderText('Start a new turn…')
    expect(ta.style.borderWidth).toBe('0px')
    expect(ta.style.borderRadius).toBe('0px')
    expect(ta.style.width).toBe('100%')
  })

  it('T1c: textarea grows to fill (flex) while footer stays pinned to the bottom', () => {
    render(<TurnInputArea {...baseProps} />)
    const footer = screen.getByTestId('turn-composer-footer')
    const ta = screen.getByPlaceholderText('Start a new turn…')

    // R2: footer pinned to bottom edge and never grows. The auto margin is
    // removed so the textarea's flex-grow absorbs all the divider-driven space.
    expect(footer.style.marginTop).not.toBe('auto')
    expect(footer.style.flexShrink).toBe('0')

    // R2: textarea is the flex child that absorbs height changes; no hardcoded height.
    expect(ta.style.flex).toMatch(/^1 /)
    expect(ta.style.height).toBe('')
  })

  it('T1d: textarea background matches the composer box for a seamless borderless look', () => {
    render(<TurnInputArea {...baseProps} />)
    const ta = screen.getByPlaceholderText('Start a new turn…')
    // #11141c serializes to rgb(17, 20, 28) in jsdom
    expect(ta.style.backgroundColor).toBe('rgb(17, 20, 28)')
  })

  it('T1e: engine badge is larger with a rounder pill look', () => {
    render(<TurnInputArea {...baseProps} />)
    const badge = screen.getByRole('button', { name: /engine/i })
    expect(badge.style.padding).toBe('6px 12px')
    expect(badge.style.fontSize).toBe('12px')
    expect(badge.style.borderRadius).toBe('14px')
  })

  it('T2: footer contains the Engine badge and the circular send button', () => {
    render(<TurnInputArea {...baseProps} />)
    // Engine badge
    expect(screen.getByRole('button', { name: /engine/i })).toBeInTheDocument()
    // Circular send button
    const send = screen.getByRole('button', { name: 'Send' })
    expect(send).toBeInTheDocument()
    expect(send.style.borderRadius).toBe('50%')
  })

  it('T3: badge click triggers showPicker on the hidden select and value reflects selectedEngine', () => {
    const { container } = render(<TurnInputArea {...baseProps} />)
    // The engine remains a real hidden <select> synced to selectedEngine.
    const select = container.querySelector('select[aria-label="Engine"]')
    expect(select).not.toBeNull()
    expect(select.value).toBe('openai:hy3')

    const badge = screen.getByRole('button', { name: /engine/i })
    fireEvent.click(badge)
    expect(HTMLSelectElement.prototype.showPicker).toHaveBeenCalled()
  })

  it('T4: circular button disabled when text empty or sending, enabled with text', () => {
    const { rerender } = render(<TurnInputArea {...baseProps} />)
    const send = screen.getByRole('button', { name: 'Send' })
    expect(send).toBeDisabled()

    const ta = screen.getByPlaceholderText('Start a new turn…')
    fireEvent.change(ta, { target: { value: 'hello' } })
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()

    rerender(<TurnInputArea {...baseProps} isSending />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('T4b: submit calls onSubmit with parsed engine and driver and clears text', () => {
    const onSubmit = vi.fn()
    render(<TurnInputArea {...baseProps} onSubmit={onSubmit} />)
    const ta = screen.getByPlaceholderText('Start a new turn…')
    fireEvent.change(ta, { target: { value: '  hello  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSubmit).toHaveBeenCalledWith('hello', 'hy3', 'openai')
    expect(ta.value).toBe('')
  })

  it('desktop: Enter (no shift) submits and clears text', () => {
    const onSubmit = vi.fn()
    render(<TurnInputArea {...baseProps} onSubmit={onSubmit} />)
    const ta = screen.getByPlaceholderText('Start a new turn…')
    fireEvent.change(ta, { target: { value: 'hello' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('hello', 'hy3', 'openai')
    expect(ta.value).toBe('')
  })

  it('desktop: Shift+Enter inserts a newline without submitting', () => {
    const onSubmit = vi.fn()
    render(<TurnInputArea {...baseProps} onSubmit={onSubmit} />)
    const ta = screen.getByPlaceholderText('Start a new turn…')
    fireEvent.change(ta, { target: { value: 'hello' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(ta.value).toBe('hello')
  })

  it('mobile: Enter inserts a newline without submitting (submit via circular button)', () => {
    installMatchMedia(true)
    const onSubmit = vi.fn()
    render(<TurnInputArea {...baseProps} onSubmit={onSubmit} />)
    const ta = screen.getByPlaceholderText('Start a new turn…')
    fireEvent.change(ta, { target: { value: 'hello' } })
    fireEvent.keyDown(ta, { key: 'Enter' })
    // On mobile the handler does NOT intercept Enter, so no submit happens and
    // the textarea's native default inserts a newline.
    expect(onSubmit).not.toHaveBeenCalled()
    expect(ta.value).toBe('hello')
  })
})
