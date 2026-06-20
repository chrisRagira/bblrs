import { useState, useEffect } from 'react'
import { isLoggedIn } from './lib/api.js'
import AuthPage from './pages/AuthPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn())

  useEffect(() => {
    const handler = () => setAuthed(isLoggedIn())
    window.addEventListener('auth-change', handler)
    return () => window.removeEventListener('auth-change', handler)
  }, [])

  return authed
    ? <DashboardPage onLogout={() => { setAuthed(false) }} />
    : <AuthPage onAuth={() => setAuthed(true)} />
}