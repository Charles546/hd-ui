import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

const s = {
  wrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' },
  card: { background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 12, padding: 40, width: 420, color: '#e2e8f0' },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 12 },
  text: { color: '#94a3b8', fontSize: 14 },
  err: { color: '#f87171', fontSize: 13, marginTop: 12 },
}

export default function SAMLCallback() {
  const { finishSAMLLogin } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const subject = params.get('subject')
    const profileName = params.get('profile_name')

    if (!token) {
      setError('SAML login failed: no session token received.')
      return
    }

    finishSAMLLogin(token, subject, profileName)
    window.history.replaceState({}, '', '/')
    window.location.assign('/')
  }, [finishSAMLLogin])

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.title}>Completing SAML Sign-In</div>
        <div style={s.text}>Validating your SAML assertion with Honeydipper.</div>
        {error && <div style={s.err}>{error}</div>}
      </div>
    </div>
  )
}
