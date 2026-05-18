import { useEffect, useState } from 'react'
import { Megaphone, X, ArrowRight } from 'lucide-react'

// Banner flutuante (bottom-right) que alerta sobre anúncios na Central
// que ainda estão com status "Para Subir". Fica visível até que todos os
// pendentes sejam movidos pra "Em Andamento" ou "Finalizado".
//
// Persistência da dispensa: sessionStorage por projeto. Se um anúncio novo
// for adicionado depois (count sobe), o banner reaparece automaticamente
// mesmo que tinha sido dispensado antes.
export default function PendingAdsBanner({ project, onNavigate }) {
  const pendingAds = (project?.debriefing?.ads || []).filter(
    (a) => (a.status || 'para_subir') === 'para_subir'
  )
  const count = pendingAds.length
  const storageKey = `pending_ads_dismissed_${project?.id}`

  const [dismissedCount, setDismissedCount] = useState(() => {
    try {
      const v = sessionStorage.getItem(storageKey)
      return v == null ? -1 : Number(v)
    } catch { return -1 }
  })

  // Quando o count cai a zero, reseta o "dismissed" pra reaparecer
  // se aparecerem novos pendentes no futuro
  useEffect(() => {
    if (count === 0 && dismissedCount !== -1) {
      try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
      setDismissedCount(-1)
    }
  }, [count, dismissedCount, storageKey])

  function handleDismiss(e) {
    e?.stopPropagation()
    try { sessionStorage.setItem(storageKey, String(count)) } catch { /* ignore */ }
    setDismissedCount(count)
  }

  function handleClick() {
    if (typeof onNavigate === 'function') onNavigate('debriefing')
  }

  // Não mostra se:
  //  - não tem ad pendente
  //  - já foi dispensado com o count atual (sem novos ads desde a dispensa)
  if (count === 0) return null
  if (count <= dismissedCount) return null

  return (
    <div
      role="alert"
      className="fixed bottom-6 right-6 z-40 max-w-sm animate-slide-up"
    >
      <button
        type="button"
        onClick={handleClick}
        className="group w-full text-left rounded-2xl bg-white border-2 border-rl-purple/40 shadow-glow hover:shadow-xl hover:border-rl-purple/60 transition-all overflow-hidden"
      >
        <div className="flex items-start gap-3 p-4">
          {/* Ícone com badge */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl bg-rl-purple/10 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-rl-purple" />
            </div>
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-rl-red text-white text-[10px] font-black flex items-center justify-center shadow-sm">
              {count}
            </span>
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rl-purple mb-0.5">
              Central de anúncios
            </p>
            <p className="text-sm font-bold text-rl-text leading-tight">
              {count} {count === 1 ? 'anúncio pronto' : 'anúncios prontos'} pra subir
            </p>
            <p className="text-[11px] text-rl-subtle mt-1 leading-snug">
              Mova o status pra <strong className="text-rl-text">Em Andamento</strong> assim que
              o anúncio for ao ar.
            </p>
            <div className="flex items-center gap-1 mt-2 text-[11px] font-bold text-rl-purple group-hover:gap-2 transition-all">
              Abrir Central <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Dismiss */}
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all shrink-0"
            aria-label="Dispensar lembrete"
            title="Dispensar (volta a aparecer quando houver novos)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </button>
    </div>
  )
}
