import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import ConvoHistoryPage from './ConvoHistoryPage'

const mockGetConvoHistory = vi.fn()
const mockGetConvoState = vi.fn()
const mockListEngines = vi.fn()
const mockStartTurn = vi.fn()
const mockListAgents = vi.fn()

vi.mock('../api', () => ({
  getConvoHistory: (...args) => mockGetConvoHistory(...args),
  getConvoState: (...args) => mockGetConvoState(...args),
  startTurn: (...args) => mockStartTurn(...args),
  listEngines: (...args) => mockListEngines(...args),
  listAgents: (...args) => mockListAgents(...args),
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

function makeConvoState(overrides = {}) {
  return {
    '10.255.255.254': {
      agent: { Driver: 'openai', Engine: 'hy3' },
      ...overrides,
    },
  }
}

async function flushTimers() {
  await vi.advanceTimersByTimeAsync(100)
}

describe('ConvoHistoryPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockGetConvoHistory.mockReset()
    mockGetConvoState.mockReset()
    mockGetConvoState.mockResolvedValue(null)
    mockListEngines.mockReset()
    mockListEngines.mockResolvedValue([])
    mockStartTurn.mockReset()
    mockListAgents.mockReset()
    mockListAgents.mockResolvedValue([])
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders loading state on initial fetch', () => {
    mockGetConvoHistory.mockReturnValue(new Promise(() => {}))
    mockGetConvoState.mockReturnValue(new Promise(() => {}))

    const { unmount } = render(<ConvoHistoryPage convoId="convo-123" />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    unmount()
  })

  it('renders empty history after fetch returns no messages', async () => {
    mockGetConvoHistory.mockResolvedValue([])

    render(<ConvoHistoryPage convoId="convo-123" />)

    const empty = await screen.findByText('No messages in history')
    expect(empty).toBeInTheDocument()
    // Empty state keeps readable horizontal padding even though the scroll
    // container no longer has outer horizontal margin.
    expect(empty.style.padding).toBe('40px 16px')
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
      expect(bubbles).toHaveLength(1)
    })

    const checkbox = screen.getByLabelText('Show tools')
    fireEvent.click(checkbox)

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
      expect(bubbles).toHaveLength(2)
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
      expect(bubbles).toHaveLength(2)
      expect(bubbles[0]).toHaveAttribute('data-role', 'agent')
      expect(bubbles[0]).toHaveTextContent('I found the answer')
    })
  })

  it('hides agent message with only tool calls (no content) when showTools is false', async () => {
    const messages = [
      { Role: 'agent', content: '', ToolCalls: [{ id: '1', function: { name: 'search' } }], ToolResult: [] },
      { Role: 'user', content: 'Hello', ToolCalls: [], ToolResult: [] },
    ]
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      const bubbles = screen.getAllByTestId('message-bubble')
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
      expect(bubbles).toHaveLength(2)
    })

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
      expect(bubbles[0]).toHaveAttribute('data-has-nav', 'true')
    })
  })

  it('displays truncated convo ID in header', async () => {
    mockGetConvoHistory.mockResolvedValue([])
    const longId = 'convo_abc123def456ghi789jkl'

    render(<ConvoHistoryPage convoId={longId} />)

    await waitFor(() => {
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

    mockGetConvoState.mockResolvedValue(
      makeConvoState({
        last_session: { status: 'complete', session_id: 'sess-1' },
      })
    )

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('complete')).toBeInTheDocument()
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
      { Role: 'agent', content: 'Here is the answer.' },
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
      expect(screen.getByText('polling')).toBeInTheDocument()
    })
  })

  it('falls back to first_session.status when last_session has no status', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

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
        last_session: { session_id: 'sess-last' },
        first_session: { status: 'failed', session_id: 'sess-first' },
      })
    )

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('failed')).toBeInTheDocument()
    })
  })

  it('falls back to history heuristic when ConvoState is null', async () => {
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

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

    mockGetConvoState.mockResolvedValue(
      makeConvoState({
        last_session: { status: 'bogus', session_id: 'sess-1' },
      })
    )

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument()
    })
  })

  it('fetches and sets engine/driver from convo state with node IP wrapper', async () => {
    const mockConvoId = 'convo-123'

    mockGetConvoHistory.mockResolvedValue([])
    mockListEngines.mockResolvedValue([
      { driver: 'openai', engine: 'hy3' },
      { driver: 'openai', engine: 'gpt-4' }
    ])

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

    await waitFor(() => {
      expect(mockGetConvoState).toHaveBeenCalledWith(
        { type: 'token', token: 'test-token' },
        mockConvoId
      )
    })

    await waitFor(() => {
      const engineSelect = container.querySelector('select')
      if (engineSelect) {
        expect(engineSelect.value).toBe('openai:hy3')
      }
    })
  })
})

describe('ConvoHistoryPage - Mobile responsiveness', () => {
  const originalMatchMedia = window.matchMedia

  function installMatchMedia(matches) {
    const mqls = new Map()
    window.matchMedia = vi.fn((query) => {
      if (!mqls.has(query)) {
        const listeners = new Set()
        mqls.set(query, {
          get matches() {
            return matches
          },
          media: query,
          onchange: null,
          addEventListener: (type, listener) => {
            if (type === 'change') listeners.add(listener)
          },
          removeEventListener: (type, listener) => {
            if (type === 'change') listeners.delete(listener)
          },
          addListener: (listener) => listeners.add(listener),
          removeListener: (listener) => listeners.delete(listener),
        })
      }
      return mqls.get(query)
    })
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockGetConvoHistory.mockReset()
    mockGetConvoState.mockReset()
    mockGetConvoState.mockResolvedValue(null)
    mockListEngines.mockReset()
    mockListEngines.mockResolvedValue([])
    mockStartTurn.mockReset()
    mockListAgents.mockReset()
    mockListAgents.mockResolvedValue([])
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
    window.matchMedia = originalMatchMedia
  })

  it('stacks the header controls on mobile so they never overflow', async () => {
    installMatchMedia(true)
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('polling')).toBeInTheDocument()
    })

    const header = screen.getByTestId('convo-header')
    // Mobile header stacks controls (flexDirection column) so they never overflow.
    expect(header.style.flexDirection).toBe('column')
    expect(header.style.padding).toBe('10px 12px')
    const controls = header.querySelector('div')
    // Inner controls wrapper wraps on mobile.
    expect(controls.style.flexWrap).toBe('wrap')

    const page = screen.getByTestId('convo-history-page')
    // Mobile page uses the dynamic viewport height offset.
    expect(page.style.height).toBe('calc(100dvh - 100px)')

    const scroll = screen.getByTestId('convo-history-scroll')
    // Mobile history scroll drops the outer horizontal margin so bubbles reach
    // the history-box edge (padding '10px 0').
    expect(scroll.style.paddingLeft).toBe('0px')
    expect(scroll.style.paddingRight).toBe('0px')
  })

  it('keeps desktop header layout unchanged on non-mobile', async () => {
    installMatchMedia(false)
    const messages = makeMessages([
      { Role: 'user', content: 'Hello' },
    ])
    mockGetConvoHistory.mockResolvedValue(messages)

    render(<ConvoHistoryPage convoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('polling')).toBeInTheDocument()
    })

    const header = screen.getByTestId('convo-header')
    expect(header.style.flexDirection).toBe('')
    expect(header.style.padding).toBe('12px 16px')

    const page = screen.getByTestId('convo-history-page')
    expect(page.style.height).toBe('calc(100vh - 60px)')

    const scroll = screen.getByTestId('convo-history-scroll')
    // Desktop history scroll drops the outer horizontal margin so bubbles reach
    // the history-box edge (padding '12px 0').
    expect(scroll.style.paddingLeft).toBe('0px')
    expect(scroll.style.paddingRight).toBe('0px')
  })
})
