import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { listConvos, getConvoHistory, getConvoState, cancelConvo, startTurn, startNewConvo, listAgents, listEngines } from '../api'
import { useAuth } from '../auth/AuthContext'
import TurnInputArea from './TurnInputArea'
import NewConvoInput from './NewConvoInput'
import {
  MessageBubble,
  ROLE_COLOR,
  truncateID,
  markdownCSS,
} from './MessageBubble'
import AgentPickerModal from './AgentPickerModal'
import { getLastKnownAgent, setLastKnownAgent } from '../utils/convoAgentStore'
import useMediaQuery from '../utils/useMediaQuery'

const MIN_INPUT_HEIGHT = 80
const MAX_INPUT_HEIGHT = 500
const DEFAULT_INPUT_HEIGHT = 160
const POLL_INTERVAL_MS = 10000
const IDLE_TIMEOUT_MS = 120000 // 2 minutes
const INITIAL_LOOK_BACK = 12
const POLL_LOOK_BACK = 2
const FETCH_MORE_LOOK_BACK = 6

const STATUS_COLOR = {
  active:    '#38bdf8',
  complete:  '#4ade80',
  failed:    '#f87171',
  cancelled: '#f97316',
}

const MOBILE_BREAKPOINT = '(max-width: 768px)'
const DRAWER_Z_INDEX = 200
const BACKDROP_Z_INDEX = 100

const s = {
  page: {
    display: 'flex',
    gap: 16,
    height: 'calc(100vh - 130px)',
    minHeight: 400,
  },
  pageMobile: {
    position: 'relative',
    display: 'flex',
    gap: 0,
    height: 'calc(100vh - 130px)',
    minHeight: 400,
  },
  leftCol: {
    width: '38%',
    minWidth: 240,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    borderRadius: 10,
    border: '1px solid #2d3148',
    background: '#141824',
    overflow: 'hidden',
  },
  leftColMobile: (isOpen) => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 'min(80vw, 320px)',
    zIndex: DRAWER_Z_INDEX,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    borderRadius: '0 10px 10px 0',
    border: '1px solid #2d3148',
    background: '#141824',
    overflow: 'hidden',
    transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
    visibility: isOpen ? 'visible' : 'hidden',
    transition: isOpen
      ? 'transform 0.25s ease, visibility 0s linear 0s'
      : 'transform 0.25s ease, visibility 0s linear 0.25s',
    boxShadow: isOpen ? '0 0 24px rgba(0,0,0,0.5)' : 'none',
  }),
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: BACKDROP_Z_INDEX,
    borderRadius: 10,
  },
  rightCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 10,
    border: '1px solid #2d3148',
    background: '#141824',
    overflow: 'hidden',
  },
  colHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #2d3148',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#11141c',
    flexShrink: 0,
  },
  mobileColHeader: {
    padding: '12px 12px',
    borderBottom: '1px solid #2d3148',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#11141c',
    flexShrink: 0,
    flexWrap: 'wrap',
    gap: 8,
  },
  colTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: '1 1 auto',
  },
  colControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  mobileColControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  hamburger: {
    background: '#1e2438',
    border: '1px solid #2d3148',
    color: '#e2e8f0',
    fontSize: 16,
    lineHeight: 1,
    padding: '5px 9px',
    borderRadius: 6,
    cursor: 'pointer',
    flexShrink: 0,
  },
  drawerCloseBtn: {
    background: 'none',
    border: '1px solid #2d3148',
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 1,
    padding: '5px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    flexShrink: 0,
  },
  colTitle: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' },
  colMeta: { fontSize: 12, color: '#64748b' },
  scrollArea: { flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column' },
  scrollContent: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  loadMoreContainer: {
    padding: '8px 8px 0 8px',
    textAlign: 'center',
    marginTop: 0,
    flexShrink: 0,
    borderTop: '1px solid #2d3148',
  },
  historyScroll: { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 },

  convoCard: (selected) => ({
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${selected ? '#4d5880' : '#2d3148'}`,
    background: selected ? '#1e2438' : '#191d2b',
    cursor: 'pointer',
    marginBottom: 4,
    transition: 'all 0.15s ease',
  }),
  convoID: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#94a3b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginBottom: 4,
  },
  convoRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  badge: (color) => ({
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 7px',
    borderRadius: 20,
    background: (color || '#94a3b8') + '22',
    color: color || '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    border: `1px solid ${(color || '#94a3b8') + '44'}`,
  }),
  ts: { fontSize: 11, color: '#475569' },
  agentName: { fontSize: 11, color: '#7c86ad' },
  firstTurnPreview: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 4,
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },

  cancelBtn: {
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 7px',
    borderRadius: 20,
    background: '#f8717122',
    color: '#f87171',
    border: '1px solid #f8717144',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: { textAlign: 'center', color: '#475569', padding: '40px 0', fontSize: 14 },
  err: { color: '#f87171', fontSize: 12, padding: '8px 12px' },
  btn: {
    padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
    background: '#2d3148', color: '#94a3b8',
  },
  refreshLabel: { fontSize: 11, color: '#64748b' },
  paused: { fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: '#f6c90e22', color: '#f6c90e', border: '1px solid #f6c90e44' },
  active: { fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: '#4ade8022', color: '#4ade80', border: '1px solid #4ade8044' },
  convoChildren: {
    marginLeft: 14,
    paddingLeft: 8,
    borderLeft: '1px solid #2d3148',
  },
  collapseToggle: {
    display: 'block',
    width: '100%',
    background: 'none',
    border: 'none',
    borderTop: '1px solid #1e2438',
    color: '#475569',
    fontSize: 10,
    cursor: 'pointer',
    padding: '3px 0 0',
    textAlign: 'center',
    marginTop: 4,
  },
  turnInputArea: {
    padding: '10px 16px',
    borderTop: '1px solid #2d3148',
    background: '#11141c',
    flexShrink: 0,
  },
  divider: (active) => ({
    height: 6,
    cursor: 'ns-resize',
    background: active ? '#2d3758' : '#141824',
    borderTop: '1px solid #2d3148',
    borderBottom: '1px solid #2d3148',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    transition: 'background 0.1s',
  }),
}

function fmtTime(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return String(ts)
  }
}

function getOverallStatus(convo) {
  const first = convo?.first_session
  const last = convo?.last_session
  if (!last && !first) return 'unknown'
  if (first?.status === 'active' || last?.status === 'active') return 'active'
  // Use the latest session's terminal status so that a cancelled/failed turn
  // doesn't permanently taint the conversation once the user continues.
  return last?.status || first?.status || 'unknown'
}

const ConvoCard = memo(function ConvoCard({ convo, selected, onClick, onCancel, cancelling }) {
  const status = getOverallStatus(convo)
  const lastSession = convo.last_session
  const agentName = lastSession?.agent_name
  const groupMatch = (convo.convo_id || '').match(/_g(\d+)$/)
  const groupNum = groupMatch ? groupMatch[1] : null
  const [copyState, setCopyState] = useState('idle') // 'idle' | 'success' | 'error'
  const [errorExpanded, setErrorExpanded] = useState(false)
  const idRef = useRef(null)
  const iconRef = useRef(null)
  const [bubblePos, setBubblePos] = useState(null)
  const isTerminal = ['complete', 'failed', 'cancelled'].includes(status)
  const errorReason = isTerminal ? (lastSession?.error_reason || lastSession?.errorReason) : null
  const totalTokens = !isTerminal && lastSession?.total_tokens
    ? convo.total_tokens + lastSession.total_tokens
    : convo.total_tokens
  const errorLineCount = errorReason ? errorReason.split('\n').length : 0
  const errorCollapsible = errorLineCount > 3

  const handleCopyID = async (e) => {
    e.stopPropagation()
    const id = convo.convo_id || ''
    try {
      let ok = false
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(id)
          ok = true
        } catch (err) {
          // fall through to fallback
        }
      }
      if (!ok) {
        const ta = document.createElement('textarea')
        ta.value = id
        // place off-screen
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        try {
          ok = document.execCommand('copy')
        } catch (err) {
          ok = false
        }
        document.body.removeChild(ta)
      }
      if (ok) {
        setCopyState('success')
        // anchor bubble to the copy icon center if available, otherwise fall back to id container
        let r = null
        if (iconRef.current && iconRef.current.getBoundingClientRect) r = iconRef.current.getBoundingClientRect()
        else if (idRef.current && idRef.current.getBoundingClientRect) r = idRef.current.getBoundingClientRect()
        if (r) setBubblePos({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top) })
        setTimeout(() => { setCopyState('idle'); setBubblePos(null) }, 3000)
      } else {
        setCopyState('error')
        let r = null
        if (iconRef.current && iconRef.current.getBoundingClientRect) r = iconRef.current.getBoundingClientRect()
        else if (idRef.current && idRef.current.getBoundingClientRect) r = idRef.current.getBoundingClientRect()
        if (r) setBubblePos({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top) })
        setTimeout(() => { setCopyState('idle'); setBubblePos(null) }, 3000)
      }
    } catch (err) {
      // ignore
    }
  }

  return (
    <div style={s.convoCard(selected)} onClick={onClick}>
      <div ref={idRef} style={{ ...s.convoID, position: 'relative' }} title={convo.convo_id}>
        {truncateID(convo.convo_id)}
        <span
          ref={iconRef}
          onClick={handleCopyID}
          title="Copy convo ID"
          aria-label="Copy convo ID"
          style={{ fontSize: 12, marginLeft: 8, color: '#64748b', cursor: 'pointer' }}
        >
          📋
        </span>
        {copyState !== 'idle' && bubblePos && ReactDOM.createPortal(
          <div style={{ position: 'fixed', left: bubblePos.x, top: bubblePos.y - 6, transform: 'translate(-50%, -100%)', background: copyState === 'success' ? '#064e3b' : '#4c1f1f', color: '#d1fae5', padding: '6px 10px', borderRadius: 6, fontSize: 12, boxShadow: '0 2px 6px rgba(0,0,0,0.6)', zIndex: 9999 }}>
            {copyState === 'success' ? 'Copied' : 'Copy failed'}
          </div>,
          document.body
        )}
      </div>
      {convo.first_turn && <div style={s.firstTurnPreview} title={convo.first_turn}>{convo.first_turn}</div>}
      <div style={s.convoRow}>
        <span style={s.badge(STATUS_COLOR[status])}>{status}</span>
        {agentName && <span style={s.agentName}>{agentName}</span>}
        {groupNum && <span style={s.badge('#a78bfa')}>{`history ${groupNum}`}</span>}
        {status === 'active' && onCancel && (
          <button
            style={s.cancelBtn}
            onClick={(e) => { e.stopPropagation(); onCancel(convo.convo_id) }}
            disabled={cancelling}
          >
            {cancelling ? '…' : 'Cancel'}
          </button>
        )}
      </div>
      {errorReason && (
        <div>
          <div style={{ position: 'relative', fontSize: 11, color: '#f87171', marginTop: 4, wordBreak: 'break-word', lineHeight: 1.3, ...(errorCollapsible && !errorExpanded ? { maxHeight: 60, overflow: 'hidden' } : {}) }}>
            Error: {errorReason}
            {errorCollapsible && !errorExpanded && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 20,
                background: 'linear-gradient(transparent, #191d2b)',
                pointerEvents: 'none',
              }} />
            )}
          </div>
          {errorCollapsible && (
            <button style={s.collapseToggle} onClick={() => setErrorExpanded((v) => !v)}>
              {errorExpanded ? '▲ collapse' : '▼ expand'}
            </button>
          )}
        </div>
      )}
      <div style={s.convoRow}>
        <span style={s.ts}>{fmtTime(lastSession?.updated_at)}</span>
        {lastSession?.input_tokens > 0 && (
          <span style={{ fontSize: 11, color: '#475569' }}>tokens: {lastSession.input_tokens.toLocaleString()}/{(lastSession.output_tokens || 0).toLocaleString()}</span>
        )}
        {totalTokens > 0 && (
          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>total: {totalTokens.toLocaleString()}</span>
        )}
      </div>
    </div>
  )
})

function normalizeConvos(data) {
  if (!data) return { convos: [], markers: [] }
  const convos = []
  const markers = []

  const processItem = (item) => {
    if (item === null || item === undefined) return
    if (typeof item === 'number' && Number.isFinite(item)) {
      const s = String(Math.trunc(item))
      if (/^\d{10}$/.test(s)) markers.push(s)
      return
    }
    if (typeof item === 'string') {
      const t = item.trim()
      if (/^\d{10}$/.test(t)) { markers.push(t); return }
      if (t.startsWith('{')) {
        try { convos.push(JSON.parse(t)) } catch { /* skip */ }
        return
      }
      // Stream names like "convo_stream_2026060716" — extract the 10-digit
      // suffix as a pagination marker but don't treat them as conversations.
      const suffixMatch = t.match(/(\d{10})$/)
      if (suffixMatch) markers.push(suffixMatch[1])
      return
    }
    if (typeof item === 'object' && !Array.isArray(item)) {
      if (item.convo_id) { convos.push(item); return }
    }
  }

  if (Array.isArray(data)) {
    data.forEach(processItem)
  } else if (typeof data === 'object') {
    Object.values(data).forEach((v) => {
      if (Array.isArray(v)) v.forEach(processItem)
      else processItem(v)
    })
  }

  return { convos, markers }
}

function mergeConvos(existing, incoming) {
  const m = new Map()
  existing.forEach((c) => m.set(c.convo_id, c))
  incoming.forEach((c) => m.set(c.convo_id, c))
  const out = Array.from(m.values())
  out.sort((a, b) => {
    const ta = a.last_session?.updated_at ? new Date(a.last_session.updated_at).getTime() : 0
    const tb = b.last_session?.updated_at ? new Date(b.last_session.updated_at).getTime() : 0
    return tb - ta
  })
  return out
}

function buildConvoTree(convos) {
  const byID = new Map(convos.map((c) => [c.convo_id, c]))
  const childrenMap = new Map()
  const roots = []

  for (const c of convos) {
    const parentID = c.unified_convo_id
    if (parentID && parentID !== c.convo_id && byID.has(parentID)) {
      if (!childrenMap.has(parentID)) childrenMap.set(parentID, [])
      childrenMap.get(parentID).push(c)
    } else {
      roots.push(c)
    }
  }

  return roots.map((c) => ({ convo: c, children: childrenMap.get(c.convo_id) || [] }))
}

export default function ConversationsPage({ initialConvoId = '', onConvoIdChange = () => {}, onFocusMode = () => {} }) {
  const { creds } = useAuth()
  const [convos, setConvos] = useState([])
  const [selectedID, setSelectedID] = useState(initialConvoId || null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)
  const [oldestAsOf, setOldestAsOf] = useState('')
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [consumedMarkers, setConsumedMarkers] = useState(new Set())
  const consumedMarkersRef = useRef(consumedMarkers)

  // Keep ref in sync with state
  useEffect(() => {
    consumedMarkersRef.current = consumedMarkers
  }, [consumedMarkers])

  const [cancellingID, setCancellingID] = useState(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isHistoryPaused, setIsHistoryPaused] = useState(false)
  const [isSendingTurn, setIsSendingTurn] = useState(false)
  const [isNewConvo, setIsNewConvo] = useState(false)
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [engines, setEngines] = useState([])
  const [selectedEngine, setSelectedEngine] = useState('')
  const [currentDriver, setCurrentDriver] = useState('')
  const [currentEngine, setCurrentEngine] = useState('')
  const [showTools, setShowTools] = useState(false)
  const [showThoughts, setShowThoughts] = useState(false)
  const [showSubAgents, setShowSubAgents] = useState(false)
  const [showArchivedGroups, setShowArchivedGroups] = useState(false)
  const [isIdle, setIsIdle] = useState(false)
  const [inputAreaHeight, setInputAreaHeight] = useState(DEFAULT_INPUT_HEIGHT)
  const [isDraggingDivider, setIsDraggingDivider] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const timerRef = useRef(null)
  const idleTimerRef = useRef(null)
  const historyEndRef = useRef(null)
  const wasActiveRef = useRef(false)
  const wasIdleRef = useRef(false)
  const wasHistoryIdleRef = useRef(false)

  const isMobile = useMediaQuery(MOBILE_BREAKPOINT)

  // Agent picker state for recovery
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const [pendingTurn, setPendingTurn] = useState(null)
  const [agentMetadata, setAgentMetadata] = useState({})

  const fetchConvos = useCallback(async (mode = 'poll') => {
    const isInitial = mode === 'initial'
    const isFetchMore = mode === 'more'
    const lookBack = isInitial ? INITIAL_LOOK_BACK : (isFetchMore ? FETCH_MORE_LOOK_BACK : POLL_LOOK_BACK)
    const asOf = isFetchMore ? oldestAsOf : ''

    if (isInitial) {
      setConsumedMarkers(new Set())
    }

    if (isFetchMore) {
      setIsFetchingMore(true)
    } else {
      setLoading(isInitial)
    }
    setError('')

    try {
      const data = await listConvos(creds, { lookBack, asOf })
      const { convos: incoming, markers } = normalizeConvos(data)

      if (isFetchMore) {
        // Compute new consumedMarkers based on current state and response
        const newConsumed = new Set(consumedMarkersRef.current)

        // If no new conversations were loaded and we have an asOf,
        // mark this asOf as consumed (it's an empty time block)
        if (incoming.length === 0 && asOf) {
          newConsumed.add(asOf)
        }

        // Find the oldest candidate marker that is:
        // 1. Strictly older than the current asOf
        // 2. Not already consumed
        let newOldestAsOf = oldestAsOf
        if (asOf) {
          const sortedMarkers = [...markers].sort()
          const candidates = sortedMarkers.filter(
            (m) => (!newConsumed.has(m)) && m < asOf
          )

          if (candidates.length > 0) {
            // Use the oldest (smallest) candidate
            const next = candidates[0]
            newOldestAsOf = (!oldestAsOf || next < oldestAsOf) ? next : oldestAsOf
          } else {
            // No candidates found - all markers consumed or no markers
            newOldestAsOf = ''
          }
        }

        // Update both states (not nested)
        setConsumedMarkers(newConsumed)
        setOldestAsOf(newOldestAsOf)
      } else {
        // Initial or poll mode
        if (markers.length > 0) {
          setOldestAsOf((prev) => {
            const next = markers[0]
            return !prev || next < prev ? next : prev
          })
        } else {
          setOldestAsOf('')
        }
      }

      setConvos((prev) => isInitial ? mergeConvos([], incoming) : mergeConvos(prev, incoming))
      setLastRefreshedAt(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      if (isFetchMore) setIsFetchingMore(false)
      else setLoading(false)
    }
  }, [creds, oldestAsOf])

  // initial load
  useEffect(() => {
    fetchConvos('initial')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect transition from idle to active and fetch immediately
  useEffect(() => {
    const wasIdle = wasIdleRef.current
    wasIdleRef.current = isIdle

    if (wasIdle && !isIdle && !isPaused) {
      // Transitioning from idle to active - fetch immediately
      fetchConvos('poll')
    }
  }, [isIdle, isPaused, fetchConvos])

  // auto-poll — suspended while isPaused or idle
  useEffect(() => {
    if (isPaused || isIdle) {
      clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => fetchConvos('poll'), POLL_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [fetchConvos, isPaused, isIdle])

  const fetchHistory = useCallback((silent = false) => {
    if (!selectedID) return
    if (!silent) setHistoryLoading(true)
    setHistoryError('')
    getConvoHistory(creds, selectedID)
      .then((data) => {
        if (Array.isArray(data)) {
          setHistory(data)
        } else if (data && typeof data === 'object') {
          const vals = Object.values(data)
          setHistory(Array.isArray(vals[0]) ? vals[0] : [])
        } else {
          setHistory([])
        }
      })
      .catch((err) => setHistoryError(err.message))
      .finally(() => setHistoryLoading(false))
  }, [selectedID, creds])

  // load history when selection changes
  useEffect(() => {
    if (!selectedID) { setHistory([]); return }
    fetchHistory(false)
  }, [fetchHistory])

  // notify parent when selectedID changes
  useEffect(() => {
    onConvoIdChange(selectedID)
  }, [selectedID, onConvoIdChange])

  // sync initialConvoId from parent
  useEffect(() => {
    if (initialConvoId && initialConvoId !== selectedID) {
      setSelectedID(initialConvoId)
    }
  }, [initialConvoId])

  // Auto-open the drawer on mobile when no conversation is selected; close it
  // whenever we leave the mobile layout.
  useEffect(() => {
    if (!isMobile) {
      setIsDrawerOpen(false)
      return
    }
    if (!selectedID && !isNewConvo) {
      setIsDrawerOpen(true)
    }
  }, [isMobile, selectedID, isNewConvo])

  // Escape closes the drawer on mobile.
  useEffect(() => {
    if (!isMobile || !isDrawerOpen) return undefined
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsDrawerOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMobile, isDrawerOpen])
  // Fetch convo state to get current engine/driver when conversation changes
  useEffect(() => {
    if (!selectedID || !creds) return

    getConvoState(creds, selectedID)
      .then((data) => {
        if (!data) return

        // The response is keyed by node IP, e.g.:
        // { "10.255.255.254": { "agent": { "Driver": "openai", "Engine": "hy3" } } }
        // Need to unwrap the dynamic node IP key
        const keys = Object.keys(data)

        // Find the key that looks like an IP address (contains dots)
        // or just use the first key if there's only one
        let nodeKey = null
        if (keys.length === 1) {
          nodeKey = keys[0]
        } else {
          // Find key that looks like an IP address
          nodeKey = keys.find(k => k.includes('.')) || keys[0]
        }

        if (!nodeKey) return

        const convoData = data[nodeKey]
        const agent = convoData?.agent || {}

        // Extract Driver and Engine (note: CAPITALIZED in API response)
        const driver = agent?.Driver || agent?.driver || ''
        const engine = agent?.Engine || agent?.engine || ''

        if (driver && engine) {
          const engineValue = `${driver}:${engine}`
          setSelectedEngine(engineValue)
          setCurrentDriver(driver)
          setCurrentEngine(engine)
        }
      })
      .catch(() => {})
  }, [selectedID, creds])

  const handleCancelConvo = useCallback(async (convoID) => {
    setCancellingID(convoID)
    try {
      await cancelConvo(creds, convoID)
      fetchConvos('poll')
    } catch (err) {
      setError(err.message)
    } finally {
      setCancellingID(null)
    }
  }, [creds, fetchConvos])

  const handleSendTurn = useCallback(async (text, engine, driver) => {
    if (!text || !selectedID) return
    setIsSendingTurn(true)

    // Only send if different from current
    const finalDriver = driver && driver !== currentDriver ? driver : undefined
    const finalEngine = engine && engine !== currentEngine ? engine : undefined

    // Get last known agent for this conversation
    const lastAgent = getLastKnownAgent(selectedID, null)

    try {
      const result = await startTurn(creds, selectedID, text, finalEngine, finalDriver, lastAgent, false)

      // Unwrap node IP envelope if present (API may return { "10.255.255.254": { ...result } })
      const unwrappedResult = (result && !Array.isArray(result) && typeof result === "object" && !result.ok && !result.error && !result.data)
        ? Object.values(result).find((v) => v && typeof v === "object" && (v.ok !== undefined || v.error !== undefined)) ?? result
        : result;


      // Check for conversation_expired error
      if (unwrappedResult && unwrappedResult.ok === false && unwrappedResult.error === 'conversation_expired') {
        // Store pending turn context
        setPendingTurn({ text, engine: finalEngine, driver: finalDriver })
        setShowAgentPicker(true)
        return
      }

      // Success - update last known agent
      if (unwrappedResult && unwrappedResult.ok && unwrappedResult.data?.agent) {
        setLastKnownAgent(selectedID, unwrappedResult.data.agent)
      } else if (lastAgent) {
        setLastKnownAgent(selectedID, lastAgent)
      }

      // Optimistically set status to 'active' so polling restarts immediately
      fetchConvos('poll')
      fetchHistory(false)
    } catch (err) {
      setError(err.message)
      fetchConvos('poll')
      fetchHistory(false)
    } finally {
      setIsSendingTurn(false)
    }
  }, [creds, selectedID, fetchConvos, fetchHistory, currentDriver, currentEngine])

  const handleSendNewConvo = useCallback(async (agent, text, engine, driver) => {
    if (!text || !agent) return
    setIsSendingTurn(true)
    try {
      const raw = await startNewConvo(creds, agent, text, engine, driver)
      // Unwrap node envelope
      const result = (raw && !Array.isArray(raw) && typeof raw === 'object')
        ? (raw.convo_id ? raw : Object.values(raw).find((v) => v?.convo_id) ?? raw)
        : raw
      setIsNewConvo(false)
      await fetchConvos('poll')
      if (result?.convo_id) {
        setSelectedID(result.convo_id)
        setIsDrawerOpen(false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSendingTurn(false)
    }
  }, [creds, fetchConvos])

  const handleNewConvoClick = useCallback(() => {
    setIsNewConvo(true)
    setSelectedID(null)
    setHistory([])
    setIsDrawerOpen(false)
  }, [])

  const handleNavigateToSubAgent = useCallback((convoId) => {
    setSelectedID(convoId)
    setIsNewConvo(false)
    setIsDrawerOpen(false)
  }, [])

  const handleDividerMouseDown = useCallback((e) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = inputAreaHeight
    setIsDraggingDivider(true)
    const onMouseMove = (ev) => {
      const delta = startY - ev.clientY
      const newHeight = Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, startHeight + delta))
      setInputAreaHeight(newHeight)
    }
    const onMouseUp = () => {
      setIsDraggingDivider(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [inputAreaHeight])

  const handleSelectConvo = useCallback((convoId) => {
    setIsNewConvo(false)
    setSelectedID(convoId)
    setIsDrawerOpen(false)
  }, [])

  // Handle agent selection from picker (recovery flow)
  const handleAgentPick = useCallback(async (selectedAgent) => {
    setShowAgentPicker(false)
    const pending = pendingTurn
    setPendingTurn(null)

    if (!pending || !selectedID) return

    setIsSendingTurn(true)
    try {
      const result = await startTurn(creds, selectedID, pending.text, pending.engine, pending.driver, selectedAgent, true)

      // Unwrap node IP envelope if present (API may return { "10.255.255.254": { ...result } })
      const unwrappedResult = (result && !Array.isArray(result) && typeof result === "object" && !result.ok && !result.error && !result.data)
        ? Object.values(result).find((v) => v && typeof v === "object" && (v.ok !== undefined || v.error !== undefined)) ?? result
        : result;

      if (unwrappedResult && unwrappedResult.ok) {
        setLastKnownAgent(selectedID, selectedAgent)
        fetchConvos('poll')
        fetchHistory(false)
      } else {
        setHistoryError(unwrappedResult?.message || 'Failed to revive conversation')
      }
    } catch (err) {
      setHistoryError(err.message)
    } finally {
      setIsSendingTurn(false)
    }
  }, [creds, selectedID, pendingTurn, fetchConvos, fetchHistory])

  const handleAgentPickerCancel = useCallback(() => {
    setShowAgentPicker(false)
    setPendingTurn(null)
    setHistoryError('Conversation expired. Select an agent to revive it.')
  }, [])

  // fetch agent list once on mount
  useEffect(() => {
    listAgents(creds)
      .then((data) => {
        let names = data
        if (data && !Array.isArray(data) && typeof data === 'object') {
          const vals = Object.values(data)
          names = vals.find(Array.isArray) ?? []
        }
        if (!Array.isArray(names)) names = []
        setAgents(names)
        if (names.length > 0) setSelectedAgent(names[0])
      })
      .catch(() => {})
    listEngines(creds)
      .then((data) => {
        let list = data
        if (data && !Array.isArray(data) && typeof data === 'object') {
          const vals = Object.values(data)
          list = vals.find(Array.isArray) ?? []
        }
        if (!Array.isArray(list)) list = []
        setEngines(list)
      })
      .catch(() => {})
  }, [creds])

  // Memoized derived values
  const treeItems = useMemo(() => buildConvoTree(convos), [convos])
  const filteredTreeItems = useMemo(() => {
    if (showSubAgents && showArchivedGroups) return treeItems
    return treeItems.map(({ convo, children }) => {
      const keepChild = (child) => {
        // hide one-off sub-agent convos: children whose convo_id does NOT start with parent convo_id
        if (!showSubAgents) {
          if (child.convo_id && convo.convo_id && !child.convo_id.startsWith(convo.convo_id)) return false
        }
        // hide archived grouped convos like <id>_g<number>
        if (!showArchivedGroups) {
          if (/_g\d+$/i.test(child.convo_id)) return false
        }
        return true
      }
      const filteredChildren = children.filter(keepChild)
      // place archived grouped convos (suffix _g<number>) on top, ordered by the number desc
      const groupRe = /_g(\d+)$/i
      const groups = []
      const stateful = []
      const oneoffs = []
      for (const ch of filteredChildren) {
        const m = String(ch.convo_id || '').match(groupRe)
        if (m) groups.push({ ch, n: parseInt(m[1], 10) || 0 })
        else if (ch.convo_id && convo.convo_id && ch.convo_id.startsWith(convo.convo_id)) stateful.push(ch)
        else oneoffs.push(ch)
      }
      // archived groups first (by group number desc), then stateful (recent first), then one-offs (recent first)
      groups.sort((a, b) => b.n - a.n)
      const byRecent = (a, b) => {
        const ta = a.last_session?.updated_at ? new Date(a.last_session.updated_at).getTime() : 0
        const tb = b.last_session?.updated_at ? new Date(b.last_session.updated_at).getTime() : 0
        return tb - ta
      }
      stateful.sort(byRecent)
      oneoffs.sort(byRecent)
      const sortedChildren = groups.map((g) => g.ch).concat(stateful, oneoffs)
      let includeParent = true
      // only hide parent when it's an archived grouped convo
      if (!showArchivedGroups) {
        if (/_g\d+$/i.test(convo.convo_id)) includeParent = false
      }
      return includeParent ? { convo, children: sortedChildren } : null
    }).filter(Boolean)
  }, [treeItems, showSubAgents, showArchivedGroups])
  const selectedConvo = useMemo(
    () => convos.find((c) => c.convo_id === selectedID),
    [convos, selectedID]
  )
  const isSelectedConvoActive = useMemo(
    () => selectedConvo != null && getOverallStatus(selectedConvo) === 'active',
    [selectedConvo]
  )
  const isTopLevelConvo = useMemo(
    () => selectedConvo != null && (!selectedConvo.unified_convo_id || selectedConvo.unified_convo_id === selectedConvo.convo_id),
    [selectedConvo]
  )

  // Detect transition from idle to active for history and fetch immediately
  useEffect(() => {
    const wasHistoryIdle = wasHistoryIdleRef.current
    wasHistoryIdleRef.current = isIdle

    if (wasHistoryIdle && !isIdle && isSelectedConvoActive && !isHistoryPaused) {
      // Transitioning from idle to active with an active conversation - fetch history immediately
      fetchHistory(true)
    }
  }, [isIdle, isSelectedConvoActive, isHistoryPaused, fetchHistory])

  // auto-refresh history when the selected conversation is active (unless idle or paused)
  useEffect(() => {
    if (!isSelectedConvoActive || isHistoryPaused || isIdle) return
    const timer = setInterval(() => fetchHistory(true), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [fetchHistory, isSelectedConvoActive, isHistoryPaused, isIdle])

  // final refresh when conversation transitions from active -> inactive
  useEffect(() => {
    if (!isSelectedConvoActive && wasActiveRef.current) {
      fetchHistory(false)
    }
    wasActiveRef.current = isSelectedConvoActive
  }, [isSelectedConvoActive, fetchHistory])

  // scroll to bottom when history updates
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  // Handle idle timeout — pause auto-refresh after 2 minutes of inactivity
  useEffect(() => {
    const lastActivityTimeRef = { current: Date.now() }
    const ACTIVITY_THROTTLE_MS = 1000 // Only process activity once per second max

    const resetIdleTimer = () => {
      clearTimeout(idleTimerRef.current)
      setIsIdle(false)

      idleTimerRef.current = setTimeout(() => {
        setIsIdle(true)
      }, IDLE_TIMEOUT_MS)
    }

    const handleActivity = () => {
      const now = Date.now()
      const timeSinceLastActivity = now - lastActivityTimeRef.current

      // Only reset timer if enough time has passed since last activity
      if (timeSinceLastActivity > ACTIVITY_THROTTLE_MS) {
        lastActivityTimeRef.current = now
        resetIdleTimer()
      }
    }

    if (isPaused) {
      clearTimeout(idleTimerRef.current)
      return
    }

    resetIdleTimer()

    document.addEventListener('mousemove', handleActivity)
    document.addEventListener('keydown', handleActivity)
    document.addEventListener('touchstart', handleActivity)

    return () => {
      clearTimeout(idleTimerRef.current)
      document.removeEventListener('mousemove', handleActivity)
      document.removeEventListener('keydown', handleActivity)
      document.removeEventListener('touchstart', handleActivity)
    }
  }, [isPaused])

  return (
    <div style={isMobile ? s.pageMobile : s.page}>
      <style>{markdownCSS}</style>
      {/* Left column — conversation list (static on desktop, overlay drawer on mobile) */}
      <div
        id="conversation-list-panel"
        style={isMobile ? s.leftColMobile(isDrawerOpen) : s.leftCol}
        role="complementary"
        aria-label="Conversation list"
        aria-hidden={isMobile ? !isDrawerOpen : undefined}
      >
        <div style={s.colHeader}>
          <span style={s.colTitle}>Conversations</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isMobile && (
              <button
                style={s.drawerCloseBtn}
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close conversation list"
              >
                ✕
              </button>
            )}
            {lastRefreshedAt && (
              <span style={s.refreshLabel}>{lastRefreshedAt.toLocaleTimeString()}</span>
            )}
            <button style={{ ...s.btn, background: "#3b82f6", color: "#fff" }} onClick={handleNewConvoClick}>+ New</button>
            <button style={s.btn} onClick={() => setIsPaused((v) => !v)}>
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button style={s.btn} onClick={() => fetchConvos('initial')} disabled={loading}>
              {loading ? '…' : 'Refresh'}
            </button>
            {isPaused ? (
              <span style={s.paused}>paused</span>
            ) : isIdle ? (
              <span style={s.paused}>idle</span>
            ) : (
              <span style={s.active}>active</span>
            )}
          </div>
        </div>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #2d3148', background: '#0f1117', display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
            <input type="checkbox" checked={showSubAgents} onChange={(e) => setShowSubAgents(e.target.checked)} />
            <span>Show one-offs</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
            <input type="checkbox" checked={showArchivedGroups} onChange={(e) => setShowArchivedGroups(e.target.checked)} />
            <span>Show summarized history</span>
          </label>
        </div>
        {error && <div style={s.err}>{error}</div>}
        <div style={s.scrollArea}>
          <div style={s.scrollContent}>
            {convos.length === 0 && !loading && (
              <div style={s.empty}>
                {isMobile ? 'No conversations yet — start one with “+ New”' : 'No conversations yet'}
              </div>
            )}
            {filteredTreeItems.map(({ convo: c, children }) => (
              <div key={c.convo_id}>
                <ConvoCard
                  convo={c}
                  selected={c.convo_id === selectedID}
                  onClick={() => handleSelectConvo(c.convo_id === selectedID ? null : c.convo_id)}
                  onCancel={handleCancelConvo}
                  cancelling={cancellingID === c.convo_id}
                />
                {children.length > 0 && (
                  <div style={s.convoChildren}>
                    {children.map((child) => (
                      <ConvoCard
                        key={child.convo_id}
                        convo={child}
                        selected={child.convo_id === selectedID}
                        onClick={() => handleSelectConvo(child.convo_id === selectedID ? null : child.convo_id)}
                        onCancel={handleCancelConvo}
                        cancelling={cancellingID === child.convo_id}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {!loading && (
            <div style={s.loadMoreContainer}>
              <button style={s.btn} onClick={() => fetchConvos('more')} disabled={isFetchingMore || !oldestAsOf}>
                {isFetchingMore ? 'Loading…' : oldestAsOf ? 'Load more' : 'No more'}
              </button>
            </div>
          )}
        </div>
      </div>

      {isMobile && isDrawerOpen && (
        <div
          style={s.backdrop}
          onClick={() => setIsDrawerOpen(false)}
          role="presentation"
          aria-hidden="true"
          data-testid="conversation-drawer-backdrop"
        />
      )}

      {/* Right column — history */}
      <div style={s.rightCol}>
        <div style={isMobile ? s.mobileColHeader : s.colHeader}>
          <div style={s.colTitleWrap}>
            {isMobile && (
              <button
                style={s.hamburger}
                onClick={() => setIsDrawerOpen(true)}
                aria-label="Open conversation list"
                aria-expanded={isDrawerOpen}
                aria-controls="conversation-list-panel"
              >
                ☰
              </button>
            )}
            <span style={s.colTitle}>
              {isNewConvo
                ? 'New Conversation'
                : selectedConvo
                  ? <>History — <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{truncateID(selectedID)}</span></>
                  : 'History'}
            </span>
          </div>
          <div style={isMobile ? s.mobileColControls : s.colControls}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
              <input type="checkbox" checked={showTools} onChange={(e) => setShowTools(e.target.checked)} />
              <span>Show tools</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
              <input type="checkbox" checked={showThoughts} onChange={(e) => setShowThoughts(e.target.checked)} />
              <span>Show thoughts</span>
            </label>
            {isSelectedConvoActive && (
              <button style={s.btn} onClick={() => setIsHistoryPaused((v) => !v)}>
                {isHistoryPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
            )}
            {selectedID && (
              <button style={s.btn} onClick={() => onFocusMode(selectedID)}>
                ⧉ Focus mode
              </button>
            )}
          </div>
        </div>
        <div style={s.historyScroll}>
          {isNewConvo && (
            <div style={s.empty}>Select an agent and type your first message below</div>
          )}
          {!isNewConvo && !selectedID && (
            <div style={s.empty}>
              {isMobile ? 'Open the conversation list to pick one' : 'Select a conversation to view its history'}
            </div>
          )}
          {!isNewConvo && selectedID && historyLoading && (
            <div style={s.empty}>Loading…</div>
          )}
          {!isNewConvo && selectedID && historyError && (
            <div style={s.err}>{historyError}</div>
          )}
          {!isNewConvo && selectedID && !historyLoading && !historyError && history.length === 0 && (
            <div style={s.empty}>
              {selectedConvo && isSelectedConvoActive ? 'Preparing the system prompt…' : 'No messages in history'}
            </div>
          )}
          {history.map((msg, i) => {
            const role = msg.Role || msg.role || ''
            if (!showTools && (role === 'tool' || role === 'tool_result' || (role === 'agent' && !msg.content))) return null
            return <MessageBubble key={`${i}`} msg={msg} idx={i} showTools={showTools} showThoughts={showThoughts} onNavigateToSubAgent={handleNavigateToSubAgent} />
          })}
          <div ref={historyEndRef} />
        </div>
        {(isNewConvo || (!isNewConvo && selectedConvo && isTopLevelConvo && !isSelectedConvoActive)) && (
          <div
            onMouseDown={handleDividerMouseDown}
            style={s.divider(isDraggingDivider)}
          >
            <div style={{ width: 24, height: 2, borderRadius: 1, background: isDraggingDivider ? '#6b7db3' : '#4d5880' }} />
          </div>
        )}
        {isNewConvo && (
          <div style={{ height: inputAreaHeight, flexShrink: 0, overflow: 'hidden' }}>
            <NewConvoInput
              agents={agents}
              selectedAgent={selectedAgent}
              onAgentChange={setSelectedAgent}
              engines={engines}
              selectedEngine={selectedEngine}
              onEngineChange={setSelectedEngine}
              onSend={handleSendNewConvo}
              isSending={isSendingTurn}
              inputHeight={inputAreaHeight - 20}
            />
          </div>
        )}
        {!isNewConvo && selectedConvo && isTopLevelConvo && !isSelectedConvoActive && (
          <div style={{ ...s.turnInputArea, height: inputAreaHeight }}>
            <TurnInputArea
              onSubmit={handleSendTurn}
              isSending={isSendingTurn}
              placeholder="Start a new turn…"
              buttonLabel="Send"
              inputHeight={inputAreaHeight - 20}
              engines={engines}
              selectedEngine={selectedEngine}
              onEngineChange={setSelectedEngine}
            />
          </div>
        )}
      </div>
      {showAgentPicker && (
        <AgentPickerModal
          agents={agents}
          agentMetadata={agentMetadata}
          onSelect={handleAgentPick}
          onCancel={handleAgentPickerCancel}
        />
      )}
    </div>
  )
}
