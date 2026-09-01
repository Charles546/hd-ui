import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getConvoHistory, getConvoState, startTurn, listEngines, listAgents } from '../api'
import { useAuth } from '../auth/AuthContext'
import TurnInputArea from './TurnInputArea'
import AgentPickerModal from './AgentPickerModal'
import { MessageBubble, truncateID, markdownCSS } from './MessageBubble'
import { getLastKnownAgent, setLastKnownAgent } from '../utils/convoAgentStore'
import useMediaQuery from '../utils/useMediaQuery'

const MOBILE_BREAKPOINT = '(max-width: 768px)'
const POLL_INTERVAL_MS = 10000
const IDLE_TIMEOUT_MS = 120000 // 2 minutes
const CONVO_STATE_POLL_INTERVAL_MS = 30000 // Poll status less frequently than history
const MIN_INPUT_HEIGHT = 80
const MAX_INPUT_HEIGHT = 500
const DEFAULT_INPUT_HEIGHT = 160

const STATUS_COLOR = {
  active:    '#38bdf8',
  complete:  '#4ade80',
  failed:    '#f87171',
  cancelled: '#f97316',
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 60px)',
    minHeight: 400,
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
  colTitle: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' },
  historyScroll: { flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 },
  empty: { textAlign: 'center', color: '#475569', padding: '40px 16px', fontSize: 14 },
  err: { color: '#f87171', fontSize: 12, padding: '8px 12px' },
  btn: {
    padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
    background: '#2d3148', color: '#94a3b8',
  },
  paused: { fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: '#f6c90e22', color: '#f6c90e', border: '1px solid #f6c90e44' },
  active: { fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: '#4ade8022', color: '#4ade80', border: '1px solid #4ade8044' },
  turnInputArea: {
    padding: 0,
    borderTop: '0px none',
    background: '#11141c',
    flexShrink: 0,
    overflow: 'hidden',
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
  pageMobile: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100dvh - 100px)',
    minHeight: 400,
    borderRadius: 10,
    border: '1px solid #2d3148',
    background: '#141824',
    overflow: 'hidden',
  },
  colHeaderMobile: {
    padding: '10px 12px',
    borderBottom: '1px solid #2d3148',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 8,
    background: '#11141c',
    flexShrink: 0,
  },
  colHeaderControlsMobile: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    rowGap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    width: '100%',
  },
  historyScrollMobile: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minHeight: 0,
  },
  turnInputAreaMobile: {
    padding: 0,
    borderTop: '0px none',
    background: '#11141c',
    flexShrink: 0,
    overflow: 'hidden',
  },
}

function getConvoStatus(history) {
  if (!history || history.length === 0) return 'unknown'

  for (let i = history.length - 1; i >= 0; i--) {
    const st = history[i]?.status
    if (st === 'complete' || st === 'failed' || st === 'cancelled') return st
  }

  const lastMsg = history[history.length - 1]
  const lastRole = lastMsg?.Role || lastMsg?.role || ''

  if (lastRole === 'system') return 'complete'

  if (lastRole === 'agent') {
    const toolCalls = lastMsg?.ToolCalls || []
    const toolResults = lastMsg?.ToolResult || []
    if (toolCalls.length > 0 && toolResults.length < toolCalls.length) return 'active'
    return 'complete'
  }

  return 'active'
}

function getConvoStateStatus(convoState) {
  if (!convoState || typeof convoState !== 'object') return null

  const VALID_STATUSES = new Set(['active', 'complete', 'failed', 'cancelled'])

  for (const key of Object.keys(convoState)) {
    const val = convoState[key]
    if (val && typeof val === 'object') {
      if (val.last_session?.status && VALID_STATUSES.has(val.last_session.status)) {
        return val.last_session.status
      }
      if (val.first_session?.status && VALID_STATUSES.has(val.first_session.status)) {
        return val.first_session.status
      }
    }
  }

  if (convoState.last_session?.status && VALID_STATUSES.has(convoState.last_session.status)) {
    return convoState.last_session.status
  }
  if (convoState.first_session?.status && VALID_STATUSES.has(convoState.first_session.status)) {
    return convoState.first_session.status
  }

  return null
}

function deriveConvoStatus(convoState, history) {
  const sessionStatus = getConvoStateStatus(convoState)
  if (sessionStatus) return sessionStatus
  return getConvoStatus(history)
}

export default function ConvoHistoryPage({ convoId, onNavigateToConvo }) {
  const { creds } = useAuth()
  const [history, setHistory] = useState([])
  const [convoState, setConvoState] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [isPaused, setIsPaused] = useState(false)
  const [isSendingTurn, setIsSendingTurn] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [showThoughts, setShowThoughts] = useState(false)
  const [isIdle, setIsIdle] = useState(false)
  const [convoStatus, setConvoStatus] = useState('unknown')
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT)
  const [inputAreaHeight, setInputAreaHeight] = useState(DEFAULT_INPUT_HEIGHT)
  const [isDraggingDivider, setIsDraggingDivider] = useState(false)
  const [engines, setEngines] = useState([])
  const [selectedEngine, setSelectedEngine] = useState('')
  const [currentDriver, setCurrentDriver] = useState('')
  const [currentEngine, setCurrentEngine] = useState('')
  const [agents, setAgents] = useState([])
  const [agentMetadata, setAgentMetadata] = useState({})

  // Agent picker state
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const [pendingTurn, setPendingTurn] = useState(null)

  const timerRef = useRef(null)
  const convoStateTimerRef = useRef(null)
  const idleTimerRef = useRef(null)
  const historyEndRef = useRef(null)
  const wasActiveRef = useRef(false)
  const wasIdleRef = useRef(false)

  const isActive = convoStatus === 'active'

  const fetchHistory = useCallback((silent = false) => {
    if (!convoId) return
    if (!silent) setHistoryLoading(true)
    setHistoryError('')
    getConvoHistory(creds, convoId)
      .then((data) => {
        let msgs = []
        if (Array.isArray(data)) {
          msgs = data
        } else if (data && typeof data === 'object') {
          const vals = Object.values(data)
          msgs = Array.isArray(vals[0]) ? vals[0] : []
        }
        setHistory(msgs)
        setConvoStatus(deriveConvoStatus(convoStateRef.current, msgs))
      })
      .catch((err) => setHistoryError(err.message))
      .finally(() => setHistoryLoading(false))
  }, [convoId, creds])

  const convoStateRef = useRef(null)

  const fetchConvoState = useCallback(() => {
    if (!convoId || !creds) return

    getConvoState(creds, convoId)
      .then((data) => {
        if (!data) return

        setConvoState(data)
        convoStateRef.current = data

        const sessionStatus = getConvoStateStatus(data)
        if (sessionStatus) {
          setConvoStatus(sessionStatus)
        }

        const keys = Object.keys(data)
        let nodeKey = null
        if (keys.length === 1) {
          nodeKey = keys[0]
        } else {
          nodeKey = keys.find(k => k.includes('.')) || keys[0]
        }

        if (!nodeKey) return

        const convoData = data[nodeKey]
        const agent = convoData?.agent || {}

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
  }, [convoId, creds])

  // initial load
  useEffect(() => {
    if (!convoId) {
      setHistory([])
      setConvoState(null)
      convoStateRef.current = null
      setConvoStatus('unknown')
      return
    }
    fetchHistory(false)
    fetchConvoState()
  }, [fetchHistory, fetchConvoState])

  // Detect transition from idle to active and fetch immediately
  useEffect(() => {
    const wasIdle = wasIdleRef.current
    wasIdleRef.current = isIdle

    if (wasIdle && !isIdle && isActive && !isPaused) {
      fetchHistory(true)
    }
  }, [isIdle, isActive, isPaused, fetchHistory])

  // auto-poll history when active, not paused, not idle
  useEffect(() => {
    if (!isActive || isPaused || isIdle) {
      clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => fetchHistory(true), POLL_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [fetchHistory, isActive, isPaused, isIdle])

  // auto-poll convoState when active, not paused, not idle
  useEffect(() => {
    if (!isActive || isPaused || isIdle) {
      clearInterval(convoStateTimerRef.current)
      return
    }

    convoStateTimerRef.current = setInterval(() => fetchConvoState(), CONVO_STATE_POLL_INTERVAL_MS)
    return () => clearInterval(convoStateTimerRef.current)
  }, [fetchConvoState, isActive, isPaused, isIdle])

  // final refresh when conversation transitions from active -> inactive
  useEffect(() => {
    if (!isActive && wasActiveRef.current) {
      fetchHistory(false)
    }
    wasActiveRef.current = isActive
  }, [isActive, fetchHistory])

  // scroll to bottom when history updates
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  // idle timeout
  useEffect(() => {
    const lastActivityTimeRef = { current: Date.now() }
    const ACTIVITY_THROTTLE_MS = 1000

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

  // fetch engine list once on mount
  useEffect(() => {
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

  // fetch agent list once on mount
  useEffect(() => {
    listAgents(creds)
      .then((data) => {
        let agentsList = []
        let metadata = {}
        if (data && !Array.isArray(data) && typeof data === 'object') {
          const vals = Object.values(data)
          agentsList = vals.find(Array.isArray) ?? []
          // If the API returns detailed agent objects, extract metadata
          if (Array.isArray(vals[0]) && vals[0].length > 0 && typeof vals[0][0] === 'object') {
            for (const agent of vals[0]) {
              if (agent && agent.name) {
                metadata[agent.name] = {
                  engine: agent.Engine || agent.engine,
                  driver: agent.Driver || agent.driver,
                }
              }
            }
          }
        }
        if (!Array.isArray(agentsList)) agentsList = []
        setAgents(agentsList)
        setAgentMetadata(metadata)
      })
      .catch(() => {})
  }, [creds])

  const handleNavigateToSubAgent = useCallback((subConvoId) => {
    if (onNavigateToConvo) {
      onNavigateToConvo(subConvoId)
    }
  }, [onNavigateToConvo])

  const handleSendTurn = useCallback(async (text, engine, driver) => {
    if (!text || !convoId) return
    setIsSendingTurn(true)

    const finalDriver = driver && driver !== currentDriver ? driver : undefined
    const finalEngine = engine && engine !== currentEngine ? engine : undefined

    // Get last known agent for this conversation
    const lastAgent = getLastKnownAgent(convoId, convoState)

    try {
      const result = await startTurn(creds, convoId, text, finalEngine, finalDriver, lastAgent, false)

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
        setLastKnownAgent(convoId, unwrappedResult.data.agent)
      } else if (lastAgent) {
        setLastKnownAgent(convoId, lastAgent)
      }

      // Optimistically set status to 'active' so polling restarts immediately
      setConvoStatus('active')
      fetchConvoState()
      fetchHistory(false)
    } catch (err) {
      setHistoryError(err.message)
      fetchConvoState()
      fetchHistory(false)
    } finally {
      setIsSendingTurn(false)
    }
  }, [creds, convoId, fetchHistory, fetchConvoState, setConvoStatus, currentDriver, currentEngine, convoState])

  const handleAgentPick = useCallback(async (selectedAgent) => {
    setShowAgentPicker(false)
    const pending = pendingTurn
    setPendingTurn(null)

    if (!pending || !convoId) return

    setIsSendingTurn(true)
    try {
      const result = await startTurn(creds, convoId, pending.text, pending.engine, pending.driver, selectedAgent, true)

      // Unwrap node IP envelope if present (API may return { "10.255.255.254": { ...result } })
      const unwrappedResult = (result && !Array.isArray(result) && typeof result === "object" && !result.ok && !result.error && !result.data)
        ? Object.values(result).find((v) => v && typeof v === "object" && (v.ok !== undefined || v.error !== undefined)) ?? result
        : result;

      if (unwrappedResult && unwrappedResult.ok) {
        setLastKnownAgent(convoId, selectedAgent)
        setConvoStatus('active')
        fetchConvoState()
        fetchHistory(false)
      } else {
        setHistoryError(unwrappedResult?.message || 'Failed to revive conversation')
      }
    } catch (err) {
      setHistoryError(err.message)
    } finally {
      setIsSendingTurn(false)
    }
  }, [creds, convoId, pendingTurn, fetchConvoState, fetchHistory, setConvoStatus])

  const handleAgentPickerCancel = useCallback(() => {
    setShowAgentPicker(false)
    setPendingTurn(null)
    setHistoryError('Conversation expired. Select an agent to revive it.')
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

  const statusColor = STATUS_COLOR[convoStatus] || '#94a3b8'

  return (
    <div style={isMobile ? s.pageMobile : s.page} data-testid="convo-history-page">
      <style>{markdownCSS}</style>
      {/* Header */}
      <div style={isMobile ? s.colHeaderMobile : s.colHeader} data-testid="convo-header">
        <span style={s.colTitle}>
          History — <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{truncateID(convoId)}</span>
        </span>
        <div style={isMobile ? s.colHeaderControlsMobile : { display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={showTools} onChange={(e) => setShowTools(e.target.checked)} />
            <span>Show tools</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={showThoughts} onChange={(e) => setShowThoughts(e.target.checked)} />
            <span>Show thoughts</span>
          </label>
          {isActive && (
            <button style={s.btn} onClick={() => setIsPaused((v) => !v)}>
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: statusColor + '22', color: statusColor, textTransform: 'uppercase', letterSpacing: 0.5, border: `1px solid ${statusColor}44` }}>
            {convoStatus}
          </span>
          {isActive && !isPaused && !isIdle ? (
            <span style={s.active}>polling</span>
          ) : isPaused ? (
            <span style={s.paused}>paused</span>
          ) : isIdle ? (
            <span style={s.paused}>idle</span>
          ) : null}
        </div>
      </div>

      {/* History scroll area */}
      <div style={isMobile ? s.historyScrollMobile : s.historyScroll} data-testid="convo-history-scroll">
        {historyLoading && history.length === 0 && (
          <div style={s.empty}>Loading…</div>
        )}
        {historyError && (
          <div style={s.err}>{historyError}</div>
        )}
        {!historyLoading && !historyError && history.length === 0 && (
          <div style={s.empty}>
            {convoState && isActive ? 'Preparing the system prompt…' : 'No messages in history'}
          </div>
        )}
        {history.map((msg, i) => {
          const role = msg.Role || msg.role || ''
          if (!showTools && (role === 'tool' || role === 'tool_result' || (role === 'agent' && !msg.content))) return null
          return <MessageBubble key={`${i}`} msg={msg} idx={i} showTools={showTools} showThoughts={showThoughts} onNavigateToSubAgent={handleNavigateToSubAgent} />
        })}
        <div ref={historyEndRef} />
      </div>

      {/* Turn input — only when conversation is NOT active */}
      {!isActive && (
        <>
          <div
            onMouseDown={handleDividerMouseDown}
            style={s.divider(isDraggingDivider)}
          >
            <div style={{ width: 24, height: 2, borderRadius: 1, background: isDraggingDivider ? '#6b7db3' : '#4d5880' }} />
          </div>
          <div
            data-testid="convo-turn-input-area"
            style={isMobile ? { ...s.turnInputAreaMobile, height: inputAreaHeight } : { ...s.turnInputArea, height: inputAreaHeight }}
          >
            <TurnInputArea
              onSubmit={handleSendTurn}
              isSending={isSendingTurn}
              placeholder="Start a new turn…"
              buttonLabel="Send"
              engines={engines}
              selectedEngine={selectedEngine}
              onEngineChange={setSelectedEngine}
            />
          </div>
        </>
      )}

      {/* Agent Picker Modal */}
      {showAgentPicker && (
        <AgentPickerModal
          agents={agents}
          agentMetadata={agentMetadata}
          onSelect={handleAgentPick}
          onCancel={handleAgentPickerCancel}
          title="Conversation expired. Select an agent to revive it."
        />
      )}
    </div>
  )
}
