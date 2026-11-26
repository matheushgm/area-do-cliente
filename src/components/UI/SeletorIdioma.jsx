import { useI18n, IDIOMAS } from '../../i18n'

// PT | EN. Nas páginas públicas grava só no navegador (sem login não há perfil); no app logado o
// menu do avatar usa `mudarIdioma` do AppContext, que também grava no perfil.
export default function SeletorIdioma({ flutuante = false, onEscolher }) {
  const { t, lang, setLang } = useI18n()
  return (
    <div
      role="radiogroup"
      aria-label={t('idioma.titulo')}
      className={`flex rounded-lg border border-rl-border p-0.5 gap-0.5 ${flutuante ? 'bg-rl-surface/90 backdrop-blur shadow-glow' : ''}`}
    >
      {IDIOMAS.map((i) => (
        <button
          key={i.id}
          type="button"
          role="radio"
          aria-checked={lang === i.id}
          title={i.rotulo}
          onClick={() => (onEscolher ? onEscolher(i.id) : setLang(i.id))}
          className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
            lang === i.id ? 'bg-rl-purple/15 text-rl-purple' : 'text-rl-muted hover:text-rl-text'
          }`}
        >
          {i.curto}
        </button>
      ))}
    </div>
  )
}
