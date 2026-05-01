import { useEffect, useState } from 'react'

const s = {
  wrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 16 },
  card: {
    width: 'min(980px, 100%)',
    background: '#1a1d27',
    border: '1px solid #2d3148',
    borderRadius: 12,
    padding: 24,
    color: '#e2e8f0',
  },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 8 },
  sub: { color: '#94a3b8', fontSize: 14, marginBottom: 16 },
  actions: { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  btn: {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #2d3148',
    background: '#263445',
    color: '#cfe6ff',
    cursor: 'pointer',
    fontSize: 13,
  },
  pre: {
    margin: 0,
    maxHeight: '65vh',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: '#0f1117',
    border: '1px solid #2d3148',
    borderRadius: 8,
    padding: 16,
    fontSize: 12,
    lineHeight: 1.5,
  },
  err: { color: '#f87171', fontSize: 13, marginTop: 8 },
}

export default function SAMLMetadata() {
  const [metadata, setMetadata] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let canceled = false

    async function loadMetadata() {
      try {
        const res = await fetch('/api/auth/saml/metadata')
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const text = await res.text()
        if (!canceled) {
          setMetadata(text)
        }
      } catch (err) {
        if (!canceled) {
          setError(err?.message || 'Failed to fetch SAML metadata.')
        }
      }
    }

    void loadMetadata()

    return () => {
      canceled = true
    }
  }, [])

  async function handleCopy() {
    if (!metadata) {
      return
    }
    try {
      await navigator.clipboard.writeText(metadata)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setError('Unable to copy metadata to clipboard.')
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.title}>SAML SP Metadata</div>
        <div style={s.sub}>
          Share this metadata URL or XML with your identity provider setup.<br />
          <a
            href="/api/auth/saml/metadata"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#60a5fa', textDecoration: 'underline', fontSize: 14 }}
          >
            Download raw XML
          </a>
        </div>
        <div style={s.actions}>
          <button style={s.btn} type="button" onClick={handleCopy}>{copied ? 'Copied' : 'Copy XML'}</button>
          <button style={s.btn} type="button" onClick={() => window.location.assign('/')}>Back</button>
        </div>
        <pre style={s.pre}>{metadata || 'Loading metadata...'}</pre>
        {error && <div style={s.err}>{error}</div>}
      </div>
    </div>
  )
}
