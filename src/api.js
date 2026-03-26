// Honeydipper API client
// Auth header is injected from the stored credentials.

const API_BASE = '/api'

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

// POST /api/events — trigger an event
export async function postEvent(creds, payload) {
  return apiFetch('/events', creds, { method: 'POST', body: JSON.stringify(payload) })
}

// GET /api/events/:eventID/wait — long-poll for a specific event result
export async function waitEvent(creds, eventID) {
  return apiFetch(`/events/${encodeURIComponent(eventID)}/wait`, creds)
}

// GET /healthz — health check (no auth required)
export async function healthCheck() {
  const res = await fetch('/healthz')
  return res.ok
}
