import { memo, useState } from 'react'
import BadgeSelect from './BadgeSelect'
import CircularSendButton from './CircularSendButton'
import useMediaQuery from '../utils/useMediaQuery'

const inputAreaStyle = {
  background: '#11141c',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 0,
  minHeight: 0,
  height: '100%',
}

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
}) {
  const [text, setText] = useState('')
  const isMobile = useMediaQuery('(max-width: 768px)')

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || !selectedAgent || isSending) return
    setText('')
    const { engine, driver } = parseEngineValue(selectedEngine)
    onSend(selectedAgent, trimmed, engine, driver)
  }

  const handleKeyDown = (e) => {
    // On desktop Enter submits (Shift+Enter newline). On mobile, soft
    // keyboards can't do Shift+Enter, so Enter stays a newline and submission
    // is via the circular send button.
    if (!isMobile && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const agentOptions = (agents || []).map((a) => ({ value: a, label: a }))
  const engineOptions = []
  if (!selectedEngine) engineOptions.push({ value: '', label: 'Default engine' })
  ;(engines || []).forEach((e) => {
    engineOptions.push({ value: `${e.driver}:${e.engine}`, label: `${e.driver}:${e.engine}` })
  })

  return (
    <div style={inputAreaStyle}>
      <textarea
        style={textareaStyle}
        rows={1}
        placeholder="Type your first message…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSending}
      />
      <div data-testid="new-convo-composer-footer" style={footerStyle}>
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
