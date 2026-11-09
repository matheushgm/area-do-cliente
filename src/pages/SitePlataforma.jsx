import { useOutletContext } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useI18n } from '../i18n'

// ─────────────────────────────────────────────────────────────────────────────
// Site da Plataforma Verta — ferramenta interna (menu Ferramentas). A página é
// um HTML estático de arquivo único em public/ferramentas/site-plataforma/
// (CSS, JS e logos embutidos), mantido fora do app e embutido por iframe, como
// o viewer do Dashboard. Para atualizar: editar em Processos Internos/verta-site
// e gerar o arquivo único com Processos Internos/verta-site-publicar.py.
// O HTML tem um mini-i18n próprio (pt/en, lê localStorage.rl_lang e acompanha a
// troca pelo evento storage): ao regerar o arquivo, preserve os data-i18n e o
// script "Idiomas" antes dos scripts do GSAP.
// ─────────────────────────────────────────────────────────────────────────────

export default function SitePlataforma() {
  const { openSidebar } = useOutletContext()
  const { t } = useI18n()

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Top bar mobile */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
        <button
          onClick={openSidebar}
          aria-label={t('sitePlataforma.abrirMenu')}
          className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold text-rl-text text-sm">{t('sitePlataforma.titulo')}</span>
      </div>

      <iframe
        src="/ferramentas/site-plataforma/index.html"
        title={t('sitePlataforma.tituloIframe')}
        style={{ flex: 1, width: '100%', border: 0, minHeight: '100vh' }}
      />
    </div>
  )
}
