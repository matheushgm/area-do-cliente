import { Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { canViewSquadsReport } from '../lib/utils'

// `loadingAuth` é true até o getSession() do Supabase resolver. Devolver null
// nesse meio-tempo evita o redirect prematuro no callback OAuth (PKCE).

// Usuário só VertaTask (user.restrito) só fica no /tarefas: qualquer outra rota interna volta pra lá.
export const ROTA_RESTRITO = '/tarefas'

export function RequireAuth({ children }) {
  const { user, loadingAuth } = useApp()
  const { pathname } = useLocation()
  if (loadingAuth) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.restrito && pathname !== ROTA_RESTRITO) return <Navigate to={ROTA_RESTRITO} replace />
  return children
}

export function RequireAdmin({ children }) {
  const { user, loadingAuth } = useApp()
  if (loadingAuth) return null
  if (!user) return <Navigate to="/login" replace />
  return user.role === 'admin' ? children : <Navigate to="/" replace />
}

// Quem já está logado não vê a tela de login: vai direto para a Inicial.
export function RedirectIfAuthed({ children }) {
  const { user, loadingAuth } = useApp()
  if (loadingAuth) return null
  return user ? <Navigate to="/inicial" replace /> : children
}

export function RequireSquadsAccess({ children }) {
  const { user, loadingAuth } = useApp()
  if (loadingAuth) return null
  if (!user) return <Navigate to="/login" replace />
  return canViewSquadsReport(user) ? children : <Navigate to="/" replace />
}
