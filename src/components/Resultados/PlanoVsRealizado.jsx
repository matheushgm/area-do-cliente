// Painel "Plano vs Realizado" — confronta os números do mês com a meta que saiu
// da Calculadora de ROI do projeto.
//
// Layout de scorecard: uma linha por métrica (dot de status + label + valor +
// meta + desvio), sem barras — a cor do dot e do desvio já carregam o
// veredito, então dá pra ler as 9 métricas em segundos.
//
// Duas famílias de métrica, com lógicas de "bom" opostas:
//   volume (leads, MQL, SQL, vendas, receita) → quanto MAIOR, melhor
//   custo  (CPL, custo/MQL, custo/SQL, CAC)   → quanto MENOR, melhor

import { Target } from 'lucide-react'
import { fmtMoneyShort } from './resultadosHelpers'

const fmtInt = n => Number(n || 0).toLocaleString('pt-BR')

// Classificação de status → cor. `ratio` é sempre "quanto do ideal foi atingido"
// (1 = na meta), já normalizado pelo tipo da métrica.
function statusOf(ratio) {
  if (ratio >= 1)   return { text: 'text-rl-green', dot: 'bg-rl-green' }
  if (ratio >= 0.8) return { text: 'text-rl-gold',  dot: 'bg-rl-gold' }
  return { text: 'text-rl-red', dot: 'bg-rl-red' }
}

function GoalRow({ label, real, meta, kind = 'count', better = 'high' }) {
  const fmt = kind === 'money' ? fmtMoneyShort : fmtInt
  const hasMeta = meta != null && meta > 0
  const hasReal = real > 0

  if (!hasMeta) {
    return (
      <div className="flex items-center gap-2.5 py-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-rl-border shrink-0" />
        <span className="text-[11px] text-rl-muted flex-1 truncate">{label}</span>
        <span className="text-[11px] text-rl-muted">sem meta</span>
      </div>
    )
  }

  // ratio = fração da meta atingida (volume) ou eficiência de custo (custo).
  const ratio = better === 'high'
    ? real / meta
    : (hasReal ? meta / real : 0)

  const st = statusOf(ratio)

  // Desvio: % da meta no volume, ± em relação à meta no custo.
  const badge = better === 'high'
    ? `${Math.round((real / meta) * 100)}%`
    : hasReal
      ? `${real <= meta ? '−' : '+'}${Math.abs(Math.round((real / meta - 1) * 100))}%`
      : '—'

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasReal ? st.dot : 'bg-rl-border'}`} />
      <span className="text-[11px] text-rl-muted flex-1 truncate">{label}</span>
      <span className="text-xs font-semibold text-rl-text text-right tabular-nums">
        {hasReal ? fmt(real) : '—'}
      </span>
      <span className="text-[10px] text-rl-muted w-16 text-right shrink-0 tabular-nums">
        /{fmt(meta)}
      </span>
      <span className={`text-[11px] font-bold w-9 text-right shrink-0 tabular-nums ${hasReal ? st.text : 'text-rl-muted'}`}>
        {badge}
      </span>
    </div>
  )
}

export default function PlanoVsRealizado({ plan, real, showMqlSql = true }) {
  if (!plan) {
    return (
      <div className="glass-card p-5 h-full">
        <h4 className="text-sm font-bold text-rl-text mb-2">Plano vs Realizado</h4>
        <p className="text-xs text-rl-muted">
          Preencha a <b className="text-rl-text">Calculadora de ROI</b> deste cliente para comparar
          o resultado do mês com a meta planejada.
        </p>
      </div>
    )
  }

  const per = qty => (real.investido > 0 && qty > 0 ? real.investido / qty : 0)

  const volume = [
    { label: 'Leads',   real: real.leads,  meta: plan.leads },
    showMqlSql && { label: 'MQL', real: real.mql, meta: plan.mql },
    showMqlSql && { label: 'SQL', real: real.sql, meta: plan.sql },
    { label: 'Vendas',  real: real.vendas, meta: plan.vendas },
    { label: 'Receita', real: real.receita, meta: plan.faturamento, kind: 'money' },
  ].filter(Boolean)

  const custo = [
    { label: 'Custo / Lead', real: per(real.leads),  meta: plan.cpl },
    showMqlSql && { label: 'Custo / MQL', real: per(real.mql), meta: plan.cpMql },
    showMqlSql && { label: 'Custo / SQL', real: per(real.sql), meta: plan.cpSql },
    { label: 'CAC',          real: per(real.vendas), meta: plan.cac },
  ].filter(Boolean).map(r => ({ ...r, kind: 'money', better: 'low' }))

  // Leitura de uma linha só: quantas metas de volume foram batidas.
  const batidas = volume.filter(v => v.meta > 0 && v.real >= v.meta).length
  const comMeta = volume.filter(v => v.meta > 0).length

  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="text-sm font-bold text-rl-text">Plano vs Realizado</h4>
          <p className="text-[11px] text-rl-muted mt-0.5">meta da Calculadora de ROI</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
          batidas === comMeta && comMeta > 0 ? 'bg-rl-green/10 text-rl-green'
          : batidas > 0 ? 'bg-rl-gold/10 text-rl-gold'
          : 'bg-rl-red/10 text-rl-red'
        }`}>
          {batidas}/{comMeta} metas
        </span>
      </div>

      <div className="text-[10px] text-rl-muted uppercase tracking-wider mb-0.5 font-semibold">Volume</div>
      <div className="divide-y divide-rl-border/30">
        {volume.map(v => <GoalRow key={v.label} {...v} />)}
      </div>

      <div className="text-[10px] text-rl-muted uppercase tracking-wider mb-0.5 mt-3 font-semibold">
        Custo · quanto menor, melhor
      </div>
      <div className="divide-y divide-rl-border/30">
        {custo.map(v => <GoalRow key={v.label} {...v} />)}
      </div>

      <div className="flex items-center gap-2 pt-3 mt-auto border-t border-rl-border/60 text-[11px] text-rl-muted">
        <Target size={13} className="text-rl-purple shrink-0" />
        <span>
          Verba planejada <b className="text-rl-text">{fmtMoneyShort(plan.mediaOrcamento)}</b> ·
          investido <b className="text-rl-text">{fmtMoneyShort(real.investido)}</b>
        </span>
      </div>
    </div>
  )
}
