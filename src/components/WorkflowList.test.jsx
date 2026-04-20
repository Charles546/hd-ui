import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import WorkflowList from './WorkflowList'

const mockListEvents = vi.fn()
const mockRerunEventSession = vi.fn()
const mockPauseEventSession = vi.fn()
const mockResumeEventSession = vi.fn()
const mockCancelEventSession = vi.fn()

vi.mock('../api', () => ({
	listEvents: (...args) => mockListEvents(...args),
	rerunEventSession: (...args) => mockRerunEventSession(...args),
	pauseEventSession: (...args) => mockPauseEventSession(...args),
	resumeEventSession: (...args) => mockResumeEventSession(...args),
	cancelEventSession: (...args) => mockCancelEventSession(...args),
}))

vi.mock('../auth/AuthContext', () => ({
	useAuth: () => ({
		creds: { type: 'token', token: 'test' },
		can: () => true,
	}),
}))

vi.mock('./SessionCard', () => ({
	default: ({ session, onRerunSession, onPauseSession, onResumeSession, onCancelSession }) => (
		<div>
			<div>{session?.data?.brief || 'session'}</div>
			{session?.data?.rerun?.available && typeof onRerunSession === 'function' && (
				<button onClick={() => onRerunSession({ sessionID: session?.data?.session_id || '' })}>
					Rerun {session?.data?.brief || 'session'}
				</button>
			)}
			{session?.data?.state === 'active' && typeof onPauseSession === 'function' && (
				<button onClick={() => onPauseSession({ sessionID: session?.data?.session_id || '' })}>
					Pause {session?.data?.brief || 'session'}
				</button>
			)}
			{session?.data?.state === 'paused' && typeof onResumeSession === 'function' && (
				<button onClick={() => onResumeSession({ sessionID: session?.data?.session_id || '' })}>
					Resume {session?.data?.brief || 'session'}
				</button>
			)}
			{(session?.data?.state === 'active' || session?.data?.state === 'paused') && typeof onCancelSession === 'function' && (
				<button onClick={() => onCancelSession({ sessionID: session?.data?.session_id || '' })}>
					Cancel {session?.data?.brief || 'session'}
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
		mockPauseEventSession.mockReset()
		mockResumeEventSession.mockReset()
		mockCancelEventSession.mockReset()
		vi.spyOn(window, 'confirm').mockReturnValue(true)
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

	it('pauses, resumes, and cancels sessions and refreshes list', async () => {
		mockListEvents.mockResolvedValueOnce([
			{ ...makeSession('6', 'active session', { isNoop: false, status: 'success' }), data: { ...makeSession('6', 'active session').data, state: 'active' } },
			{ ...makeSession('7', 'paused session', { isNoop: false, status: 'success' }), data: { ...makeSession('7', 'paused session').data, state: 'paused' } },
		])
		mockListEvents.mockResolvedValue([])
		mockPauseEventSession.mockResolvedValue({})
		mockResumeEventSession.mockResolvedValue({})
		mockCancelEventSession.mockResolvedValue({})

		render(<WorkflowList />)

		await waitFor(() => expect(screen.getByText('active session')).toBeInTheDocument())
		await userEvent.click(screen.getByRole('button', { name: /pause active session/i }))
		await userEvent.click(screen.getByRole('button', { name: /resume paused session/i }))
		await userEvent.click(screen.getByRole('button', { name: /cancel active session/i }))

		await waitFor(() => {
			expect(mockPauseEventSession).toHaveBeenCalledTimes(1)
			expect(mockResumeEventSession).toHaveBeenCalledTimes(1)
			expect(mockCancelEventSession).toHaveBeenCalledTimes(1)
		})
	})
})
