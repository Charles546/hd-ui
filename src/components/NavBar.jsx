import { useAuth } from '../auth/AuthContext'
import HdLogo from './HdLogo'

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
  left: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 },
  brand: { fontSize: 18, fontWeight: 700, color: '#f6c90e', letterSpacing: -0.5 },
  links: { display: 'flex', gap: 8, marginLeft: 6, flexWrap: 'wrap' },
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
  right: { display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' },
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
  role: (role) => ({
    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
    background: (ROLE_COLOR[role] || '#94a3b8') + '22',
    color: ROLE_COLOR[role] || '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 1,
  }),
  btn: {
    padding: '5px 12px', borderRadius: 6, border: '1px solid #2d3148',
    background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13,
  },
}

export default function NavBar({
  view = 'events',
  onViewChange,
  showGlobalEventsTab = true,
  showGitHubEventsTab = false,
  showGitHubSecretsTab = false,
}) {
  const { subject, profileName, role, logout } = useAuth()
  const displayName = profileName || subject
  const canSwitchViews = typeof onViewChange === 'function' && (showGlobalEventsTab || showGitHubEventsTab || showGitHubSecretsTab)

  return (
    <nav style={s.nav}>
      <div style={s.left}>
        <HdLogo size={28} />
        <span style={s.brand}>Honeydipper</span>
        {canSwitchViews && (
          <div style={s.links}>
            {showGlobalEventsTab && (
              <button style={s.link(view === 'events')} onClick={() => onViewChange('events')}>Events</button>
            )}
            {showGitHubEventsTab && (
              <button style={s.link(view === 'github-events')} onClick={() => onViewChange('github-events')}>GitHub Events</button>
            )}
            {showGitHubSecretsTab && (
              <button style={s.link(view === 'github-secrets')} onClick={() => onViewChange('github-secrets')}>Script Secrets</button>
            )}
          </div>
        )}
      </div>
      <div style={s.right}>
        {displayName && <span style={s.user}>{displayName}</span>}
        <span style={s.role(role)}>{role}</span>
        <button style={s.btn} onClick={logout}>Sign out</button>
      </div>
    </nav>
  )
}
