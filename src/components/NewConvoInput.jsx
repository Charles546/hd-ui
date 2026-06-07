import { memo, useState } from 'react'

const inputAreaStyle = {
  padding: '10px 16px',
  borderTop: '1px solid #2d3148',
  background: '#11141c',
  flexShrink: 0,
  display: 'flex',
  gap: 8,
  alignItems: 'flex-end',
}

const inputStyle = {
  flex: 1,
  background: '#0f1117',
  border: '1px solid #2d3148',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 14,
  padding: '10px 12px',
  resize: 'none',
  outline: 'none',
  lineHeight: 1.5,
  fontFamily: 'inherit',
  minHeight: 50,
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

const selectStyle = {
  background: '#0f1117',
  border: '1px solid #2d3148',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 14,
  padding: '10px 12px',
  outline: 'none',
  flexShrink: 0,
  minHeight: 50,
}

const NewConvoInput = memo(function NewConvoInput({ agents, selectedAgent, onAgentChange, onSend, isSending }) {
  const [text, setText] = useState('')

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || !selectedAgent || isSending) return
    setText('')
    onSend(selectedAgent, trimmed)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div style={inputAreaStyle}>
      <select
        style={selectStyle}
        value={selectedAgent}
        onChange={(e) => onAgentChange(e.target.value)}
        disabled={isSending}
      >
        {agents.length === 0 && <option value="">No agents</option>}
        {agents.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <textarea
        style={inputStyle}
        rows={1}
        placeholder="Type your first message…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSending}
      />
      <button
        style={{ ...btnStyle, opacity: isSending || !text.trim() || !selectedAgent ? 0.5 : 1 }}
        onClick={handleSubmit}
        disabled={isSending || !text.trim() || !selectedAgent}
      >
        {isSending ? '…' : 'Start'}
      </button>
    </div>
  )
})

export default NewConvoInput
