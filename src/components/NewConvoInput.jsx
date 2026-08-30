import { memo, useState } from 'react'
import useMediaQuery from '../utils/useMediaQuery'

const MOBILE_BREAKPOINT = '(max-width: 768px)'

const inputAreaStyle = {
  padding: '10px 16px',
  borderTop: '1px solid #2d3148',
  background: '#11141c',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const topRowStyle = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
  minWidth: 0,
}

const inputRowStyle = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-end',
  minWidth: 0,
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
  minWidth: 0,
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
  fontSize: 13,
  padding: '8px 12px',
  outline: 'none',
  flexShrink: 0,
  minWidth: 0,
  maxWidth: '100%',
}

function parseEngineValue(value) {
  if (!value) return { engine: '', driver: '' }
  const idx = value.indexOf(':')
  if (idx === -1) return { engine: value, driver: '' }
  return { driver: value.substring(0, idx), engine: value.substring(idx + 1) }
}

const NewConvoInput = memo(function NewConvoInput({
  agents,
  selectedAgent,
  onAgentChange,
  engines,
  selectedEngine,
  onEngineChange,
  onSend,
  isSending,
  inputHeight,
}) {
  const [text, setText] = useState('')
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT)

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || !selectedAgent || isSending) return
    setText('')
    const { engine, driver } = parseEngineValue(selectedEngine)
    onSend(selectedAgent, trimmed, engine, driver)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div style={isMobile ? { ...inputAreaStyle, padding: '8px 10px' } : inputAreaStyle}>
      <div style={topRowStyle}>
        <select
          style={{ ...selectStyle, ...(isMobile ? { flex: '1 1 100%' } : {}) }}
          value={selectedAgent}
          onChange={(e) => onAgentChange(e.target.value)}
          disabled={isSending}
        >
          {agents.length === 0 && <option value="">No agents</option>}
          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          style={{ ...selectStyle, ...(isMobile ? { flex: '1 1 100%' } : {}) }}
          value={selectedEngine}
          onChange={(e) => onEngineChange(e.target.value)}
          disabled={isSending}
        >
          <option value="">Default engine</option>
          {engines.map((e) => (
            <option key={`${e.driver}:${e.engine}`} value={`${e.driver}:${e.engine}`}>
              {e.driver}:{e.engine}
            </option>
          ))}
        </select>
      </div>
      <div style={inputRowStyle}>
        <textarea
          style={inputHeight ? { ...inputStyle, height: inputHeight - 46, maxHeight: inputHeight - 46, overflowY: 'auto' } : inputStyle}
          rows={1}
          placeholder="Type your first message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        <button
          style={{
            ...btnStyle,
            ...(isMobile ? { padding: '10px 16px' } : {}),
            opacity: isSending || !text.trim() || !selectedAgent ? 0.5 : 1,
          }}
          onClick={handleSubmit}
          disabled={isSending || !text.trim() || !selectedAgent}
        >
          {isSending ? '…' : 'Start'}
        </button>
      </div>
    </div>
  )
})

export default NewConvoInput
