import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

const s = {
  wrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' },
  card: { background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 12, padding: 40, width: 420, color: '#e2e8f0' },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 12 },
  text: { color: '#94a3b8', fontSize: 14 },
  err: { color: '#f87171', fontSize: 13, marginTop: 12 },
}

function buildOAuthErrorMessage(errorCode, description) {
  const code = String(errorCode || '').trim().toLowerCase()
  const detail = String(description || '').trim()

  if (code === 'access_denied') {
    return 'GitHub sign-in was canceled or denied. Please try again and approve the requested access.'
  }

  if (detail) {
    return `GitHub login failed: ${detail}`
  }

  return `GitHub login failed: ${errorCode}`
}

function buildCallbackFailureMessage(err) {
  const status = err?.status
  const raw = String(err?.message || '').trim()
  const lower = raw.toLowerCase()

  if (status === 403 || lower.includes('not allowed by github login restrictions')) {
    return 'Your GitHub account is not allowed to sign in for this Honeydipper deployment. Ask an administrator to add your GitHub username to allowed_users or one of your organizations to allowed_orgs.'
  }

  if (status === 401) {
    return 'GitHub sign-in could not be validated by the API. Please retry. If this continues, ask an administrator to verify OAuth client settings and callback URL configuration.'
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network error')) {
    return 'GitHub sign-in could not reach the Honeydipper API. Check connectivity and try again.'
  }

  if (raw) {
    return `GitHub login failed: ${raw}. Please try again or contact an administrator.`
  }

  return 'GitHub login failed. Please try again or contact an administrator.'
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
      const authErrorDescription = params.get('error_description')

      if (authError) {
        if (active) {
          setError(buildOAuthErrorMessage(authError, authErrorDescription))
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
          setError(buildCallbackFailureMessage(err))
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