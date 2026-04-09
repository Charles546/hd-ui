import { useState } from 'react'

function CollapsibleReason({ reason }) {
  const [expanded, setExpanded] = useState(false)
  const lines = reason.split('\n')
  const isLong = lines.length > 2
  const displayed = expanded ? reason : lines.slice(0, 2).join('\n')
  return (
    <div style={{ marginTop: 4 }}>
      <span style={{ color: '#94a3b8' }}>Reason: </span>
      <div style={{ color: '#f87171', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{displayed}</div>
      {!expanded && isLong && <div style={{ color: '#f87171' }}>…</div>}
      {isLong && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ marginTop: 4, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, padding: 0 }}
        >
          {expanded ? '▲ Show less' : '▼ Show more'}
        </button>
      )}
    </div>
  )
}

const STATE_COLOR = {
  init:    '#94a3b8',
  active:  '#38bdf8',
  waiting: '#f6c90e',
  done:    '#4ade80',
}

const STATUS_COLOR = {
  success: '#4ade80',
  failure: '#f87171',
  error:   '#fb923c',
}

const LIVE_ACCENT = '#facc15'

function formatTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function formatDuration(startIso, endIso) {
  if (!startIso) return null
  const ms = (endIso ? new Date(endIso) : new Date()) - new Date(startIso)
  if (ms < 0) return null
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const s = {
  card: {
    background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 10,
    padding: '16px 20px', marginBottom: 12,
  },
  liveCard: {
    border: `1px solid ${LIVE_ACCENT}`,
    boxShadow: '0 0 0 1px rgba(250, 204, 21, 0.35), 0 0 28px rgba(250, 204, 21, 0.22)',
    background: 'linear-gradient(180deg, rgba(250, 204, 21, 0.08), rgba(26, 29, 39, 1) 44%)',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  brief: { fontWeight: 600, fontSize: 15, color: '#e2e8f0' },
  liveBrief: { color: '#fde047' },
  badge: (color) => ({
    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
    background: color + '22', color, textTransform: 'uppercase', letterSpacing: 1,
  }),
  meta: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  eventName: { fontSize: 13, fontWeight: 600, color: '#fde047', marginBottom: 4 },
  metaIds: { display: 'flex', justifyContent: 'flex-end', gap: 16, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' },
  times: { display: 'flex', gap: 16, fontSize: 12, color: '#64748b', marginBottom: 6, flexWrap: 'wrap' },
  timeLabel: { color: '#475569' },
  duration: { color: '#94a3b8', fontStyle: 'italic' },
  performing: { marginTop: 8 },
  step: { fontSize: 12, color: '#94a3b8', padding: '2px 0', paddingLeft: 12, borderLeft: '2px solid #2d3148' },
  liveStep: { color: '#fde68a', borderLeft: `2px solid ${LIVE_ACCENT}` },
  desc: { fontSize: 13, color: '#64748b', marginBottom: 4 },
}

export default function SessionCard({ session, isChild = false, onOpenLogStream = null }) {
  const [performingExpanded, setPerformingExpanded] = useState(false)
  const { data, labels, performing } = session
  const state = data?.state || 'unknown'
  const isLive = state !== 'done'
  const status = labels?.status
  const showStatusBadge = state === 'done'
  const isSucceeded = status === 'success'
  const isFailedOrErrored = status === 'failure' || status === 'error'
  const displayedPerforming = performing || []
  const showPerforming = displayedPerforming.length > 0 && (isLive || isFailedOrErrored)
  const stateColor = STATE_COLOR[state] || '#94a3b8'
  const statusColor = STATUS_COLOR[status] || null
  const isNoop = !!(data?.is_noop || session?.is_noop)
  const isHook = !!(data?.is_hook || session?.is_hook)
  const performingToShow = performingExpanded ? displayedPerforming : displayedPerforming.slice(-3)
  const logStream = data?.log_stream && typeof data.log_stream === 'object' ? data.log_stream : null
  const hasLogStream = !!(logStream?.pod_id || logStream?.podID)

  const openLogStream = () => {
    if (!hasLogStream || typeof onOpenLogStream !== 'function') {
      return
    }

    const podID = logStream?.pod_id || logStream?.podID || ''
    const provider = logStream?.provider || logStream?.runtime || 'podman'
    const streamToken = logStream?.stream_token || logStream?.token || ''
    const ghSlug = logStream?.gh_slug || ''
    const payload = { provider, podID }
    if (streamToken) {
      payload.streamToken = streamToken
    }
    if (ghSlug) {
      payload.ghSlug = ghSlug
    }

    onOpenLogStream(payload)
  }

  return (
    <div style={{ ...s.card, ...(isLive ? s.liveCard : null) }}>
      <div style={s.header}>
        <span style={{ ...s.brief, ...(isLive ? s.liveBrief : null) }}>{data?.brief || 'Unnamed workflow'}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {hasLogStream && (
            <button
              onClick={openLogStream}
              title='Open live log stream'
              style={{
                border: '1px solid #3f4557',
                background: '#151b26',
                color: '#facc15',
                borderRadius: 6,
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              📜
            </button>
          )}
          <span style={s.badge(stateColor)}>{state}</span>
          {showStatusBadge && status && statusColor && <span style={s.badge(statusColor)}>{status}</span>}
          {isNoop && <span style={s.badge('#a78bfa')}>no-op</span>}
          {isHook && <span style={s.badge('#22d3ee')}>hook</span>}
        </div>
      </div>

      {data?.description && data.description !== data?.brief && (
        <div style={s.desc}>{data.description}</div>
      )}

      <div style={s.times}>
        {labels?.start && (
          <span><span style={s.timeLabel}>Started: </span>{formatTime(labels.start)}</span>
        )}
        {labels?.end && (
          <span><span style={s.timeLabel}>Ended: </span>{formatTime(labels.end)}</span>
        )}
        {labels?.start && (
          <span style={s.duration}>({formatDuration(labels.start, labels.end)})</span>
        )}
      </div>

      <div style={s.meta}>
        {!isChild && data?.event_name && <div style={s.eventName}>Event: {data.event_name}</div>}
        {!isChild && (data?.event_id || data?.session_id) && (
          <div style={s.metaIds}>
            {data?.event_id && <span>ID: {data.event_id}</span>}
            {data?.session_id && <span>Session: {data.session_id}</span>}
          </div>
        )}
        {labels?.reason && <CollapsibleReason reason={labels.reason} />}
      </div>

      {showPerforming && (
        <div style={s.performing}>
          {displayedPerforming.length > 3 && (
            <button
              onClick={() => setPerformingExpanded(v => !v)}
              style={{ marginBottom: 6, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, padding: 0 }}
            >
              {performingExpanded ? '▼ Collapse' : `▶ Show last 3 (of ${displayedPerforming.length})`}
            </button>
          )}
          {performingToShow.map((step, i) => (
            <div key={i} style={isLive ? { ...s.step, ...s.liveStep } : s.step}>{step}</div>
          ))}
        </div>
      )}
    </div>
  )
}
