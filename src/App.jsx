import { useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext'
import GitHubCallback from './auth/GitHubCallback'
import GitHubSecretsPage from './components/GitHubSecretsPage'
import GitHubWorkflowList from './components/GitHubWorkflowList'
import LoginForm from './auth/LoginForm'
import NavBar from './components/NavBar'
import WorkflowList from './components/WorkflowList'

const s = {
  main: { maxWidth: 900, margin: '0 auto', padding: '32px 24px' },
}

function parseRouteLocation() {
  const { pathname, search } = window.location
  const params = new URLSearchParams(search)

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

  if (params.get('view') === 'github-events') {
    return { view: 'github-events', ghSlug: (params.get('gh') || '').trim() }
  }

  return { view: 'events', ghSlug: '' }
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

export default function App() {
  const { creds, isGitHubSession } = useAuth()
  const [view, setView] = useState(() => parseRouteLocation().view)
  const [ghSlug, setGhSlug] = useState(() => parseRouteLocation().ghSlug)
  const [showGlobalEventsTab, setShowGlobalEventsTab] = useState(true)

  useEffect(() => {
    const syncFromLocation = () => {
      const route = parseRouteLocation()
      setView(route.view)
      setGhSlug(route.ghSlug)
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

    const current = window.location.pathname + window.location.search
    if (current !== targetPath) {
      window.history.replaceState({}, '', targetPath)
    }
  }, [view, ghSlug, isGitHubSession])

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
          <GitHubWorkflowList ghSlug={ghSlug} onGhSlugChange={setGhSlug} onOpenSecrets={openGitHubSecrets} />
        )}
        {isGitHubSession && view === 'github-secrets' && (
          <GitHubSecretsPage ghSlug={ghSlug} onGhSlugChange={setGhSlug} onBackToEvents={openGitHubEvents} />
        )}
        {(!isGitHubSession || (view !== 'github-events' && view !== 'github-secrets')) && (
          <WorkflowList onForbidden={handleEventsForbidden} />
        )}
      </main>
    </>
  )
}
