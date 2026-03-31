import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteGitHubSecret, listGitHubSecrets, setGitHubSecret } from '../api'
import { useAuth } from '../auth/AuthContext'

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
  title: { fontSize: 20, fontWeight: 700, color: '#e2e8f0' },
  subtitle: { fontSize: 12, color: '#94a3b8' },
  row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
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
  input: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #2d3148',
    background: '#0f1117',
    color: '#e2e8f0',
    fontSize: 13,
    minWidth: 220,
  },
  btn: (variant = '') => ({
    padding: '6px 14px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    background: variant === 'primary' ? '#f6c90e' : (variant === 'danger' ? '#7f1d1d' : '#2d3148'),
    color: variant === 'primary' ? '#0f1117' : '#e2e8f0',
    fontWeight: variant === 'primary' ? 700 : 500,
  }),
  panel: {
    border: '1px solid #2d3148',
    borderRadius: 10,
    background: '#11141c',
    overflow: 'hidden',
  },
  panelHead: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    padding: '10px 12px',
    borderBottom: '1px solid #2d3148',
    color: '#94a3b8',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  list: { display: 'flex', flexDirection: 'column' },
  item: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderBottom: '1px solid #1d2130',
  },
  key: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, color: '#e2e8f0' },
  empty: { textAlign: 'center', color: '#64748b', padding: '24px 10px', fontSize: 14 },
  err: { color: '#f87171', fontSize: 13 },
  ok: { color: '#4ade80', fontSize: 13 },
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

export default function GitHubSecretsPage({ ghSlug = '', onGhSlugChange = () => {}, onBackToEvents = () => {} }) {
  const { creds } = useAuth()
  const [ghSlugDraft, setGhSlugDraft] = useState(ghSlug)
  const [ghTargetHistory, setGhTargetHistory] = useState(() => loadGhTargetHistory())
  const [showHistory, setShowHistory] = useState(false)
  const [hoveredHistory, setHoveredHistory] = useState('')
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [keyDraft, setKeyDraft] = useState('')
  const [valueDraft, setValueDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingKey, setDeletingKey] = useState('')
  const autoLoadedHistoryRef = useRef(false)
  const applyButtonRef = useRef(null)

  const normalizeKeys = (data) => {
    const out = new Set()

    if (!data || typeof data !== 'object') {
      return []
    }

    // Direct payload shape: { keys: ["a", "b"] }
    if (Array.isArray(data.keys)) {
      data.keys.forEach((k) => out.add(String(k)))
    }

    // Wrapped payload shape from API aggregator: { "node-id": { keys: [...] } }
    Object.values(data).forEach((entry) => {
      if (entry && typeof entry === 'object' && Array.isArray(entry.keys)) {
        entry.keys.forEach((k) => out.add(String(k)))
      }
    })

    return Array.from(out).sort((a, b) => a.localeCompare(b))
  }

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

  const loadSecrets = useCallback(async (overrideSlug) => {
    const activeSlug = String(overrideSlug ?? ghSlug).trim()
    setError('')
    setMessage('')

    if (!activeSlug) {
      setKeys([])
      return
    }

    setLoading(true)
    try {
      const data = await listGitHubSecrets(creds, activeSlug)
      const nextKeys = normalizeKeys(data)
      setKeys(nextKeys)
    } catch (err) {
      if (err?.status === 403) {
        setError('You do not have permission to view secrets for this target.')
      } else {
        setError(err.message || 'Failed to load secrets.')
      }
      setKeys([])
    } finally {
      setLoading(false)
    }
  }, [creds, ghSlug])

  useEffect(() => {
    if (ghSlug) {
      loadSecrets(ghSlug)
    } else {
      setKeys([])
    }
  }, [ghSlug, loadSecrets])

  const applySlug = () => {
    const normalized = ghSlugDraft.replace(/^\/+/, '').trim()
    onGhSlugChange(normalized)
    if (normalized) {
      const nextHistory = pushGhTargetHistory(ghTargetHistory, normalized)
      setGhTargetHistory(nextHistory)
      saveGhTargetHistory(nextHistory)
    }
    void loadSecrets(normalized)
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
    void loadSecrets(normalized)
    setShowHistory(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyButtonRef.current?.focus()
      })
    })
  }

  const submitSet = async () => {
    const activeSlug = String(ghSlug).trim()
    const key = keyDraft.trim()
    const value = valueDraft

    setError('')
    setMessage('')

    if (!activeSlug) {
      setError('Please set a GitHub target first.')
      return
    }
    if (!key) {
      setError('Secret key is required.')
      return
    }
    if (!value) {
      setError('Secret value is required.')
      return
    }

    setSaving(true)
    try {
      await setGitHubSecret(creds, activeSlug, key, value)
      setMessage(`Secret key ${key} was saved.`)
      setValueDraft('')
      setKeyDraft('')
      await loadSecrets(activeSlug)
    } catch (err) {
      setError(err.message || 'Failed to set secret.')
    } finally {
      setSaving(false)
    }
  }

  const onDeleteKey = async (key) => {
    const activeSlug = String(ghSlug).trim()
    if (!activeSlug || !key) {
      return
    }

    setDeletingKey(key)
    setError('')
    setMessage('')
    try {
      await deleteGitHubSecret(creds, activeSlug, key)
      setMessage(`Secret key ${key} was deleted.`)
      await loadSecrets(activeSlug)
    } catch (err) {
      setError(err.message || 'Failed to delete secret.')
    } finally {
      setDeletingKey('')
    }
  }

  return (
    <div>
      <div style={s.toolbar}>
        <div style={s.topRow}>
          <div>
            <div style={s.title}>Script Secrets</div>
            <div style={s.subtitle}>Manage script secret keys for a GitHub org or repo target.</div>
          </div>
          <div style={s.row}>
            <button style={s.btn()} onClick={onBackToEvents}>Back to Events</button>
            <button style={s.btn()} onClick={() => loadSecrets()}>Refresh</button>
          </div>
        </div>

        <div style={s.row}>
          <div style={s.historyWrap}>
            <input
              style={s.input}
              type='text'
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
              placeholder='GitHub target, e.g. honeydipper or honeydipper/honeydipper'
            />
            {showHistory && ghTargetHistory.length > 0 && (
              <div style={s.historyList}>
                {ghTargetHistory.map((target) => (
                  <button
                    key={target}
                    type='button'
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
          <button ref={applyButtonRef} style={s.btn('primary')} onClick={applySlug}>Apply Target</button>
        </div>

        <div style={s.row}>
          <input
            style={s.input}
            type='text'
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder='Secret key'
          />
          <input
            style={{ ...s.input, minWidth: 320 }}
            type='password'
            value={valueDraft}
            onChange={(e) => setValueDraft(e.target.value)}
            placeholder='Secret value'
          />
          <button style={s.btn('primary')} onClick={submitSet} disabled={saving}>
            {saving ? 'Saving…' : 'Set Secret'}
          </button>
        </div>

        {error && <div style={s.err}>{error}</div>}
        {message && <div style={s.ok}>{message}</div>}
      </div>

      <div style={s.panel}>
        <div style={s.panelHead}>
          <span>Secret Key</span>
          <span>Actions</span>
        </div>
        <div style={s.list}>
          {loading && <div style={s.empty}>Loading…</div>}
          {!loading && keys.length === 0 && <div style={s.empty}>No secrets found for this target.</div>}
          {!loading && keys.map((key) => (
            <div key={key} style={s.item}>
              <span style={s.key}>{key}</span>
              <button
                style={s.btn('danger')}
                onClick={() => onDeleteKey(key)}
                disabled={deletingKey === key}
              >
                {deletingKey === key ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
