import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewOnboarding from './pages/NewOnboarding'
import ProjectDetail from './pages/ProjectDetail'
import UserManagement from './pages/UserManagement'
import ClientForm from './pages/ClientForm'
import B2CClientForm from './pages/B2CClientForm'
import NPSClientForm from './pages/NPSClientForm'
import BancoDeAnuncios from './pages/BancoDeAnuncios'
import BancoDeAnunciosPublico from './pages/BancoDeAnunciosPublico'
import CRMPublico from './pages/CRMPublico'
import FunilCanvas from './pages/FunilCanvas'
import SquadsReport from './pages/SquadsReport'
import ResetPassword from './pages/ResetPassword'

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
        <Route path="/nps/:token" element={<NPSClientForm />} />
        <Route path="/banco-de-anuncios" element={<RequireAuth><BancoDeAnuncios /></RequireAuth>} />
        <Route path="/banco-publico" element={<BancoDeAnunciosPublico />} />
        <Route path="/crm/:token" element={<CRMPublico />} />
        <Route path="/funil" element={<RequireAuth><FunilCanvas /></RequireAuth>} />
        <Route path="/squads-report" element={<RequireAuth><SquadsReport /></RequireAuth>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
