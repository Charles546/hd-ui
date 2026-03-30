// Honeydipper API client
// Auth header is injected from the stored credentials.

const API_BASE = '/api'
const REFRESHED_JWT_HEADER = 'X-Honeydipper-Refreshed-JWT'

let onTokenRotated = null
let inFlightGitHubCode = null
let inFlightGitHubLogin = null

export function setTokenRotationHandler(handler) {
  onTokenRotated = typeof handler === 'function' ? handler : null
}

function getAuthHeader(creds) {
  if (!creds) return {}
  if (creds.type === 'token') {
    return { Authorization: `Bearer ${creds.token}` }
  }
  if (creds.type === 'basic') {
    return { Authorization: `Basic ${btoa(`${creds.username}:${creds.password}`)}` }
  }
  return {}
}

async function apiFetch(path, creds, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(creds),
      ...(options.headers || {}),
    },
  })

  if (res.status === 401) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }
  if (res.status === 403) {
    const err = new Error('Forbidden')
    err.status = 403
    throw err
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.error || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }

  const rotatedJWT = res.headers.get(REFRESHED_JWT_HEADER)
  if (rotatedJWT && creds?.type === 'token' && creds.token !== rotatedJWT && onTokenRotated) {
    onTokenRotated(rotatedJWT, creds)
  }

  return res.json()
}

// GET /api/events — list in-fly workflow sessions
export async function listEvents(creds, params = {}) {
  const query = new URLSearchParams()
  if (params.lookBack !== undefined && params.lookBack !== null) {
    query.set('look_back', String(params.lookBack))
  }
  if (params.asOf) {
    query.set('as_of', String(params.asOf))
  }

  const suffix = query.toString() ? `?${query.toString()}` : ''
  return apiFetch(`/events${suffix}`, creds)
}

// GET /api/gh/events/*gh_slug — list in-fly workflow sessions filtered by git repo/org
export async function listGitHubEvents(creds, ghSlug, params = {}) {
  const query = new URLSearchParams()
  if (params.lookBack !== undefined && params.lookBack !== null) {
    query.set('look_back', String(params.lookBack))
  }
  if (params.asOf) {
    query.set('as_of', String(params.asOf))
  }

  const suffix = query.toString() ? `?${query.toString()}` : ''
  const slug = String(ghSlug || '').replace(/^\/+/, '').trim()
  return apiFetch(`/gh/events/${encodeURIComponent(slug)}${suffix}`, creds)
}

// POST /api/events — trigger an event
export async function postEvent(creds, payload) {
  return apiFetch('/events', creds, { method: 'POST', body: JSON.stringify(payload) })
}

// GET /api/events/:eventID/wait — long-poll for a specific event result
export async function waitEvent(creds, eventID) {
  return apiFetch(`/events/${encodeURIComponent(eventID)}/wait`, creds)
}

// GET /api/user/profile — current authenticated user profile
export async function getUserProfile(creds) {
  return apiFetch('/user/profile', creds)
}

// GET /api/auth/github/callback — exchange GitHub OAuth code for Honeydipper token
export async function completeGitHubLogin(code) {
  if (inFlightGitHubCode === code && inFlightGitHubLogin) {
    return inFlightGitHubLogin
  }

  const query = new URLSearchParams({ code })
  inFlightGitHubCode = code
  inFlightGitHubLogin = apiFetch(`/auth/github/callback?${query.toString()}`, null)
    .finally(() => {
      if (inFlightGitHubCode === code) {
        inFlightGitHubCode = null
        inFlightGitHubLogin = null
      }
    })

  return inFlightGitHubLogin
}

// GET /healthz — health check (no auth required)
export async function healthCheck() {
  const res = await fetch('/healthz')
  return res.ok
}
