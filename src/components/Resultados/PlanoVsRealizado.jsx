// Painel "Plano vs Realizado" — confronta os números do mês com a meta que saiu
// da Calculadora de ROI do projeto.
//
// Duas famílias de métrica, com lógicas de "bom" opostas:
//   volume (leads, MQL, SQL, vendas, receita) → quanto MAIOR, melhor
//   custo  (CPL, custo/MQL, custo/SQL, CAC)   → quanto MENOR, melhor

import { Target } from 'lucide-react'
import { fmtMoney } from './resultadosHelpers'

const fmtInt = n => Number(n || 0).toLocaleString('pt-BR')

// Classificação de status → cor. `ratio` é sempre "quanto do ideal foi atingido"
// (1 = na meta), já normalizado pelo tipo da métrica.
function statusOf(ratio) {
  if (ratio >= 1)    return { text: 'text-rl-green',  bar: 'bg-rl-green',  bg: 'bg-rl-green/8' }
  if (ratio >= 0.8)  return { text: 'text-rl-gold',   bar: 'bg-rl-gold',   bg: 'bg-rl-gold/8' }
  return { text: 'text-rl-red', bar: 'bg-rl-red', bg: 'bg-rl-red/8' }
}

function GoalRow({ label, real, meta, kind = 'count', better = 'high' }) {
  const fmt = kind === 'money' ? fmtMoney : fmtInt
  const hasMeta = meta != null && meta > 0
  const hasReal = real > 0

  if (!hasMeta) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-[11px] text-rl-muted">{label}</span>
        <span className="text-xs text-rl-muted">sem meta</span>
      </div>
    )
  }

  // ratio = fração da meta atingida (volume) ou eficiência de custo (custo).
  const ratio = better === 'high'
    ? real / meta
    : (hasReal ? meta / real : 0)

  const st = statusOf(ratio)

  // Rótulo do desvio: % da meta no volume, ± em relação à meta no custo.
  const badge = better === 'high'
    ? `${Math.round((real / meta) * 100)}%`
    : hasReal
      ? `${real <= meta ? '−' : '+'}${Math.abs(Math.round((real / meta - 1) * 100))}%`
      : '—'

  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[11px] text-rl-muted truncate">{label}</span>
        <span className={`text-[11px] font-bold shrink-0 ${hasReal ? st.text : 'text-rl-muted'}`}>{badge}</span>
      </div>
      <div className="h-1.5 rounded-full bg-rl-border/50 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${st.bar}`}
             style={{ width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }} />
      </div>
      <div className="flex items-baseline justify-between gap-2 mt-1">
        <span className="text-xs font-semibold text-rl-text">{hasReal ? fmt(real) : '—'}</span>
        <span className="text-[10px] text-rl-muted">meta {fmt(meta)}</span>
      </div>
    </div>
  )
}

export default function PlanoVsRealizado({ plan, real, showMqlSql = true }) {
  if (!plan) {
    return (
      <div className="glass-card p-5">
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
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-rl-text">Plano vs Realizado</h4>
          <p className="text-[11px] text-rl-muted mt-0.5">meta da Calculadora de ROI</p>
        </div>
        <span className={`text-[11px] font-bold px-2 py-1 rounded-lg shrink-0 ${
          batidas === comMeta && comMeta > 0 ? 'bg-rl-green/10 text-rl-green'
          : batidas > 0 ? 'bg-rl-gold/10 text-rl-gold'
          : 'bg-rl-red/10 text-rl-red'
        }`}>
          {batidas}/{comMeta} metas
        </span>
      </div>

      <div>
        <div className="text-[10px] text-rl-muted uppercase tracking-wider mb-1 font-semibold">Volume</div>
        <div className="divide-y divide-rl-border/40">
          {volume.map(v => <GoalRow key={v.label} {...v} />)}
        </div>
      </div>

      <div className="pt-1 border-t border-rl-border/60">
        <div className="text-[10px] text-rl-muted uppercase tracking-wider mb-1 mt-2 font-semibold">
          Custo · quanto menor, melhor
        </div>
        <div className="divide-y divide-rl-border/40">
          {custo.map(v => <GoalRow key={v.label} {...v} />)}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-rl-border/60 text-[11px] text-rl-muted">
        <Target size={13} className="text-rl-purple shrink-0" />
        <span>
          Verba planejada <b className="text-rl-text">{fmtMoney(plan.mediaOrcamento)}</b> ·
          investido <b className="text-rl-text">{fmtMoney(real.investido)}</b>
        </span>
      </div>
    </div>
  )
}
