import { memo, useState } from 'react'
import BadgeSelect from './BadgeSelect'
import CircularSendButton from './CircularSendButton'

// Fixed footprint the footer row adds below the textarea.
const FOOTER_HEIGHT = 30
// Vertical padding inside the textarea (10px top + 10px bottom).
const VERTICAL_PAD = 20

const inputAreaStyle = {
  background: '#11141c',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 0,
  height: '100%',
}

const textareaStyle = {
  width: '100%',
  minWidth: 0,
  background: '#0f1117',
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
  maxHeight: 140,
  boxSizing: 'border-box',
}

const footerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginTop: 4,
  minWidth: 0,
  flexWrap: 'wrap',
}

const badgesWrapStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  flex: '1 1 auto',
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

  const textareaHeight = inputHeight ? Math.max(38, inputHeight - FOOTER_HEIGHT - VERTICAL_PAD) : undefined

  const agentOptions = (agents || []).map((a) => ({ value: a, label: a }))
  const engineOptions = []
  if (!selectedEngine) engineOptions.push({ value: '', label: 'Default engine' })
  ;(engines || []).forEach((e) => {
    engineOptions.push({ value: `${e.driver}:${e.engine}`, label: `${e.driver}:${e.engine}` })
  })

  return (
    <div style={inputAreaStyle}>
      <textarea
        style={{ ...textareaStyle, height: textareaHeight, overflowY: 'auto' }}
        rows={1}
        placeholder="Type your first message…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSending}
      />
      <div style={footerStyle}>
        <div style={badgesWrapStyle}>
          <BadgeSelect
            value={selectedAgent || ''}
            onChange={onAgentChange}
            options={agentOptions}
            emptyLabel="No agents"
            disabled={isSending}
            ariaLabel="Agent"
          />
          <BadgeSelect
            value={selectedEngine || ''}
            onChange={onEngineChange}
            options={engineOptions}
            emptyLabel="Default engine"
            disabled={isSending}
            ariaLabel="Engine"
          />
        </div>
        <CircularSendButton
          onClick={handleSubmit}
          disabled={isSending || !text.trim() || !selectedAgent}
          sending={isSending}
          ariaLabel="Start"
        />
      </div>
    </div>
  )
})

export default NewConvoInput
