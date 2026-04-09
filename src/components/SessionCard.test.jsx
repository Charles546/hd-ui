import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SessionCard from './SessionCard'

function makeSession(overrides = {}) {
  return {
    data: {
      brief: 'Test workflow',
      state: 'active',
      event_name: 'demo',
      event_id: 'evt-1',
      session_id: 'sess-1',
      ...overrides.data,
    },
    labels: {
      status: 'success',
      start: '2026-03-26T10:00:00.000Z',
      ...overrides.labels,
    },
    performing: overrides.performing || [],
    ...overrides,
  }
}

describe('SessionCard', () => {
  it('renders no-op and hook badges when flags are set', () => {
    render(
      <SessionCard
        session={makeSession({
          data: { is_noop: true, is_hook: true },
        })}
      />,
    )

    expect(screen.getByText('no-op')).toBeInTheDocument()
    expect(screen.getByText('hook')).toBeInTheDocument()
  })

  it('shows the bottom of the performing stack when collapsed and expands on demand', () => {
    render(
      <SessionCard
        session={makeSession({
          performing: ['step-1', 'step-2', 'step-3', 'step-4', 'step-5'],
        })}
      />,
    )

    expect(screen.queryByText('step-1')).not.toBeInTheDocument()
    expect(screen.queryByText('step-2')).not.toBeInTheDocument()
    expect(screen.getByText('step-3')).toBeInTheDocument()
    expect(screen.getByText('step-4')).toBeInTheDocument()
    expect(screen.getByText('step-5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show last 3/i }))

    expect(screen.getByText('step-1')).toBeInTheDocument()
    expect(screen.getByText('step-2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument()
  })

  it('shows log stream icon and calls handler with provider and pod ID', () => {
    const onOpenLogStream = vi.fn()

    render(
      <SessionCard
        session={makeSession({
          data: {
            log_stream: {
              provider: 'podman',
              pod_id: 'pod-xyz',
              gh_slug: 'org/repo',
              stream_token: 'signed-token',
            },
          },
        })}
        onOpenLogStream={onOpenLogStream}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '📜' }))

    expect(onOpenLogStream).toHaveBeenCalledWith({
      provider: 'podman',
      podID: 'pod-xyz',
      ghSlug: 'org/repo',
      streamToken: 'signed-token',
    })
  })
})
