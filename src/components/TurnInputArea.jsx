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
  width: '100%',
}

function parseEngineValue(value) {
  if (!value) return { engine: '', driver: '' }
  const idx = value.indexOf(':')
  if (idx === -1) return { engine: value, driver: '' }
  return { driver: value.substring(0, idx), engine: value.substring(idx + 1) }
}

const TurnInputArea = memo(function TurnInputArea({ onSubmit, isSending, placeholder, buttonLabel, engines, selectedEngine, onEngineChange, inputHeight }) {
  const [text, setText] = useState('')

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || isSending) return
    setText('')
    const { engine, driver } = parseEngineValue(selectedEngine)
    onSubmit(trimmed, engine, driver)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Account for padding (10px top + 10px bottom) and engine dropdown (approx 40px)
  const dropdownOffset = engines && engines.length > 0 ? 40 : 0
  const textareaHeight = inputHeight ? Math.max(38, inputHeight - 20 - dropdownOffset) : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%' }}>
      {engines && engines.length > 0 && (
        <select
          style={selectStyle}
          value={selectedEngine || ''}
          onChange={(e) => onEngineChange(e.target.value)}
          disabled={isSending}
        >
          <option value="">Default engine</option>
          {engines.map((e) => (
            <option key={e.driver + ':' + e.engine} value={e.driver + ':' + e.engine}>
              {e.driver}:{e.engine}
            </option>
          ))}
        </select>
      )}
      <div style={{ ...areaStyle, flex: 1 }}>
        <textarea
          style={{ ...inputStyle, height: textareaHeight }}
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
    </div>
  )
})

export default TurnInputArea
