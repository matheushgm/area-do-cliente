import { useLocation, useOutletContext } from 'react-router-dom'
import { Menu } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard de Tráfego — alimentado pelas APIs de Meta + Google. A tela em si
// é o viewer standalone de /dash-teste/viewer.html (estático em public/),
// embutido por iframe. O dashboard antigo (planilhas) não existe mais.
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardApiTeste() {
  const { openSidebar } = useOutletContext()
  const { search } = useLocation()

  // `?cliente=&canal=` abre o viewer já na conta certa — é o que o botão de
  // compartilhar de ProjectTrafficDashboard monta. Antes a query morria no
  // redirect /dashboard → /dashboard-teste e o link chegava sem contexto.
  const viewerSrc = `/dash-teste/viewer.html${search}`

  return (
    <>
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar mobile */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button
            onClick={openSidebar}
            aria-label="Abrir menu de navegação"
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-rl-text text-sm">Dashboard</span>
        </div>

        {/* Viewer embutido */}
        <iframe
          src={viewerSrc}
          title="Dashboard de Tráfego"
          style={{ flex: 1, width: '100%', border: 0, minHeight: 'calc(100vh - 42px)' }}
        />
      </div>
    </>
  )
}
