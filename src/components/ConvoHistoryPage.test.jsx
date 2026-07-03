import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import ConvoHistoryPage from './ConvoHistoryPage'

const mockGetConvoHistory = vi.fn()
const mockListEngines = vi.fn()
const mockStartTurn = vi.fn()

vi.mock('../api', () => ({
  getConvoHistory: (...args) => mockGetConvoHistory(...args),
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

describe('ConvoHistoryPage', () => {
  beforeEach(() => {
    mockGetConvoHistory.mockReset()
    mockListEngines.mockReset()
    mockListEngines.mockResolvedValue([])
    mockStartTurn.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders loading state on initial fetch', () => {
    // Never-resolving promise keeps loading state
    mockGetConvoHistory.mockReturnValue(new Promise(() => {}))

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
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Thinking...', ToolCalls: [{ FuncName: 'test_func' }] },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      // Agent with ToolCalls should be hidden when showTools is false (default)
      expect(bubbles).toHaveLength(1)
      expect(bubbles[0]).toHaveAttribute('data-role', 'user')
    })

    // Enable show tools
    fireEvent.click(screen.getByLabelText('Show tools'))

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      expect(bubbles).toHaveLength(2)
      expect(bubbles[1]).toHaveAttribute('data-show-tools', 'true')
    })
  })

  it('show thoughts toggle controls thought visibility on messages', async () => {
    const messages = makeMessages([
      { Role: 'agent', content: 'Response' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      expect(bubbles[0]).toHaveAttribute('data-show-thoughts', 'false')
    })

    fireEvent.click(screen.getByLabelText('Show thoughts'))

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      expect(bubbles[0]).toHaveAttribute('data-show-thoughts', 'true')
    })
  })

  it('pause/resume button appears for active convos and toggles', async () => {
    // Active convo: last message is from user (waiting for agent to respond)
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Let me think...' },
      { Role: 'user', content: 'Any update?' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    })

    // Toggle pause
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
  })

  it('pause/resume button appears for active convos with pending tool calls', async () => {
    // Active convo: agent message has tool calls but not all results yet
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Working on it...', ToolCalls: [{ FuncName: 'search' }, { FuncName: 'fetch' }], ToolResult: [{ data: 'result1' }] },
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
    // Active: last message from user, waiting for agent
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Let me check...' },
      { Role: 'user', content: 'Any update?' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Start a new turn…')).not.toBeInTheDocument()
    })
  })

  it('completed convo with agent-last message does NOT show polling', async () => {
    // Completed convo: agent finished its response (no pending tool calls)
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
    // Completed convo: agent finished, user can start a new turn
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
})
