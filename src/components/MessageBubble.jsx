import { useState, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import useMediaQuery from '../utils/useMediaQuery'

// ─── Constants ───────────────────────────────────────────────────────────────

export const ROLE_COLOR = {
  user:   '#38bdf8',
  agent:  '#4ade80',
  system: '#94a3b8',
  tool:   '#f6c90e',
}

export const COLLAPSE_LINE_THRESHOLD = 3

// ─── Helper ──────────────────────────────────────────────────────────────────

export function truncateID(id) {
  if (!id) return ''
  return id.length > 20 ? id.slice(0, 8) + '…' + id.slice(-6) : id
}

// ─── Styles ──────────────────────────────────────────────────────────────────

export const messageStyles = {
  msgRow: (role) => ({
    display: 'flex',
    justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
    minWidth: 0,
  }),
  msgBubble: (role, isMobile = false) => ({
    padding: '8px 12px',
    borderRadius: role === 'user' ? '8px 0 0 8px' : '0 8px 8px 0',
    border: '1px solid #2d3148',
    // Drop the alignment-side border so it connects flush to the history-box
    // border without a doubled 2px line (the box provides the outer line).
    borderLeft: role === 'user' ? '1px solid #2d3148' : 'none',
    borderRight: role === 'user' ? 'none' : '1px solid #2d3148',
    background: role === 'user' ? '#162030' : role === 'agent' ? '#12201a' : '#191d2b',
    maxWidth: isMobile ? '92%' : '75%',
    minWidth: 0,
    wordBreak: 'break-word',
    textAlign: 'left',
  }),
  msgHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  msgRole: (role) => ({
    fontSize: 11,
    fontWeight: 700,
    color: ROLE_COLOR[role] || '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }),
  viewSelect: {
    fontSize: 10,
    background: '#0f1117',
    color: '#64748b',
    border: '1px solid #2d3148',
    borderRadius: 4,
    padding: '1px 4px',
    cursor: 'pointer',
    outline: 'none',
  },
  msgContent: {
    fontSize: 13,
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
  },
  thoughtsBlock: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5,
    borderLeft: '2px solid #2d3148',
    paddingLeft: 8,
    marginBottom: 8,
  },
  thoughtsLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  toolCallID: { fontSize: 10, color: '#475569', marginTop: 2 },
  msgTokenFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    fontSize: 10,
    color: '#475569',
    marginTop: 4,
  },
  toolCallCard: {
    background: '#0d1017',
    borderRadius: 6,
    border: '1px solid #2d3148',
    padding: '6px 10px',
  },
  toolCallFuncName: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 700,
    color: '#f6c90e',
    marginBottom: 4,
  },
  toolCallJson: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#94a3b8',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: 0,
    lineHeight: 1.5,
  },
  toolResultLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  collapseToggle: {
    display: 'block',
    width: '100%',
    background: 'none',
    border: 'none',
    borderTop: '1px solid #1e2438',
    color: '#475569',
    fontSize: 10,
    cursor: 'pointer',
    padding: '3px 0 0',
    textAlign: 'center',
    marginTop: 4,
  },
  subAgentNavLink: {
    display: 'inline-block',
    marginTop: 6,
    fontSize: 11,
    fontWeight: 600,
    color: '#7c3aed',
    textDecoration: 'none',
    cursor: 'pointer',
    padding: '2px 0',
    borderBottom: '1px solid transparent',
    transition: 'border-color 0.15s, color 0.15s',
  },
}

// ─── Markdown CSS ─────────────────────────────────────────────────────────────

export const markdownCSS = `
  .md-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
    font-size: 13px;
    display: block;
    overflow-x: auto;
  }
  .md-content thead {
    background: #1a1f30;
  }
  .md-content th {
    border: 1px solid #2d3148;
    padding: 8px 12px;
    text-align: left;
    font-weight: 700;
    color: #e2e8f0;
    background: #1a1f30;
  }
  .md-content td {
    border: 1px solid #2d3148;
    padding: 6px 12px;
    text-align: left;
    color: #cbd5e1;
  }
  .md-content tr {
    border-bottom: 1px solid #2d3148;
  }
  .md-content tr:nth-child(even) {
    background: #111827;
  }
  .md-content tr:nth-child(odd) {
    background: #0f131d;
  }
  .md-content tr:hover {
    background: #1e2438;
  }
`

// ─── CollapsiblePre ──────────────────────────────────────────────────────────

export function CollapsiblePre({ text, bg }) {
  const lines = text.split('\n').length
  const collapsible = lines > COLLAPSE_LINE_THRESHOLD
  const [expanded, setExpanded] = useState(false)
  const collapsed = collapsible && !expanded
  return (
    <>
      <div style={{ position: 'relative' }}>
        <pre style={{ ...messageStyles.toolCallJson, ...(collapsed ? { maxHeight: 50, overflow: 'hidden' } : {}) }}>{text}</pre>
        {collapsed && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 24,
            background: `linear-gradient(transparent, ${bg || '#0d1017'})`,
            pointerEvents: 'none',
          }} />
        )}
      </div>
      {collapsible && (
        <button style={messageStyles.collapseToggle} onClick={() => setExpanded((v) => !v)}>
          {expanded ? '▲ collapse' : '▼ expand'}
        </button>
      )}
    </>
  )
}

// ─── CollapsibleMarkdown ─────────────────────────────────────────────────────

export const CollapsibleMarkdown = memo(function CollapsibleMarkdown({ text, viewMode, bg }) {
  const lines = text.split('\n').length
  const collapsible = lines > COLLAPSE_LINE_THRESHOLD
  const [expanded, setExpanded] = useState(false)
  const collapsed = collapsible && !expanded
  const maxH = viewMode === 'markdown' ? 72 : 50
  return (
    <>
      <div style={{ position: 'relative' }}>
        <div style={collapsed ? { maxHeight: maxH, overflow: 'hidden' } : {}}>
          {viewMode === 'markdown'
            ? <div className="md-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div>
            : <div style={messageStyles.msgContent}>{text}</div>}
        </div>
        {collapsed && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 24,
            background: `linear-gradient(transparent, ${bg || '#0d1017'})`,
            pointerEvents: 'none',
          }} />
        )}
      </div>
      {collapsible && (
        <button style={messageStyles.collapseToggle} onClick={() => setExpanded((v) => !v)}>
          {expanded ? '▲ collapse' : '▼ expand'}
        </button>
      )}
    </>
  )
})

// ─── ToolCallCard ────────────────────────────────────────────────────────────

export const ToolCallCard = memo(function ToolCallCard({ call, onNavigateToSubAgent }) {
  const isAgent = call.FuncName?.startsWith('ag__')
  const displayName = isAgent ? call.FuncName.slice(4) : call.FuncName
  const input = isAgent ? (call.Params?.input || '') : null
  const hasConvoID = !!(call.ConvoID || call.convo_id)
  const convoID = call.ConvoID || call.convo_id || ''
  const [viewMode, setViewMode] = useState('markdown')
  const hasParams = !isAgent && call.Params && Object.keys(call.Params).length > 0
  return (
    <div style={messageStyles.toolCallCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={messageStyles.toolCallFuncName}>{isAgent ? '🤖' : '⚙'} {displayName}</div>
        {isAgent && input && (
          <select style={messageStyles.viewSelect} value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="markdown">Markdown</option>
            <option value="text">Text</option>
          </select>
        )}
      </div>
      {isAgent
        ? (input && <CollapsibleMarkdown text={input} viewMode={viewMode} />)
        : (hasParams && <CollapsiblePre text={JSON.stringify(call.Params, null, 2)} />)
      }
      {hasConvoID && onNavigateToSubAgent && (
        <div
          style={messageStyles.subAgentNavLink}
          onClick={(e) => { e.stopPropagation(); onNavigateToSubAgent(convoID) }}
          onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = '#7c3aed'; e.currentTarget.style.color = '#a78bfa' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; e.currentTarget.style.color = '#7c3aed' }}
        >
          ⟫ View Sub-Agent Conversation
        </div>
      )}
    </div>
  )
})

// ─── ToolResultCard ──────────────────────────────────────────────────────────

export const ToolResultCard = memo(function ToolResultCard({ result, index }) {
  const data = result?.data
  const isStringData = typeof data === 'string'
  const isSuccess = result?.status === 'success' || result?.status == null
  const isAgentResult = result?.func_name?.startsWith('ag__')
  const renderAsMarkdown = isStringData && isSuccess && isAgentResult
  const [viewMode, setViewMode] = useState('markdown')
  return (
    <div style={messageStyles.toolCallCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={messageStyles.toolResultLabel}>result {index + 1}{result?.status ? ` · ${result.status}` : ''}</div>
        {renderAsMarkdown && (
          <select style={messageStyles.viewSelect} value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="markdown">Markdown</option>
            <option value="text">Text</option>
          </select>
        )}
      </div>
      {renderAsMarkdown
        ? <CollapsibleMarkdown text={data} viewMode={viewMode} />
        : <CollapsiblePre text={JSON.stringify(result, null, 2)} />
      }
    </div>
  )
})

// ─── MessageBubble ───────────────────────────────────────────────────────────

export const MessageBubble = memo(function MessageBubble({ msg, idx, showTools = true, showThoughts = false, onNavigateToSubAgent }) {
  const role = msg.Role || msg.role || 'unknown'
  const user = msg.User || msg.user || ''
  const defaultMode = (role === 'user' || role === 'agent') ? 'markdown' : 'text'
  const [viewMode, setViewMode] = useState(defaultMode)
  const rawContent = msg.content || ''
  const thoughts = msg.thoughts || ''

  // Detect archived conversation marker in system messages
  const archivedConvoMatch = rawContent.match(/<!-- archived_convo: ([^>]+) -->/)
  const archivedConvoID = archivedConvoMatch ? archivedConvoMatch[1].trim() : null
  const content = archivedConvoMatch ? rawContent.replace(/<!-- archived_convo: [^>]+ -->\n?/, '') : rawContent
  const [thoughtsViewMode, setThoughtsViewMode] = useState('markdown')
  const toolCalls = msg.ToolCalls || []
  const toolResults = msg.ToolResult || []
  const bubbleBg = role === 'user' ? '#162030' : role === 'agent' ? '#12201a' : '#191d2b'
  const isMobile = useMediaQuery('(max-width: 768px)')
  return (
    <div style={messageStyles.msgRow(role)}>
      <div style={messageStyles.msgBubble(role, isMobile)} data-testid="msg-bubble">
        <div style={messageStyles.msgHeader}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <div style={messageStyles.msgRole(role)}>{role}</div>
            {user && <div style={{ fontSize: 10, color: '#64748b' }}>{user}</div>}
          </div>
          {content && (
            <select style={messageStyles.viewSelect} value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
              <option value="markdown">Markdown</option>
              <option value="text">Text</option>
            </select>
          )}
        </div>
        {showThoughts && thoughts && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <div style={messageStyles.thoughtsLabel}>Thoughts</div>
              <select style={messageStyles.viewSelect} value={thoughtsViewMode} onChange={(e) => setThoughtsViewMode(e.target.value)}>
                <option value="markdown">Markdown</option>
                <option value="text">Text</option>
              </select>
            </div>
            <div style={messageStyles.thoughtsBlock}>
              <CollapsibleMarkdown text={thoughts} viewMode={thoughtsViewMode} bg={bubbleBg} />
            </div>
          </div>
        )}
        {showTools && toolCalls.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: content ? 8 : 0 }}>
            {toolCalls.map((call, i) => <ToolCallCard key={i} call={call} onNavigateToSubAgent={onNavigateToSubAgent} />)}
          </div>
        )}
        {showTools && toolResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: content ? 8 : 0 }}>
            {toolResults.map((result, i) => <ToolResultCard key={i} result={result} index={i} />)}
          </div>
        )}
        {content && (viewMode === 'markdown'
          ? <div className="md-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>
          : <div style={messageStyles.msgContent}>{content}</div>
        )}
        {archivedConvoID && onNavigateToSubAgent && (() => {
          const genMatch = archivedConvoID.match(/_g(\d+)$/)
          const genNum = genMatch ? genMatch[1] : null
          const label = genNum ? `📎 View archived conversation (generation ${genNum})` : '📎 View archived conversation'
          return (
            <div
              style={messageStyles.subAgentNavLink}
              onClick={(e) => { e.stopPropagation(); onNavigateToSubAgent(archivedConvoID) }}
              onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = '#7c3aed'; e.currentTarget.style.color = '#a78bfa' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; e.currentTarget.style.color = '#7c3aed' }}
            >
              {label}
            </div>
          )
        })()}
        {msg.tool_call_id && <div style={messageStyles.toolCallID}>tool_call_id: {msg.tool_call_id}</div>}
        {(msg.input_tokens > 0 || msg.output_tokens > 0) && (
          <div style={messageStyles.msgTokenFooter}>
            tokens: {(msg.input_tokens || 0).toLocaleString()}/{(msg.output_tokens || 0).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
})
