import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import AppSidebar from '../components/AppSidebar'

export default function WorkloadDashboard() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-gradient-dark">
      <AppSidebar
        filter="workload"
        setFilter={() => navigate('/')}
        counts={{}}
        activeAccounts={[]}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar mobile */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de navegação" className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-rl-text text-sm">Capacidade do Time</span>
        </div>
        {/* Dashboard embutido */}
        <iframe
          src="/workload/dashboard.html"
          title="Capacidade do Time — Workload (ClickUp)"
          style={{ flex: 1, width: '100%', border: 0, minHeight: 'calc(100vh - 42px)' }}
        />
      </div>
    </div>
  )
}
