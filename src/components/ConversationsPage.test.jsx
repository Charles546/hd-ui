import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import ConversationsPage from './ConversationsPage'

// Mock API functions
const mockListConvos = vi.fn()
const mockGetConvoHistory = vi.fn()
const mockGetConvoState = vi.fn()
const mockCancelConvo = vi.fn()
const mockStartTurn = vi.fn()
const mockStartNewConvo = vi.fn()
const mockListAgents = vi.fn()
const mockListEngines = vi.fn()

vi.mock('../api', () => ({
  listConvos: (...args) => mockListConvos(...args),
  getConvoHistory: (...args) => mockGetConvoHistory(...args),
  getConvoState: (...args) => mockGetConvoState(...args),
  cancelConvo: (...args) => mockCancelConvo(...args),
  startTurn: (...args) => mockStartTurn(...args),
  startNewConvo: (...args) => mockStartNewConvo(...args),
  listAgents: (...args) => mockListAgents(...args),
  listEngines: (...args) => mockListEngines(...args),
}))

const mockCreds = { type: 'token', token: 'test-token' }
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ creds: mockCreds }),
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

vi.mock('./TurnInputArea', () => ({
  default: function MockTurnInputArea({ onSubmit, isSending, placeholder, buttonLabel, inputHeight, engines, selectedEngine, onEngineChange }) {
    return (
      <div data-testid="turn-input-area">
        <textarea data-testid="turn-input" placeholder={placeholder} />
        <button data-testid="send-btn" onClick={() => onSubmit('test message', selectedEngine, '')} disabled={isSending}>
          {buttonLabel}
        </button>
        <select data-testid="engine-select" value={selectedEngine} onChange={(e) => onEngineChange(e.target.value)}>
          <option value="">Default</option>
          {engines?.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
    )
  },
}))

vi.mock('./NewConvoInput', () => ({
  default: function MockNewConvoInput({ agents, selectedAgent, onAgentChange, engines, selectedEngine, onEngineChange, onSend, isSending, inputHeight }) {
    return (
      <div data-testid="new-convo-input">
        <select data-testid="agent-select" value={selectedAgent} onChange={(e) => onAgentChange(e.target.value)}>
          {agents?.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <textarea data-testid="new-convo-text" placeholder="Type your first message" />
        <button data-testid="new-convo-send" onClick={() => onSend(selectedAgent, 'test message', selectedEngine, '')} disabled={isSending}>
          Send
        </button>
      </div>
    )
  },
}))

vi.mock('../utils/convoAgentStore', () => ({
  getLastKnownAgent: vi.fn(() => 'test-agent'),
  setLastKnownAgent: vi.fn(),
  clearLastKnownAgent: vi.fn(),
}))

// Mock createPortal for AgentPickerModal
vi.mock('react-dom', () => ({
  createPortal: (children) => children,
}))

async function flushTimers() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100)
  })
}

describe('ConversationsPage - Conversation Recovery Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockListConvos.mockReset()
    mockListConvos.mockResolvedValue([])
    mockGetConvoHistory.mockReset()
    mockGetConvoHistory.mockResolvedValue([])
    mockGetConvoState.mockReset()
    mockGetConvoState.mockResolvedValue(null)
    mockCancelConvo.mockReset()
    mockCancelConvo.mockResolvedValue({})
    mockStartTurn.mockReset()
    mockStartNewConvo.mockReset()
    mockListAgents.mockReset()
    mockListAgents.mockResolvedValue(['agent1', 'agent2'])
    mockListEngines.mockReset()
    mockListEngines.mockResolvedValue(['openai:gpt-4o'])
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows AgentPickerModal when startTurn returns conversation_expired', async () => {
    // Setup: return a conversation list with one conversation
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])

    // Mock startTurn to return conversation_expired error
    mockStartTurn.mockResolvedValue({
      ok: false,
      error: 'conversation_expired',
      message: 'please select an agent',
    })

    render(<ConversationsPage />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    // Click on the conversation to select it
    const convoCard = screen.getByText('convo-123')
    fireEvent.click(convoCard)

    // Wait for history to load
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Start a new turn…')).toBeInTheDocument()
    })

    // Type a message and send
    const textarea = screen.getByTestId('turn-input')
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    const sendBtn = screen.getByTestId('send-btn')
    fireEvent.click(sendBtn)

    // Wait for the API call
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })

    // The AgentPickerModal should appear
    await waitFor(() => {
      expect(screen.getByText('Select an agent to revive this conversation')).toBeInTheDocument()
    })

    expect(screen.getByRole('radio', { name: 'agent1' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'agent2' })).toBeInTheDocument()
  })

  it('retries with agent_override=true when agent is selected from picker', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])

    // First call returns conversation_expired, second call succeeds
    mockStartTurn
      .mockResolvedValueOnce({
        ok: false,
        error: 'conversation_expired',
        message: 'please select an agent',
      })
      .mockResolvedValueOnce({ ok: true, data: { agent: 'agent2' } })

    render(<ConversationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    const convoCard = screen.getByText('convo-123')
    fireEvent.click(convoCard)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Start a new turn…')).toBeInTheDocument()
    })

    const textarea = screen.getByTestId('turn-input')
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    const sendBtn = screen.getByTestId('send-btn')
    fireEvent.click(sendBtn)

    await act(async () => { await vi.advanceTimersByTimeAsync(200) })

    // Modal appears
    await waitFor(() => {
      expect(screen.getByText('Select an agent to revive this conversation')).toBeInTheDocument()
    })

    // Select agent2
    fireEvent.click(screen.getByRole('radio', { name: 'agent2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revive Conversation' }))

    await act(async () => { await vi.advanceTimersByTimeAsync(200) })

    // Verify startTurn was called again with agent_override=true
    expect(mockStartTurn).toHaveBeenCalledTimes(2)
    const secondCall = mockStartTurn.mock.calls[1]
    expect(secondCall[5]).toBe('agent2') // agent parameter
    expect(secondCall[6]).toBe(true)    // agentOverride parameter
  })

  it('shows error when user cancels agent picker', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])

    mockStartTurn.mockResolvedValue({
      ok: false,
      error: 'conversation_expired',
      message: 'please select an agent',
    })

    render(<ConversationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    const convoCard = screen.getByText('convo-123')
    fireEvent.click(convoCard)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Start a new turn…')).toBeInTheDocument()
    })

    const textarea = screen.getByTestId('turn-input')
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    const sendBtn = screen.getByTestId('send-btn')
    fireEvent.click(sendBtn)

    await act(async () => { await vi.advanceTimersByTimeAsync(200) })

    // Modal appears
    await waitFor(() => {
      expect(screen.getByText('Select an agent to revive this conversation')).toBeInTheDocument()
    })

    // Click cancel
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await act(async () => { await vi.advanceTimersByTimeAsync(200) })

    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText('Conversation expired. Select an agent to revive it.')).toBeInTheDocument()
    })
  })
})

describe('ConversationsPage - Mobile Drawer', () => {
  const originalMatchMedia = window.matchMedia

  // jsdom does not implement window.matchMedia. Install a controllable mock so
  // the useMediaQuery hook reports a mobile viewport when matches=true.
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
    mockListConvos.mockReset()
    mockListConvos.mockResolvedValue([])
    mockGetConvoHistory.mockReset()
    mockGetConvoHistory.mockResolvedValue([])
    mockGetConvoState.mockReset()
    mockGetConvoState.mockResolvedValue(null)
    mockCancelConvo.mockReset()
    mockCancelConvo.mockResolvedValue({})
    mockStartTurn.mockReset()
    mockStartNewConvo.mockReset()
    mockListAgents.mockReset()
    mockListAgents.mockResolvedValue(['agent1', 'agent2'])
    mockListEngines.mockReset()
    mockListEngines.mockResolvedValue(['openai:gpt-4o'])
    installMatchMedia(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
    window.matchMedia = originalMatchMedia
  })

  function getPanel() {
    return document.getElementById('conversation-list-panel')
  }

  it('auto-opens the drawer when no conversation is selected on mobile', async () => {
    render(<ConversationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    // Hamburger lives in the right column header on mobile.
    expect(screen.getByRole('button', { name: 'Open conversation list' })).toBeInTheDocument()

    // Drawer is open with backdrop visible.
    expect(getPanel().getAttribute('aria-hidden')).toBe('false')
    expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()
  })

  it('keeps the drawer closed when a conversation is selected and opens it via the hamburger', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])

    render(<ConversationsPage initialConvoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    // Drawer closed: hidden from accessibility tree, no backdrop.
    expect(getPanel().getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByTestId('conversation-drawer-backdrop')).not.toBeInTheDocument()

    // Hamburger toggles the drawer open.
    fireEvent.click(screen.getByRole('button', { name: 'Open conversation list' }))
    expect(getPanel().getAttribute('aria-hidden')).toBe('false')
    expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()

    // Hamburger reflects expanded state.
    expect(screen.getByRole('button', { name: 'Open conversation list' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes the drawer when the backdrop is tapped', async () => {
    render(<ConversationsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('conversation-drawer-backdrop'))

    expect(getPanel().getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByTestId('conversation-drawer-backdrop')).not.toBeInTheDocument()
  })

  it('closes the drawer when Escape is pressed', async () => {
    render(<ConversationsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(getPanel().getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByTestId('conversation-drawer-backdrop')).not.toBeInTheDocument()
  })

  it('selecting a conversation closes the drawer and reveals that conversation', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])

    render(<ConversationsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('convo-123'))

    // Drawer closed after selection.
    expect(getPanel().getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByTestId('conversation-drawer-backdrop')).not.toBeInTheDocument()

    // Conversation revealed in the right column.
    await waitFor(() => {
      expect(screen.getByText(/History —/)).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Start a new turn…')).toBeInTheDocument()
    })
  })

  it('going New switches to the new-convo view and closes the drawer', async () => {
    render(<ConversationsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '+ New' }))

    expect(getPanel().getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByTestId('conversation-drawer-backdrop')).not.toBeInTheDocument()
    expect(screen.getByText('New Conversation')).toBeInTheDocument()
  })

  it('keeps the static two-column layout on desktop with no drawer controls', async () => {
    installMatchMedia(false)
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])

    render(<ConversationsPage initialConvoId="convo-123" />)

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    // Panel is not treated as a hidden drawer on desktop.
    expect(getPanel().getAttribute('aria-hidden')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open conversation list' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('conversation-drawer-backdrop')).not.toBeInTheDocument()
  })
})
