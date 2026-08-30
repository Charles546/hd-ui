import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import NavBar from './NavBar'

const mockLogout = vi.fn()
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    subject: 'charles',
    profileName: null,
    role: 'admin',
    logout: mockLogout,
  }),
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

describe('NavBar - mobile responsiveness', () => {
  beforeEach(() => {
    installMatchMedia(false)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
  })

  it('keeps desktop layout with tabs and controls visible', () => {
    installMatchMedia(false)
    const onViewChange = vi.fn()
    render(
      <NavBar
        view="conversations"
        onViewChange={onViewChange}
        showConversationsTab
        showGlobalEventsTab
      />
    )

    // All tabs and user controls are present.
    expect(screen.getByRole('button', { name: 'Conversations' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Events' })).toBeInTheDocument()
    expect(screen.getByText('charles')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()

    // Desktop nav uses 56px min-height and 20px padding.
    const nav = screen.getByTestId('navbar')
    expect(nav.style.minHeight).toBe('56px')
    expect(nav.style.padding).toBe('10px 20px')
  })

  it('wraps tabs and controls without overflow and keeps them all visible on mobile', () => {
    installMatchMedia(true)
    const onViewChange = vi.fn()
    render(
      <NavBar
        view="conversations"
        onViewChange={onViewChange}
        showConversationsTab
        showGlobalEventsTab
        showGitHubEventsTab
        showGitHubSecretsTab
      />
    )

    // All controls remain visible/tappable on mobile.
    expect(screen.getByRole('button', { name: 'Conversations' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Events' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'GitHub Events' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Script Secrets' })).toBeInTheDocument()
    expect(screen.getByText('charles')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()

    // Mobile nav collapses to full-width stacked rows with tighter padding.
    const nav = screen.getByTestId('navbar')
    expect(nav.style.padding).toBe('8px 12px')

    const links = screen.getByTestId('nav-links')
    expect(links.style.width).toBe('100%')
    expect(links.style.flexWrap).toBe('wrap')

    const right = screen.getByTestId('nav-right')
    expect(right.style.width).toBe('100%')
  })

  it('active Conversations tab remains tappable on mobile', () => {
    installMatchMedia(true)
    const onViewChange = vi.fn()
    render(
      <NavBar
        view="events"
        onViewChange={onViewChange}
        showConversationsTab
        showGlobalEventsTab
      />
    )

    const convoTab = screen.getByRole('button', { name: 'Conversations' })
    expect(convoTab).toBeInTheDocument()
    fireEvent.click(convoTab)
    expect(onViewChange).toHaveBeenCalledWith('conversations')
  })

  it('sign out remains accessible on mobile', () => {
    installMatchMedia(true)
    render(<NavBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(mockLogout).toHaveBeenCalled()
  })
})
