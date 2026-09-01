import { useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext'
import GitHubCallback from './auth/GitHubCallback'
import SAMLCallback from './auth/SAMLCallback'
import SAMLMetadata from './auth/SAMLMetadata'
import ConversationsPage from './components/ConversationsPage'
import ConvoHistoryPage from './components/ConvoHistoryPage'
import GitHubSecretsPage from './components/GitHubSecretsPage'
import GitHubWorkflowList from './components/GitHubWorkflowList'
import LogStreamPage from './components/LogStreamPage'
import LoginForm from './auth/LoginForm'
import NavBar from './components/NavBar'
import WorkflowList from './components/WorkflowList'
import useMediaQuery from './utils/useMediaQuery'

const MOBILE_BREAKPOINT = '(max-width: 768px)'

// Height the (mobile) GLOBAL NavBar occupies in the document flow while shown.
// The pages compensate for it with a CSS var (--nav-h) so that collapsing the
// NavBar lets the page content grow to reclaim the space exactly.
const NAV_HEIGHT_PX = 100

const s = {
  main: { maxWidth: 900, margin: '0 auto', padding: '32px 24px' },
  mainWide: { maxWidth: 1400, margin: '0 auto', padding: '16px 24px' },
  mainMobile: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '12px 8px',
    minWidth: 0,
  },
  mainMobileEdge: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: 0,
    minWidth: 0,
  },
}

function parseProviderDataQuery(raw) {
  const value = String(raw || '').trim()
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  } catch {
    return null
  }

  return null
}

function parseRouteLocation() {
  const { pathname, search } = window.location
  const params = new URLSearchParams(search)

  if (params.get('view') === 'log-stream') {
    const providerData = parseProviderDataQuery(params.get('provider_data'))
    return {
      view: 'log-stream',
      provider: (params.get('provider') || 'podman').trim() || 'podman',
      podID: (params.get('pod') || '').trim(),
      providerData,
      ghSlug: (params.get('gh') || '').trim(),
      streamToken: (params.get('stream_token') || '').trim(),
    }
  }

  if (pathname.startsWith('/gh/events')) {
    const raw = pathname.replace(/^\/gh\/events\/?/, '')
    const ghSlug = raw
      ? raw.split('/').map((part) => decodeURIComponent(part)).join('/')
      : ''
    return { view: 'github-events', ghSlug }
  }

  if (pathname.startsWith('/gh/secrets')) {
    const raw = pathname.replace(/^\/gh\/secrets\/?/, '')
    const ghSlug = raw
      ? raw.split('/').map((part) => decodeURIComponent(part)).join('/')
      : ''
    return { view: 'github-secrets', ghSlug }
  }

  if (pathname.startsWith('/logs/')) {
    const raw = pathname.replace(/^\/logs\//, '')
    const [providerPart, podPart] = raw.split('/')
    const provider = decodeURIComponent(providerPart || '').trim()
    const podID = decodeURIComponent(podPart || '').trim()
    const ghSlug = (params.get('gh') || '').trim()
    const streamToken = (params.get('stream_token') || '').trim()
    const providerData = parseProviderDataQuery(params.get('provider_data'))

    return {
      view: 'log-stream',
      provider: provider || 'podman',
      podID,
      providerData,
      ghSlug,
      streamToken,
    }
  }

  if (params.get('view') === 'github-events') {
    return { view: 'github-events', ghSlug: (params.get('gh') || '').trim() }
  }

  if (pathname.startsWith('/conversations')) {
    const raw = pathname.replace(/^\/conversations\/?/, '')
    const convoId = raw ? decodeURIComponent(raw) : ''
    return { view: 'conversations', convoId, ghSlug: '', provider: '', podID: '', providerData: null, streamToken: '' }
  }

  if (pathname.startsWith('/focus/')) {
    const raw = pathname.replace(/^\/focus\/?/, '')
    const convoId = raw ? decodeURIComponent(raw) : ''
    return { view: 'focus', convoId, ghSlug: '', provider: '', podID: '', providerData: null, streamToken: '' }
  }

  return { view: 'events', convoId: '', ghSlug: '', provider: '', podID: '', providerData: null, streamToken: '' }
}

function buildGitHubEventsPath(ghSlug) {
  const normalized = String(ghSlug || '').replace(/^\/+/, '').trim()
  if (!normalized) {
    return '/gh/events'
  }

  return `/gh/events/${normalized.split('/').map((part) => encodeURIComponent(part)).join('/')}`
}

function buildGitHubSecretsPath(ghSlug) {
  const normalized = String(ghSlug || '').replace(/^\/+/, '').trim()
  if (!normalized) {
    return '/gh/secrets'
  }

  return `/gh/secrets/${normalized.split('/').map((part) => encodeURIComponent(part)).join('/')}`
}

function buildConversationsPath(convoId) {
  const normalized = String(convoId || '').trim()
  if (!normalized) {
    return '/conversations'
  }

  return `/conversations/${encodeURIComponent(normalized)}`
}

function buildFocusPath(convoId) {
  const normalized = String(convoId || '').trim()
  if (!normalized) {
    return '/focus'
  }

  return `/focus/${encodeURIComponent(normalized)}`
}

function buildLogStreamPath(provider, podID, providerData, ghSlug, streamToken) {
  const query = new URLSearchParams()
  query.set('view', 'log-stream')
  query.set('provider', String(provider || 'podman').trim() || 'podman')
  query.set('pod', String(podID || '').trim())
  if (providerData && typeof providerData === 'object') {
    query.set('provider_data', JSON.stringify(providerData))
  }
  if (ghSlug) {
    query.set('gh', String(ghSlug).replace(/^\/+/, '').trim())
  }
  if (streamToken) {
    query.set('stream_token', String(streamToken).trim())
  }

  return `/?${query.toString()}`
}

export default function App() {
  const { creds, isGitHubSession } = useAuth()
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT)
  const [view, setView] = useState(() => parseRouteLocation().view)
  const [convoId, setConvoId] = useState(() => parseRouteLocation().convoId)
  const [ghSlug, setGhSlug] = useState(() => parseRouteLocation().ghSlug)
  const [logProvider, setLogProvider] = useState(() => parseRouteLocation().provider || 'podman')
  const [logPodID, setLogPodID] = useState(() => parseRouteLocation().podID || '')
  const [logProviderData, setLogProviderData] = useState(() => parseRouteLocation().providerData || null)
  const [logStreamToken, setLogStreamToken] = useState(() => parseRouteLocation().streamToken || '')
  const [showGlobalEventsTab, setShowGlobalEventsTab] = useState(true)
  // Drawer state is lifted to App so the global NavBar badge can open/toggle it.
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  // Whether the GLOBAL NavBar is currently auto-hidden (mobile browser
  // address-bar style).
  const [navCollapsed, setNavCollapsed] = useState(false)

  useEffect(() => {
    const syncFromLocation = () => {
      const route = parseRouteLocation()
      setView(route.view)
      setConvoId(route.convoId)
      setGhSlug(route.ghSlug)
      setLogProvider(route.provider || 'podman')
      setLogPodID(route.podID || '')
      setLogProviderData(route.providerData || null)
      setLogStreamToken(route.streamToken || '')
    }

    window.addEventListener('popstate', syncFromLocation)

    const nextView = sessionStorage.getItem('hd_next_view')
    if (nextView) {
      setView(nextView)
      sessionStorage.removeItem('hd_next_view')
    }

    return () => {
      window.removeEventListener('popstate', syncFromLocation)
    }
  }, [])

  useEffect(() => {
    if (!isGitHubSession && (view === 'github-events' || view === 'github-secrets')) {
      setView('events')
    }
  }, [isGitHubSession, view])

  // Close the drawer whenever we leave the conversations view, so stale open
  // state can never disable the NavBar collapse on another page.
  useEffect(() => {
    if (view !== 'conversations') {
      setIsDrawerOpen(false)
    }
  }, [view])

  // Drive the page-height CSS var that compensates for the GLOBAL NavBar. When
  // the NavBar collapses the var goes to 0 so the page content expands to fill
  // the reclaimed space (no blank gap).
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--nav-h',
      navCollapsed ? '0px' : `${NAV_HEIGHT_PX}px`
    )
  }, [navCollapsed])

  // Force the NavBar expanded whenever collapse isn't possible: on desktop, on
  // pages that don't host the auto-hide hook, or while the drawer is open.
  useEffect(() => {
    if (!isMobile || isDrawerOpen || (view !== 'conversations' && view !== 'focus')) {
      setNavCollapsed(false)
    }
  }, [isMobile, isDrawerOpen, view])

  useEffect(() => {
    setShowGlobalEventsTab(true)
  }, [creds?.token, creds?.authProvider])

  useEffect(() => {
    if (window.location.pathname === '/auth/github/callback') {
      return
    }

    if (window.location.pathname === '/auth/saml/callback') {
      return
    }

    let targetPath = '/'
    if (isGitHubSession && view === 'github-events') {
      targetPath = buildGitHubEventsPath(ghSlug)
    }
    if (isGitHubSession && view === 'github-secrets') {
      targetPath = buildGitHubSecretsPath(ghSlug)
    }
    if (view === 'log-stream') {
      targetPath = buildLogStreamPath(logProvider, logPodID, logProviderData, ghSlug, logStreamToken)
    }
    if (view === 'conversations') {
      targetPath = buildConversationsPath(convoId)
    }
    if (view === 'focus') {
      targetPath = buildFocusPath(convoId)
    }

    const current = window.location.pathname + window.location.search
    if (current !== targetPath) {
      window.history.pushState({}, '', targetPath)
    }
  }, [view, convoId, ghSlug, isGitHubSession, logProvider, logPodID, logProviderData, logStreamToken])

  if (window.location.pathname === '/auth/github/callback') {
    return <GitHubCallback />
  }

  if (window.location.pathname === '/auth/saml/callback') {
    return <SAMLCallback />
  }

  if (window.location.pathname === '/auth/saml/metadata') {
    return <SAMLMetadata />
  }

  if (!creds) return <LoginForm />

  const handleViewChange = (nextView) => {
    setView(nextView)
    if (nextView !== 'conversations') {
      setIsDrawerOpen(false)
    }
  }

  const handleEventsForbidden = () => {
    setShowGlobalEventsTab(false)
    if (isGitHubSession) {
      setView('github-events')
    }
  }

  const openGitHubSecrets = () => {
    setView('github-secrets')
    setIsDrawerOpen(false)
  }

  const openGitHubEvents = () => {
    setView('github-events')
    setIsDrawerOpen(false)
  }

  const openLogStream = ({ provider, podID, providerData = null, ghSlug: targetGhSlug = '', streamToken = '' }) => {
    setLogProvider(provider || 'podman')
    setLogPodID(podID || '')
    setLogProviderData(providerData)
    setLogStreamToken(streamToken || '')
    if (targetGhSlug) {
      setGhSlug(targetGhSlug)
    }
    setView('log-stream')
    setIsDrawerOpen(false)
  }

  const showGitHubEventsTab = isGitHubSession

  const handleNavigateToConvo = (nextConvoId) => {
    setConvoId(nextConvoId)
    window.history.pushState({}, '', buildFocusPath(nextConvoId))
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const handleFocusMode = (nextConvoId) => {
    setConvoId(nextConvoId)
    setView('focus')
    setIsDrawerOpen(false)
  }

  const openDrawer = () => setIsDrawerOpen(true)
  const closeDrawer = () => setIsDrawerOpen(false)

  // Don't collapse the NavBar behind/over the open drawer, and never collapse
  // on desktop.
  const allowNavCollapse = isMobile && !isDrawerOpen

  return (
    <>
      <NavBar
        view={view}
        onViewChange={handleViewChange}
        showGlobalEventsTab={showGlobalEventsTab}
        showGitHubEventsTab={showGitHubEventsTab}
        showGitHubSecretsTab={showGitHubEventsTab}
        showConversationsTab={showGlobalEventsTab}
        showTabs={view !== 'focus'}
        isDrawerOpen={isDrawerOpen}
        onOpenDrawer={openDrawer}
        onCloseDrawer={closeDrawer}
        navCollapsed={navCollapsed}
      />
      <main style={view === 'conversations' || view === 'focus' ? (isMobile ? s.mainMobileEdge : s.mainWide) : (isMobile ? { ...s.mainMobile, maxWidth: 900 } : s.main)}>
        {isGitHubSession && view === 'github-events' && (
          <GitHubWorkflowList
            ghSlug={ghSlug}
            onGhSlugChange={setGhSlug}
            onOpenSecrets={openGitHubSecrets}
            onOpenLogStream={({ provider, podID, providerData = null, ghSlug: streamGhSlug = '', streamToken = '' }) => (
              openLogStream({ provider, podID, providerData, ghSlug: streamGhSlug || ghSlug, streamToken })
            )}
          />
        )}
        {isGitHubSession && view === 'github-secrets' && (
          <GitHubSecretsPage ghSlug={ghSlug} onGhSlugChange={setGhSlug} onBackToEvents={openGitHubEvents} />
        )}
        {view === 'log-stream' && (
          <LogStreamPage
            provider={logProvider}
            podID={logPodID}
            providerData={logProviderData}
            ghSlug={ghSlug}
            streamToken={logStreamToken}
            onBackToEvents={openGitHubEvents}
          />
        )}
        {view === 'conversations' && (
          <ConversationsPage
            initialConvoId={convoId}
            onConvoIdChange={setConvoId}
            onFocusMode={handleFocusMode}
            isDrawerOpen={isDrawerOpen}
            onCloseDrawer={closeDrawer}
            allowNavCollapse={allowNavCollapse}
            onNavCollapsedChange={setNavCollapsed}
          />
        )}
        {view === 'focus' && (
          <ConvoHistoryPage
            convoId={convoId}
            onNavigateToConvo={handleNavigateToConvo}
            allowNavCollapse={allowNavCollapse}
            onNavCollapsedChange={setNavCollapsed}
          />
        )}
        {view !== 'conversations' && view !== 'focus' && (!isGitHubSession || (view !== 'github-events' && view !== 'github-secrets')) && (
          view !== 'log-stream' && <WorkflowList onForbidden={handleEventsForbidden} onOpenLogStream={openLogStream} />
        )}
      </main>
    </>
  )
}
