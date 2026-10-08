// Atalho da home pra central /otimizacoes: quantas sugestões do playbook
// estão pendentes, em quantos clientes, e os 3 clientes mais urgentes.
import { Sparkles, ChevronRight, Loader2 } from 'lucide-react'
import { useSugestoesGlobais } from '../../hooks/useSugestoesGlobais'

export default function OtimizacoesBanner({ dash, onAbrir }) {
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
            ? 'Calculando as otimizações do dia…'
            : <>{n} otimiz{n > 1 ? 'ações' : 'ação'} do playbook aguardando decisão em {sg.grupos.length} cliente{sg.grupos.length > 1 ? 's' : ''}{urgentes > 0 && <span className="text-rl-red"> · {urgentes} urgente{urgentes > 1 ? 's' : ''}</span>}</>}
        </p>
        {top.length > 0 && (
          <p className="text-xs text-rl-muted truncate mt-0.5">
            {top.map((g) => `${g.nome} (${g.sugestoes.length})`).join(' · ')}{sg.grupos.length > 3 ? ` · +${sg.grupos.length - 3}` : ''}
          </p>
        )}
      </div>
      <span className="text-xs font-semibold text-rl-purple flex items-center gap-1 shrink-0">Abrir <ChevronRight className="w-4 h-4" /></span>
    </button>
  )
}
