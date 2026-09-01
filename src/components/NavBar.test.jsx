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

describe('NavBar - Conversations badge hamburger (mobile)', () => {
  beforeEach(() => {
    installMatchMedia(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
  })

  it('prepends the ☰ glyph to the Conversations badge on mobile', () => {
    const onViewChange = vi.fn()
    render(
      <NavBar
        view="events"
        onViewChange={onViewChange}
        showConversationsTab
        showGlobalEventsTab
      />
    )

    const badge = screen.getByTestId('conversations-badge')
    expect(badge).toBeInTheDocument()
    // Badge carries the hamburger glyph on mobile.
    expect(badge.textContent).toContain('☰')
  })

  it('does NOT prepend the hamburger on desktop', () => {
    installMatchMedia(false)
    const onViewChange = vi.fn()
    render(
      <NavBar
        view="events"
        onViewChange={onViewChange}
        showConversationsTab
        showGlobalEventsTab
      />
    )

    const badge = screen.getByTestId('conversations-badge')
    expect(badge.textContent).not.toContain('☰')
  })

  it('tapping the badge on another view navigates to conversations and opens the drawer', () => {
    const onViewChange = vi.fn()
    const onOpenDrawer = vi.fn()
    render(
      <NavBar
        view="events"
        onViewChange={onViewChange}
        onOpenDrawer={onOpenDrawer}
        showConversationsTab
        showGlobalEventsTab
      />
    )

    fireEvent.click(screen.getByTestId('conversations-badge'))
    expect(onViewChange).toHaveBeenCalledWith('conversations')
    expect(onOpenDrawer).toHaveBeenCalled()
  })

  it('tapping the badge while in conversations with the drawer closed opens it', () => {
    const onViewChange = vi.fn()
    const onOpenDrawer = vi.fn()
    const onCloseDrawer = vi.fn()
    render(
      <NavBar
        view="conversations"
        isDrawerOpen={false}
        onViewChange={onViewChange}
        onOpenDrawer={onOpenDrawer}
        onCloseDrawer={onCloseDrawer}
        showConversationsTab
        showGlobalEventsTab
      />
    )

    fireEvent.click(screen.getByTestId('conversations-badge'))
    expect(onOpenDrawer).toHaveBeenCalled()
    expect(onCloseDrawer).not.toHaveBeenCalled()
  })

  it('tapping the badge while in conversations with the drawer open closes it', () => {
    const onViewChange = vi.fn()
    const onOpenDrawer = vi.fn()
    const onCloseDrawer = vi.fn()
    render(
      <NavBar
        view="conversations"
        isDrawerOpen
        onViewChange={onViewChange}
        onOpenDrawer={onOpenDrawer}
        onCloseDrawer={onCloseDrawer}
        showConversationsTab
        showGlobalEventsTab
      />
    )

    fireEvent.click(screen.getByTestId('conversations-badge'))
    expect(onCloseDrawer).toHaveBeenCalled()
    expect(onOpenDrawer).not.toHaveBeenCalled()
  })
})

describe('NavBar - auto-hide transform (mobile only)', () => {
  beforeEach(() => {
    installMatchMedia(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
  })

  it('applies translateY(-100%) to the GLOBAL nav when navCollapsed on mobile', () => {
    render(<NavBar navCollapsed />)

    const nav = screen.getByTestId('navbar')
    expect(nav.style.transform).toContain('translateY(-100%)')
    // Smooth address-bar-like transition.
    expect(nav.style.transition).toContain('transform')
  })

  it('keeps the nav expanded (translateY 0) when not collapsed on mobile', () => {
    render(<NavBar navCollapsed={false} />)

    const nav = screen.getByTestId('navbar')
    expect(nav.style.transform).toContain('translateY(0)')
  })

  it('applies NO transform on desktop regardless of navCollapsed', () => {
    installMatchMedia(false)
    render(<NavBar navCollapsed />)

    const nav = screen.getByTestId('navbar')
    expect(nav.style.transform).toBe('')
  })
})


describe('NavBar - overlay (out-of-flow) positioning', () => {
  beforeEach(() => {
    installMatchMedia(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
  })

  it('is position fixed at the top with zIndex 10 on mobile when overlay', () => {
    render(<NavBar view="conversations" overlay />)

    const nav = screen.getByTestId('navbar')
    expect(nav.style.position).toBe('fixed')
    expect(nav.style.top).toBe('0px')
    expect(nav.style.left).toBe('0px')
    expect(nav.style.right).toBe('0px')
    expect(nav.style.zIndex).toBe('10')
  })

  it('keeps the collapse transform while overlaid (fixed) on mobile', () => {
    render(<NavBar view="focus" overlay navCollapsed />)

    const nav = screen.getByTestId('navbar')
    expect(nav.style.position).toBe('fixed')
    expect(nav.style.transform).toContain('translateY(-100%)')
    expect(nav.style.transition).toContain('transform')
  })

  it('is NOT fixed when overlay=false on mobile (stays sticky in flow)', () => {
    render(<NavBar view="conversations" overlay={false} />)

    const nav = screen.getByTestId('navbar')
    expect(nav.style.position).toBe('sticky')
    // On mobile the collapse transform still applies (translateY(0) when not
    // collapsed) — only the out-of-flow overlay positioning is gated by overlay.
    expect(nav.style.transform).toContain('translateY(0)')
  })

  it('is sticky (in flow) on desktop even when overlay is passed', () => {
    installMatchMedia(false)
    render(<NavBar view="conversations" overlay />)

    const nav = screen.getByTestId('navbar')
    expect(nav.style.position).toBe('sticky')
    expect(nav.style.transform).toBe('')
  })
})

