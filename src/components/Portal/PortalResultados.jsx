// Resultados (somente leitura) para o portal. Lê o mesmo JSONB `resultados.data`
// do módulo interno: B2B por semana (`b2b[YYYY-MM].semanaN`) e B2C por semana
// (`b2c_semanas[YYYY-MM].N`, com fallback somando os dias de `b2c[YYYY-MM].DD`).
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fmtMoney, getWeekRanges, nomeMes } from '../Resultados/resultadosHelpers'
import { CostGrid } from '../Resultados/ResultadosCharts'
import { AutoBadge } from '../Resultados/AutofillResultados'
import { Section, Empty } from './PortalUI'
import { useI18n } from '../../i18n'

const n = (v) => Number(v) || 0

function monthKeys(data) {
  const keys = new Set()
  for (const k of ['b2b', 'b2c', 'b2c_semanas']) for (const mk of Object.keys(data?.[k] || {})) keys.add(mk)
  return [...keys].sort()
}

function b2cWeeks(data, mk, year, month) {
  const ranges = getWeekRanges(year, month)
  const semanas = data?.b2c_semanas?.[mk] || {}
  const dias    = data?.b2c?.[mk] || {}
  return ranges.map((r, i) => {
    const w = semanas[String(i + 1)]
    if (w) return { ...r, ...w }
    // soma os dias
    const acc = { investido: 0, leads: 0, vendas: 0, valorVendas: 0 }
    let any = false
    for (let d = r.start; d <= r.end; d++) {
      const e = dias[String(d).padStart(2, '0')]
      if (!e) continue
      any = true
      acc.investido += n(e.investido); acc.leads += n(e.leads); acc.vendas += n(e.vendas); acc.valorVendas += n(e.valorVendas)
    }
    return any ? { ...r, ...acc } : { ...r }
  })
}

function Kpi({ label, value, sub }) {
  return (
    <div className="rounded-xl bg-rl-surface p-3">
      <p className="text-[10px] uppercase tracking-wider text-rl-muted">{label}</p>
      <p className="text-lg font-bold text-rl-text tabular-nums mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-rl-muted">{sub}</p>}
    </div>
  )
}

export default function PortalResultados({ data }) {
  const { t } = useI18n()
  const keys = useMemo(() => monthKeys(data), [data])
  const [idx, setIdx] = useState(() => Math.max(0, keys.length - 1))
  const modelo = data?.modelo

  if (!modelo || keys.length === 0) return <Empty text={t('portal.resultados.vazio')} />

  const mk = keys[Math.min(idx, keys.length - 1)]
  const [y, m] = mk.split('-').map(Number)
  const title = `${nomeMes(m - 1)} ${y}`
  const isB2B = modelo === 'b2b'

  const weeks = isB2B
    ? getWeekRanges(y, m - 1).map((r, i) => ({ ...r, ...(data.b2b?.[mk]?.[`semana${i + 1}`] || {}) }))
    : b2cWeeks(data, mk, y, m - 1)

  const tot = weeks.reduce((a, w) => ({
    investido: a.investido + n(w.investido), leads: a.leads + n(w.leads), mql: a.mql + n(w.mql), sql: a.sql + n(w.sql),
    vendas: a.vendas + n(w.vendas), receita: a.receita + n(isB2B ? w.receitaVendas : w.valorVendas),
  }), { investido: 0, leads: 0, mql: 0, sql: 0, vendas: 0, receita: 0 })

  const roas = tot.investido > 0 ? tot.receita / tot.investido : 0
  const cols = isB2B
    ? [['investido', t('portal.resultados.investido'), fmtMoney], ['leads', t('portal.resultados.leads')], ['mql', t('portal.resultados.mql')], ['sql', t('portal.resultados.sql')], ['vendas', t('portal.resultados.vendas')], ['receitaVendas', t('portal.resultados.receita'), fmtMoney]]
    : [['investido', t('portal.resultados.investido'), fmtMoney], ['leads', t('portal.resultados.leads')], ['vendas', t('portal.resultados.vendas')], ['valorVendas', t('portal.resultados.receita'), fmtMoney]]

  const nav = (
    <div className="flex items-center gap-1">
      <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx <= 0} className="p-1.5 rounded-lg text-rl-muted hover:bg-rl-surface disabled:opacity-30" aria-label={t('portal.resultados.mesAnterior')}><ChevronLeft className="w-4 h-4" /></button>
      <span className="text-sm font-semibold text-rl-text min-w-[9rem] text-center">{title}</span>
      <button onClick={() => setIdx((i) => Math.min(keys.length - 1, i + 1))} disabled={idx >= keys.length - 1} className="p-1.5 rounded-lg text-rl-muted hover:bg-rl-surface disabled:opacity-30" aria-label={t('portal.resultados.proximoMes')}><ChevronRight className="w-4 h-4" /></button>
    </div>
  )

  return (
    <div className="space-y-4">
      <Section title={t('portal.resultados.titulo', { modelo: isB2B ? 'B2B' : 'B2C' })} subtitle={t('portal.resultados.subtitulo')} right={nav}>
        <div className={`grid gap-3 ${isB2B ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
          <Kpi label={t('portal.resultados.investido')} value={fmtMoney(tot.investido)} />
          <Kpi label={t('portal.resultados.leads')} value={tot.leads} sub={tot.leads ? `CPL ${fmtMoney(tot.investido / tot.leads)}` : null} />
          <Kpi label={t('portal.resultados.vendas')} value={tot.vendas} sub={tot.vendas ? `CAC ${fmtMoney(tot.investido / tot.vendas)}` : null} />
          <Kpi label={t('portal.resultados.receita')} value={fmtMoney(tot.receita)} sub={roas ? `ROAS ${roas.toFixed(2)}x` : null} />
        </div>
        {isB2B && (
          <div className="mt-4"><CostGrid investido={tot.investido} leads={tot.leads} mql={tot.mql} sql={tot.sql} vendas={tot.vendas} /></div>
        )}
      </Section>

      <Section>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-rl-muted">
                <th className="text-left px-2 py-2 font-semibold">{t('portal.resultados.semana')}</th>
                {cols.map(([k, label]) => <th key={k} className="text-right px-2 py-2 font-semibold">{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-rl-border/60">
              {weeks.map((w, i) => {
                const filled = cols.some(([k]) => w[k] !== undefined && w[k] !== null)
                return (
                  <tr key={i} className={filled ? '' : 'opacity-50'}>
                    <td className="px-2 py-2 text-rl-text">
                      <span className="font-medium">{w.label}</span>
                      <span className="text-[11px] text-rl-muted ml-1.5">{String(w.start).padStart(2, '0')}–{String(w.end).padStart(2, '0')}</span>
                      <span className="ml-1.5"><AutoBadge entry={w} /></span>
                    </td>
                    {cols.map(([k, , fmt]) => (
                      <td key={k} className="px-2 py-2 text-right tabular-nums text-rl-text">
                        {filled ? (fmt ? fmt(n(w[k])) : n(w[k])) : '—'}
                      </td>
                    ))}
                  </tr>
                )
              })}
              <tr className="font-semibold bg-rl-surface/60">
                <td className="px-2 py-2 text-rl-text">{t('portal.resultados.total')}</td>
                {cols.map(([k, , fmt]) => {
                  const v = k === 'receitaVendas' || k === 'valorVendas' ? tot.receita : tot[k] ?? 0
                  return <td key={k} className="px-2 py-2 text-right tabular-nums text-rl-text">{fmt ? fmt(v) : v}</td>
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}
