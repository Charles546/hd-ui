import { useState, useEffect, useCallback, useRef } from 'react'
import { getConvoHistory, startTurn, listEngines } from '../api'
import { useAuth } from '../auth/AuthContext'
import TurnInputArea from './TurnInputArea'
import { MessageBubble, truncateID, markdownCSS } from './MessageBubble'

const POLL_INTERVAL_MS = 10000
const IDLE_TIMEOUT_MS = 120000 // 2 minutes
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
  historyScroll: { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  empty: { textAlign: 'center', color: '#475569', padding: '40px 0', fontSize: 14 },
  err: { color: '#f87171', fontSize: 12, padding: '8px 12px' },
  btn: {
    padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
    background: '#2d3148', color: '#94a3b8',
  },
  paused: { fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: '#f6c90e22', color: '#f6c90e', border: '1px solid #f6c90e44' },
  active: { fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: '#4ade8022', color: '#4ade80', border: '1px solid #4ade8044' },
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

function getConvoStatus(history) {
  if (!history || history.length === 0) return 'unknown'

  // Scan all messages for explicit terminal status.
  // Some messages in the history may carry a .status field indicating
  // the conversation state at the time that message was recorded.
  for (let i = history.length - 1; i >= 0; i--) {
    const st = history[i]?.status
    if (st === 'complete' || st === 'failed' || st === 'cancelled') return st
  }

  const lastMsg = history[history.length - 1]
  const lastRole = lastMsg?.Role || lastMsg?.role || ''

  // A system message as the last entry signals the conversation has been
  // summarised / archived / completed.
  if (lastRole === 'system') return 'complete'

  // If the last message is from the agent and it has no pending/unanswered
  // tool calls (i.e. ToolCalls without matching ToolResult), the agent has
  // finished its turn and the conversation is complete.
  if (lastRole === 'agent') {
    const toolCalls = lastMsg?.ToolCalls || []
    const toolResults = lastMsg?.ToolResult || []
    // If there are tool calls but fewer results than calls, the agent is
    // still waiting — conversation is active.
    if (toolCalls.length > 0 && toolResults.length < toolCalls.length) return 'active'
    // Agent produced a final response (no outstanding tool calls).
    return 'complete'
  }

  // For any other role (user, tool, tool_result, etc.) the conversation
  // is still in progress — the agent hasn't had its final say yet.
  return 'active'
}

export default function ConvoHistoryPage({ convoId, onNavigateToConvo }) {
  const { creds } = useAuth()
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [isPaused, setIsPaused] = useState(false)
  const [isSendingTurn, setIsSendingTurn] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [showThoughts, setShowThoughts] = useState(false)
  const [isIdle, setIsIdle] = useState(false)
  const [convoStatus, setConvoStatus] = useState('unknown')
  const [inputAreaHeight, setInputAreaHeight] = useState(DEFAULT_INPUT_HEIGHT)
  const [isDraggingDivider, setIsDraggingDivider] = useState(false)
  const [engines, setEngines] = useState([])
  const [selectedEngine, setSelectedEngine] = useState("")
  const [currentDriver, setCurrentDriver] = useState('')
  const [currentEngine, setCurrentEngine] = useState('')
  const timerRef = useRef(null)
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
        setConvoStatus(getConvoStatus(msgs))
      })
      .catch((err) => setHistoryError(err.message))
      .finally(() => setHistoryLoading(false))
  }, [convoId, creds])

  // initial load
  useEffect(() => {
    if (!convoId) { setHistory([]); setConvoStatus('unknown'); return }
    fetchHistory(false)
  }, [fetchHistory])

  // Fetch convo state to get current engine/driver
  useEffect(() => {
    if (!convoId || !creds?.token) return
    
    fetch(`/api/conversations/${encodeURIComponent(convoId)}/state`, {
      headers: { "Authorization": `Bearer ${creds.token}` }
    })
      .then(res => res.json())
      .then((data) => {
        if (!data) return
        
        let convoData = data
        const keys = Object.keys(data || {})
        if (keys.length === 1 && keys[0].includes(".")) {
          convoData = data[keys[0]]
        }
        
        const agent = convoData?.agent || {}
        const driver = agent?.driver || agent?.Driver || ""
        const engine = agent?.engine || agent?.Engine || ""
        
        if (driver && engine) {
          setSelectedEngine(`${driver}:${engine}`)
          setCurrentDriver(driver)
          setCurrentEngine(engine)
        }
      })
      .catch(() => {})
  }, [convoId, creds])

  // Detect transition from idle to active and fetch immediately
  useEffect(() => {
    const wasIdle = wasIdleRef.current
    wasIdleRef.current = isIdle

    if (wasIdle && !isIdle && isActive && !isPaused) {
      fetchHistory(true)
    }
  }, [isIdle, isActive, isPaused, fetchHistory])

  // auto-poll when active, not paused, not idle
  useEffect(() => {
    if (!isActive || isPaused || isIdle) {
      clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => fetchHistory(true), POLL_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [fetchHistory, isActive, isPaused, isIdle])

  // final refresh when conversation transitions from active → inactive
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
        if (data && !Array.isArray(data) && typeof data === "object") {
          const vals = Object.values(data)
          list = vals.find(Array.isArray) ?? []
        }
        if (!Array.isArray(list)) list = []
        setEngines(list)
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
    
    // Only send if different from current
    const finalDriver = driver && driver !== currentDriver ? driver : undefined
    const finalEngine = engine && engine !== currentEngine ? engine : undefined
    
    try {
      await startTurn(creds, convoId, text, finalEngine, finalDriver)
      fetchHistory(false)
    } catch (err) {
      setHistoryError(err.message)
    } finally {
      setIsSendingTurn(false)
    }
  }, [creds, convoId, fetchHistory, currentDriver, currentEngine])

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
    <div style={s.page}>
      <style>{markdownCSS}</style>
      {/* Header */}
      <div style={s.colHeader}>
        <span style={s.colTitle}>
          History — <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{truncateID(convoId)}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
            <input type="checkbox" checked={showTools} onChange={(e) => setShowTools(e.target.checked)} />
            <span>Show tools</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
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
      <div style={s.historyScroll}>
        {historyLoading && history.length === 0 && (
          <div style={s.empty}>Loading…</div>
        )}
        {historyError && (
          <div style={s.err}>{historyError}</div>
        )}
        {!historyLoading && !historyError && history.length === 0 && (
          <div style={s.empty}>No messages in history</div>
        )}
        {history.map((msg, i) => {
          const role = msg.Role || msg.role || ''
          const hasToolCalls = (msg.ToolCalls || []).length > 0
          if (!showTools && (role === 'tool' || role === 'tool_result' || (role === 'agent' && hasToolCalls))) return null
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
        </>
      )}
    </div>
  )
}
