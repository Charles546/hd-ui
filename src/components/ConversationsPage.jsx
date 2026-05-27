import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { listConvos, getConvoHistory, cancelConvo } from '../api'
import { useAuth } from '../auth/AuthContext'

const POLL_INTERVAL_MS = 10000
const INITIAL_LOOK_BACK = 12
const POLL_LOOK_BACK = 2

const STATUS_COLOR = {
  active:    '#38bdf8',
  complete:  '#4ade80',
  failed:    '#f87171',
  cancelled: '#f97316',
}

const ROLE_COLOR = {
  user:   '#38bdf8',
  agent:  '#4ade80',
  system: '#94a3b8',
  tool:   '#f6c90e',
}

const s = {
  page: {
    display: 'flex',
    gap: 16,
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
  colTitle: { fontSize: 14, fontWeight: 700, color: '#e2e8f0' },
  colMeta: { fontSize: 12, color: '#64748b' },
  scrollArea: { flex: 1, overflowY: 'auto', padding: 8 },
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

  msgRow: (role) => ({
    display: 'flex',
    justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
  }),
  msgBubble: (role) => ({
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #2d3148',
    background: role === 'user' ? '#162030' : role === 'agent' ? '#12201a' : '#191d2b',
    maxWidth: '75%',
    wordBreak: 'break-word',
    textAlign: 'left',
  }),
  msgHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  msgRole: (role) => ({
    fontSize: 11,
    fontWeight: 700,
    color: ROLE_COLOR[role] || '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }),
  viewSelect: {
    fontSize: 10,
    background: '#0f1117',
    color: '#64748b',
    border: '1px solid #2d3148',
    borderRadius: 4,
    padding: '1px 4px',
    cursor: 'pointer',
    outline: 'none',
  },
  msgContent: {
    fontSize: 13,
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
  },
  toolCallID: { fontSize: 10, color: '#475569', marginTop: 2 },
  toolCallCard: {
    background: '#0d1017',
    borderRadius: 6,
    border: '1px solid #2d3148',
    padding: '6px 10px',
  },
  toolCallFuncName: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 700,
    color: '#f6c90e',
    marginBottom: 4,
  },
  toolCallJson: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#94a3b8',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: 0,
    lineHeight: 1.5,
  },
  toolResultLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
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
  convoChildren: {
    marginLeft: 14,
    paddingLeft: 8,
    borderLeft: '1px solid #2d3148',
  },
}

function fmtTime(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return String(ts)
  }
}

function truncateID(id) {
  if (!id) return ''
  return id.length > 20 ? id.slice(0, 8) + '…' + id.slice(-6) : id
}

function getOverallStatus(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return 'unknown'
  if (sessions.some((s) => s.status === 'active')) return 'active'
  // Use the latest session's terminal status so that a cancelled/failed turn
  // doesn't permanently taint the conversation once the user continues.
  return sessions[sessions.length - 1]?.status || 'unknown'
}

function ConvoCard({ convo, selected, onClick, onCancel, cancelling }) {
  const status = getOverallStatus(convo.sessions)
  const latestSession = convo.sessions?.[convo.sessions.length - 1]
  const agentNames = [...new Set((convo.sessions || []).map((s) => s.agent_name).filter(Boolean))]

  return (
    <div style={s.convoCard(selected)} onClick={onClick}>
      <div style={s.convoID} title={convo.convo_id}>{truncateID(convo.convo_id)}</div>
      <div style={s.convoRow}>
        <span style={s.badge(STATUS_COLOR[status])}>{status}</span>
        {agentNames.map((name) => (
          <span key={name} style={s.agentName}>{name}</span>
        ))}
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
      <div style={s.convoRow}>
        <span style={s.ts}>{fmtTime(latestSession?.updated_at)}</span>
        {convo.sessions?.length > 0 && (
          <span style={{ fontSize: 11, color: '#475569' }}>{convo.sessions.length} session{convo.sessions.length !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  )
}

const COLLAPSE_LINE_THRESHOLD = 3

function CollapsiblePre({ text, bg }) {
  const lines = text.split('\n').length
  const collapsible = lines > COLLAPSE_LINE_THRESHOLD
  const [expanded, setExpanded] = useState(false)
  const collapsed = collapsible && !expanded
  return (
    <>
      <div style={{ position: 'relative' }}>
        <pre style={{ ...s.toolCallJson, ...(collapsed ? { maxHeight: 50, overflow: 'hidden' } : {}) }}>{text}</pre>
        {collapsed && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 24,
            background: `linear-gradient(transparent, ${bg || '#0d1017'})`,
            pointerEvents: 'none',
          }} />
        )}
      </div>
      {collapsible && (
        <button style={s.collapseToggle} onClick={() => setExpanded((v) => !v)}>
          {expanded ? '▲ collapse' : '▼ expand'}
        </button>
      )}
    </>
  )
}

function ToolCallCard({ call }) {
  const hasParams = call.Params && Object.keys(call.Params).length > 0
  return (
    <div style={s.toolCallCard}>
      <div style={s.toolCallFuncName}>⚙ {call.FuncName}</div>
      {hasParams && <CollapsiblePre text={JSON.stringify(call.Params, null, 2)} />}
    </div>
  )
}

function ToolResultCard({ result, index }) {
  return (
    <div style={s.toolCallCard}>
      <div style={s.toolResultLabel}>result {index + 1}</div>
      <CollapsiblePre text={JSON.stringify(result, null, 2)} />
    </div>
  )
}

function MessageBubble({ msg }) {
  const role = msg.Role || msg.role || 'unknown'
  const defaultMode = (role === 'user' || role === 'agent') ? 'markdown' : 'text'
  const [viewMode, setViewMode] = useState(defaultMode)
  const content = msg.content || ''
  const toolCalls = msg.ToolCalls || []
  const toolResults = msg.ToolResult || []
  return (
    <div style={s.msgRow(role)}>
      <div style={s.msgBubble(role)}>
        <div style={s.msgHeader}>
          <div style={s.msgRole(role)}>{role}</div>
          {content && (
            <select style={s.viewSelect} value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
              <option value="markdown">Markdown</option>
              <option value="text">Text</option>
            </select>
          )}
        </div>
        {toolCalls.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: content ? 8 : 0 }}>
            {toolCalls.map((call, i) => <ToolCallCard key={i} call={call} />)}
          </div>
        )}
        {toolResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: content ? 8 : 0 }}>
            {toolResults.map((result, i) => <ToolResultCard key={i} result={result} index={i} />)}
          </div>
        )}
        {content && (viewMode === 'markdown'
          ? <div className="md-content"><ReactMarkdown>{content}</ReactMarkdown></div>
          : <div style={s.msgContent}>{content}</div>
        )}
        {msg.tool_call_id && <div style={s.toolCallID}>tool_call_id: {msg.tool_call_id}</div>}
      </div>
    </div>
  )
}

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
      }
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
    const ta = a.sessions?.[a.sessions.length - 1]?.updated_at ? new Date(a.sessions[a.sessions.length - 1].updated_at).getTime() : 0
    const tb = b.sessions?.[b.sessions.length - 1]?.updated_at ? new Date(b.sessions[b.sessions.length - 1].updated_at).getTime() : 0
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

export default function ConversationsPage() {
  const { creds } = useAuth()
  const [convos, setConvos] = useState([])
  const [selectedID, setSelectedID] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)
  const [oldestAsOf, setOldestAsOf] = useState('')
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [cancellingID, setCancellingID] = useState(null)
  const timerRef = useRef(null)

  const fetchConvos = useCallback(async (mode = 'poll') => {
    const isInitial = mode === 'initial'
    const isFetchMore = mode === 'more'
    const lookBack = isInitial ? INITIAL_LOOK_BACK : (isFetchMore ? 6 : POLL_LOOK_BACK)
    const asOf = isFetchMore ? oldestAsOf : ''

    if (isFetchMore) {
      setIsFetchingMore(true)
    } else {
      setLoading(isInitial)
    }
    setError('')

    try {
      const data = await listConvos(creds, { lookBack, asOf })
      const { convos: incoming, markers } = normalizeConvos(data)

      if (markers.length > 0) {
        setOldestAsOf((prev) => {
          const next = markers[0]
          return !prev || next < prev ? next : prev
        })
      } else if (isInitial) {
        setOldestAsOf('')
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

  // auto-poll
  useEffect(() => {
    timerRef.current = setInterval(() => fetchConvos('poll'), POLL_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [fetchConvos])

  // load history when selection changes
  useEffect(() => {
    if (!selectedID) { setHistory([]); return }
    setHistoryLoading(true)
    setHistoryError('')
    getConvoHistory(creds, selectedID)
      .then((data) => {
        if (Array.isArray(data)) {
          setHistory(data)
        } else if (data && typeof data === 'object') {
          // unwrap single-key envelope if needed
          const vals = Object.values(data)
          setHistory(Array.isArray(vals[0]) ? vals[0] : [])
        } else {
          setHistory([])
        }
      })
      .catch((err) => setHistoryError(err.message))
      .finally(() => setHistoryLoading(false))
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

  const selectedConvo = convos.find((c) => c.convo_id === selectedID)

  return (
    <div style={s.page}>
      {/* Left column — conversation list */}
      <div style={s.leftCol}>
        <div style={s.colHeader}>
          <span style={s.colTitle}>Conversations</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lastRefreshedAt && (
              <span style={s.refreshLabel}>{lastRefreshedAt.toLocaleTimeString()}</span>
            )}
            <button style={s.btn} onClick={() => fetchConvos('initial')} disabled={loading}>
              {loading ? '…' : 'Refresh'}
            </button>
          </div>
        </div>
        {error && <div style={s.err}>{error}</div>}
        <div style={s.scrollArea}>
          {convos.length === 0 && !loading && (
            <div style={s.empty}>No conversations yet</div>
          )}
          {buildConvoTree(convos).map(({ convo: c, children }) => (
            <div key={c.convo_id}>
              <ConvoCard
                convo={c}
                selected={c.convo_id === selectedID}
                onClick={() => setSelectedID(c.convo_id === selectedID ? null : c.convo_id)}
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
                      onClick={() => setSelectedID(child.convo_id === selectedID ? null : child.convo_id)}
                      onCancel={handleCancelConvo}
                      cancelling={cancellingID === child.convo_id}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          {convos.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button style={s.btn} onClick={() => fetchConvos('more')} disabled={isFetchingMore}>
                {isFetchingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right column — history */}
      <div style={s.rightCol}>
        <div style={s.colHeader}>
          <span style={s.colTitle}>
            {selectedConvo
              ? <>History — <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{truncateID(selectedID)}</span></>
              : 'History'}
          </span>
          {selectedConvo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {(selectedConvo.sessions || []).map((sess) => (
                <span key={sess.session_id} style={s.badge(STATUS_COLOR[sess.status])}>{sess.agent_name || sess.type}</span>
              ))}
            </div>
          )}
        </div>
        <div style={s.historyScroll}>
          {!selectedID && (
            <div style={s.empty}>Select a conversation to view its history</div>
          )}
          {selectedID && historyLoading && (
            <div style={s.empty}>Loading…</div>
          )}
          {selectedID && historyError && (
            <div style={s.err}>{historyError}</div>
          )}
          {selectedID && !historyLoading && !historyError && history.length === 0 && (
            <div style={s.empty}>No messages in history</div>
          )}
          {history.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
        </div>
      </div>
    </div>
  )
}
