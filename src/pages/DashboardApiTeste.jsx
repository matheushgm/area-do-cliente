import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, FlaskConical } from 'lucide-react'
import AppSidebar from '../components/AppSidebar'

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard de Tráfego (NOVA versão — alimentada por API Meta + Google).
// EM TESTE: enquanto reformulamos, fica embutida via iframe do viewer
// standalone em /dash-teste/viewer.html (estático em public/). Não substitui o
// dashboard atual (/dashboard) — é uma aba separada para validação.
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardApiTeste() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-gradient-dark">
      <AppSidebar
        filter="dashboard-teste"
        setFilter={() => navigate('/')}
        counts={{}}
        activeAccounts={[]}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar mobile */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu de navegação"
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-rl-text text-sm">Dashboard (em teste)</span>
        </div>

        {/* Faixa "em teste" */}
        <div className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold"
             style={{ background: '#FEF3C7', color: '#92400E', borderBottom: '1px solid #FDE68A' }}>
          <FlaskConical className="w-4 h-4 shrink-0" />
          <span>
            Dashboard <b>em teste</b> — nova versão alimentada por API (Meta&nbsp;+&nbsp;Google), com
            drill-down de campanhas/conjuntos/anúncios e conversões pela coluna “Resultados”.
            Estamos validando os dados; o dashboard oficial continua em <b>“Dashboard”</b>.
          </span>
        </div>

        {/* Viewer embutido */}
        <iframe
          src="/dash-teste/viewer.html"
          title="Dashboard de Tráfego (API) — em teste"
          style={{ flex: 1, width: '100%', border: 0, minHeight: 'calc(100vh - 42px)' }}
        />
      </div>
    </div>
  )
}
