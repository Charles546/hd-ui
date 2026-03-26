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
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: 56, background: '#1a1d27',
    borderBottom: '1px solid #2d3148', position: 'sticky', top: 0, zIndex: 10,
  },
  brand: { fontSize: 18, fontWeight: 700, color: '#f6c90e', letterSpacing: -0.5 },
  right: { display: 'flex', alignItems: 'center', gap: 12 },
  subject: { fontSize: 13, color: '#94a3b8' },
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

export default function NavBar() {
  const { subject, role, logout } = useAuth()

  return (
    <nav style={s.nav}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <HdLogo size={28} />
        <span style={s.brand}>Honeydipper</span>
      </div>
      <div style={s.right}>
        {subject && <span style={s.subject}>{subject}</span>}
        <span style={s.role(role)}>{role}</span>
        <button style={s.btn} onClick={logout}>Sign out</button>
      </div>
    </nav>
  )
}
