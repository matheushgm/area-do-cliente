import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { canViewSquadsReport } from '../lib/utils'

// `loadingAuth` é true até o getSession() do Supabase resolver. Devolver null
// nesse meio-tempo evita o redirect prematuro no callback OAuth (PKCE).

export function RequireAuth({ children }) {
  const { user, loadingAuth } = useApp()
  if (loadingAuth) return null
  return user ? children : <Navigate to="/login" replace />
}

export function RequireAdmin({ children }) {
  const { user, loadingAuth } = useApp()
  if (loadingAuth) return null
  if (!user) return <Navigate to="/login" replace />
  return user.role === 'admin' ? children : <Navigate to="/" replace />
}

// Quem já está logado não vê a tela de login — vai direto pro Dashboard.
export function RedirectIfAuthed({ children }) {
  const { user, loadingAuth } = useApp()
  if (loadingAuth) return null
  return user ? <Navigate to="/" replace /> : children
}

export function RequireSquadsAccess({ children }) {
  const { user, loadingAuth } = useApp()
  if (loadingAuth) return null
  if (!user) return <Navigate to="/login" replace />
  return canViewSquadsReport(user) ? children : <Navigate to="/" replace />
}
