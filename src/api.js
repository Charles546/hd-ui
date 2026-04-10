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

  const readErrorMessage = async () => {
    const body = await res.json().catch(() => ({}))
    if (body && typeof body === 'object') {
      if (typeof body.error === 'string' && body.error.trim()) {
        return body.error.trim()
      }
      if (typeof body.message === 'string' && body.message.trim()) {
        return body.message.trim()
      }
    }
    return ''
  }

  if (res.status === 401) {
    const message = await readErrorMessage()
    const err = new Error(message || 'Unauthorized')
    err.status = 401
    throw err
  }
  if (res.status === 403) {
    const message = await readErrorMessage()
    const err = new Error(message || 'Forbidden')
    err.status = 403
    throw err
  }
  if (!res.ok) {
    const message = await readErrorMessage()
    const err = new Error(message || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }

  const rotatedJWT = res.headers.get(REFRESHED_JWT_HEADER)
  if (rotatedJWT && creds?.type === 'token' && creds.token !== rotatedJWT && onTokenRotated) {
    onTokenRotated(rotatedJWT, creds)
  }

  return res.json()
}

function unwrapPodLogChunkEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload.lines) || payload.next_cursor || payload.done !== undefined || payload.has_more !== undefined) {
    return payload
  }

  for (const entry of Object.values(payload)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }

    if (Array.isArray(entry.lines) || entry.next_cursor || entry.done !== undefined || entry.has_more !== undefined) {
      return entry
    }
  }

  return payload
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

// GET /api/gh/secrets/*gh_slug — list secret keys for a GitHub org/repo target
export async function listGitHubSecrets(creds, ghSlug) {
  const slug = String(ghSlug || '').replace(/^\/+/, '').trim()
  return apiFetch(`/gh/secrets/${encodeURIComponent(slug)}`, creds)
}

// POST /api/gh/secrets/*gh_slug — set one secret key/value
export async function setGitHubSecret(creds, ghSlug, key, value) {
  const slug = String(ghSlug || '').replace(/^\/+/, '').trim()
  return apiFetch(`/gh/secrets/${encodeURIComponent(slug)}`, creds, {
    method: 'POST',
    body: JSON.stringify({ key, value }),
  })
}

// DELETE /api/gh/secrets/*gh_slug?key=... — delete one secret key
export async function deleteGitHubSecret(creds, ghSlug, key) {
  const slug = String(ghSlug || '').replace(/^\/+/, '').trim()
  const query = new URLSearchParams({ key: String(key || '') })
  return apiFetch(`/gh/secrets/${encodeURIComponent(slug)}?${query.toString()}`, creds, {
    method: 'DELETE',
  })
}

// POST /api/events — trigger an event
export async function postEvent(creds, payload) {
  return apiFetch('/events', creds, { method: 'POST', body: JSON.stringify(payload) })
}

// GET /api/events/:eventID/wait — long-poll for a specific event result
export async function waitEvent(creds, eventID) {
  return apiFetch(`/events/${encodeURIComponent(eventID)}/wait`, creds)
}

// GET /api/pods/:pod_id/log/chunk — fetch one log chunk with cursor-based long polling
export async function getPodLogChunk(creds, podID, params = {}) {
  const query = new URLSearchParams()
  if (params.provider) {
    query.set('provider', String(params.provider))
  }
  if (params.waitSeconds !== undefined && params.waitSeconds !== null) {
    query.set('wait_seconds', String(params.waitSeconds))
  }
  if (params.maxLines !== undefined && params.maxLines !== null) {
    query.set('max_lines', String(params.maxLines))
  }
  if (params.doneMaxLines !== undefined && params.doneMaxLines !== null) {
    query.set('done_max_lines', String(params.doneMaxLines))
  }
  if (params.cursor) {
    query.set('cursor', JSON.stringify(params.cursor))
  }
  if (params.streamToken) {
    query.set('stream_token', String(params.streamToken))
  }

  const suffix = query.toString() ? `?${query.toString()}` : ''
  const normalizedSlug = String(params.ghSlug || '').replace(/^\/+/, '').trim()
  const basePath = normalizedSlug
    ? `/gh/pods/${encodeURIComponent(podID)}/log/chunk/${normalizedSlug.split('/').map((part) => encodeURIComponent(part)).join('/')}`
    : `/pods/${encodeURIComponent(podID)}/log/chunk`
  const payload = await apiFetch(`${basePath}${suffix}`, creds)
  return unwrapPodLogChunkEnvelope(payload)
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
