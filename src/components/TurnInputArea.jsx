import { memo, useState } from 'react'

const areaStyle = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-end',
  flex: 1,
}

const inputStyle = {
  flex: 1,
  background: '#0f1117',
  border: '1px solid #2d3148',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 13,
  padding: '8px 12px',
  resize: 'none',
  outline: 'none',
  lineHeight: 1.5,
  fontFamily: 'inherit',
  minHeight: 38,
  maxHeight: 140,
}

const btnStyle = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  background: '#3b82f6',
  color: '#fff',
  flexShrink: 0,
  alignSelf: 'flex-end',
}

const TurnInputArea = memo(function TurnInputArea({ onSubmit, isSending, placeholder, buttonLabel }) {
  const [text, setText] = useState('')

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || isSending) return
    setText('')
    onSubmit(trimmed)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div style={areaStyle}>
      <textarea
        style={inputStyle}
        rows={1}
        placeholder={placeholder || 'Type a message…'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSending}
      />
      <button
        style={{ ...btnStyle, opacity: isSending || !text.trim() ? 0.5 : 1 }}
        onClick={handleSubmit}
        disabled={isSending || !text.trim()}
      >
        {isSending ? '…' : (buttonLabel || 'Send')}
      </button>
    </div>
  )
})

export default TurnInputArea
