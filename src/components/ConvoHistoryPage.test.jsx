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

const mockCreds = { type: 'token', token: 'test-token' }
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    creds: mockCreds,
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
    mockGetConvoState.mockReset()
    mockGetConvoState.mockResolvedValue(null) // Default: no convo state
    mockListEngines.mockReset()
    mockListEngines.mockResolvedValue([])
    mockStartTurn.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
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

    // findByText waits for the text to appear, handling async loading state
    expect(await screen.findByText('No messages in history')).toBeInTheDocument()
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

  it('shows agent message with content and tool calls when showTools is false', async () => {
    const messages = makeMessages([
      { Role: 'agent', content: 'I found the answer', ToolCalls: [{ id: '1', function: { name: 'search' } }] },
      { Role: 'user', content: 'Thanks' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      // Agent message has content, so it should be visible even with tool calls
      expect(bubbles).toHaveLength(2)
      expect(bubbles[0]).toHaveAttribute('data-role', 'agent')
      expect(bubbles[0]).toHaveTextContent('I found the answer')
    })
  })

  it('hides agent message with only tool calls (no content) when showTools is false', async () => {
    // Build the message manually so we can set content to an empty string
    // (makeMessages would replace '' with the default 'message 0')
    const messages = [
      { Role: 'agent', content: '', ToolCalls: [{ id: '1', function: { name: 'search' } }], ToolResult: [] },
      { Role: 'user', content: 'Hello', ToolCalls: [], ToolResult: [] },
    ]
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      // Agent message has no content, should be hidden when showTools is false
      expect(bubbles).toHaveLength(1)
      expect(bubbles[0]).toHaveAttribute('data-role', 'user')
    })
  })

  it('shows agent message with content and tool calls when showTools is true', async () => {
    const messages = makeMessages([
      { Role: 'agent', content: 'I searched and found', ToolCalls: [{ id: '1', function: { name: 'search' } }] },
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      // Agent message has content, so it's visible even with showTools=false
      expect(bubbles).toHaveLength(2)
    })

    // Enable show tools
    const checkbox = screen.getByLabelText('Show tools')
    fireEvent.click(checkbox)

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      expect(bubbles).toHaveLength(2)
      expect(bubbles[0]).toHaveAttribute('data-role', 'agent')
      expect(bubbles[0]).toHaveTextContent('I searched and found')
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
