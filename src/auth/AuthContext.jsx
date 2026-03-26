import { createContext, useContext, useState, useCallback } from 'react'

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

  const login = useCallback((newCreds, resolvedSubject) => {
    setCreds(newCreds)
    setSubject(resolvedSubject)
    sessionStorage.setItem('hd_creds', JSON.stringify(newCreds))
    sessionStorage.setItem('hd_subject', resolvedSubject || '')
  }, [])

  const logout = useCallback(() => {
    setCreds(null)
    setSubject(null)
    sessionStorage.removeItem('hd_creds')
    sessionStorage.removeItem('hd_subject')
  }, [])

  const role = deriveRole(subject)
  const permissions = ROLE_PERMISSIONS[role] ?? []

  const can = useCallback((permission) => permissions.includes(permission), [permissions])

  return (
    <AuthContext.Provider value={{ creds, subject, role, can, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
