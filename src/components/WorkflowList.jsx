import { useState, useEffect, useCallback, useRef } from 'react'
import { listEvents } from '../api'
import { useAuth } from '../auth/AuthContext'
import SessionCard from './SessionCard'

const POLL_INTERVAL_MS = 5000
const DEFAULT_VISIBLE_LEVELS = 2
const INITIAL_LOOK_BACK = 12
const POLL_LOOK_BACK = 2
const FETCH_MORE_LOOK_BACK = 6

const s = {
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 700, color: '#e2e8f0' },
  controls: { display: 'flex', gap: 10, alignItems: 'center' },
  badge: { fontSize: 12, color: '#94a3b8', background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 20, padding: '3px 10px' },
  refreshed: { fontSize: 12, color: '#64748b' },
  btn: (variant) => ({
    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
    background: variant === 'primary' ? '#f6c90e' : '#2d3148',
    color: variant === 'primary' ? '#0f1117' : '#94a3b8',
    fontWeight: variant === 'primary' ? 700 : 400,
  }),
  empty: { textAlign: 'center', color: '#475569', padding: '60px 0', fontSize: 15 },
  err: { color: '#f87171', fontSize: 13, marginBottom: 12 },
  bottomControls: { display: 'flex', justifyContent: 'center', marginTop: 16 },
  checkLabel: { fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' },
  treeWrap: { display: 'flex', flexDirection: 'column', gap: 2 },
  treeNode: { display: 'flex', flexDirection: 'column' },
  nodeHead: { display: 'flex', alignItems: 'center', gap: 8 },
  nodeBody: { flex: 1, minWidth: 0 },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    border: '1px solid #2d3148',
    background: '#1a1d27',
    color: '#94a3b8',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },
  toggleHover: {
    background: '#252a37',
    borderColor: '#3f4557',
    color: '#cbd5e1',
  },
}

function getSessionID(session) {
  return session?.data?.session_id || session?.session_id || ''
}

function getSessionMergeKey(session) {
  const sessionID = getSessionID(session)
  if (sessionID) {
    return `session:${sessionID}`
  }

  const eventID = session?.data?.event_id || session?.event_id || ''
  const cursor = session?.labels?.cursor || ''
  if (eventID || cursor) {
    return `event:${eventID}:${cursor}`
  }

  return JSON.stringify(session)
}

function extractAsOfMarker(entry) {
  if (typeof entry === 'number' && Number.isFinite(entry)) {
    const marker = String(Math.trunc(entry))
    if (/^\d{10}$/.test(marker)) {
      return marker
    }
  }

  if (typeof entry !== 'string') {
    return ''
  }

  const trimmed = entry.trim()
  if (/^\d{10}$/.test(trimmed)) {
    return trimmed
  }

  const parts = trimmed.split('_')
  const tail = parts[parts.length - 1]
  if (/^\d{10}$/.test(tail)) {
    return tail
  }

  return ''
}

function getParentSessionID(session) {
  const parent = session?.parent || session?.data?.parent || session?.labels?.parent || ''
  return parent.split('.')[0]
}

function buildSessionTree(items) {
  const byID = new Map()
  const children = new Map()

  items.forEach((session) => {
    const id = getSessionID(session)
    if (!id) {
      return
    }
    byID.set(id, session)
  })

  items.forEach((session) => {
    const id = getSessionID(session)
    const parentID = getParentSessionID(session)
    if (!id) {
      return
    }
    if (parentID && byID.has(parentID)) {
      if (!children.has(parentID)) {
        children.set(parentID, [])
      }
      children.get(parentID).push(session)
    }
  })

  const roots = []
  items.forEach((session) => {
    const parentID = getParentSessionID(session)
    if (!parentID || !byID.has(parentID)) {
      roots.push(session)
    }
  })

  return { roots, children }
}

export default function WorkflowList() {
  const { creds, can } = useAuth()
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [showNoop, setShowNoop] = useState(false)
  const [showHook, setShowHook] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [oldestAsOf, setOldestAsOf] = useState('')
  const timerRef = useRef(null)

  const parseSessionEntry = (entry) => {
    if (!entry) {
      return null
    }
    if (typeof entry === 'object') {
      return entry
    }
    if (typeof entry !== 'string') {
      return null
    }

    const trimmed = entry.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null
    }

    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    } catch {
      return null
    }

    return null
  }

  const normalizeSessions = (data) => {
    const sessions = []
    const markers = []

    const consumeArray = (arr) => {
      arr.forEach((entry) => {
        const marker = extractAsOfMarker(entry)
        if (marker) {
          markers.push(marker)
          return
        }

        const parsed = parseSessionEntry(entry)
        if (parsed) {
          sessions.push(parsed)
        }
      })
    }

    if (Array.isArray(data)) {
      consumeArray(data)
      return { sessions, markers }
    }
    if (!data || typeof data !== 'object') {
      return { sessions, markers }
    }

    Object.values(data).forEach((entry) => {
      if (Array.isArray(entry)) {
        consumeArray(entry)
        return
      }
      if (entry && typeof entry === 'object' && Array.isArray(entry.sessions)) {
        consumeArray(entry.sessions)
      }
    })

    return { sessions, markers }
  }

  const mergeSessions = (existing, incoming) => {
    const merged = new Map()

    existing.forEach((session) => {
      merged.set(getSessionMergeKey(session), session)
    })

    incoming.forEach((session) => {
      merged.set(getSessionMergeKey(session), session)
    })

    const out = Array.from(merged.values())
    out.sort((a, b) => {
      const ta = a.labels?.start ? new Date(a.labels.start).getTime() : 0
      const tb = b.labels?.start ? new Date(b.labels.start).getTime() : 0
      return tb - ta
    })

    return out
  }

  const fetchSessions = useCallback(async (mode = 'poll') => {
    if (!can('events:read')) return

    const isInitial = mode === 'initial'
    const isFetchMore = mode === 'more'
    const lookBack = isInitial ? INITIAL_LOOK_BACK : (isFetchMore ? FETCH_MORE_LOOK_BACK : POLL_LOOK_BACK)
    const asOf = isFetchMore ? oldestAsOf : ''

    if (isFetchMore) {
      setIsFetchingMore(true)
    } else {
      setLoading(true)
    }

    setError('')
    try {
      const data = await listEvents(creds, { lookBack, asOf })
      const normalized = normalizeSessions(data)

      if (normalized.markers.length > 0) {
        setOldestAsOf((prev) => {
          const next = normalized.markers[0]
          if (!prev || next < prev) {
            return next
          }
          return prev
        })
      }

      setSessions((prev) => {
        if (isInitial) {
          return mergeSessions([], normalized.sessions)
        }
        return mergeSessions(prev, normalized.sessions)
      })
      setLastRefreshedAt(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      if (isFetchMore) {
        setIsFetchingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [creds, can, oldestAsOf])

  useEffect(() => {
    fetchSessions('initial')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefresh) {
      clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => fetchSessions('poll'), POLL_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [autoRefresh, fetchSessions])

  const fetchMore = useCallback(() => {
    if (!oldestAsOf) {
      return
    }
    fetchSessions('more')
  }, [fetchSessions, oldestAsOf])

  if (!can('events:read')) {
    return <div style={s.empty}>You do not have permission to view workflows.</div>
  }

  const lastRefreshedText = lastRefreshedAt
    ? lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'never'

  const visible = sessions.filter((session) => {
    const isNoop = !!session?.data?.is_noop
    const isHook = !!(session?.data?.is_hook || session?.is_hook)

    if (!showNoop && isNoop) {
      return false
    }
    if (!showHook && isHook) {
      return false
    }

    return true
  })
  const { roots, children } = buildSessionTree(visible)
  const renderRoots = roots.length > 0 ? roots : visible

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const [hoveredId, setHoveredId] = useState(null)

  const renderNode = (session, depth = 0) => {
    const id = getSessionID(session)
    const childItems = id ? (children.get(id) || []) : []
    const hasChildren = childItems.length > 0
    const isDone = session?.data?.state === 'done'
    const visibleLevels = isDone ? 1 : DEFAULT_VISIBLE_LEVELS
    const showChildrenByDefault = depth < (visibleLevels - 1)
    const isExpanded = !!expanded[id]
    const showChildren = hasChildren && (showChildrenByDefault || isExpanded)
    const isRootDone = depth === 0 && isDone && hasChildren
    const shouldShowToggle = hasChildren && (!showChildrenByDefault || isRootDone)
    const indent = depth * 20

    return (
      <div key={id || `${session?.data?.event_id || 'event'}-${depth}`} style={{ ...s.treeNode, marginLeft: indent }}>
        <div style={s.nodeHead}>
          <div style={s.nodeBody}>
            <SessionCard session={session} isChild={depth > 0} />
          </div>
          {shouldShowToggle && (
            <button
              style={{ ...s.toggle, ...(hoveredId === id ? s.toggleHover : {}) }}
              onClick={() => toggleExpand(id)}
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() => setHoveredId(null)}
              title={isExpanded ? 'Collapse children' : `Expand ${childItems.length} child${childItems.length !== 1 ? 'ren' : ''}`}
            >
              <span style={{ fontSize: 14, display: 'flex', alignItems: 'center' }}>
                {isExpanded ? '▼' : '▶'}
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{childItems.length}</span>
            </button>
          )}
        </div>
        {showChildren && childItems.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div>
      <div style={s.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={s.title}>In-fly Workflows</span>
          {loading && <span style={{ ...s.badge, color: '#f6c90e' }}>Refreshing…</span>}
          {!loading && <span style={s.badge}>{visible.length} session{visible.length !== 1 ? 's' : ''}</span>}
          <span style={s.refreshed}>Last refreshed: {lastRefreshedText}</span>
        </div>
        <div style={s.controls}>
          <button style={s.btn(autoRefresh ? 'primary' : '')} onClick={() => setAutoRefresh(v => !v)}>
            {autoRefresh ? '⏸ Pause' : '▶ Resume'}
          </button>
          <button style={s.btn()} onClick={() => fetchSessions('poll')}>↻ Refresh</button>
          <label style={s.checkLabel}>
            <input type="checkbox" checked={showNoop} onChange={e => setShowNoop(e.target.checked)} />
            Show no-ops
          </label>
          <label style={s.checkLabel}>
            <input type="checkbox" checked={showHook} onChange={e => setShowHook(e.target.checked)} />
            Show hooks
          </label>
        </div>
      </div>

      {error && <div style={s.err}>⚠ {error}</div>}

      {visible.length === 0 && !loading && !error && (
        <div style={s.empty}>No in-fly workflows at the moment.</div>
      )}

      <div style={s.treeWrap}>
        {renderRoots.map((session) => renderNode(session, 0))}
      </div>

      <div style={s.bottomControls}>
        <button
          style={s.btn()}
          onClick={fetchMore}
          disabled={!oldestAsOf || isFetchingMore}
          title={oldestAsOf ? `Fetch older sessions before ${oldestAsOf}` : 'No older cursor available yet'}
        >
          {isFetchingMore ? 'Loading more…' : 'Fetch More'}
        </button>
      </div>

    </div>
  )
}
