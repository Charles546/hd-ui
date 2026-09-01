import { useAuth } from '../auth/AuthContext'
import HdLogo from './HdLogo'
import useMediaQuery from '../utils/useMediaQuery'

const MOBILE_BREAKPOINT = '(max-width: 768px)'

const ROLE_COLOR = {
  admin:    '#f6c90e',
  operator: '#38bdf8',
  viewer:   '#4ade80',
  guest:    '#94a3b8',
}

const s = {
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
    gap: 10, rowGap: 8,
    padding: '10px 20px', minHeight: 56, background: '#1a1d27',
    borderBottom: '1px solid #2d3148', position: 'sticky', top: 0, zIndex: 10,
  },
  navMobile: {
    padding: '8px 12px', minHeight: 0,
  },
  navCollapsed: {
    transform: 'translateY(-100%)',
    transition: 'transform 0.25s ease',
  },
  navExpanded: {
    transform: 'translateY(0)',
    transition: 'transform 0.25s ease',
  },
  left: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 },
  leftMobile: {
    width: '100%',
    flexWrap: 'wrap',
    gap: 8,
  },
  brand: { fontSize: 18, fontWeight: 700, color: '#f6c90e', letterSpacing: -0.5 },
  brandMobile: { fontSize: 16 },
  links: { display: 'flex', gap: 8, marginLeft: 6, flexWrap: 'wrap' },
  linksMobile: {
    width: '100%',
    marginLeft: 0,
    gap: 6,
    rowGap: 6,
    justifyContent: 'flex-start',
  },
  link: (active) => ({
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid #2d3148',
    cursor: 'pointer',
    fontSize: 12,
    background: active ? '#f6c90e' : 'transparent',
    color: active ? '#0f1117' : '#94a3b8',
    fontWeight: active ? 700 : 500,
  }),
  linkMobile: (active) => ({
    ...s.link(active),
    padding: '8px 12px',
    whiteSpace: 'nowrap',
    textAlign: 'center',
  }),
  right: { display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' },
  rightMobile: {
    width: '100%',
    marginLeft: 0,
    justifyContent: 'flex-end',
    gap: 6,
    rowGap: 6,
    flexWrap: 'wrap',
  },
  user: {
    fontSize: 12,
    color: '#94a3b8',
    background: '#11141c',
    border: '1px solid #2d3148',
    borderRadius: 999,
    padding: '4px 10px',
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userMobile: {
    maxWidth: 140,
  },
  role: (role) => ({
    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
    background: (ROLE_COLOR[role] || '#94a3b8') + '22',
    color: ROLE_COLOR[role] || '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 1,
    whiteSpace: 'nowrap',
  }),
  btn: {
    padding: '5px 12px', borderRadius: 6, border: '1px solid #2d3148',
    background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13,
    whiteSpace: 'nowrap',
  },
  btnMobile: {
    padding: '8px 14px',
  },
  hamburger: {
    fontSize: 13,
    lineHeight: 1,
    marginRight: 2,
  },
}

export default function NavBar({
  view = 'events',
  onViewChange,
  showGlobalEventsTab = true,
  showGitHubEventsTab = false,
  showGitHubSecretsTab = false,
  showConversationsTab = false,
  showTabs = true,
  isDrawerOpen = false,
  onOpenDrawer,
  onCloseDrawer,
  navCollapsed = false,
  navRef = null,
}) {
  const { subject, profileName, role, logout } = useAuth()
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT)
  const displayName = profileName || subject
  const canSwitchViews = showTabs && typeof onViewChange === 'function' && (showGlobalEventsTab || showGitHubEventsTab || showGitHubSecretsTab || showConversationsTab)

  const tabProps = (active) => (isMobile ? s.linkMobile(active) : s.link(active))

  // On mobile only, the Conversations badge merges the ☰ hamburger so a single
  // tap navigates to conversations and opens the conversation drawer (or
  // toggles it when already in conversations). Desktop keeps a plain view
  // switch.
  const handleConversationsClick = () => {
    if (!showConversationsTab) return
    if (view !== 'conversations') {
      onViewChange?.('conversations')
      onOpenDrawer?.()
    } else if (isDrawerOpen) {
      onCloseDrawer?.()
    } else {
      onOpenDrawer?.()
    }
  }

  const navTransform = isMobile ? (navCollapsed ? s.navCollapsed : s.navExpanded) : {}

  return (
    <nav
      ref={navRef}
      style={{ ...(isMobile ? { ...s.nav, ...s.navMobile } : s.nav), ...navTransform }}
      data-testid="navbar"
    >
      <div style={isMobile ? { ...s.left, ...s.leftMobile } : s.left}>
        <HdLogo size={isMobile ? 24 : 28} />
        <span style={isMobile ? { ...s.brand, ...s.brandMobile } : s.brand}>Honeydipper</span>
        {canSwitchViews && (
          <div style={isMobile ? { ...s.links, ...s.linksMobile } : s.links} data-testid="nav-links">
            {showGlobalEventsTab && (
              <button style={tabProps(view === 'events')} onClick={() => onViewChange('events')}>Events</button>
            )}
            {showGitHubEventsTab && (
              <button style={tabProps(view === 'github-events')} onClick={() => onViewChange('github-events')}>GitHub Events</button>
            )}
            {showGitHubSecretsTab && (
              <button style={tabProps(view === 'github-secrets')} onClick={() => onViewChange('github-secrets')}>Script Secrets</button>
            )}
            {showConversationsTab && (
              <button
                style={tabProps(view === 'conversations')}
                onClick={handleConversationsClick}
                data-testid="conversations-badge"
              >
                {isMobile && <span aria-hidden="true" style={s.hamburger}>☰</span>}
                Conversations
              </button>
            )}
          </div>
        )}
      </div>
      <div style={isMobile ? { ...s.right, ...s.rightMobile } : s.right} data-testid="nav-right">
        {displayName && <span style={isMobile ? { ...s.user, ...s.userMobile } : s.user} title={displayName}>{displayName}</span>}
        <span style={s.role(role)}>{role}</span>
        <button style={isMobile ? { ...s.btn, ...s.btnMobile } : s.btn} onClick={logout}>Sign out</button>
      </div>
    </nav>
  )
}
