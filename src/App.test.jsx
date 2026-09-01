import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import App from './App'

const mockCreds = { type: 'token', token: 'test-token' }
vi.mock('./auth/AuthContext', () => ({
  useAuth: () => ({
    creds: mockCreds,
    isGitHubSession: false,
    subject: 'charles',
    profileName: null,
    role: 'admin',
    logout: vi.fn(),
  }),
}))

// Capture the props App forwards to the pages so tests can verify the drawer +
// NavBar-collapse wiring and drive navCollapsed through App.
let conversationsProps = null
let historyProps = null
vi.mock('./components/ConversationsPage', () => ({
  default: (props) => {
    conversationsProps = props
    return <div data-testid="mock-conversations-page" />
  },
}))

vi.mock('./components/ConvoHistoryPage', () => ({
  default: (props) => {
    historyProps = props
    return <div data-testid="mock-convo-history-page" />
  },
}))

vi.mock('./components/WorkflowList', () => ({
  default: () => <div data-testid="mock-workflow-list" />,
}))

vi.mock('./components/LogStreamPage', () => ({
  default: () => <div data-testid="mock-log-stream" />,
}))

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

function getNavVar() {
  return document.documentElement.style.getPropertyValue('--nav-h')
}

describe('App - mobile shell', () => {
  beforeEach(() => {
    installMatchMedia(false)
    window.history.pushState({}, '', '/')
    sessionStorage.clear()
    conversationsProps = null
    historyProps = null
    document.documentElement.style.setProperty('--nav-h', '')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
    window.history.pushState({}, '', '/')
    sessionStorage.clear()
    conversationsProps = null
    historyProps = null
    document.documentElement.style.setProperty('--nav-h', '')
  })

  it('removes main padding on mobile for conversations view (edge-to-edge)', () => {
    installMatchMedia(true)
    window.history.pushState({}, '', '/conversations')
    render(<App />)

    const main = document.querySelector('main')
    expect(main).toBeTruthy()
    // Edge-to-edge: no outer margin including the bottom part.
    expect(main.style.padding).toBe('0px')
  })

  it('removes main padding on mobile for focus view (edge-to-edge)', () => {
    installMatchMedia(true)
    window.history.pushState({}, '', '/focus/convo-123')
    render(<App />)

    const main = document.querySelector('main')
    expect(main).toBeTruthy()
    expect(main.style.padding).toBe('0px')
  })

  it('applies reduced padding on mobile for the default events view', () => {
    installMatchMedia(true)
    window.history.pushState({}, '', '/')
    render(<App />)

    const main = document.querySelector('main')
    expect(main).toBeTruthy()
    expect(main.style.padding).toBe('12px 8px')
  })

  it('keeps wide padding on desktop for conversations view', () => {
    installMatchMedia(false)
    window.history.pushState({}, '', '/conversations')
    render(<App />)

    const main = document.querySelector('main')
    expect(main).toBeTruthy()
    expect(main.style.padding).toBe('16px 24px')
  })

  it('keeps desktop padding unchanged on the default events view', () => {
    installMatchMedia(false)
    window.history.pushState({}, '', '/')
    render(<App />)

    const main = document.querySelector('main')
    expect(main).toBeTruthy()
    expect(main.style.padding).toBe('32px 24px')
  })
})

describe('App - NavBar + drawer + collapse wiring', () => {
  beforeEach(() => {
    installMatchMedia(true)
    window.history.pushState({}, '', '/conversations')
    sessionStorage.clear()
    conversationsProps = null
    historyProps = null
    document.documentElement.style.setProperty('--nav-h', '')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
    window.history.pushState({}, '', '/')
    sessionStorage.clear()
    conversationsProps = null
    historyProps = null
    document.documentElement.style.setProperty('--nav-h', '')
  })

  it('renders the Conversations badge with the ☰ hamburger on mobile', () => {
    render(<App />)
    const badge = document.querySelector('[data-testid="conversations-badge"]')
    expect(badge).not.toBeNull()
    expect(badge.textContent).toContain('☰')
  })

  it('passes drawer props to ConversationsPage and allows collapse when drawer is closed', () => {
    render(<App />)

    // ConversationsPage mounted with App-controlled drawer state.
    expect(conversationsProps).not.toBeNull()
    expect(conversationsProps.isDrawerOpen).toBe(false)
    expect(typeof conversationsProps.onCloseDrawer).toBe('function')
    // Drawer closed → NavBar collapse allowed on mobile.
    expect(conversationsProps.allowNavCollapse).toBe(true)
  })

  it('opens the drawer from the NavBar badge and disables NavBar collapse while open', () => {
    render(<App />)
    expect(conversationsProps.isDrawerOpen).toBe(false)

    // Tapping the ☰ Conversations badge in the global NavBar opens the drawer.
    fireEvent.click(document.querySelector('[data-testid="conversations-badge"]'))

    // App lifts the drawer state and passes it down; opening the drawer turns
    // off NavBar collapse so the drawer never sits under a collapsed bar.
    expect(conversationsProps.isDrawerOpen).toBe(true)
    expect(conversationsProps.allowNavCollapse).toBe(false)
  })

  it('page-height var reacts to navCollapsed so the content reclaims the navbar space', () => {
    render(<App />)

    // Expanded navbar → compensate with the full placeholder height.
    expect(getNavVar()).toBe('100px')
    // Global NavBar is expanded (no upward translate).
    const nav = document.querySelector('[data-testid="navbar"]')
    expect(nav.style.transform).toContain('translateY(0)')

    // Page scrolls down → App collapses the GLOBAL NavBar.
    act(() => {
      conversationsProps.onNavCollapsedChange(true)
    })
    expect(getNavVar()).toBe('0px')
    expect(nav.style.transform).toContain('translateY(-100%)')

    // Reaching the top → NavBar expands again and the height var is restored.
    act(() => {
      conversationsProps.onNavCollapsedChange(false)
    })
    expect(getNavVar()).toBe('100px')
    expect(nav.style.transform).toContain('translateY(0)')
  })
})

describe('App - NavBar collapse disabled on desktop', () => {
  beforeEach(() => {
    installMatchMedia(false)
    window.history.pushState({}, '', '/focus/convo-123')
    sessionStorage.clear()
    conversationsProps = null
    historyProps = null
    document.documentElement.style.setProperty('--nav-h', '')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
    window.history.pushState({}, '', '/')
    sessionStorage.clear()
    conversationsProps = null
    historyProps = null
    document.documentElement.style.setProperty('--nav-h', '')
  })

  it('does not allow NavBar collapse on desktop (focus view)', () => {
    render(<App />)

    // Desktop → the page is told collapse is not allowed.
    expect(historyProps).not.toBeNull()
    expect(historyProps.allowNavCollapse).toBe(false)

    // Even if a page tried to collapse, App keeps the NavBar expanded on desktop.
    const nav = document.querySelector('[data-testid="navbar"]')
    expect(nav.style.transform).toBe('')
    expect(getNavVar()).toBe('100px')
  })
})
