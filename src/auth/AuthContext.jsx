import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { completeGitHubLogin, getUserProfile, setTokenRotationHandler } from '../api'

const ROLE_PERMISSIONS = {
  admin:    ['events:read', 'events:write'],
  operator: ['events:read', 'events:write'],
  viewer:   ['events:read'],
  guest:    [],
}

// Maps the subject strings defined in daemon.yaml Casbin policies to UI roles.
const SUBJECT_ROLES = {
  charles: 'admin',
}

function deriveRole(subject) {
  if (!subject || subject === 'guest') return 'guest'
  return SUBJECT_ROLES[subject] ?? 'viewer'
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [creds, setCreds] = useState(() => {
    try {
      const stored = sessionStorage.getItem('hd_creds')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const [subject, setSubject] = useState(() => sessionStorage.getItem('hd_subject') || null)
  const [profileName, setProfileName] = useState(() => sessionStorage.getItem('hd_profile_name') || null)

  const loadProfile = useCallback(async (activeCreds) => {
    if (!activeCreds) {
      setProfileName(null)
      sessionStorage.removeItem('hd_profile_name')

      return
    }

    try {
      const profile = await getUserProfile(activeCreds)
      const nextProfileName = profile?.profile_name || null
      setProfileName(nextProfileName)
      if (nextProfileName) {
        sessionStorage.setItem('hd_profile_name', nextProfileName)
      } else {
        sessionStorage.removeItem('hd_profile_name')
      }
    } catch {
      setProfileName(null)
      sessionStorage.removeItem('hd_profile_name')
    }
  }, [])

  const login = useCallback((newCreds, resolvedSubject) => {
    setCreds(newCreds)
    setSubject(resolvedSubject)
    sessionStorage.setItem('hd_creds', JSON.stringify(newCreds))
    sessionStorage.setItem('hd_subject', resolvedSubject || '')
    void loadProfile(newCreds)
  }, [loadProfile])

  const loginWithGitHub = useCallback(() => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
    if (!clientId) {
      throw new Error('Missing VITE_GITHUB_CLIENT_ID')
    }

    const redirectUri = `${window.location.origin}/auth/github/callback`
    const authUrl = new URL('https://github.com/login/oauth/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', 'user:email read:org')
    authUrl.searchParams.set('allow_signup', 'true')

    window.location.assign(authUrl.toString())
  }, [])

  const finishGitHubLogin = useCallback(async (code) => {
    const data = await completeGitHubLogin(code)
    const newCreds = { type: 'token', token: data.token, authProvider: 'auth-github' }
    login(newCreds, data.username || 'user')

    return data
  }, [login])

  const logout = useCallback(() => {
    setCreds(null)
    setSubject(null)
    setProfileName(null)
    sessionStorage.removeItem('hd_creds')
    sessionStorage.removeItem('hd_subject')
    sessionStorage.removeItem('hd_profile_name')
  }, [])

  useEffect(() => {
    if (!creds) {
      return
    }

    if (!profileName) {
      void loadProfile(creds)
    }
  }, [creds, profileName, loadProfile])

  useEffect(() => {
    setTokenRotationHandler((rotatedJWT) => {
      setCreds((current) => {
        if (!current || current.type !== 'token' || current.token === rotatedJWT) {
          return current
        }

        const next = { ...current, token: rotatedJWT }
        sessionStorage.setItem('hd_creds', JSON.stringify(next))
        return next
      })
    })

    return () => {
      setTokenRotationHandler(null)
    }
  }, [])

  const role = deriveRole(subject)
  const permissions = ROLE_PERMISSIONS[role] ?? []
  const isGitHubSession = creds?.authProvider === 'auth-github'

  const can = useCallback((permission) => permissions.includes(permission), [permissions])

  return (
    <AuthContext.Provider value={{ creds, subject, profileName, role, isGitHubSession, can, login, loginWithGitHub, finishGitHubLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
