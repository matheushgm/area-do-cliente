import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { canViewSquadsReport } from './lib/utils'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewOnboarding from './pages/NewOnboarding'
import ProjectDetail from './pages/ProjectDetail'
import UserManagement from './pages/UserManagement'
import ClientForm from './pages/ClientForm'
import B2CClientForm from './pages/B2CClientForm'
import B2BClientForm from './pages/B2BClientForm'
import MeetingMinutePublic from './pages/MeetingMinutePublic'
import MatrizObjecaoPublic from './pages/MatrizObjecaoPublic'
import NPSClientForm from './pages/NPSClientForm'
import BancoDeAnuncios from './pages/BancoDeAnuncios'
import BancoDeAnunciosPublico from './pages/BancoDeAnunciosPublico'
import CRMPublico from './pages/CRMPublico'
import FunilCanvas from './pages/FunilCanvas'
import SquadsReport from './pages/SquadsReport'
import ResetPassword from './pages/ResetPassword'
import Tasks from './pages/Tasks'
import Chat from './pages/Chat'
import DashboardTrafego from './pages/DashboardTrafego'
import DashboardApiTeste from './pages/DashboardApiTeste'
import NotificationCenter from './components/NotificationCenter'

function RequireAuth({ children }) {
  const { user, loadingAuth } = useApp()
  if (loadingAuth) return null
  return user ? children : <Navigate to="/login" replace />
}

function RequireAdmin({ children }) {
  const { user, loadingAuth } = useApp()
  if (loadingAuth) return null
  if (!user) return <Navigate to="/login" replace />
  return user.role === 'admin' ? children : <Navigate to="/" replace />
}

function RequireSquadsAccess({ children }) {
  const { user, loadingAuth } = useApp()
  if (loadingAuth) return null
  if (!user) return <Navigate to="/login" replace />
  return canViewSquadsReport(user) ? children : <Navigate to="/" replace />
}

// Dashboard de Tráfego: público quando aberto via link compartilhável
// (?shared=1) — o cliente vê o próprio dashboard sem login; caso contrário,
// exige autenticação como as demais rotas internas.
function DashboardRoute() {
  const isShared = new URLSearchParams(window.location.search).get('shared') === '1'
  if (isShared) return <DashboardTrafego />
  return <RequireAuth><DashboardTrafego /></RequireAuth>
}

function AppRoutes() {
  const { user, loadingAuth } = useApp()
  return (
    <>
      <Routes>
        <Route path="/login" element={loadingAuth ? null : user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/onboarding/new" element={<RequireAuth><NewOnboarding /></RequireAuth>} />
        <Route path="/project/:id" element={<RequireAuth><ProjectDetail /></RequireAuth>} />
        <Route path="/users" element={<RequireAdmin><UserManagement /></RequireAdmin>} />
        <Route path="/client/:token" element={<ClientForm />} />
        <Route path="/b2c/:token" element={<B2CClientForm />} />
        <Route path="/b2b/:token" element={<B2BClientForm />} />
        <Route path="/ata/:token" element={<MeetingMinutePublic />} />
        <Route path="/objecoes/:token" element={<MatrizObjecaoPublic />} />
        <Route path="/nps/:token" element={<NPSClientForm />} />
        <Route path="/banco-de-anuncios" element={<RequireAuth><BancoDeAnuncios /></RequireAuth>} />
        <Route path="/banco-publico" element={<BancoDeAnunciosPublico />} />
        <Route path="/crm/:token" element={<CRMPublico />} />
        <Route path="/funil" element={<RequireAuth><FunilCanvas /></RequireAuth>} />
        <Route path="/squads-report" element={<RequireSquadsAccess><SquadsReport /></RequireSquadsAccess>} />
        <Route path="/tarefas" element={<RequireAuth><Tasks /></RequireAuth>} />
        <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/dashboard-teste" element={<RequireAuth><DashboardApiTeste /></RequireAuth>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {user && <NotificationCenter />}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}
