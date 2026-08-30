import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import App from './App'

const mockCreds = { type: 'token', token: 'test-token' }
vi.mock('./auth/AuthContext', () => ({
  useAuth: () => ({
    creds: mockCreds,
    isGitHubSession: false,
  }),
}))

vi.mock('./components/ConversationsPage', () => ({
  default: () => <div data-testid="mock-conversations-page" />,
}))

vi.mock('./components/ConvoHistoryPage', () => ({
  default: () => <div data-testid="mock-convo-history-page" />,
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

describe('App - mobile shell', () => {
  beforeEach(() => {
    installMatchMedia(false)
    window.history.pushState({}, '', '/')
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
    window.history.pushState({}, '', '/')
    sessionStorage.clear()
  })

  it('applies reduced horizontal padding on mobile for conversations view', () => {
    installMatchMedia(true)
    window.history.pushState({}, '', '/conversations')
    render(<App />)

    const main = document.querySelector('main')
    expect(main).toBeTruthy()
    expect(main.style.padding).toBe('12px 8px')
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
