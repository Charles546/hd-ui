import { useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext'
import GitHubCallback from './auth/GitHubCallback'
import GitHubSecretsPage from './components/GitHubSecretsPage'
import GitHubWorkflowList from './components/GitHubWorkflowList'
import LogStreamPage from './components/LogStreamPage'
import LoginForm from './auth/LoginForm'
import NavBar from './components/NavBar'
import WorkflowList from './components/WorkflowList'

const s = {
  main: { maxWidth: 900, margin: '0 auto', padding: '32px 24px' },
}

function parseRouteLocation() {
  const { pathname, search } = window.location
  const params = new URLSearchParams(search)

  if (params.get('view') === 'log-stream') {
    return {
      view: 'log-stream',
      provider: (params.get('provider') || 'podman').trim() || 'podman',
      podID: (params.get('pod') || '').trim(),
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

    return {
      view: 'log-stream',
      provider: provider || 'podman',
      podID,
      ghSlug,
    }
  }

  if (params.get('view') === 'github-events') {
    return { view: 'github-events', ghSlug: (params.get('gh') || '').trim() }
  }

  return { view: 'events', ghSlug: '', provider: '', podID: '', streamToken: '' }
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

function buildLogStreamPath(provider, podID, ghSlug) {
  const query = new URLSearchParams()
  query.set('view', 'log-stream')
  query.set('provider', String(provider || 'podman').trim() || 'podman')
  query.set('pod', String(podID || '').trim())
  if (ghSlug) {
    query.set('gh', String(ghSlug).replace(/^\/+/, '').trim())
  }

  return `/?${query.toString()}`
}

export default function App() {
  const { creds, isGitHubSession } = useAuth()
  const [view, setView] = useState(() => parseRouteLocation().view)
  const [ghSlug, setGhSlug] = useState(() => parseRouteLocation().ghSlug)
  const [logProvider, setLogProvider] = useState(() => parseRouteLocation().provider || 'podman')
  const [logPodID, setLogPodID] = useState(() => parseRouteLocation().podID || '')
  const [logStreamToken, setLogStreamToken] = useState(() => parseRouteLocation().streamToken || '')
  const [showGlobalEventsTab, setShowGlobalEventsTab] = useState(true)

  useEffect(() => {
    const syncFromLocation = () => {
      const route = parseRouteLocation()
      setView(route.view)
      setGhSlug(route.ghSlug)
      setLogProvider(route.provider || 'podman')
      setLogPodID(route.podID || '')
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

  useEffect(() => {
    setShowGlobalEventsTab(true)
  }, [creds?.token, creds?.authProvider])

  useEffect(() => {
    if (window.location.pathname === '/auth/github/callback') {
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
      targetPath = buildLogStreamPath(logProvider, logPodID, ghSlug)
    }

    const current = window.location.pathname + window.location.search
    if (current !== targetPath) {
      window.history.replaceState({}, '', targetPath)
    }
  }, [view, ghSlug, isGitHubSession, logProvider, logPodID])

  if (window.location.pathname === '/auth/github/callback') {
    return <GitHubCallback />
  }

  if (!creds) return <LoginForm />

  const handleViewChange = (nextView) => {
    setView(nextView)
  }

  const handleEventsForbidden = () => {
    setShowGlobalEventsTab(false)
    if (isGitHubSession) {
      setView('github-events')
    }
  }

  const openGitHubSecrets = () => {
    setView('github-secrets')
  }

  const openGitHubEvents = () => {
    setView('github-events')
  }

  const openLogStream = ({ provider, podID, ghSlug: targetGhSlug = '', streamToken = '' }) => {
    setLogProvider(provider || 'podman')
    setLogPodID(podID || '')
    setLogStreamToken(streamToken || '')
    if (targetGhSlug) {
      setGhSlug(targetGhSlug)
    }
    setView('log-stream')
  }

  const showGitHubEventsTab = isGitHubSession

  return (
    <>
      <NavBar
        view={view}
        onViewChange={handleViewChange}
        showGlobalEventsTab={showGlobalEventsTab}
        showGitHubEventsTab={showGitHubEventsTab}
        showGitHubSecretsTab={showGitHubEventsTab}
      />
      <main style={s.main}>
        {isGitHubSession && view === 'github-events' && (
          <GitHubWorkflowList
            ghSlug={ghSlug}
            onGhSlugChange={setGhSlug}
            onOpenSecrets={openGitHubSecrets}
            onOpenLogStream={({ provider, podID, ghSlug: streamGhSlug = '', streamToken = '' }) => (
              openLogStream({ provider, podID, ghSlug: streamGhSlug || ghSlug, streamToken })
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
            ghSlug={ghSlug}
            streamToken={logStreamToken}
            onBackToEvents={openGitHubEvents}
          />
        )}
        {(!isGitHubSession || (view !== 'github-events' && view !== 'github-secrets')) && (
          view !== 'log-stream' && <WorkflowList onForbidden={handleEventsForbidden} onOpenLogStream={openLogStream} />
        )}
      </main>
    </>
  )
}
