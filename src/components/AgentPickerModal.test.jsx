import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'

// Mock createPortal before importing component
vi.mock('react-dom', () => ({
  createPortal: (children) => children,
}))

import AgentPickerModal from './AgentPickerModal'

const mockOnSelect = vi.fn()
const mockOnCancel = vi.fn()

describe('AgentPickerModal', () => {
  beforeEach(() => {
    mockOnSelect.mockReset()
    mockOnCancel.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders agent list with radio buttons', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2', 'agent3']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('Select an agent to revive this conversation')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'agent1' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'agent2' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'agent3' })).toBeInTheDocument()
  })

  it('selects first agent by default', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    const radio1 = screen.getByRole('radio', { name: 'agent1' })
    expect(radio1).toHaveAttribute('aria-checked', 'true')

    const radio2 = screen.getByRole('radio', { name: 'agent2' })
    expect(radio2).toHaveAttribute('aria-checked', 'false')
  })

  it('uses initial selectedAgent prop when provided', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
        selectedAgent="agent2"
      />
    )

    expect(screen.getByRole('radio', { name: 'agent1' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'agent2' })).toHaveAttribute('aria-checked', 'true')
  })

  it('allows selecting an agent by click', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    fireEvent.click(screen.getByRole('radio', { name: 'agent2' }))

    expect(screen.getByRole('radio', { name: 'agent1' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'agent2' })).toHaveAttribute('aria-checked', 'true')
  })

  it('allows selecting an agent by keyboard (Enter)', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    const radio2 = screen.getByRole('radio', { name: 'agent2' })
    fireEvent.keyDown(radio2, { key: 'Enter' })

    expect(screen.getByRole('radio', { name: 'agent2' })).toHaveAttribute('aria-checked', 'true')
  })

  it('allows selecting an agent by keyboard (Space)', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    const radio2 = screen.getByRole('radio', { name: 'agent2' })
    fireEvent.keyDown(radio2, { key: ' ' })

    expect(screen.getByRole('radio', { name: 'agent2' })).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onSelect with selected agent when confirm button clicked', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    fireEvent.click(screen.getByRole('radio', { name: 'agent2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revive Conversation' }))

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(mockOnSelect).toHaveBeenCalledTimes(1)
    expect(mockOnSelect).toHaveBeenCalledWith('agent2')
    expect(mockOnCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when cancel button clicked', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(mockOnCancel).toHaveBeenCalledTimes(1)
    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('calls onCancel when Escape key pressed', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(mockOnCancel).toHaveBeenCalledTimes(1)
    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('calls onCancel when overlay clicked', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    const overlay = screen.getByRole('presentation')
    fireEvent.click(overlay)

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(mockOnCancel).toHaveBeenCalledTimes(1)
    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('does not call onCancel when modal content clicked', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    const modal = screen.getByRole('dialog')
    fireEvent.click(modal)

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(mockOnCancel).not.toHaveBeenCalled()
  })

  it('disables confirm button when no agent selected', () => {
    render(
      <AgentPickerModal
        agents={[]}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    const confirmBtn = screen.getByRole('button', { name: 'Revive Conversation' })
    expect(confirmBtn).toBeDisabled()
  })

  it('shows empty state when no agents', () => {
    render(
      <AgentPickerModal
        agents={[]}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('No agents available')).toBeInTheDocument()
  })

  it('displays agent metadata when provided', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
        agentMetadata={{
          agent1: { engine: 'gpt-4', driver: 'openai' },
          agent2: { engine: 'claude-3', driver: 'anthropic' },
        }}
      />
    )

    expect(screen.getByText('gpt-4 / openai')).toBeInTheDocument()
    expect(screen.getByText('claude-3 / anthropic')).toBeInTheDocument()
  })

  it('uses custom title when provided', () => {
    render(
      <AgentPickerModal
        agents={['agent1']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
        title="Custom Title"
      />
    )

    expect(screen.getByText('Custom Title')).toBeInTheDocument()
  })

  it('has focusable elements for focus trap', () => {
    render(
      <AgentPickerModal
        agents={['agent1', 'agent2']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    // Verify all focusable elements exist in the DOM
    const closeBtn = screen.getByRole('button', { name: 'Close agent picker' })
    const firstRadio = screen.getByRole('radio', { name: 'agent1' })
    const secondRadio = screen.getByRole('radio', { name: 'agent2' })
    const confirmBtn = screen.getByRole('button', { name: 'Revive Conversation' })
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })

    expect(closeBtn).toBeInTheDocument()
    expect(firstRadio).toBeInTheDocument()
    expect(secondRadio).toBeInTheDocument()
    expect(confirmBtn).toBeInTheDocument()
    expect(cancelBtn).toBeInTheDocument()

    // Verify they are focusable (buttons are natively focusable, radios have tabIndex)
    expect(closeBtn).not.toBeDisabled()
    expect(cancelBtn).not.toBeDisabled()
    expect(firstRadio).toHaveAttribute('tabIndex', '0')
  })

  it('restores focus to trigger element on close', () => {
    const triggerBtn = document.createElement('button')
    triggerBtn.textContent = 'Open Modal'
    document.body.appendChild(triggerBtn)
    triggerBtn.focus()

    expect(document.activeElement).toBe(triggerBtn)

    render(
      <AgentPickerModal
        agents={['agent1']}
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(document.activeElement).toBe(triggerBtn)

    document.body.removeChild(triggerBtn)
  })
})
