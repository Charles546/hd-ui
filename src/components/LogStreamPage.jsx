import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnsiUp } from 'ansi_up'
import { getPodLogChunk } from '../api'
import { useAuth } from '../auth/AuthContext'

const POLL_WAIT_SECONDS = 5
const MAX_LINES = 300
const CONSOLE_FONTS = {
  jetbrains: '"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  firacode: '"Fira Code", "JetBrains Mono", "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  consolas: 'Consolas, "Cascadia Mono", "Courier New", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 12 },
  top: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    padding: 12,
    border: '1px solid #2d3148',
    borderRadius: 10,
    background: '#141824',
  },
  title: { fontSize: 20, fontWeight: 700, color: '#e2e8f0' },
  podMeta: { fontSize: 12, color: '#94a3b8' },
  controls: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  displayControls: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  select: {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid #2d3148',
    background: '#0f1117',
    color: '#e2e8f0',
    fontSize: 12,
  },
  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    padding: '8px 10px',
    borderBottom: '1px solid #2d3148',
    background: '#121826',
  },
  tab: (active = false) => ({
    border: '1px solid #3a425a',
    borderRadius: 6,
    padding: '3px 10px',
    fontSize: 12,
    cursor: 'pointer',
    color: active ? '#0f1117' : '#cbd5e1',
    background: active ? '#facc15' : '#1a1f2b',
    fontWeight: active ? 700 : 500,
  }),
  btn: (primary = false) => ({
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #2d3148',
    cursor: 'pointer',
    background: primary ? '#f6c90e' : '#1a1d27',
    color: primary ? '#0f1117' : '#cbd5e1',
    fontWeight: primary ? 700 : 500,
    textDecoration: 'none',
    fontSize: 13,
  }),
  status: { fontSize: 12, color: '#94a3b8' },
  done: { color: '#4ade80', fontWeight: 700 },
  err: { color: '#f87171', fontSize: 13 },
  logPanel: {
    border: '1px solid #2d3148',
    borderRadius: 10,
    background: '#0f1117',
    overflow: 'hidden',
  },
  logViewport: {
    maxHeight: '70vh',
    overflowY: 'auto',
    fontFamily: CONSOLE_FONTS.jetbrains,
    fontSize: 12,
    lineHeight: 1.45,
    padding: 12,
    color: '#dbe5f5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  row: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  container: {
    fontSize: 11,
    minWidth: 80,
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#facc15',
    border: '1px solid #3a425a',
    borderRadius: 4,
    padding: '1px 6px',
    background: '#1a1f2b',
  },
  line: { flex: 1 },
  ansiLine: { flex: 1 },
}

function buildGitHubEventsPath(ghSlug) {
  const normalized = String(ghSlug || '').replace(/^\/+/, '').trim()
  if (!normalized) {
    return '/gh/events'
  }

  return `/gh/events/${normalized.split('/').map((part) => encodeURIComponent(part)).join('/')}`
}

export default function LogStreamPage({ provider = 'podman', podID = '', ghSlug = '', streamToken = '', onBackToEvents = () => {} }) {
  const { creds } = useAuth()
  const [lines, setLines] = useState([])
  const [cursor, setCursor] = useState(null)
  const [done, setDone] = useState(false)
  const [paused, setPaused] = useState(false)
  const [selectedContainer, setSelectedContainer] = useState('all')
  const [wrapLines, setWrapLines] = useState(true)
  const [showTimestamps, setShowTimestamps] = useState(false)
  const [fontFamily, setFontFamily] = useState('jetbrains')
  const [error, setError] = useState('')
  const [pollCount, setPollCount] = useState(0)
  const viewportRef = useRef(null)
  const timerRef = useRef(null)
  const ansiRef = useRef(new AnsiUp())
  const doneRef = useRef(false)
  const cursorRef = useRef(null)
  const inFlightRef = useRef(false)

  const backHref = useMemo(() => buildGitHubEventsPath(ghSlug), [ghSlug])
  const containers = useMemo(() => {
    const seen = new Set()
    for (const item of lines) {
      const name = String(item?.container || '').trim()
      if (name) {
        seen.add(name)
      }
    }

    return Array.from(seen).sort((a, b) => a.localeCompare(b))
  }, [lines])

  const visibleLines = useMemo(() => {
    if (selectedContainer === 'all') {
      return [...lines].sort((a, b) => {
        const tsA = String(a?.line || '').match(/^(\S+)/)?.[1] ?? ''
        const tsB = String(b?.line || '').match(/^(\S+)/)?.[1] ?? ''
        return tsA < tsB ? -1 : tsA > tsB ? 1 : 0
      })
    }

    return lines.filter((item) => String(item?.container || '').trim() === selectedContainer)
  }, [lines, selectedContainer])

  const appendChunk = useCallback((chunk) => {
    const nextLines = Array.isArray(chunk?.lines) ? chunk.lines : []
    if (nextLines.length > 0) {
      setLines((prev) => [...prev, ...nextLines])
    }

    if (chunk?.next_cursor) {
      cursorRef.current = chunk.next_cursor
      setCursor(chunk.next_cursor)
    }

    const isTerminal = !!(chunk?.done && !chunk?.has_more)
    if (isTerminal) {
      doneRef.current = true
      setDone(true)
    }

    return !isTerminal
  }, [])

  const pausedRef = useRef(false)
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const pollOnce = useCallback(async () => {
    if (!podID || pausedRef.current || doneRef.current || inFlightRef.current) {
      return false
    }

    try {
      inFlightRef.current = true
      const chunk = await getPodLogChunk(creds, podID, {
        provider,
        ghSlug,
        streamToken,
        waitSeconds: POLL_WAIT_SECONDS,
        maxLines: MAX_LINES,
        cursor: cursorRef.current,
      })
      const shouldContinue = appendChunk(chunk)
      setError('')
      setPollCount((v) => v + 1)

      return shouldContinue
    } catch (err) {
      setError(err?.message || 'Failed to load log stream')

      return true
    } finally {
      inFlightRef.current = false
    }
  }, [appendChunk, creds, ghSlug, podID, provider, streamToken])

  useEffect(() => {
    cursorRef.current = cursor
  }, [cursor])

  useEffect(() => {
    doneRef.current = done
  }, [done])

  useEffect(() => {
    if (!podID) {
      return
    }

    let cancelled = false
    const loop = async () => {
      if (cancelled || paused || done) {
        return
      }
      const shouldContinue = await pollOnce()
      if (cancelled || paused || done || !shouldContinue) {
        return
      }
      timerRef.current = setTimeout(loop, 150)
    }

    loop()

    return () => {
      cancelled = true
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [done, paused, podID, pollOnce])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    viewport.scrollTop = viewport.scrollHeight
  }, [lines.length])

  const clearLogs = () => {
    setLines([])
  }

  useEffect(() => {
    setLines([])
    setCursor(null)
    cursorRef.current = null
    setDone(false)
    doneRef.current = false
    setError('')
    setPollCount(0)
    setSelectedContainer('all')
  }, [provider, podID])

  useEffect(() => {
    if (selectedContainer !== 'all' && !containers.includes(selectedContainer)) {
      setSelectedContainer('all')
    }
  }, [containers, selectedContainer])

  return (
    <section style={s.page}>
      <div style={s.top}>
        <div>
          <div style={s.title}>Live Pod Logs</div>
          <div style={s.podMeta}>Provider: {provider} | Pod: {podID || 'N/A'}</div>
        </div>
        <div style={s.controls}>
          <a href={backHref} style={s.btn()} onClick={onBackToEvents}>← Back to GH Events</a>
          <button style={s.btn(paused)} onClick={() => setPaused((v) => !v)}>{paused ? 'Resume' : 'Pause'}</button>
          <button style={s.btn()} onClick={clearLogs}>Clear</button>
        </div>
        <div style={s.displayControls}>
          <label style={{ fontSize: 12, color: '#cbd5e1' }}>
            <input
              type='checkbox'
              checked={wrapLines}
              onChange={(e) => setWrapLines(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Wrap lines
          </label>
          <label style={{ fontSize: 12, color: '#cbd5e1' }}>
            <input
              type='checkbox'
              checked={showTimestamps}
              onChange={(e) => setShowTimestamps(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Show timestamps
          </label>
          <label style={{ fontSize: 12, color: '#cbd5e1' }}>
            Font
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} style={{ ...s.select, marginLeft: 6 }}>
              <option value='jetbrains'>JetBrains Mono</option>
              <option value='firacode'>Fira Code</option>
              <option value='consolas'>Consolas</option>
            </select>
          </label>
        </div>
      </div>

      <div style={s.status}>
        Polls: {pollCount} | Lines: {lines.length} {done && <span style={s.done}>| Done</span>}
      </div>
      {error && <div style={s.err}>{error}</div>}

      <div style={s.logPanel}>
        <div style={s.tabs}>
          <button style={s.tab(selectedContainer === 'all')} onClick={() => setSelectedContainer('all')}>All containers</button>
          {containers.map((container) => (
            <button
              key={container}
              style={s.tab(selectedContainer === container)}
              onClick={() => setSelectedContainer(container)}
            >
              {container}
            </button>
          ))}
        </div>
        <div
          style={{
            ...s.logViewport,
            fontFamily: CONSOLE_FONTS[fontFamily] || CONSOLE_FONTS.jetbrains,
            whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
            wordBreak: wrapLines ? 'break-word' : 'normal',
            overflowX: wrapLines ? 'hidden' : 'auto',
          }}
          ref={viewportRef}
        >
          {visibleLines.length === 0 && <div style={{ color: '#64748b' }}>Waiting for log lines...</div>}
          {visibleLines.map((item, idx) => (
            <div key={`${item?.container || 'c'}-${item?.index || idx}-${idx}`} style={s.row}>
              {selectedContainer === 'all' && <span style={s.container}>{item?.container || 'container'}</span>}
              <span
                style={s.ansiLine}
                dangerouslySetInnerHTML={{
                  __html: ansiRef.current.ansi_to_html(
                    showTimestamps ? String(item?.line || '') : String(item?.line || '').replace(/^\S+\s+/, ''),
                  ),
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
