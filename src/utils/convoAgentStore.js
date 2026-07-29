// localStorage key prefix for storing last-known agents per conversation
const STORAGE_PREFIX = 'hd:convoAgent:'

/**
 * Get the last known agent for a conversation.
 * Priority:
 * 1. localStorage (persisted across sessions)
 * 2. convoState.last_session.agent_name (from API)
 * 3. convoState.first_session.agent_name (fallback)
 * @param {string} convoId - Conversation ID
 * @param {object} convoState - Conversation state from API (optional)
 * @returns {string|null} Agent name or null if not found
 */
export function getLastKnownAgent(convoId, convoState) {
  if (!convoId) return null

  const storageKey = `${STORAGE_PREFIX}${convoId}`

  // 1. Check localStorage first (persists across sessions)
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) return stored
  } catch {
    // localStorage might be unavailable
  }

  // 2. Fallback: extract from convoState
  if (convoState && typeof convoState === 'object') {
    for (const key of Object.keys(convoState)) {
      const val = convoState[key]
      if (val && typeof val === 'object') {
        if (val.last_session?.agent_name) {
          return val.last_session.agent_name
        }
        if (val.first_session?.agent_name) {
          return val.first_session.agent_name
        }
      }
    }
  }

  return null
}

/**
 * Store the last known agent for a conversation in localStorage.
 * @param {string} convoId - Conversation ID
 * @param {string} agentName - Agent name to store
 */
export function setLastKnownAgent(convoId, agentName) {
  if (!convoId || !agentName) return
  const storageKey = `${STORAGE_PREFIX}${convoId}`
  try {
    localStorage.setItem(storageKey, agentName)
  } catch {
    // Ignore localStorage errors (private browsing, quota exceeded, etc.)
  }
}

/**
 * Clear the stored agent for a conversation.
 * @param {string} convoId - Conversation ID
 */
export function clearLastKnownAgent(convoId) {
  if (!convoId) return
  const storageKey = `${STORAGE_PREFIX}${convoId}`
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // Ignore
  }
}

/**
 * Get all stored conversation agents (for debugging/cleanup).
 * @returns {Record<string, string>} Map of convoId -> agentName
 */
export function getAllStoredAgents() {
  const result = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const convoId = key.slice(STORAGE_PREFIX.length)
        result[convoId] = localStorage.getItem(key)
      }
    }
  } catch {
    // Ignore
  }
  return result
}
