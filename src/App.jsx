import { useAuth } from './auth/AuthContext'
import LoginForm from './auth/LoginForm'
import NavBar from './components/NavBar'
import WorkflowList from './components/WorkflowList'

const s = {
  main: { maxWidth: 900, margin: '0 auto', padding: '32px 24px' },
}

export default function App() {
  const { creds } = useAuth()

  if (!creds) return <LoginForm />

  return (
    <>
      <NavBar />
      <main style={s.main}>
        <WorkflowList />
      </main>
    </>
  )
}
