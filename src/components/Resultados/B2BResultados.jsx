import { useState, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Edit2, Check, X, FileDown, Link2, CheckCircle2,
} from 'lucide-react'
import { fmtMoney, fmtPct, parseMoney, getWeekRanges, computeRoiPlan, MONTH_NAMES } from './resultadosHelpers'
import { CostGrid } from './ResultadosCharts'
import GraficosEvolucao from './GraficosEvolucao'
import FunilDoMes, { FonteTag } from './FunilDoMes'
import ComparativoCanais from './ComparativoCanais'
import PlanoVsRealizado from './PlanoVsRealizado'
import { exportResultadosB2BPDF } from '../../utils/exportPDF'
import { AutofillButton, AutoBadge } from './AutofillResultados'

// ─── Lançamento da semana (linha que abre dentro da tabela) ─────────────────────
function B2BWeekForm({ initial = {}, onSave, onCancel }) {
  const fromApi = initial.fonte === 'api'
  const [form, setForm] = useState({
    investido:     initial.investido     != null ? String(initial.investido).replace('.', ',')     : '',
    receitaVendas: initial.receitaVendas != null ? String(initial.receitaVendas).replace('.', ',') : '',
    leads:  initial.leads  || '',
    mql:    initial.mql    || '',
    sql:    initial.sql    || '',
    vendas: initial.vendas || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Prévia dos custos unitários enquanto o usuário digita.
  const preview = {
    investido: parseMoney(form.investido),
    leads:  Number(form.leads)  || 0,
    mql:    Number(form.mql)    || 0,
    sql:    Number(form.sql)    || 0,
    vendas: Number(form.vendas) || 0,
  }

  const campos = [
    ['investido', 'Investido', 'R$ 0,00', 'api'], ['leads', 'Leads', '0', 'api'],
    ['mql', 'MQL', '0', 'lancado'], ['sql', 'SQL', '0', 'lancado'], ['vendas', 'Vendas', '0', 'lancado'],
    ['receitaVendas', 'Receita de vendas', 'R$ 0,00', 'lancado'],
  ]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {campos.map(([k, lbl, ph, fonte]) => (
          <div key={k}>
            <label className="label-field flex items-center gap-1.5">{lbl} <FonteTag fonte={fonte} /></label>
            <input className="input-field" placeholder={ph} value={form[k]} onChange={e => set(k, e.target.value)}
              {...(ph === '0' ? { type: 'number', min: '0' } : {})} />
          </div>
        ))}
      </div>
      {fromApi && <p className="text-xs text-rl-muted">Investido e leads vêm da API: uma mudança aqui é sobrescrita no próximo preenchimento automático.</p>}
      <div className="flex items-center gap-3 flex-wrap">
        {preview.investido > 0 && <div className="flex-1 min-w-[280px] max-w-xl"><CostGrid {...preview} compact /></div>}
        <div className="flex gap-2 ml-auto">
          <button onClick={onCancel} className="btn-secondary flex items-center gap-1 text-sm"><X size={13} /> Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary flex items-center gap-1.5 text-sm"><Check size={13} /> Salvar semana</button>
        </div>
      </div>
    </div>
  )
}

const fmtInt = n => Number(n || 0).toLocaleString('pt-BR')

// ─── B2B Month Navigator ────────────────────────────────────────────────────────
export function MonthNav({ year, month, setYear, setMonth }) {
  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  return (
    <div className="flex items-center gap-3">
      <button onClick={prev} className="btn-secondary p-2"><ChevronLeft size={16} /></button>
      <h3 className="text-base font-semibold text-rl-text min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</h3>
      <button onClick={next} className="btn-secondary p-2"><ChevronRight size={16} /></button>
    </div>
  )
}

// ─── Summary Card helper ────────────────────────────────────────────────────────
export function SummaryCard({ label, value, sub, color }) {
  const textClass =
    color === 'rl-gold'   ? 'text-rl-gold'   :
    color === 'rl-blue'   ? 'text-rl-blue'   :
    color === 'rl-cyan'   ? 'text-rl-cyan'   :
    color === 'rl-purple' ? 'text-rl-purple' :
    color === 'rl-green'  ? 'text-rl-green'  : 'text-rl-text'

  return (
    <div className="glass-card p-3 text-center">
      <div className="text-xs text-rl-muted mb-1">{label}</div>
      <div className={`font-bold text-sm ${textClass}`}>{value || '—'}</div>
      {sub && <div className="text-xs text-rl-muted mt-1">{sub}</div>}
    </div>
  )
}

// ─── Weekly targets helper ────────────────────────────────────────────────────
// Meta semanal = plano mensal do ROI dividido pelas semanas do mês.
function computeWeeklyTargets(roiCalc, numSemanas) {
  const plan = numSemanas ? computeRoiPlan(roiCalc) : null
  if (!plan) return null
  const perWeek = v => (v ? Math.ceil(v / numSemanas) : null)
  return {
    leads:  perWeek(plan.leads),
    mql:    perWeek(plan.mql),
    sql:    perWeek(plan.sql),
    vendas: perWeek(plan.vendas),
  }
}

// ─── B2B View ──────────────────────────────────────────────────────────────────
export default function B2BView({ resultados, onUpdate, companyName, roiCalc, getOrCreateShareToken, dash, projectId }) {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [editing, setEditing] = useState(null)
  const [copied, setCopied]   = useState(false)

  // ── Copy share link ─────────────────────────────────────────────────────────
  const copyLink = () => {
    if (!getOrCreateShareToken) return
    const token = getOrCreateShareToken()
    if (!token) return
    const url = `${window.location.origin}/b2b/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const weekRanges = getWeekRanges(year, month)
  const weeklyTargets = useMemo(() => computeWeeklyTargets(roiCalc, weekRanges.length), [roiCalc, weekRanges.length])

  const monthKey  = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthData = resultados.b2b?.[monthKey] || {}

  const saveWeek = (weekKey, data) => {
    onUpdate({
      ...resultados,
      b2b: {
        ...(resultados.b2b || {}),
        [monthKey]: {
          ...(resultados.b2b?.[monthKey] || {}),
          [weekKey]: {
            investido:     parseMoney(data.investido),
            receitaVendas: parseMoney(data.receitaVendas),
            leads:  Number(data.leads)  || 0,
            mql:    Number(data.mql)    || 0,
            sql:    Number(data.sql)    || 0,
            vendas: Number(data.vendas) || 0,
          },
        },
      },
    })
    setEditing(null)
  }

  // Monthly totals
  const totals = weekRanges.reduce((acc, _, i) => {
    const wk = monthData[`semana${i + 1}`] || {}
    return {
      investido:     acc.investido     + (wk.investido     || 0),
      receitaVendas: acc.receitaVendas + (wk.receitaVendas || 0),
      leads:  acc.leads  + (wk.leads  || 0),
      mql:    acc.mql    + (wk.mql    || 0),
      sql:    acc.sql    + (wk.sql    || 0),
      vendas: acc.vendas + (wk.vendas || 0),
    }
  }, { investido: 0, receitaVendas: 0, leads: 0, mql: 0, sql: 0, vendas: 0 })

  const hasTotals = totals.leads > 0 || totals.investido > 0

  // ── Métricas derivadas do mês ───────────────────────────────────────────────
  const perUnit = qty => (totals.investido > 0 && qty > 0 ? totals.investido / qty : 0)
  const cpl  = perUnit(totals.leads)
  const cpMql = perUnit(totals.mql)
  const cpSql = perUnit(totals.sql)
  const cac  = perUnit(totals.vendas)
  const roas = totals.investido > 0 ? totals.receitaVendas / totals.investido : 0

  // Meta mensal vinda da Calculadora de ROI do projeto.
  const plan = computeRoiPlan(roiCalc)

  // Última vez que a API preencheu alguma semana do mês
  const atualizadoApi = (() => {
    const ts = Object.values(monthData).map(w => w?.fonte === 'api' && w.atualizadoEm).filter(Boolean).sort().at(-1)
    return ts ? new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null
  })()


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <MonthNav year={year} month={month} setYear={setYear} setMonth={setMonth} />
        <div className="flex items-center gap-2 flex-wrap">
          <AutofillButton
            projectId={projectId}
            year={year}
            month={month}
            onFilled={onUpdate}
          />
          {getOrCreateShareToken && (
            <button
              onClick={copyLink}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border font-medium transition-all ${
                copied
                  ? 'bg-rl-green/10 border-rl-green/30 text-rl-green'
                  : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
              }`}
              title="Copia um link para o cliente preencher os resultados B2B"
            >
              {copied ? <CheckCircle2 size={14} /> : <Link2 size={14} />}
              {copied ? 'Link copiado!' : 'Copiar link do cliente'}
            </button>
          )}
          <button
            onClick={() => exportResultadosB2BPDF({ companyName, resultados, year, month, weekRanges, MONTH_NAMES })}
            className="btn-secondary flex items-center gap-2 text-sm whitespace-nowrap"
            title="Gerar PDF do mês para o cliente"
          >
            <FileDown size={15} />
            Gerar PDF
          </button>
        </div>
      </div>

      {/* ── Funil do mês: API + lançado ──────────────────────────────────────── */}
      <FunilDoMes
        titulo={`Funil de ${MONTH_NAMES[month]}`}
        atualizado={atualizadoApi}
        etapas={[
          { key: 'inv', label: 'Investido', valor: fmtMoney(totals.investido), sub: plan ? `plano ${fmtMoney(plan.mediaOrcamento)}` : null, fonte: 'api' },
          { key: 'leads', label: 'Leads', valor: fmtInt(totals.leads), sub: cpl ? `${fmtMoney(cpl)} por lead` : null, fonte: 'api' },
          { key: 'mql', label: 'MQL', valor: fmtInt(totals.mql), sub: cpMql ? `${fmtMoney(cpMql)} por MQL` : null, fonte: 'lancado', conversao: totals.mql ? `${fmtPct(totals.mql, totals.leads)} dos leads` : null },
          { key: 'sql', label: 'SQL', valor: fmtInt(totals.sql), sub: cpSql ? `${fmtMoney(cpSql)} por SQL` : null, fonte: 'lancado', conversao: totals.sql ? `${fmtPct(totals.sql, totals.mql)} dos MQL` : null },
          { key: 'vendas', label: 'Vendas', valor: fmtInt(totals.vendas), sub: cac ? `CAC ${fmtMoney(cac)}` : null, fonte: 'lancado', conversao: totals.vendas ? `${fmtPct(totals.vendas, totals.sql)} dos SQL` : null },
          { key: 'receita', label: 'Receita', valor: fmtMoney(totals.receitaVendas), sub: roas ? `ROAS ${roas.toFixed(2)}x` : null, fonte: 'lancado', conversao: totals.vendas && totals.receitaVendas ? `ticket ${fmtMoney(totals.receitaVendas / totals.vendas)}` : null },
        ]}
      />

      {/* ── Semanas: uma linha por semana, lançamento na própria linha ──────────── */}
      <div className="rounded-2xl border border-rl-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider">
                <th className="bg-rl-surface/60" />
                <th colSpan={2} className="bg-rl-surface/60 px-3 pt-2.5 text-left"><FonteTag fonte="api" /></th>
                <th colSpan={4} className="bg-rl-surface/60 px-3 pt-2.5 text-left border-l border-rl-border"><FonteTag fonte="lancado" /></th>
                <th colSpan={3} className="bg-rl-surface/60 px-3 pt-2.5 text-left text-rl-muted font-semibold border-l border-rl-border">Calculado</th>
                <th className="bg-rl-surface/60" />
              </tr>
              <tr className="text-xs text-rl-muted border-b border-rl-border">
                {['Semana', 'Investido', 'Leads', 'MQL', 'SQL', 'Vendas', 'Receita', 'CPL', 'CAC', 'ROAS', ''].map((h, i) => (
                  <th key={h + i} className={`bg-rl-surface/60 px-3 pb-2 pt-1 font-medium ${i === 0 ? 'text-left' : 'text-right'} ${i === 3 || i === 7 ? 'border-l border-rl-border' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekRanges.map((week, i) => {
                const weekKey = `semana${i + 1}`
                const wk = monthData[weekKey]
                const semLancamento = wk && !(wk.mql || wk.sql || wk.vendas || wk.receitaVendas)
                const per = (q) => (wk?.investido > 0 && q > 0 ? fmtMoney(wk.investido / q) : '—')
                const vsMeta = (k) => {
                  const alvo = weeklyTargets?.[k]
                  if (!alvo || !wk || wk.parcial || !wk[k]) return ''
                  const r = wk[k] / alvo
                  return r >= 1 ? 'text-rl-green' : r >= 0.8 ? 'text-rl-gold' : 'text-red-500'
                }
                const metaTitulo = (k) => (weeklyTargets?.[k] ? `meta semanal: ${weeklyTargets[k]}` : undefined)
                const cel = 'px-3 py-2.5 text-right tabular-nums'
                return [
                  <tr key={weekKey} className={`border-b border-rl-border/60 ${editing === weekKey ? 'bg-rl-purple/5' : 'hover:bg-rl-surface/40'}`}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-rl-text">{week.label}</span>
                        <AutoBadge entry={wk} />
                      </div>
                      <div className="text-xs text-rl-muted">{week.start}/{month + 1} a {week.end}/{month + 1}</div>
                    </td>
                    {wk ? (
                      <>
                        <td className={cel}>{fmtMoney(wk.investido)}</td>
                        <td className={`${cel} ${vsMeta('leads')}`} title={metaTitulo('leads')}>{fmtInt(wk.leads)}</td>
                        <td className={`${cel} border-l border-rl-border/60 ${vsMeta('mql')}`} title={metaTitulo('mql')}>{wk.mql ? fmtInt(wk.mql) : '—'}</td>
                        <td className={`${cel} ${vsMeta('sql')}`} title={metaTitulo('sql')}>{wk.sql ? fmtInt(wk.sql) : '—'}</td>
                        <td className={`${cel} ${vsMeta('vendas')}`} title={metaTitulo('vendas')}>{wk.vendas ? fmtInt(wk.vendas) : '—'}</td>
                        <td className={cel}>{wk.receitaVendas ? fmtMoney(wk.receitaVendas) : '—'}</td>
                        <td className={`${cel} border-l border-rl-border/60 text-rl-subtle`}>{per(wk.leads)}</td>
                        <td className={`${cel} text-rl-subtle`}>{per(wk.vendas)}</td>
                        <td className={`${cel} text-rl-subtle`}>{wk.investido > 0 && wk.receitaVendas > 0 ? `${(wk.receitaVendas / wk.investido).toFixed(2)}x` : '—'}</td>
                      </>
                    ) : (
                      <td colSpan={9} className="px-3 py-2.5 text-xs text-rl-muted">Sem dados ainda. A API preenche quando a semana fecha.</td>
                    )}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {semLancamento ? (
                        <button onClick={() => setEditing(weekKey)} className="inline-flex items-center gap-1 text-xs font-semibold text-rl-purple bg-rl-purple/10 hover:bg-rl-purple/15 px-2.5 py-1 rounded-lg">
                          <Plus size={12} /> Lançar vendas
                        </button>
                      ) : (
                        <button onClick={() => setEditing(editing === weekKey ? null : weekKey)} title={wk ? 'Editar semana' : 'Lançar semana'}
                          className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-colors">
                          {wk ? <Edit2 size={13} /> : <Plus size={13} />}
                        </button>
                      )}
                    </td>
                  </tr>,
                  editing === weekKey && (
                    <tr key={weekKey + '-form'} className="border-b border-rl-border/60 bg-rl-purple/5">
                      <td colSpan={11} className="px-3 pb-4 pt-1">
                        <B2BWeekForm initial={wk} onSave={data => saveWeek(weekKey, data)} onCancel={() => setEditing(null)} />
                      </td>
                    </tr>
                  ),
                ]
              })}
            </tbody>
            {hasTotals && (
              <tfoot>
                <tr className="bg-rl-surface/60 font-semibold text-rl-text">
                  <td className="px-3 py-2.5">Total do mês</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.investido)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtInt(totals.leads)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums border-l border-rl-border/60">{fmtInt(totals.mql)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtInt(totals.sql)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtInt(totals.vendas)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(totals.receitaVendas)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums border-l border-rl-border/60">{cpl ? fmtMoney(cpl) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{cac ? fmtMoney(cac) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{roas ? `${roas.toFixed(2)}x` : '—'}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {weeklyTargets && (
          <p className="px-3 py-2 text-xs text-rl-muted border-t border-rl-border/60">
            Cor dos volumes = semana fechada contra a meta semanal do plano de ROI: <span className="text-rl-green">na meta</span>, <span className="text-rl-gold">80% a 99%</span>, <span className="text-red-500">abaixo</span>.
          </p>
        )}
      </div>

      {/* ── Evolução semanal ─────────────────────────────────────────────────────── */}
      <GraficosEvolucao
        titulo="Evolução semanal"
        labels={weekRanges.map((_, i) => `S${i + 1}`)}
        nomes={weekRanges.map(w => `${w.label} · ${w.start}/${month + 1} a ${w.end}/${month + 1}`)}
        periodos={weekRanges.map((_, i) => {
          const w = monthData[`semana${i + 1}`]
          return w ? { investido: w.investido, leads: w.leads, vendas: w.vendas, receita: w.receitaVendas } : null
        })}
      />

      {/* ── Plano de ROI e canais ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <PlanoVsRealizado
          plan={plan}
          real={{
            investido: totals.investido,
            leads:  totals.leads,
            mql:    totals.mql,
            sql:    totals.sql,
            vendas: totals.vendas,
            receita: totals.receitaVendas,
          }}
        />
        <div className="lg:col-span-2">
          <ComparativoCanais
            dash={dash}
            projectId={projectId}
            year={year}
            month={month}
            monthLabel={`${MONTH_NAMES[month]} ${year}`}
          />
        </div>
      </div>
    </div>
  )
}
