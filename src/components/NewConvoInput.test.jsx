import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import NewConvoInput from './NewConvoInput'

describe('NewConvoInput', () => {
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
    inputHeight: 160,
  }

  it('T1: textarea is full-width and borderless', () => {
    render(<NewConvoInput {...baseProps} />)
    const ta = screen.getByPlaceholderText('Type your first message…')
    expect(ta.style.width).toBe('100%')
    expect(ta.style.borderWidth).toBe('0px')
    expect(ta.style.borderRadius).toBe('0px')
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
})
