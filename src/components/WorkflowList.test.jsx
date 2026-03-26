import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkflowList from './WorkflowList'
import { listEvents } from '../api'

vi.mock('../api', () => ({
  listEvents: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    creds: { type: 'token', token: 'abc' },
    can: (permission) => permission === 'events:read',
  }),
}))

function makeSession({ brief, sessionId, isNoop = false, isHook = false }) {
  return JSON.stringify({
    data: {
      brief,
      state: 'active',
      session_id: sessionId,
      event_id: `event-${sessionId}`,
      is_noop: isNoop,
      is_hook: isHook,
    },
    labels: {
      start: '2026-03-26T10:00:00.000Z',
      status: 'success',
      cursor: '0',
    },
    performing: [],
  })
}

async function flushAsyncWork() {
	await act(async () => {
		await Promise.resolve()
		await Promise.resolve()
	})
}

describe('WorkflowList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('uses the expected look_back windows for initial load, polling, and fetch more', async () => {
	vi.useFakeTimers()

    listEvents
      .mockResolvedValueOnce([
        'session_stream_2026032508',
        'session_stream_2026032610',
        makeSession({ brief: 'regular session', sessionId: 'sess-1' }),
      ])
      .mockResolvedValueOnce([
        'session_stream_2026032608',
        'session_stream_2026032610',
        makeSession({ brief: 'regular session', sessionId: 'sess-1' }),
      ])
      .mockResolvedValueOnce([
        'session_stream_2026032502',
        'session_stream_2026032508',
        makeSession({ brief: 'older session', sessionId: 'sess-2' }),
      ])

    render(<WorkflowList />)
	await flushAsyncWork()

	expect(listEvents).toHaveBeenCalledWith({ type: 'token', token: 'abc' }, { lookBack: 12, asOf: '' })

    expect(screen.getByRole('button', { name: /fetch more/i })).toBeEnabled()

    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
	await flushAsyncWork()

	expect(listEvents).toHaveBeenNthCalledWith(2, { type: 'token', token: 'abc' }, { lookBack: 2, asOf: '' })

    fireEvent.click(screen.getByRole('button', { name: /fetch more/i }))
	await flushAsyncWork()

	expect(listEvents).toHaveBeenNthCalledWith(3, { type: 'token', token: 'abc' }, { lookBack: 6, asOf: '2026032508' })

    expect(screen.getByText('older session')).toBeInTheDocument()
  })

  it('hides no-op and hook sessions by default and reveals them when toggled', async () => {
    listEvents.mockResolvedValue([
      'session_stream_2026032508',
      'session_stream_2026032610',
      makeSession({ brief: 'regular session', sessionId: 'sess-1' }),
      makeSession({ brief: 'noop session', sessionId: 'sess-2', isNoop: true }),
      makeSession({ brief: 'hook session', sessionId: 'sess-3', isHook: true }),
    ])

    render(<WorkflowList />)

    expect(await screen.findByText('regular session')).toBeInTheDocument()
    expect(screen.queryByText('noop session')).not.toBeInTheDocument()
    expect(screen.queryByText('hook session')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Show no-ops'))
    fireEvent.click(screen.getByLabelText('Show hooks'))

    expect(await screen.findByText('noop session')).toBeInTheDocument()
    expect(await screen.findByText('hook session')).toBeInTheDocument()
  })

  it('shows the last refreshed timestamp after a successful load', async () => {
    listEvents.mockResolvedValue([
      'session_stream_2026032508',
      'session_stream_2026032610',
      makeSession({ brief: 'regular session', sessionId: 'sess-1' }),
    ])

    render(<WorkflowList />)

    expect(screen.getByText(/last refreshed: never/i)).toBeInTheDocument()
    await screen.findByText('regular session')
    await waitFor(() => {
      expect(screen.queryByText(/last refreshed: never/i)).not.toBeInTheDocument()
    })
  })
})
