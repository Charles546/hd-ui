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
  paused:  '#f59e0b',
  cancelling: '#f97316',
  done:    '#4ade80',
}

const STATUS_COLOR = {
  success: '#4ade80',
  failure: '#f87171',
  error:   '#fb923c',
  cancelled: '#f97316',
}

const LIVE_ACCENT = '#facc15'

const INTERACT_STYLE = {
  normal: {
    borderColor: '#3f4557',
    color: '#cbd5e1',
    background: '#151b26',
  },
  warning: {
    borderColor: '#854d0e',
    color: '#fcd34d',
    background: '#2b2112',
  },
  approval: {
    borderColor: '#14532d',
    color: '#86efac',
    background: '#13261c',
  },
  danger: {
    borderColor: '#7f1d1d',
    color: '#fca5a5',
    background: '#2b1618',
  },
}

function normalizeInteractiveStyle(style) {
  const name = String(style || 'normal').trim().toLowerCase()
  return INTERACT_STYLE[name] ? name : 'normal'
}

function normalizeInteractiveOptions(raw) {
  if (!raw) {
    return []
  }

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null
        }
        const key = String(item.key || '').trim()
        if (!key) {
          return null
        }

        return {
          key,
          label: String(item.label || item.title || key),
          style: normalizeInteractiveStyle(item.style),
        }
      })
      .filter(Boolean)
  }

  if (typeof raw === 'object') {
    return Object.entries(raw)
      .map(([key, item]) => {
        const itemObj = item && typeof item === 'object' ? item : {}
        return {
          key,
          label: String(itemObj.label || itemObj.title || key),
          style: normalizeInteractiveStyle(itemObj.style),
        }
      })
      .filter((item) => item.key)
  }

  return []
}

function normalizeInteractiveInteractions(raw) {
  if (!raw) {
    return []
  }

  const normalizeItem = (item) => {
    if (!item || typeof item !== 'object') {
      return null
    }
    const key = String(item.key || '').trim()
    if (!key) {
      return null
    }

    return {
      key,
      label: String(item.label || item.title || key),
      user: String(item.user || '').trim(),
      at: String(item.at || '').trim(),
      style: normalizeInteractiveStyle(item.style),
    }
  }

  if (Array.isArray(raw)) {
    return raw.map(normalizeItem).filter(Boolean)
  }

  if (typeof raw === 'object') {
    if (raw.key || raw.label || raw.title || raw.user || raw.at) {
      const single = normalizeItem(raw)
      return single ? [single] : []
    }

    return Object.entries(raw)
      .map(([key, item]) => {
        const itemObj = item && typeof item === 'object' ? item : {}
        return normalizeItem({ key, ...itemObj })
      })
      .filter(Boolean)
  }

  return []
}

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
  interactiveRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1px solid #2d3148',
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  interactiveTitle: { fontSize: 12, color: '#94a3b8', marginRight: 4 },
  interactionHistory: {
    marginTop: 8,
    borderTop: '1px dashed #2d3148',
    paddingTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  interactionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #2d3148',
    background: '#141824',
    width: '100%',
    boxSizing: 'border-box',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  interactionLabel: { fontSize: 12, fontWeight: 600, color: '#e2e8f0' },
  interactionMeta: { fontSize: 12, color: '#94a3b8' },
  interactionEntry: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  step: { fontSize: 12, color: '#94a3b8', padding: '2px 0', paddingLeft: 12, borderLeft: '2px solid #2d3148' },
  liveStep: { color: '#fde68a', borderLeft: `2px solid ${LIVE_ACCENT}` },
  desc: { fontSize: 13, color: '#64748b', marginBottom: 4 },
}

export default function SessionCard({
  session,
  isChild = false,
  onOpenLogStream = null,
  onRerunSession = null,
  onPauseSession = null,
  onResumeSession = null,
  onInteractSession = null,
  onCancelSession = null,
}) {
  const [performingExpanded, setPerformingExpanded] = useState(false)
  const { data, labels, performing } = session
  const state = data?.state || 'unknown'
  const isTerminal = state === 'done' || state === 'cancelled'
  const isLive = !isTerminal
  const status = labels?.status
  const showStatusBadge = isTerminal
  const isSucceeded = status === 'success'
  const isFailedOrErrored = status === 'failure' || status === 'error'
  const isCancelled = status === 'cancelled' || state === 'cancelled'
  const displayedPerforming = performing || []
  const showPerforming = displayedPerforming.length > 0 && (isLive || isFailedOrErrored || isCancelled)
  const stateColor = STATE_COLOR[state] || '#94a3b8'
  const statusColor = STATUS_COLOR[status] || null
  const isNoop = !!(data?.is_noop || session?.is_noop)
  const isHook = !!(data?.is_hook || session?.is_hook)
  const performingToShow = performingExpanded ? displayedPerforming : displayedPerforming.slice(-3)
  const logStream = data?.log_stream && typeof data.log_stream === 'object' ? data.log_stream : null
  const hasLogStream = !!(logStream?.pod_id || logStream?.podID)
  const canRerun = (state === 'done' || state === 'cancelled') && !!data?.session_id && !!(data?.rerun?.available || data?.can_rerun)
  const canPause = !isTerminal && state !== 'paused' && state !== 'cancelling' && !!data?.session_id
  const canResume = state === 'paused' && !!data?.session_id
  const canCancel = !isTerminal && state !== 'cancelling' && !!data?.session_id
  const interactiveOptions = normalizeInteractiveOptions(data?.interactive_options)
  const canInteract = !isTerminal && !!data?.session_id && interactiveOptions.length > 0
  const interactiveInteractions = normalizeInteractiveInteractions(data?.interactive_interactions || data?.interactive_interaction)

  const openLogStream = () => {
    if (!hasLogStream || typeof onOpenLogStream !== 'function') {
      return
    }

    const podID = logStream?.pod_id || logStream?.podID || ''
    const provider = logStream?.provider || logStream?.runtime || 'podman'
    const providerData = logStream?.provider_data && typeof logStream.provider_data === 'object'
      ? logStream.provider_data
      : null
    const streamToken = logStream?.stream_token || logStream?.token || ''
    const ghSlug = logStream?.gh_slug || ''
    const payload = { provider, podID }
    if (providerData) {
      payload.providerData = providerData
    }
    if (streamToken) {
      payload.streamToken = streamToken
    }
    if (ghSlug) {
      payload.ghSlug = ghSlug
    }

    onOpenLogStream(payload)
  }

  const rerunSession = () => {
    if (!canRerun || typeof onRerunSession !== 'function') {
      return
    }

    onRerunSession({
      sessionID: data?.session_id || '',
      eventID: data?.event_id || '',
      eventName: data?.event_name || '',
    })
  }

  const pauseSession = () => {
    if (!canPause || typeof onPauseSession !== 'function') {
      return
    }

    onPauseSession({
      sessionID: data?.session_id || '',
    })
  }

  const resumeSession = () => {
    if (!canResume || typeof onResumeSession !== 'function') {
      return
    }

    onResumeSession({
      sessionID: data?.session_id || '',
    })
  }

  const cancelSession = () => {
    if (!canCancel || typeof onCancelSession !== 'function') {
      return
    }

    onCancelSession({
      sessionID: data?.session_id || '',
    })
  }

  const interactSession = (key) => {
    if (!canInteract || typeof onInteractSession !== 'function') {
      return
    }

    onInteractSession({
      sessionID: data?.session_id || '',
      key,
    })
  }

  return (
    <div style={{ ...s.card, ...(isLive ? s.liveCard : null) }}>
      <div style={s.header}>
        <span style={{ ...s.brief, ...(isLive ? s.liveBrief : null) }}>{data?.brief || 'Unnamed workflow'}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {canPause && (
            <button
              onClick={pauseSession}
              title='Pause workflow'
              aria-label='Pause workflow'
              style={{
                border: '1px solid #3f4557',
                background: '#151b26',
                color: typeof onPauseSession === 'function' ? '#fcd34d' : '#64748b',
                borderRadius: 6,
                padding: '2px 8px',
                cursor: typeof onPauseSession === 'function' ? 'pointer' : 'not-allowed',
                fontSize: 13,
              }}
              disabled={typeof onPauseSession !== 'function'}
            >
              ||
            </button>
          )}
          {canResume && (
            <button
              onClick={resumeSession}
              title='Resume workflow'
              aria-label='Resume workflow'
              style={{
                border: '1px solid #3f4557',
                background: '#151b26',
                color: typeof onResumeSession === 'function' ? '#93c5fd' : '#64748b',
                borderRadius: 6,
                padding: '2px 8px',
                cursor: typeof onResumeSession === 'function' ? 'pointer' : 'not-allowed',
                fontSize: 13,
              }}
              disabled={typeof onResumeSession !== 'function'}
            >
              ▶
            </button>
          )}
          {canCancel && (
            <button
              onClick={cancelSession}
              title='Cancel workflow'
              aria-label='Cancel workflow'
              style={{
                border: '1px solid #3f4557',
                background: '#151b26',
                color: typeof onCancelSession === 'function' ? '#fca5a5' : '#64748b',
                borderRadius: 6,
                padding: '2px 8px',
                cursor: typeof onCancelSession === 'function' ? 'pointer' : 'not-allowed',
                fontSize: 13,
              }}
              disabled={typeof onCancelSession !== 'function'}
            >
              x
            </button>
          )}
          {canRerun && (
            <button
              onClick={rerunSession}
              title='Re-run workflow'
              aria-label='Re-run workflow'
              style={{
                border: '1px solid #3f4557',
                background: '#151b26',
                color: typeof onRerunSession === 'function' ? '#93c5fd' : '#64748b',
                borderRadius: 6,
                padding: '2px 8px',
                cursor: typeof onRerunSession === 'function' ? 'pointer' : 'not-allowed',
                fontSize: 13,
              }}
              disabled={typeof onRerunSession !== 'function'}
            >
              ↻
            </button>
          )}
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
        {(data?.event_id || data?.session_id) && (
          <div style={s.metaIds}>
            {!isChild && data?.event_id && <span>ID: {data.event_id}</span>}
            {data?.session_id && <span>Session: {data.session_id}</span>}
          </div>
        )}
        {labels?.reason && <CollapsibleReason reason={labels.reason} />}
      </div>

      {canInteract && (
        <div style={s.interactiveRow}>
          <span style={s.interactiveTitle}>Actions:</span>
          {interactiveOptions.map((option) => {
            const style = INTERACT_STYLE[option.style] || INTERACT_STYLE.normal
            return (
              <button
                key={option.key}
                onClick={() => interactSession(option.key)}
                title={`Interactive action: ${option.label}`}
                aria-label={`Interactive action: ${option.label}`}
                style={{
                  border: `1px solid ${style.borderColor}`,
                  background: style.background,
                  color: typeof onInteractSession === 'function' ? style.color : '#64748b',
                  borderRadius: 6,
                  padding: '2px 8px',
                  cursor: typeof onInteractSession === 'function' ? 'pointer' : 'not-allowed',
                  fontSize: 13,
                }}
                disabled={typeof onInteractSession !== 'function'}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}

      {interactiveInteractions.length > 0 && (
        <div style={s.interactionHistory}>
          <span style={s.interactiveTitle}>Decisions:</span>
          {interactiveInteractions.map((interaction, i) => (
            <div key={`${interaction.key}-${interaction.at}-${i}`} style={s.interactionCard}>
              <span style={s.badge((INTERACT_STYLE[interaction.style] || INTERACT_STYLE.normal).color)}>{interaction.label}</span>
              <span style={s.interactionMeta}>
                {interaction.user ? `by ${interaction.user}` : 'by unknown'}
                {formatTime(interaction.at) ? ` on ${formatTime(interaction.at)}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

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
