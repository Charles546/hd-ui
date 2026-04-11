import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import WorkflowList from './WorkflowList'

const mockListEvents = vi.fn()
const mockRerunEventSession = vi.fn()

vi.mock('../api', () => ({
	listEvents: (...args) => mockListEvents(...args),
	rerunEventSession: (...args) => mockRerunEventSession(...args),
}))

vi.mock('../auth/AuthContext', () => ({
	useAuth: () => ({
		creds: { type: 'token', token: 'test' },
		can: () => true,
	}),
}))

vi.mock('./SessionCard', () => ({
	default: ({ session, onRerunSession }) => (
		<div>
			<div>{session?.data?.brief || 'session'}</div>
			{session?.data?.rerun?.available && typeof onRerunSession === 'function' && (
				<button onClick={() => onRerunSession({ sessionID: session?.data?.session_id || '' })}>
					Rerun {session?.data?.brief || 'session'}
				</button>
			)}
		</div>
	),
}))

function makeSession(id, brief, { isNoop = false, status = 'success', rerunAvailable = false } = {}) {
	return {
		data: {
			brief,
			event_id: `evt-${id}`,
			session_id: `sess-${id}`,
			is_noop: isNoop,
			rerun: { available: rerunAvailable },
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
		mockRerunEventSession.mockReset()
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

	it('reruns a session and refreshes the list', async () => {
		mockListEvents.mockResolvedValue([
			makeSession('5', 'rerunnable session', { isNoop: false, status: 'success', rerunAvailable: true }),
		])
		mockRerunEventSession.mockResolvedValue({ sessionID: 'sess-99', eventID: 'evt-99' })

		render(<WorkflowList />)

		await waitFor(() => expect(screen.getByText('rerunnable session')).toBeInTheDocument())
		await userEvent.click(screen.getByRole('button', { name: /rerun rerunnable session/i }))

		await waitFor(() => {
			expect(mockRerunEventSession).toHaveBeenCalledTimes(1)
			expect(screen.getByText(/Re-run started as session sess-99/i)).toBeInTheDocument()
		})
	})
})
