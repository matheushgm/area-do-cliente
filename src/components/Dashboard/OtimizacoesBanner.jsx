// Atalho da home pra central /otimizacoes: quantas sugestões do playbook
// estão pendentes, em quantos clientes, e os 3 clientes mais urgentes.
import { Sparkles, ChevronRight, Loader2 } from 'lucide-react'
import { useSugestoesGlobais } from '../../hooks/useSugestoesGlobais'
import { useI18n } from '../../i18n'

export default function OtimizacoesBanner({ dash, onAbrir }) {
  const { t } = useI18n()
  const sg = useSugestoesGlobais(dash)
  const n = sg.pendentes.length
  const urgentes = sg.pendentes.filter((s) => s.prioridade === 'urgente').length
  if (!sg.loading && n === 0) return null
  const top = sg.grupos.slice(0, 3)
  return (
    <button
      onClick={onAbrir}
      className="w-full text-left glass-card border border-rl-purple/30 bg-rl-purple/5 hover:bg-rl-purple/10 transition-colors px-4 py-3 flex items-center gap-3"
    >
      <span className="w-9 h-9 rounded-full bg-rl-purple/15 flex items-center justify-center shrink-0">
        {sg.loading && n === 0 ? <Loader2 className="w-4 h-4 text-rl-purple animate-spin" /> : <Sparkles className="w-4 h-4 text-rl-purple" />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-rl-text">
          {sg.loading && n === 0
            ? t('home.otimizacoes.calculando')
            : <>{t('home.otimizacoes.resumo', { otimizacoes: t('home.otimizacoes.otimizacoes', { count: n }), clientes: t('home.otimizacoes.clientes', { count: sg.grupos.length }) })}{urgentes > 0 && <span className="text-rl-red"> · {t('home.otimizacoes.urgentes', { count: urgentes })}</span>}</>}
        </p>
        {top.length > 0 && (
          <p className="text-xs text-rl-muted truncate mt-0.5">
            {top.map((g) => `${g.nome} (${g.sugestoes.length})`).join(' · ')}{sg.grupos.length > 3 ? ` · +${sg.grupos.length - 3}` : ''}
          </p>
        )}
      </div>
      <span className="text-xs font-semibold text-rl-purple flex items-center gap-1 shrink-0">{t('comum.abrir')} <ChevronRight className="w-4 h-4" /></span>
    </button>
  )
}
