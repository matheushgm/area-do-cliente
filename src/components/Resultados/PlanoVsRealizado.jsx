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
import { useI18n, localeAtual } from '../../i18n'

const fmtInt = n => Number(n || 0).toLocaleString(localeAtual())

// Classificação de status → cor. `ratio` é sempre "quanto do ideal foi atingido"
// (1 = na meta), já normalizado pelo tipo da métrica.
function statusOf(ratio) {
  if (ratio >= 1)   return { text: 'text-rl-green', dot: 'bg-rl-green' }
  if (ratio >= 0.8) return { text: 'text-rl-gold',  dot: 'bg-rl-gold' }
  return { text: 'text-rl-red', dot: 'bg-rl-red' }
}

function GoalRow({ label, real, meta, kind = 'count', better = 'high' }) {
  const { t } = useI18n()
  const fmt = kind === 'money' ? fmtMoneyShort : fmtInt
  const hasMeta = meta != null && meta > 0
  const hasReal = real > 0

  if (!hasMeta) {
    return (
      <div className="flex items-center gap-2.5 py-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-rl-border shrink-0" />
        <span className="text-xs text-rl-muted flex-1 truncate">{label}</span>
        <span className="text-xs text-rl-muted">{t('resultados.plano.semMeta')}</span>
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
      <span className="text-xs text-rl-muted flex-1 truncate">{label}</span>
      <span className="text-xs font-semibold text-rl-text text-right tabular-nums">
        {hasReal ? fmt(real) : '—'}
      </span>
      <span className="text-xs text-rl-muted w-16 text-right shrink-0 tabular-nums">
        /{fmt(meta)}
      </span>
      <span className={`text-xs font-bold w-9 text-right shrink-0 tabular-nums ${hasReal ? st.text : 'text-rl-muted'}`}>
        {badge}
      </span>
    </div>
  )
}

export default function PlanoVsRealizado({ plan, real, showMqlSql = true }) {
  const { t } = useI18n()
  if (!plan) {
    return (
      <div className="glass-card p-5 h-full">
        <h4 className="text-sm font-bold text-rl-text mb-2">{t('resultados.plano.titulo')}</h4>
        <p className="text-xs text-rl-muted">
          {t('resultados.plano.preencha1')}<b className="text-rl-text">{t('resultados.plano.calculadora')}</b>{t('resultados.plano.preencha2')}
        </p>
      </div>
    )
  }

  const per = qty => (real.investido > 0 && qty > 0 ? real.investido / qty : 0)

  const volume = [
    { label: t('resultados.campos.leads'),   real: real.leads,  meta: plan.leads },
    showMqlSql && { label: t('resultados.campos.mql'), real: real.mql, meta: plan.mql },
    showMqlSql && { label: t('resultados.campos.sql'), real: real.sql, meta: plan.sql },
    { label: t('resultados.campos.vendas'),  real: real.vendas, meta: plan.vendas },
    { label: t('resultados.campos.receita'), real: real.receita, meta: plan.faturamento, kind: 'money' },
  ].filter(Boolean)

  const custo = [
    { label: t('resultados.campos.custoLead'), real: per(real.leads),  meta: plan.cpl },
    showMqlSql && { label: t('resultados.campos.custoMql'), real: per(real.mql), meta: plan.cpMql },
    showMqlSql && { label: t('resultados.campos.custoSql'), real: per(real.sql), meta: plan.cpSql },
    { label: t('resultados.campos.cac'),          real: per(real.vendas), meta: plan.cac },
  ].filter(Boolean).map(r => ({ ...r, kind: 'money', better: 'low' }))

  // Leitura de uma linha só: quantas metas de volume foram batidas.
  const batidas = volume.filter(v => v.meta > 0 && v.real >= v.meta).length
  const comMeta = volume.filter(v => v.meta > 0).length

  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="text-sm font-bold text-rl-text">{t('resultados.plano.titulo')}</h4>
          <p className="text-xs text-rl-muted mt-0.5">{t('resultados.plano.sub')}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
          batidas === comMeta && comMeta > 0 ? 'bg-rl-green/10 text-rl-green'
          : batidas > 0 ? 'bg-rl-gold/10 text-rl-gold'
          : 'bg-rl-red/10 text-rl-red'
        }`}>
          {t('resultados.plano.metas', { batidas, total: comMeta })}
        </span>
      </div>

      <div className="text-xs text-rl-muted uppercase tracking-wider mb-0.5 font-semibold">{t('resultados.plano.volume')}</div>
      <div className="divide-y divide-rl-border/30">
        {volume.map(v => <GoalRow key={v.label} {...v} />)}
      </div>

      <div className="text-xs text-rl-muted uppercase tracking-wider mb-0.5 mt-3 font-semibold">
        {t('resultados.plano.custo')}
      </div>
      <div className="divide-y divide-rl-border/30">
        {custo.map(v => <GoalRow key={v.label} {...v} />)}
      </div>

      <div className="flex items-center gap-2 pt-3 mt-auto border-t border-rl-border/60 text-xs text-rl-muted">
        <Target size={13} className="text-rl-purple shrink-0" />
        <span>
          {t('resultados.plano.verbaPlanejada')} <b className="text-rl-text">{fmtMoneyShort(plan.mediaOrcamento)}</b> ·
          {t('resultados.plano.investido')} <b className="text-rl-text">{fmtMoneyShort(real.investido)}</b>
        </span>
      </div>
    </div>
  )
}
