import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

const s = {
  wrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' },
  card: { background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 12, padding: 40, width: 420, color: '#e2e8f0' },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 12 },
  text: { color: '#94a3b8', fontSize: 14 },
  err: { color: '#f87171', fontSize: 13, marginTop: 12 },
}

export default function GitHubCallback() {
  const { finishGitHubLogin } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function run() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const authError = params.get('error')

      if (authError) {
        if (active) {
          setError(`GitHub login failed: ${authError}`)
        }

        return
      }

      if (!code) {
        if (active) {
          setError('Missing GitHub authorization code.')
        }

        return
      }

      try {
        await finishGitHubLogin(code)
        window.history.replaceState({}, '', '/')
        window.location.assign('/')
      } catch (err) {
        if (active) {
          setError(err.message || 'GitHub login failed.')
        }
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [finishGitHubLogin])

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.title}>Completing GitHub Sign-In</div>
        <div style={s.text}>Exchanging your GitHub authorization code with Honeydipper.</div>
        {error && <div style={s.err}>{error}</div>}
      </div>
    </div>
  )
}