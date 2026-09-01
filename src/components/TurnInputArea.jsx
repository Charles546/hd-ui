import { memo, useState } from 'react'
import BadgeSelect from './BadgeSelect'
import CircularSendButton from './CircularSendButton'

const textareaStyle = {
  width: '100%',
  minWidth: 0,
  background: '#11141c',
  border: '0px none',
  borderRadius: 0,
  color: '#e2e8f0',
  fontSize: 13,
  padding: '10px 12px',
  resize: 'none',
  outline: 'none',
  lineHeight: 1.5,
  fontFamily: 'inherit',
  minHeight: 38,
  boxSizing: 'border-box',
  flex: '1 1 auto',
  overflowY: 'auto',
}

const footerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
  flexWrap: 'wrap',
  flexShrink: 0,
  boxSizing: 'border-box',
  padding: '0 12px 10px',
}

function parseEngineValue(value) {
  if (!value) return { engine: '', driver: '' }
  const idx = value.indexOf(':')
  if (idx === -1) return { engine: value, driver: '' }
  return { driver: value.substring(0, idx), engine: value.substring(idx + 1) }
}

const TurnInputArea = memo(function TurnInputArea({ onSubmit, isSending, placeholder, buttonLabel, engines, selectedEngine, onEngineChange }) {
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

  const engineOptions = []
  if (!selectedEngine) engineOptions.push({ value: '', label: 'Default engine' })
  ;(engines || []).forEach((e) => {
    engineOptions.push({ value: `${e.driver}:${e.engine}`, label: `${e.driver}:${e.engine}` })
  })

  const hasEngines = (engines && engines.length > 0) || !selectedEngine

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
      <textarea
        style={textareaStyle}
        rows={1}
        placeholder={placeholder || 'Type a message…'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSending}
      />
      <div data-testid="turn-composer-footer" style={footerStyle}>
        {hasEngines && (
          <BadgeSelect
            value={selectedEngine || ''}
            onChange={onEngineChange}
            options={engineOptions}
            emptyLabel="Default engine"
            disabled={isSending}
            ariaLabel="Engine"
          />
        )}
        <CircularSendButton
          onClick={handleSubmit}
          disabled={isSending || !text.trim()}
          sending={isSending}
          ariaLabel={buttonLabel || 'Send'}
        />
      </div>
    </div>
  )
})

export default TurnInputArea
