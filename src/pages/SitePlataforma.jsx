import { useOutletContext } from 'react-router-dom'
import { Menu } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Site da Plataforma Verta — ferramenta interna (menu Ferramentas). A página é
// um HTML estático de arquivo único em public/ferramentas/site-plataforma/
// (CSS, JS e logos embutidos), mantido fora do app e embutido por iframe, como
// o viewer do Dashboard. Para atualizar: editar em Processos Internos/verta-site
// e gerar o arquivo único com Processos Internos/verta-site-publicar.py.
// ─────────────────────────────────────────────────────────────────────────────

export default function SitePlataforma() {
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
        <span className="font-bold text-rl-text text-sm">Site da Plataforma</span>
      </div>

      <iframe
        src="/ferramentas/site-plataforma/index.html"
        title="Site da Plataforma Verta"
        style={{ flex: 1, width: '100%', border: 0, minHeight: '100vh' }}
      />
    </div>
  )
}
