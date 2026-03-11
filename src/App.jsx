import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewOnboarding from './pages/NewOnboarding'
import ProjectDetail from './pages/ProjectDetail'

function RequireAuth({ children }) {
  const { user } = useApp()
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user } = useApp()
  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/onboarding/new" element={<RequireAuth><NewOnboarding /></RequireAuth>} />
        <Route path="/project/:id" element={<RequireAuth><ProjectDetail /></RequireAuth>} />
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
