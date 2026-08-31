import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import TurnInputArea from './TurnInputArea'

describe('TurnInputArea', () => {
  beforeEach(() => {
    // jsdom does not implement showPicker. Provide a function on the
    // prototype (backed by vi.fn) so the badge can call it and we can
    // assert it was invoked.
    Object.defineProperty(HTMLSelectElement.prototype, 'showPicker', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
  })

  const baseProps = {
    onSubmit: vi.fn(),
    isSending: false,
    placeholder: 'Start a new turn…',
    buttonLabel: 'Send',
    inputHeight: 160,
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
})
