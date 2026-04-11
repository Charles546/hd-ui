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
const AUTH_KEYS = {
  creds: 'hd_creds',
  subject: 'hd_subject',
  profileName: 'hd_profile_name',
}

function getStoredItem(key) {
  const localValue = localStorage.getItem(key)
  if (localValue !== null) {
    return localValue
  }

  // Backward compatibility: read legacy per-tab session values.
  return sessionStorage.getItem(key)
}

function setStoredItem(key, value) {
  localStorage.setItem(key, value)
  sessionStorage.setItem(key, value)
}

function removeStoredItem(key) {
  localStorage.removeItem(key)
  sessionStorage.removeItem(key)
}

function hydrateAuthState() {
  try {
    const storedCreds = getStoredItem(AUTH_KEYS.creds)
    const parsedCreds = storedCreds ? JSON.parse(storedCreds) : null
    const storedSubject = getStoredItem(AUTH_KEYS.subject)
    const storedProfileName = getStoredItem(AUTH_KEYS.profileName)

    return {
      creds: parsedCreds,
      subject: storedSubject || null,
      profileName: storedProfileName || null,
    }
  } catch {
    return { creds: null, subject: null, profileName: null }
  }
}

export function AuthProvider({ children }) {
  const [creds, setCreds] = useState(() => hydrateAuthState().creds)
  const [subject, setSubject] = useState(() => hydrateAuthState().subject)
  const [profileName, setProfileName] = useState(() => hydrateAuthState().profileName)

  const loadProfile = useCallback(async (activeCreds) => {
    if (!activeCreds) {
      setProfileName(null)
      removeStoredItem(AUTH_KEYS.profileName)

      return
    }

    try {
      const profile = await getUserProfile(activeCreds)
      const nextProfileName = profile?.profile_name || null
      setProfileName(nextProfileName)
      if (nextProfileName) {
        setStoredItem(AUTH_KEYS.profileName, nextProfileName)
      } else {
        removeStoredItem(AUTH_KEYS.profileName)
      }
    } catch {
      setProfileName(null)
      removeStoredItem(AUTH_KEYS.profileName)
    }
  }, [])

  const login = useCallback((newCreds, resolvedSubject) => {
    setCreds(newCreds)
    setSubject(resolvedSubject)
    setStoredItem(AUTH_KEYS.creds, JSON.stringify(newCreds))
    setStoredItem(AUTH_KEYS.subject, resolvedSubject || '')
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
    removeStoredItem(AUTH_KEYS.creds)
    removeStoredItem(AUTH_KEYS.subject)
    removeStoredItem(AUTH_KEYS.profileName)
  }, [])

  useEffect(() => {
    // Migrate legacy session-only values into shared local storage.
    for (const key of Object.values(AUTH_KEYS)) {
      if (localStorage.getItem(key) === null) {
        const legacy = sessionStorage.getItem(key)
        if (legacy !== null) {
          localStorage.setItem(key, legacy)
        }
      }
    }
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
        setStoredItem(AUTH_KEYS.creds, JSON.stringify(next))
        return next
      })
    })

    return () => {
      setTokenRotationHandler(null)
    }
  }, [])

  useEffect(() => {
    const onStorage = (event) => {
      if (!Object.values(AUTH_KEYS).includes(event.key)) {
        return
      }

      const next = hydrateAuthState()
      setCreds(next.creds)
      setSubject(next.subject)
      setProfileName(next.profileName)
    }

    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('storage', onStorage)
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
