import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react'
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

  it('divider pointer-drag resizes the turn composer strip and touch is enabled', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])

    const { container } = render(<ConversationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    const convoCard = screen.getByText('convo-123')
    fireEvent.click(convoCard)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Start a new turn…')).toBeInTheDocument()
    })

    // The divider uses pointer events + touch-action none so touch drag works,
    // and move/up listeners are attached to the divider element (not window) so
    // the drag continues even when the finger leaves the handle.
    const divider = screen.getByTestId('divider')
    expect(divider).not.toBeNull()
    expect(divider.style.touchAction).toBe('none')

    const composer = container.querySelector('[data-testid="convo-turn-input-area"]')
    expect(composer).not.toBeNull()
    // DEFAULT_INPUT_HEIGHT = 160
    expect(composer.style.height).toBe('160px')

    // Pointer-drag down by 50px -> height grows to 210px (drag uses clientY delta).
    fireEvent.pointerDown(divider, { clientY: 200 })
    fireEvent.pointerMove(divider, { clientY: 150 })
    expect(composer.style.height).toBe('210px')

    // Releasing clears the drag state without crashing.
    fireEvent.pointerUp(divider)
    expect(composer.style.height).toBe('210px')
  })

  it('touch-drag on the divider resizes the turn composer via the native non-passive touchmove override', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])

    const { container } = render(<ConversationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    const convoCard = screen.getByText('convo-123')
    fireEvent.click(convoCard)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Start a new turn…')).toBeInTheDocument()
    })

    const divider = screen.getByTestId('divider')
    const composer = container.querySelector('[data-testid="convo-turn-input-area"]')
    expect(composer.style.height).toBe('160px')

    // Finger down on the handle (touchstart -> beginDrag attaches the native,
    // non-passive touchmove listener on the divider element).
    fireEvent.touchStart(divider, { touches: [{ clientY: 200 }] })

    // Touch move: the native non-passive listener calls preventDefault() (the
    // robust scroll-capture override for iOS Safari) and resizes the composer.
    fireEvent.touchMove(divider, { touches: [{ clientY: 150 }], clientY: 150 })
    expect(composer.style.height).toBe('210px')

    // Finger lift clears the drag without crashing.
    fireEvent.touchEnd(divider)
    expect(composer.style.height).toBe('210px')
  })
})

describe('ConversationsPage - Mobile Drawer (App-controlled)', () => {
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

  it('renders the drawer closed when App passes isDrawerOpen=false', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])

    render(
      <ConversationsPage
        initialConvoId="convo-123"
        isDrawerOpen={false}
        onCloseDrawer={vi.fn()}
        allowNavCollapse
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    // Drawer closed: hidden from the accessibility tree, no backdrop, and no
    // page-level hamburger (the drawer now opens from the global NavBar).
    expect(getPanel().getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByTestId('conversation-drawer-backdrop')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open conversation list' })).not.toBeInTheDocument()
  })

  it('renders the drawer open when App passes isDrawerOpen=true', async () => {
    render(
      <ConversationsPage
        isDrawerOpen
        onCloseDrawer={vi.fn()}
        allowNavCollapse={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    // Drawer open: visible panel + backdrop.
    expect(getPanel().getAttribute('aria-hidden')).toBe('false')
    expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()
  })

  it('closes the drawer when the backdrop is tapped via onCloseDrawer', async () => {
    const onCloseDrawer = vi.fn()
    render(
      <ConversationsPage
        isDrawerOpen
        onCloseDrawer={onCloseDrawer}
        allowNavCollapse={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('conversation-drawer-backdrop'))
    expect(onCloseDrawer).toHaveBeenCalled()
  })

  it('closes the drawer when Escape is pressed via onCloseDrawer', async () => {
    const onCloseDrawer = vi.fn()
    render(
      <ConversationsPage
        isDrawerOpen
        onCloseDrawer={onCloseDrawer}
        allowNavCollapse={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCloseDrawer).toHaveBeenCalled()
  })

  it('selecting a conversation closes the drawer and reveals that conversation', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])
    const onCloseDrawer = vi.fn()

    render(
      <ConversationsPage
        isDrawerOpen
        onCloseDrawer={onCloseDrawer}
        allowNavCollapse={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('convo-123'))
    expect(onCloseDrawer).toHaveBeenCalled()

    // Conversation revealed in the right column.
    await waitFor(() => {
      expect(screen.getByText(/History —/)).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Start a new turn…')).toBeInTheDocument()
    })
  })

  it('going New closes the drawer and switches to the new-convo view', async () => {
    const onCloseDrawer = vi.fn()
    render(
      <ConversationsPage
        isDrawerOpen
        onCloseDrawer={onCloseDrawer}
        allowNavCollapse={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '+ New' }))
    expect(onCloseDrawer).toHaveBeenCalled()
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

    render(
      <ConversationsPage
        initialConvoId="convo-123"
        isDrawerOpen={false}
        onCloseDrawer={vi.fn()}
        allowNavCollapse={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    // Panel is not treated as a hidden drawer on desktop.
    expect(getPanel().getAttribute('aria-hidden')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open conversation list' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('conversation-drawer-backdrop')).not.toBeInTheDocument()

    // History scroll drops the outer horizontal margin so bubbles reach the
    // history-box edge (padding '12px 0').
    const scroll = screen.getByTestId('conversations-history-scroll')
    expect(scroll.style.paddingLeft).toBe('0px')
    expect(scroll.style.paddingRight).toBe('0px')

    // Empty state keeps readable horizontal padding even without the outer margin.
    const empty = screen.getByText('No messages in history')
    expect(empty.style.padding).toBe('40px 16px')
  })

  it('T1: shows all drawer header controls (+ New, Pause, Refresh, active badge) on mobile', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'active' },
      last_session: { status: 'active', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])

    render(
      <ConversationsPage
        initialConvoId="convo-123"
        isDrawerOpen
        onCloseDrawer={vi.fn()}
        allowNavCollapse={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()
    })

    // Drawer is open.
    expect(getPanel().getAttribute('aria-hidden')).toBe('false')

    // Every drawer header control is present and reachable (not clipped).
    const controls = within(screen.getByTestId('drawer-controls'))
    expect(controls.getByRole('button', { name: '+ New' })).toBeInTheDocument()
    expect(controls.getByRole('button', { name: '⏸ Pause' })).toBeInTheDocument()
    expect(controls.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
    // Status badge is visible inside the drawer header.
    expect(within(screen.getByTestId('drawer-header')).getByText('active')).toBeInTheDocument()
  })

  it('T2: drawer header and inner controls wrap on mobile so nothing overflows', async () => {
    render(
      <ConversationsPage
        isDrawerOpen
        onCloseDrawer={vi.fn()}
        allowNavCollapse={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '+ New' })).toBeInTheDocument()
    })

    const header = screen.getByTestId('drawer-header')
    // Mobile drawer header uses a wrapping layout.
    expect(header).toHaveStyle({ flexWrap: 'wrap', flexShrink: '0' })

    const controls = screen.getByTestId('drawer-controls')
    // Inner controls row wraps so Refresh / badge are reachable.
    expect(controls).toHaveStyle({ flexWrap: 'wrap', minWidth: '0' })
  })

  it('T3: desktop drawer header keeps the base non-wrapping layout', async () => {
    installMatchMedia(false)
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])

    render(
      <ConversationsPage
        initialConvoId="convo-123"
        isDrawerOpen={false}
        onCloseDrawer={vi.fn()}
        allowNavCollapse={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    const header = screen.getByTestId('drawer-header')
    // Desktop uses base s.colHeader: no flexWrap applied.
    expect(header.style.flexWrap).toBe('')
    const controls = screen.getByTestId('drawer-controls')
    expect(controls.style.flexWrap).toBe('')
  })

  it('mobile: history right column is borderless and the divider is thicker for finger drag', async () => {
    installMatchMedia(true)
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])

    render(
      <ConversationsPage
        initialConvoId="convo-123"
        isDrawerOpen={false}
        onCloseDrawer={vi.fn()}
        allowNavCollapse
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })

    // Right column is edge-to-edge borderless on mobile (matches the removed
    // <main> padding so the history box reaches the screen edge).
    const rightCol = screen.getByTestId('conversations-right-col')
    expect(rightCol.style.borderStyle).toBe('none')
    expect(rightCol.style.borderWidth).toBe('0px')
    expect(rightCol.style.borderRadius).toBe('0px')

    // The divider is thicker (16px) on mobile for easier finger grabs, but
    // still overrides the browser's touch-scroll capture with touchAction none.
    await waitFor(() => {
      expect(screen.getByTestId('divider')).toBeInTheDocument()
    })
    const divider = screen.getByTestId('divider')
    expect(parseInt(divider.style.height, 10)).toBeGreaterThanOrEqual(12)
    expect(divider.style.touchAction).toBe('none')
  })
})

describe('ConversationsPage - NavBar collapse wiring', () => {
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

  it('drives onNavCollapsedChange(true) on forward scroll when NavBar collapse is allowed', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])
    mockGetConvoHistory.mockResolvedValue([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Done', status: 'complete' },
    ])
    const onNavCollapsedChange = vi.fn()

    render(
      <ConversationsPage
        initialConvoId="convo-123"
        isDrawerOpen={false}
        onCloseDrawer={vi.fn()}
        allowNavCollapse
        onNavCollapsedChange={onNavCollapsedChange}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Start a new turn…')).toBeInTheDocument()
    })

    const scroller = screen.getByTestId('conversations-history-scroll')
    scroller.scrollTop = 120
    fireEvent.scroll(scroller)
    expect(onNavCollapsedChange).toHaveBeenCalledWith(true)
  })

  it('drives onNavCollapsedChange(false) when the scroll reaches the top', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])
    mockGetConvoHistory.mockResolvedValue([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Done', status: 'complete' },
    ])
    const onNavCollapsedChange = vi.fn()

    render(
      <ConversationsPage
        initialConvoId="convo-123"
        isDrawerOpen={false}
        onCloseDrawer={vi.fn()}
        allowNavCollapse
        onNavCollapsedChange={onNavCollapsedChange}
      />
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Start a new turn…')).toBeInTheDocument()
    })

    const scroller = screen.getByTestId('conversations-history-scroll')
    scroller.scrollTop = 150
    fireEvent.scroll(scroller)
    expect(onNavCollapsedChange).toHaveBeenCalledWith(true)

    scroller.scrollTop = 0
    fireEvent.scroll(scroller)
    expect(onNavCollapsedChange).toHaveBeenCalledWith(false)
  })

  it('does not collapse the NavBar while the drawer is open (allowNavCollapse=false)', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])
    mockGetConvoHistory.mockResolvedValue([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Done', status: 'complete' },
    ])
    const onNavCollapsedChange = vi.fn()

    render(
      <ConversationsPage
        initialConvoId="convo-123"
        isDrawerOpen
        onCloseDrawer={vi.fn()}
        allowNavCollapse={false}
        onNavCollapsedChange={onNavCollapsedChange}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('conversation-drawer-backdrop')).toBeInTheDocument()
    })

    // Collapse is inactive while the drawer is open: a strong forward scroll
    // must NOT notify the NavBar to collapse.
    const scroller = screen.getByTestId('conversations-history-scroll')
    scroller.scrollTop = 120
    fireEvent.scroll(scroller)
    expect(onNavCollapsedChange).not.toHaveBeenCalledWith(true)
  })

  it('restores the single page-level header (no split title/nav bars) and keeps composer transform empty', async () => {
    mockListConvos.mockResolvedValue([{
      convo_id: 'convo-123',
      first_session: { status: 'complete' },
      last_session: { status: 'complete', updated_at: new Date().toISOString() },
      first_turn: 'Hello',
    }])
    mockGetConvoHistory.mockResolvedValue([
      { Role: 'user', content: 'Hello' },
      { Role: 'agent', content: 'Done', status: 'complete' },
    ])

    const { container } = render(
      <ConversationsPage
        initialConvoId="convo-123"
        isDrawerOpen={false}
        onCloseDrawer={vi.fn()}
        allowNavCollapse
      />
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Start a new turn…')).toBeInTheDocument()
    })

    // No page-level split title/nav bars (removed in the rework) and no
    // page-level hamburger — drawer opens from the global NavBar only.
    expect(screen.queryByTestId('conversations-title-bar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('conversations-nav-bar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open conversation list' })).not.toBeInTheDocument()

    // Single colHeader on mobile (no collapse transform on the page header).
    const header = container.querySelector('[data-testid="conversations-right-col"] > div')
    expect(header.style.transform).toBe('')

    // Compact header: minimal vertical padding so the history box only takes the
    // space it needs — no "big empty forehead".
    expect(parseInt(header.style.paddingTop, 10)).toBeLessThanOrEqual(8)
    expect(parseInt(header.style.paddingBottom, 10)).toBeLessThanOrEqual(8)
    // Title wrap no longer grows to fill the row (flexGrow 0) so title +
    // controls CAN share a single row; wraps only when forced.
    const titleRow = container.querySelector('[data-testid="conversations-right-col"] > div > div')
    expect(titleRow.style.flexGrow).toBe('0')
    // Title text uses a tighter line-height to keep the row compact.
    expect(titleRow.querySelector('span').style.lineHeight).toBe('1.2')

    // Composer never receives any collapse transform.
    const composer = container.querySelector('[data-testid="convo-turn-input-area"]')
    expect(composer.style.transform).toBe('')
  })
})
