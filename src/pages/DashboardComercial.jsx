import { useOutletContext } from 'react-router-dom'
import { Menu } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Comercial (métricas de pré-venda, venda e mídia paga da Verta),
// ferramenta interna (menu Ferramentas). HTML estático de arquivo único em
// public/ferramentas/dashboard-comercial/, embutido por iframe. Origem: repo
// eduardomouras/dashboard-comercial-verta. Funil lido ao vivo da planilha
// 1IWBvkOSK1v0wbdGJCGkG1oVHQMZ51rkUe56pl3Kx9s8 (abas PRÉ-VENDA e VENDA); mídia paga
// por /api/dash-comercial-meta (exige login, usa o META_TOKEN da Vercel). Ao trocar
// o index.html por uma versão nova, refazer a troca de /api/meta pela função nova.
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardComercial() {
  const { openSidebar } = useOutletContext()

  return (
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
        <span className="font-bold text-rl-text text-sm">Dashboard Comercial</span>
      </div>

      <iframe
        src="/ferramentas/dashboard-comercial/index.html"
        title="Dashboard Comercial"
        style={{ flex: 1, width: '100%', border: 0, minHeight: '100vh' }}
      />
    </div>
  )
}
