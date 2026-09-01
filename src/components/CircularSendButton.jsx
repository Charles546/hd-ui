// Small circular floating send button for the composer footer row.
const btnStyle = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  border: 'none',
  background: '#3b82f6',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
  padding: 0,
}

export default function CircularSendButton({ onClick, disabled = false, sending = false, ariaLabel = 'Send' }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={{ ...btnStyle, opacity: disabled ? 0.4 : 1 }}
    >
      {sending ? (
        <span style={{ fontSize: 14, lineHeight: 1 }}>…</span>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor" />
        </svg>
      )}
    </button>
  )
}
