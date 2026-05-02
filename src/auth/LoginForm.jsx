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

/**
 * Returns a Set of enabled auth method keys.
 * If ENABLED_AUTH_METHODS is empty/unset, all methods are enabled.
 * Supported keys: 'github', 'saml', 'token', 'basic'
 */
function getEnabledMethods() {
  const raw = window.HD_CONFIG?.ENABLED_AUTH_METHODS || import.meta.env.VITE_ENABLED_AUTH_METHODS || ''
  if (!raw.trim()) {
    return new Set(['github', 'saml', 'token', 'basic'])
  }
  return new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))
}

const ENABLED = getEnabledMethods()

export default function LoginForm() {
  const { login, loginWithGitHub, loginWithSAML } = useAuth()

  // Determine initial scheme based on what's enabled
  const defaultScheme = ENABLED.has('token') ? 'token' : ENABLED.has('basic') ? 'basic' : null

  const [scheme, setScheme] = useState(defaultScheme)
  const [token, setToken] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [githubError, setGithubError] = useState('')
  const [samlError, setSamlError] = useState('')

  const showCredentialForm = ENABLED.has('token') || ENABLED.has('basic')
  const showTabs = ENABLED.has('token') && ENABLED.has('basic')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const creds = scheme === 'token'
      ? { type: 'token', token }
      : { type: 'basic', username, password }

    try {
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

  function handleGitHubLogin() {
    setGithubError('')
    try {
      loginWithGitHub()
    } catch (err) {
      setGithubError(err.message || 'GitHub login is not configured.')
    }
  }

  function handleSAMLLogin() {
    setSamlError('')
    try {
      loginWithSAML()
    } catch (err) {
      setSamlError(err.message || 'SAML login is not configured.')
    }
  }

  function handleOpenSAMLMetadata() {
    window.location.assign('/auth/saml/metadata')
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <HdLogo size={40} />
          <span style={s.logo}>Honeydipper</span>
        </div>
        <div style={s.sub}>Sign in to view in-fly workflows</div>

        {ENABLED.has('github') && (
          <button style={{ ...s.btn, marginBottom: 16 }} type="button" onClick={handleGitHubLogin}>
            Continue With GitHub
          </button>
        )}

        {ENABLED.has('saml') && (
          <>
            <button style={{ ...s.btn, marginBottom: 16, background: '#4a90d9', color: '#fff' }} type="button" onClick={handleSAMLLogin}>
              Continue With SAML SSO
            </button>
            <button style={{ ...s.btn, marginBottom: 16, background: '#263445', color: '#cfe6ff' }} type="button" onClick={handleOpenSAMLMetadata}>
              View SAML SP Metadata
            </button>
          </>
        )}

        {showCredentialForm && (
          <>
            {showTabs && (
              <div style={s.tabs}>
                <button style={s.tab(scheme === 'token')} onClick={() => setScheme('token')}>Bearer Token</button>
                <button style={s.tab(scheme === 'basic')} onClick={() => setScheme('basic')}>Basic Auth</button>
              </div>
            )}

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
          </>
        )}

        {(error || githubError || samlError) && <div style={s.err}>{error || githubError || samlError}</div>}
      </div>
    </div>
  )
}
