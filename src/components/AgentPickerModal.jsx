import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 16,
}

const modalStyle = {
  background: '#141824',
  border: '1px solid #2d3148',
  borderRadius: 12,
  width: '100%',
  maxWidth: 420,
  maxHeight: '80vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
  animation: 'modalIn 0.15s ease-out',
}

const headerStyle = {
  padding: '16px 20px',
  borderBottom: '1px solid #2d3148',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
}

const titleStyle = {
  fontSize: 16,
  fontWeight: 600,
  color: '#e2e8f0',
  margin: 0,
}

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  fontSize: 20,
  cursor: 'pointer',
  padding: '4px 8px',
  lineHeight: 1,
  borderRadius: 4,
  transition: 'color 0.15s, background 0.15s',
}

const contentStyle = {
  padding: '16px 20px',
  overflowY: 'auto',
  flex: 1,
}

const agentListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const agentOptionStyle = (selected) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  border: `1px solid ${selected ? '#3b82f6' : '#2d3148'}`,
  borderRadius: 8,
  background: selected ? '#1e3a5f' : '#0f1117',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
})

const radioStyle = (selected) => ({
  width: 18,
  height: 18,
  border: `2px solid ${selected ? '#3b82f6' : '#4d5880'}`,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'border-color 0.15s',
})

const radioInnerStyle = (selected) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: selected ? '#3b82f6' : 'transparent',
  transition: 'background 0.15s',
})

const agentNameStyle = {
  fontSize: 14,
  fontWeight: 500,
  color: '#e2e8f0',
  flex: 1,
}

const agentMetaStyle = {
  fontSize: 12,
  color: '#64748b',
}

const emptyStyle = {
  padding: '24px 16px',
  textAlign: 'center',
  color: '#64748b',
  fontSize: 14,
}

const footerStyle = {
  padding: '12px 20px',
  borderTop: '1px solid #2d3148',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  flexShrink: 0,
}

const cancelBtnStyle = {
  padding: '8px 16px',
  borderRadius: 8,
  border: '1px solid #2d3148',
  background: '#0f1117',
  color: '#94a3b8',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s',
}

const confirmBtnStyle = (disabled) => ({
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: disabled ? '#2d3148' : '#3b82f6',
  color: disabled ? '#64748b' : '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'background 0.15s',
})

const styleSheet = `
  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.95) translateY(8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes modalOut {
    from { opacity: 1; transform: scale(1) translateY(0); }
    to { opacity: 0; transform: scale(0.95) translateY(8px); }
  }
`

/**
 * AgentPickerModal - Accessible modal for selecting an agent to revive a conversation.
 * @param {Object} props
 * @param {string[]} props.agents - List of agent names
 * @param {function(string): void} props.onSelect - Called when user confirms selection
 * @param {function(): void} props.onCancel - Called when user cancels
 * @param {string} [props.title] - Modal title
 * @param {string} [props.selectedAgent] - Pre-selected agent
 * @param {Object.<string, {engine?: string, driver?: string}>} [props.agentMetadata] - Optional metadata per agent
 */
export default function AgentPickerModal({
  agents = [],
  onSelect,
  onCancel,
  title = 'Select an agent to revive this conversation',
  selectedAgent: initialSelectedAgent = '',
  agentMetadata = {},
}) {
  const [selectedAgent, setSelectedAgent] = useState(initialSelectedAgent)
  const [isOpen, setIsOpen] = useState(true)
  const modalRef = useRef(null)
  const previousActiveElement = useRef(null)

  // Initialize selected agent
  useEffect(() => {
    if (initialSelectedAgent && agents.includes(initialSelectedAgent)) {
      setSelectedAgent(initialSelectedAgent)
    } else if (agents.length > 0) {
      setSelectedAgent(agents[0])
    }
  }, [initialSelectedAgent, agents])

  // Focus trap and initial focus
  useEffect(() => {
    if (!isOpen) return

    previousActiveElement.current = document.activeElement

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    if (focusableElements?.length) {
      focusableElements[0].focus()
    }

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
      previousActiveElement.current?.focus?.()
    }
  }, [isOpen])

  // Handle Escape key and focus trap
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return

    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
      return
    }

    if (e.key === 'Tab') {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusableElements?.length) return

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }, [isOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleCancel = useCallback(() => {
    setIsOpen(false)
    setTimeout(() => onCancel?.(), 150)
  }, [onCancel])

  const handleConfirm = useCallback(() => {
    if (!selectedAgent) return
    setIsOpen(false)
    setTimeout(() => onSelect?.(selectedAgent), 150)
  }, [selectedAgent, onSelect])

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      handleCancel()
    }
  }, [handleCancel])

  const handleOptionClick = useCallback((agent) => {
    setSelectedAgent(agent)
  }, [])

  if (!isOpen) return null

  const modalContent = (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-picker-title"
      aria-describedby="agent-picker-desc"
      style={modalStyle}
    >
      <style>{styleSheet}</style>
      <div style={headerStyle}>
        <h2 id="agent-picker-title" style={titleStyle}>
          {title}
        </h2>
        <button
          type="button"
          onClick={handleCancel}
          style={closeBtnStyle}
          aria-label="Close agent picker"
          onMouseOver={(e) => (e.target.style.color = '#e2e8f0')}
          onMouseOut={(e) => (e.target.style.color = '#64748b')}
        >
          ×
        </button>
      </div>
      <div id="agent-picker-desc" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' }}>
        Select an agent from the list below to revive the conversation. Press Escape to cancel.
      </div>
      <div style={contentStyle}>
        {agents.length === 0 ? (
          <div style={emptyStyle}>No agents available</div>
        ) : (
          <div style={agentListStyle} role="radiogroup" aria-label="Available agents">
            {agents.map((agent) => {
              const isSelected = agent === selectedAgent
              const meta = agentMetadata[agent] || {}
              const metaParts = []
              if (meta.engine) metaParts.push(meta.engine)
              if (meta.driver) metaParts.push(meta.driver)
              return (
                <div
                  key={agent}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={agent}
                  tabIndex={0}
                  style={agentOptionStyle(isSelected)}
                  onClick={() => handleOptionClick(agent)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleOptionClick(agent)
                    }
                  }}
                >
                  <div style={radioStyle(isSelected)}>
                    {isSelected && <div style={radioInnerStyle(isSelected)} />}
                  </div>
                  <div style={agentNameStyle}>{agent}</div>
                  {metaParts.length > 0 && (
                    <span style={agentMetaStyle}>{metaParts.join(' / ')}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div style={footerStyle}>
        <button type="button" onClick={handleCancel} style={cancelBtnStyle}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          style={confirmBtnStyle(!selectedAgent)}
          disabled={!selectedAgent}
        >
          Revive Conversation
        </button>
      </div>
    </div>
  )

  return createPortal(
    <div style={overlayStyle} onClick={handleOverlayClick} role="presentation">
      {modalContent}
    </div>,
    document.body
  )
}
