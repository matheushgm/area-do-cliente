import { useOutletContext } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useI18n } from '../i18n'

// ─────────────────────────────────────────────────────────────────────────────
// Precificação (Soluções Verta), ferramenta interna (menu Ferramentas). A página é
// um HTML estático de arquivo único em public/ferramentas/precificacao/
// (CSS, JS e logos embutidos), mantido fora do app e embutido por iframe, como
// o viewer do Dashboard. Origem: pasta do Drive 1FLAO9tlv0rlflk0kLUhUdsMKifkZI9h0
// (index.html + assets/logo). Ao atualizar, embutir os logos em data URI de novo.
// ─────────────────────────────────────────────────────────────────────────────

export default function FerramentaPrecificacao() {
  const { openSidebar } = useOutletContext()
  const { t } = useI18n()

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Top bar mobile */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
        <button
          onClick={openSidebar}
          aria-label={t('ferramentaPrecificacao.abrirMenu')}
          className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold text-rl-text text-sm">{t('ferramentaPrecificacao.titulo')}</span>
      </div>

      <iframe
        src="/ferramentas/precificacao/index.html"
        title={t('ferramentaPrecificacao.iframeTitulo')}
        style={{ flex: 1, width: '100%', border: 0, minHeight: '100vh' }}
      />
    </div>
  )
}
