import { useState, useEffect, useCallback, useRef } from 'react'
import { listGitHubEvents, rerunEventSession } from '../api'
import { useAuth } from '../auth/AuthContext'
import SessionCard from './SessionCard'

const POLL_INTERVAL_MS = 5000
const DEFAULT_VISIBLE_LEVELS = 2
const INITIAL_LOOK_BACK = 12
const POLL_LOOK_BACK = 2
const FETCH_MORE_LOOK_BACK = 6
const GH_TARGET_HISTORY_COOKIE = 'hd_gh_target_history'
const GH_TARGET_HISTORY_LIMIT = 10
const GH_TARGET_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 365

const s = {
  toolbar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 20,
    padding: 12,
    border: '1px solid #2d3148',
    borderRadius: 10,
    background: '#141824',
  },
  topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 320, flex: 1 },
  metaRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 20, fontWeight: 700, color: '#e2e8f0' },
  controls: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  slugWrap: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  input: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #2d3148',
    background: '#0f1117',
    color: '#e2e8f0',
    fontSize: 13,
    minWidth: 260,
  },
  historyWrap: { position: 'relative' },
  historyList: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: '#11141c',
    border: '1px solid #2d3148',
    borderRadius: 6,
    maxHeight: 220,
    overflowY: 'auto',
    zIndex: 20,
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
  },
  historyItem: {
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    border: 'none',
    background: 'transparent',
    color: '#cbd5e1',
    fontSize: 13,
    cursor: 'pointer',
  },
  historyItemHover: {
    background: '#1a1f2b',
  },
  badge: { fontSize: 12, color: '#94a3b8', background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 20, padding: '3px 10px' },
  refreshed: { fontSize: 12, color: '#64748b' },
  paused: { fontSize: 12, color: '#f6c90e' },
  btn: (variant) => ({
    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
    background: variant === 'primary' ? '#f6c90e' : '#2d3148',
    color: variant === 'primary' ? '#0f1117' : '#94a3b8',
    fontWeight: variant === 'primary' ? 700 : 400,
  }),
  empty: { textAlign: 'center', color: '#475569', padding: '60px 0', fontSize: 15 },
  err: { color: '#f87171', fontSize: 13, marginBottom: 12 },
  ok: { color: '#4ade80', fontSize: 13, marginBottom: 12 },
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

function loadGhTargetHistory() {
  const row = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${GH_TARGET_HISTORY_COOKIE}=`))
  if (!row) {
    return []
  }

  const encoded = row.slice(GH_TARGET_HISTORY_COOKIE.length + 1)
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded))
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .map((entry) => String(entry || '').replace(/^\/+/, '').trim())
      .filter((entry) => entry !== '')
      .slice(0, GH_TARGET_HISTORY_LIMIT)
  } catch {
    return []
  }
}

function saveGhTargetHistory(history) {
  const safe = history
    .map((entry) => String(entry || '').replace(/^\/+/, '').trim())
    .filter((entry) => entry !== '')
    .slice(0, GH_TARGET_HISTORY_LIMIT)
  const encoded = encodeURIComponent(JSON.stringify(safe))
  document.cookie = `${GH_TARGET_HISTORY_COOKIE}=${encoded}; Max-Age=${GH_TARGET_HISTORY_TTL_SECONDS}; Path=/; SameSite=Lax`
}

function pushGhTargetHistory(history, target) {
  const normalized = String(target || '').replace(/^\/+/, '').trim()
  if (!normalized) {
    return history
  }

  const withoutDup = history.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())
  return [normalized, ...withoutDup].slice(0, GH_TARGET_HISTORY_LIMIT)
}

export default function GitHubWorkflowList({ ghSlug = '', onGhSlugChange = () => {}, onOpenSecrets = () => {}, onOpenLogStream = () => {} }) {
  const { creds, can } = useAuth()
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)
  const [info, setInfo] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [showNoop, setShowNoop] = useState(false)
  const [showHook, setShowHook] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [oldestAsOf, setOldestAsOf] = useState('')
  const [isPageVisible, setIsPageVisible] = useState(true)
  const [ghSlugDraft, setGhSlugDraft] = useState(ghSlug)
  const [ghTargetHistory, setGhTargetHistory] = useState(() => loadGhTargetHistory())
  const [showHistory, setShowHistory] = useState(false)
  const [hoveredHistory, setHoveredHistory] = useState('')
  const timerRef = useRef(null)
  const pageVisibleRef = useRef(true)
  const autoLoadedHistoryRef = useRef(false)
  const applyButtonRef = useRef(null)

  useEffect(() => {
    setGhSlugDraft(ghSlug)
  }, [ghSlug])

  useEffect(() => {
    if (autoLoadedHistoryRef.current) {
      return
    }
    autoLoadedHistoryRef.current = true

    if (ghSlug || ghTargetHistory.length === 0) {
      return
    }

    const last = ghTargetHistory[0]
    setGhSlugDraft(last)
    onGhSlugChange(last)
  }, [ghSlug, ghTargetHistory, onGhSlugChange])

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

  const fetchSessions = useCallback(async (mode = 'poll', overrideSlug) => {
    if (!can('events:read')) return

    const activeSlug = String(overrideSlug ?? ghSlug).trim()
    if (!activeSlug) {
      setSessions([])
      setOldestAsOf('')
      setLoading(false)
      setIsFetchingMore(false)
      return
    }

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

    if (isInitial) {
      setOldestAsOf('')
      setSessions([])
    }

    try {
      const data = await listGitHubEvents(creds, activeSlug, { lookBack, asOf })
      const normalized = normalizeSessions(data)

      if (normalized.markers.length > 0) {
        setOldestAsOf((prev) => {
          const next = normalized.markers[0]
          if (!prev || next < prev) {
            return next
          }
          return prev
        })
      } else if (isInitial) {
        setOldestAsOf('')
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
  }, [creds, can, ghSlug, oldestAsOf])

  const handleRerunSession = useCallback(async ({ sessionID }) => {
    if (!sessionID) {
      return
    }

    try {
      setError('')
      const result = await rerunEventSession(creds, sessionID)
      const nextSessionID = result?.sessionID || result?.session_id || ''
      setInfo(nextSessionID ? `Re-run started as session ${nextSessionID}.` : 'Re-run started.')
      await fetchSessions('poll')
    } catch (err) {
      setInfo('')
      setError(err?.message || 'Failed to re-run workflow')
    }
  }, [creds, fetchSessions])

  useEffect(() => {
    if (!ghSlug) {
      return
    }
    fetchSessions('initial')
  }, [ghSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stopPolling = () => {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    const startPolling = (refreshNow = false) => {
      stopPolling()
      if (!autoRefresh || !pageVisibleRef.current || !ghSlug) {
        return
      }

      if (refreshNow) {
        fetchSessions('poll')
      }

      timerRef.current = setInterval(() => fetchSessions('poll'), POLL_INTERVAL_MS)
    }

    const handleVisibilityOrFocus = () => {
      const isVisible = document.visibilityState !== 'hidden'
      const wasVisible = pageVisibleRef.current
      pageVisibleRef.current = isVisible
      setIsPageVisible(isVisible)

      if (!autoRefresh || !ghSlug) {
        stopPolling()
        return
      }

      if (!isVisible) {
        stopPolling()
        return
      }

      if (!wasVisible) {
        startPolling(true)
      }
    }

    pageVisibleRef.current = document.visibilityState !== 'hidden'
    setIsPageVisible(pageVisibleRef.current)
    startPolling(false)

    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
    }
  }, [autoRefresh, fetchSessions, ghSlug])

  const fetchMore = useCallback(() => {
    if (!oldestAsOf || !ghSlug) {
      return
    }
    fetchSessions('more')
  }, [fetchSessions, oldestAsOf, ghSlug])

  if (!can('events:read')) {
    return <div style={s.empty}>You do not have permission to view workflows.</div>
  }

  const lastRefreshedText = lastRefreshedAt
    ? lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'never'
  const pollingStatus = !autoRefresh
    ? 'Paused (manual)'
    : (!isPageVisible ? 'Paused (tab inactive)' : '')

  const visible = sessions.filter((session) => {
    const isNoop = !!session?.data?.is_noop
    const isHook = !!(session?.data?.is_hook || session?.is_hook)
    const status = session?.labels?.status
    const isFailedNoop = isNoop && (status === 'failure' || status === 'error')

    if (!showNoop && isNoop && !isFailedNoop) {
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
            <SessionCard
              session={session}
              isChild={depth > 0}
              onOpenLogStream={onOpenLogStream}
              onRerunSession={handleRerunSession}
            />
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

  const applySlug = () => {
    const normalized = ghSlugDraft.replace(/^\/+/, '').trim()
    onGhSlugChange(normalized)
    if (normalized) {
      const nextHistory = pushGhTargetHistory(ghTargetHistory, normalized)
      setGhTargetHistory(nextHistory)
      saveGhTargetHistory(nextHistory)
    }
    if (normalized) {
      fetchSessions('initial', normalized)
      return
    }

    setSessions([])
    setOldestAsOf('')
  }

  const selectHistory = (target) => {
    const normalized = String(target || '').replace(/^\/+/, '').trim()
    if (!normalized) {
      return
    }
    setGhSlugDraft(normalized)
    onGhSlugChange(normalized)
    const nextHistory = pushGhTargetHistory(ghTargetHistory, normalized)
    setGhTargetHistory(nextHistory)
    saveGhTargetHistory(nextHistory)
    fetchSessions('initial', normalized)
    setShowHistory(false)
    // Let parent route/state updates settle first, then move focus away from input.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyButtonRef.current?.focus()
      })
    })
  }

  return (
    <div>
      <div style={s.toolbar}>
        <div style={s.topRow}>
          <div style={s.leftCol}>
          <div style={s.metaRow}>
            <span style={s.title}>GitHub In-fly Workflows</span>
            {loading && <span style={{ ...s.badge, color: '#f6c90e' }}>Refreshing…</span>}
            {!loading && <span style={s.badge}>{visible.length} session{visible.length !== 1 ? 's' : ''}</span>}
            <span style={s.refreshed}>Last refreshed: {lastRefreshedText}</span>
            {pollingStatus && <span style={s.paused}>{pollingStatus}</span>}
          </div>
          <div style={s.slugWrap}>
            <div style={s.historyWrap}>
            <input
              style={s.input}
              type="text"
              value={ghSlugDraft}
              onChange={(e) => setGhSlugDraft(e.target.value)}
              onFocus={() => {
                if (ghTargetHistory.length > 0) {
                  setShowHistory(true)
                }
              }}
              onBlur={() => {
                setTimeout(() => setShowHistory(false), 100)
                applySlug()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applySlug()
                }
              }}
              placeholder="GitHub target, e.g. honeydipper or honeydipper/honeydipper"
            />
            {showHistory && ghTargetHistory.length > 0 && (
              <div style={s.historyList}>
                {ghTargetHistory.map((target) => (
                  <button
                    key={target}
                    type="button"
                    style={{ ...s.historyItem, ...(hoveredHistory === target ? s.historyItemHover : {}) }}
                    onMouseEnter={() => setHoveredHistory(target)}
                    onMouseLeave={() => setHoveredHistory('')}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectHistory(target)
                    }}
                  >
                    {target}
                  </button>
                ))}
              </div>
            )}
            </div>
            <button ref={applyButtonRef} style={s.btn('primary')} onClick={applySlug}>Apply</button>
          </div>
          </div>
        </div>
        <div style={s.controls}>
          <button style={s.btn()} onClick={onOpenSecrets} title='Manage script secrets for current GitHub target'>Script Secrets</button>
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

      {info && <div style={s.ok}>{info}</div>}
      {error && <div style={s.err}>⚠ {error}</div>}

      {!ghSlug && !loading && !error && (
        <div style={s.empty}>Enter a GitHub org or repo slug to load workflows.</div>
      )}

      {ghSlug && visible.length === 0 && !loading && !error && (
        <div style={s.empty}>No matching in-fly workflows for this GitHub target.</div>
      )}

      <div style={s.treeWrap}>
        {renderRoots.map((session) => renderNode(session, 0))}
      </div>

      <div style={s.bottomControls}>
        <button
          style={s.btn()}
          onClick={fetchMore}
          disabled={!oldestAsOf || isFetchingMore || !ghSlug}
          title={oldestAsOf ? `Fetch older sessions before ${oldestAsOf}` : 'No older cursor available yet'}
        >
          {isFetchingMore ? 'Loading more…' : 'Fetch More'}
        </button>
      </div>

    </div>
  )
}
