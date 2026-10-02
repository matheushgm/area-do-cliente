import { Suspense } from 'react'
import { BrowserRouter, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { publicRoutes } from './routes/publicRoutes'
import { appRoutes } from './routes/appRoutes'
import RouteFallback from './components/UI/RouteFallback'
import NotificationCenter from './components/NotificationCenter'

function AppRoutes() {
  const { user } = useApp()
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {publicRoutes}
          {appRoutes}
        </Routes>
      </Suspense>
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
