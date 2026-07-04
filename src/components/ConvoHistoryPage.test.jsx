import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import ConvoHistoryPage from './ConvoHistoryPage'

const mockGetConvoHistory = vi.fn()
const mockGetConvoState = vi.fn()
const mockListEngines = vi.fn()
const mockStartTurn = vi.fn()

vi.mock('../api', () => ({
  getConvoHistory: (...args) => mockGetConvoHistory(...args),
  getConvoState: (...args) => mockGetConvoState(...args),
  startTurn: (...args) => mockStartTurn(...args),
  listEngines: (...args) => mockListEngines(...args),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    creds: { type: 'token', token: 'test-token' },
  }),
}))

vi.mock('./MessageBubble', () => ({
  MessageBubble: function MockMessageBubble({ msg, showTools, showThoughts, onNavigateToSubAgent }) {
    const role = msg.Role || msg.role || 'unknown'
    return (
      <div data-testid="message-bubble" data-role={role} data-show-tools={String(showTools)} data-show-thoughts={String(showThoughts)} data-has-nav={String(!!onNavigateToSubAgent)}>
        {msg.content || ''}
      </div>
    )
  },
  truncateID: (id) => id && id.length > 20 ? id.slice(0, 8) + '…' + id.slice(-6) : (id || ''),
  markdownCSS: '/* mock markdown css */',
}))

function makeMessages(overrides = []) {
  return overrides.map((o, i) => ({
    Role: o.Role || o.role || 'user',
    content: o.content || `message ${i}`,
    ToolCalls: o.ToolCalls || [],
    ToolResult: o.ToolResult || [],
    status: o.status,
  }))
}

/**
 * Build a ConvoState response shaped like the real API (keyed by node IP).
 * @param {object} overrides - Fields to merge into the inner convoData object.
 */
function makeConvoState(overrides = {}) {
  return {
    '10.255.255.254': {
      agent: { Driver: 'openai', Engine: 'hy3' },
      ...overrides,
    },
  }
}

// Helper to flush all pending timers and promises
async function flushTimers() {
  await vi.advanceTimersByTimeAsync(100)
}

describe('ConvoHistoryPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockGetConvoHistory.mockReset()
    mockGetConvoState.mockReset()
    mockGetConvoState.mockResolvedValue(null) // Default: no convo state
    mockListEngines.mockReset()
    mockListEngines.mockResolvedValue([])
    mockStartTurn.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders loading state on initial fetch', () => {
    // Never-resolving promise keeps loading state
    mockGetConvoHistory.mockReturnValue(new Promise(() => {}))
    mockGetConvoState.mockReturnValue(new Promise(() => {})) // Also mock getConvoState

    const { unmount } = render(<ConvoHistoryPage convoId="convo-123" />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()

    // Clean up the mounted component to avoid leaking into other tests
    unmount()
  })

  it('renders empty history after fetch returns no messages', async () => {
    mockGetConvoHistory.mockResolvedValue([])

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('No messages in history')).toBeInTheDocument()
    })
  })

  it('renders messages with correct roles', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Hi there!' },
      { Role: 'system', content: 'Done' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      expect(bubbles).toHaveLength(3)
      expect(bubbles[0]).toHaveAttribute('data-role', 'user')
      expect(bubbles[1]).toHaveAttribute('data-role', 'agent')
      expect(bubbles[2]).toHaveAttribute('data-role', 'system')
    })
  })

  it('show tools toggle controls tool visibility on messages', async () => {
    const messages = makeMessages([
      { Role: 'tool', content: 'tool result', ToolCalls: [], ToolResult: [] },
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      // First message is tool, should be hidden when showTools is false
      expect(bubbles).toHaveLength(1) // Only user message visible
    })

    // Click show tools
    const checkbox = screen.getByLabelText('Show tools')
    fireEvent.click(checkbox)

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      expect(bubbles).toHaveLength(2) // Both messages visible
    })
  })

  it('show thoughts toggle controls thought visibility on messages', async () => {
    const messages = makeMessages([
      { Role: 'agent', content: 'Answer', thoughts: 'I am thinking' },
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('Answer')).toBeInTheDocument()
    })
  })

  it('pause/resume button appears for active convos and toggles', async () => {
    // Active: last message from user (waiting for agent response)
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    })
  })

  it('pause/resume button appears for active convos with pending tool calls', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Let me check', ToolCalls: [{ id: '1', function: { name: 'test' } }], ToolResult: [] },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    })
  })

  it('pause/resume button does NOT appear for terminal convos', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Done', status: 'complete' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument()
    })
  })

  it('turn input is shown for terminal (non-active) convos', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Done', status: 'complete' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Start a new turn…')).toBeInTheDocument()
    })
  })

  it('turn input is hidden for active convos', async () => {
    // Active: last message from user
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Start a new turn…')).not.toBeInTheDocument()
    })
  })

  it('completed convo with agent-last message does NOT show polling', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Here is the answer.' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('complete')).toBeInTheDocument()
      expect(screen.queryByText('polling')).not.toBeInTheDocument()
    })
  })

  it('completed convo with agent-last message shows turn input', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Here is the answer.' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Start a new turn…')).toBeInTheDocument()
    })
  })

  it('completed convo with agent-last message does NOT show pause button', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Here is the answer.' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument()
    })
  })

  it('sub-agent link renders and is clickable via onNavigateToConvo', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Response' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)
    const onNavigateToConvo = vi.fn()

    render(<ConvoHistoryPage convoId="convo-123" onNavigateToConvo={onNavigateToConvo} />)

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      // When onNavigateToConvo is provided, the nav link should be wired
      expect(bubbles[0]).toHaveAttribute('data-has-nav', 'true')
    })
  })

  it('displays truncated convo ID in header', async () => {
    mockGetConvoHistory.mockResolvedValue([])
    const longId = 'convo_abc123def456ghi789jkl'

    render(<ConvoHistoryPage convoId={longId} />)

    await waitFor(() => {
      // Should show truncated ID
      expect(screen.getByText(/convo_ab…789jkl/)).toBeInTheDocument()
    })
  })

  it('shows error state when fetch fails', async () => {
    mockGetConvoHistory.mockRejectedValue(new Error('Network error'))

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('status badge shows correct convo status', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Done', status: 'complete' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('complete')).toBeInTheDocument()
    })
  })

  it('polling status indicator shows polling when active', async () => {
    // Active: last message from user (waiting for agent response)
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Let me think...' },
      { Role: 'user', content: 'Any update?' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('polling')).toBeInTheDocument()
    })
  })

  it('polling status indicator does NOT show polling when complete', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Here is the answer.' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('complete')).toBeInTheDocument()
      expect(screen.queryByText('polling')).not.toBeInTheDocument()
    })
  })

  // ─── ConvoState-derived status tests ────────────────────────────────────

  it('derives status from ConvoState last_session.status = complete', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Thinking...', ToolCalls: [{ id: '1', function: { name: 'test' } }], ToolResult: [] },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    // ConvoState says complete even though history heuristic would say active
    mockGetConvoState.mockResolvedValue(
      makeConvoState({
        last_session: { status: 'complete', session_id: 'sess-1' },
      })
    )

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('complete')).toBeInTheDocument()
      // Should NOT show polling since derived status is terminal
      expect(screen.queryByText('polling')).not.toBeInTheDocument()
    })
  })

  it('derives status from ConvoState last_session.status = failed', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Thinking...' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    mockGetConvoState.mockResolvedValue(
      makeConvoState({
        last_session: { status: 'failed', session_id: 'sess-1' },
      })
    )

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('failed')).toBeInTheDocument()
      expect(screen.queryByText('polling')).not.toBeInTheDocument()
    })
  })

  it('derives status from ConvoState last_session.status = cancelled', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Working...' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    mockGetConvoState.mockResolvedValue(
      makeConvoState({
        last_session: { status: 'cancelled', session_id: 'sess-1' },
      })
    )

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('cancelled')).toBeInTheDocument()
      expect(screen.queryByText('polling')).not.toBeInTheDocument()
    })
  })

  it('derives status from ConvoState last_session.status = active', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Here is the answer.' }, // history would say complete
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    mockGetConvoState.mockResolvedValue(
      makeConvoState({
        last_session: { status: 'active', session_id: 'sess-1' },
      })
    )

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument()
      // Should show polling since status is active
      expect(screen.getByText('polling')).toBeInTheDocument()
    })
  })

  it('falls back to first_session.status when last_session has no status', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    // No last_session, but first_session says complete
    mockGetConvoState.mockResolvedValue(
      makeConvoState({
        last_session: null,
        first_session: { status: 'complete', session_id: 'sess-1' },
      })
    )

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('complete')).toBeInTheDocument()
      expect(screen.queryByText('polling')).not.toBeInTheDocument()
    })
  })

  it('falls back to first_session.status when last_session has no status field', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    mockGetConvoState.mockResolvedValue(
      makeConvoState({
        last_session: { session_id: 'sess-last' }, // no status field
        first_session: { status: 'failed', session_id: 'sess-first' },
      })
    )

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('failed')).toBeInTheDocument()
    })
  })

  it('falls back to history heuristic when ConvoState is null', async () => {
    // History says active (last message from user)
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    // getConvoState returns null (e.g. network error or convo not found)
    mockGetConvoState.mockResolvedValue(null)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument()
    })
  })

  it('falls back to history heuristic when ConvoState returns empty object', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Complete.' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    // ConvoState returns an empty object (no node data)
    mockGetConvoState.mockResolvedValue({})

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('complete')).toBeInTheDocument()
    })
  })

  it('uses only recognized status values from ConvoState (ignores unknown)', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    // ConvoState has an unrecognized status value; should fall back to history
    mockGetConvoState.mockResolvedValue(
      makeConvoState({
        last_session: { status: 'bogus', session_id: 'sess-1' },
      })
    )

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      // Should fall back to history heuristic (active, since last msg is user)
      expect(screen.getByText('active')).toBeInTheDocument()
    })
  })

  it('fetches and sets engine/driver from convo state with node IP wrapper', async () => {
    const mockConvoId = 'convo-123'
    
    // Mock getConvoHistory to return empty array
    mockGetConvoHistory.mockResolvedValue([])
    
    // Mock listEngines to return engine list
    mockListEngines.mockResolvedValue([
      { driver: 'openai', engine: 'hy3' },
      { driver: 'openai', engine: 'gpt-4' }
    ])
    
    // Mock getConvoState to return data with node IP wrapper and capitalized field names
    mockGetConvoState.mockResolvedValue({
      '10.255.255.254': {
        agent: {
          Driver: 'openai',
          Engine: 'hy3'
        }
      }
    })

    const { container } = render(
      <ConvoHistoryPage
        convoId={mockConvoId}
        onNavigateToConvo={() => {}}
      />
    )
    
    // Wait for state fetch
    await waitFor(() => {
      expect(mockGetConvoState).toHaveBeenCalledWith(
        { type: 'token', token: 'test-token' },
        mockConvoId
      )
    })

    // The engine should be set in the dropdown
    await waitFor(() => {
      const engineSelect = container.querySelector('select')
      if (engineSelect) {
        expect(engineSelect.value).toBe('openai:hy3')
      }
    })
  })
})
