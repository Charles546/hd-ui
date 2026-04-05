import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import WorkflowList from './WorkflowList'

const mockListEvents = vi.fn()

vi.mock('../api', () => ({
	listEvents: (...args) => mockListEvents(...args),
}))

vi.mock('../auth/AuthContext', () => ({
	useAuth: () => ({
		creds: { type: 'token', token: 'test' },
		can: () => true,
	}),
}))

vi.mock('./SessionCard', () => ({
	default: ({ session }) => <div>{session?.data?.brief || 'session'}</div>,
}))

function makeSession(id, brief, { isNoop = false, status = 'success' } = {}) {
	return {
		data: {
			brief,
			event_id: `evt-${id}`,
			session_id: `sess-${id}`,
			is_noop: isNoop,
			state: 'done',
		},
		labels: {
			status,
			start: '2026-04-03T10:00:00.000Z',
		},
		performing: [],
	}
}

describe('WorkflowList no-op filtering', () => {
	beforeEach(() => {
		mockListEvents.mockReset()
	})

	it('hides successful no-op sessions by default', async () => {
		mockListEvents.mockResolvedValue([
			makeSession('1', 'regular session', { isNoop: false, status: 'success' }),
			makeSession('2', 'successful noop', { isNoop: true, status: 'success' }),
		])

		render(<WorkflowList />)

		await waitFor(() => expect(screen.getByText('regular session')).toBeInTheDocument())
		expect(screen.queryByText('successful noop')).not.toBeInTheDocument()
	})

	it('keeps failed and errored no-op sessions visible by default', async () => {
		mockListEvents.mockResolvedValue([
			makeSession('3', 'failed noop', { isNoop: true, status: 'failure' }),
			makeSession('4', 'errored noop', { isNoop: true, status: 'error' }),
		])

		render(<WorkflowList />)

		await waitFor(() => expect(screen.getByText('failed noop')).toBeInTheDocument())
		expect(screen.getByText('errored noop')).toBeInTheDocument()
	})
})
