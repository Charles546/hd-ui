import { useState } from 'react'
import { useAuth } from './AuthContext'
import { listEvents } from '../api'
import HdLogo from '../components/HdLogo'

const s = {
  wrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' },
  card: { background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 12, padding: 40, width: 380 },
  logo: { fontSize: 28, fontWeight: 700, color: '#f6c90e', marginBottom: 8 },
  sub:  { color: '#94a3b8', fontSize: 14, marginBottom: 28 },
  tabs: { display: 'flex', gap: 8, marginBottom: 24 },
  tab:  (active) => ({
    flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14,
    background: active ? '#f6c90e' : '#2d3148', color: active ? '#0f1117' : '#94a3b8', fontWeight: active ? 600 : 400,
  }),
  label: { display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #2d3148',
    background: '#0f1117', color: '#e2e8f0', fontSize: 14, marginBottom: 16, outline: 'none',
  },
  btn: {
    width: '100%', padding: '11px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
    background: '#f6c90e', color: '#0f1117', fontWeight: 700, fontSize: 15,
  },
  err: { color: '#f87171', fontSize: 13, marginTop: 12, textAlign: 'center' },
}

export default function LoginForm() {
  const { login } = useAuth()
  const [scheme, setScheme] = useState('token')
  const [token, setToken] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const creds = scheme === 'token'
      ? { type: 'token', token }
      : { type: 'basic', username, password }

    try {
      // Validate credentials by making a real API call
      await listEvents(creds)
      login(creds, username || 'user')
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setError('Invalid credentials.')
      } else {
        setError(err.message || 'Login failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <HdLogo size={40} />
          <span style={s.logo}>Honeydipper</span>
        </div>
        <div style={s.sub}>Sign in to view in-fly workflows</div>

        <div style={s.tabs}>
          <button style={s.tab(scheme === 'token')} onClick={() => setScheme('token')}>Bearer Token</button>
          <button style={s.tab(scheme === 'basic')} onClick={() => setScheme('basic')}>Basic Auth</button>
        </div>

        <form onSubmit={handleSubmit}>
          {scheme === 'token' ? (
            <>
              <label style={s.label}>Token</label>
              <input
                style={s.input} type="password" value={token} autoFocus
                onChange={e => setToken(e.target.value)} placeholder="Bearer token" required
              />
            </>
          ) : (
            <>
              <label style={s.label}>Username</label>
              <input
                style={s.input} type="text" value={username} autoFocus
                onChange={e => setUsername(e.target.value)} placeholder="Username" required
              />
              <label style={s.label}>Password</label>
              <input
                style={s.input} type="password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Password" required
              />
            </>
          )}
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {error && <div style={s.err}>{error}</div>}
      </div>
    </div>
  )
}
