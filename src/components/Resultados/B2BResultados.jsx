import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Edit2, Check, X, TrendingUp, ArrowDown } from 'lucide-react'
import { fmtMoney, fmtPct, parseMoney, getDaysInMonth, getWeekRanges, MONTH_NAMES } from './resultadosHelpers'

// ─── Funnel Visualization (B2B) ────────────────────────────────────────────────
const FUNNEL_STAGES = [
  { key: 'leads',  label: 'Leads',  icon: '👥', bg: 'bg-rl-blue/10',   border: 'border-rl-blue/30',   text: 'text-rl-blue',   sub: 'text-rl-blue' },
  { key: 'mql',    label: 'MQL',    icon: '🎯', bg: 'bg-rl-cyan/10',   border: 'border-rl-cyan/30',   text: 'text-rl-cyan',   sub: 'text-rl-cyan' },
  { key: 'sql',    label: 'SQL',    icon: '💎', bg: 'bg-rl-purple/10', border: 'border-rl-purple/30', text: 'text-rl-purple', sub: 'text-rl-purple' },
  { key: 'vendas', label: 'Vendas', icon: '🏆', bg: 'bg-rl-gold/10',   border: 'border-rl-gold/30',   text: 'text-rl-gold',   sub: 'text-rl-gold' },
]

function FunnelViz({ data, investido }) {
  const inv = Number(investido) || 0
  const values = FUNNEL_STAGES.map(s => Number(data[s.key]) || 0)
  const maxVal = Math.max(...values, 1)

  return (
    <div className="flex flex-col items-center gap-0 py-6">
      {FUNNEL_STAGES.map((stage, i) => {
        const val = values[i]
        const prev = i > 0 ? values[i - 1] : null
        const convRate = prev !== null ? fmtPct(val, prev) : null
        const cost = val > 0 && inv > 0 ? inv / val : 0
        const widthPct = Math.max(Math.round((val / maxVal) * 100), 18)

        return (
          <div key={stage.key} className="w-full flex flex-col items-center">
            {/* Conversion arrow */}
            {convRate && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-px h-2 bg-rl-border" />
                  <ArrowDown size={10} className="text-rl-muted" />
                </div>
                <span className="bg-rl-surface border border-rl-border px-2.5 py-0.5 rounded-full text-[11px] text-rl-muted">
                  {convRate} avançaram
                </span>
              </div>
            )}

            {/* Stage bar */}
            <div
              className={`${stage.bg} ${stage.border} border rounded-xl px-5 py-3.5 flex items-center justify-between transition-all`}
              style={{ width: `${widthPct}%`, minWidth: '260px', maxWidth: '100%' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{stage.icon}</span>
                <span className={`font-semibold text-sm ${stage.text}`}>{stage.label}</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-rl-text text-lg leading-none">
                  {val > 0 ? val.toLocaleString('pt-BR') : <span className="text-rl-muted text-base">—</span>}
                </div>
                {val > 0 && inv > 0 && (
                  <div className={`text-[11px] mt-0.5 ${stage.sub}`}>
                    {fmtMoney(cost)} / {stage.label.toLowerCase()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── B2B Week Form ─────────────────────────────────────────────────────────────
function B2BWeekForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    investido: initial.investido != null ? String(initial.investido).replace('.', ',') : '',
    leads:  initial.leads  || '',
    mql:    initial.mql    || '',
    sql:    initial.sql    || '',
    vendas: initial.vendas || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-3">
      <div>
        <label className="label-field">Valor Investido</label>
        <input className="input-field" placeholder="R$ 0,00" value={form.investido}
          onChange={e => set('investido', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[['leads','Leads'],['mql','MQL'],['sql','SQL'],['vendas','Vendas']].map(([k, lbl]) => (
          <div key={k}>
            <label className="label-field">{lbl}</label>
            <input className="input-field" type="number" min="0" placeholder="0"
              value={form[k]} onChange={e => set(k, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm"
        >
          <Check size={13} /> Salvar
        </button>
        <button onClick={onCancel} className="btn-secondary flex items-center gap-1 text-sm">
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

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
    <div className="flex items-center justify-between">
      <button onClick={prev} className="btn-secondary p-2"><ChevronLeft size={16} /></button>
      <h3 className="text-base font-semibold text-rl-text">{MONTH_NAMES[month]} {year}</h3>
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
      <div className="text-[11px] text-rl-muted mb-1">{label}</div>
      <div className={`font-bold text-sm ${textClass}`}>{value || '—'}</div>
      {sub && <div className="text-[10px] text-rl-muted mt-1">{sub}</div>}
    </div>
  )
}

// ─── B2B View ──────────────────────────────────────────────────────────────────
export default function B2BView({ resultados, onUpdate }) {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [editing, setEditing] = useState(null)

  const monthKey  = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthData = resultados.b2b?.[monthKey] || {}
  const weekRanges = getWeekRanges(year, month)

  const saveWeek = (weekKey, data) => {
    onUpdate({
      ...resultados,
      b2b: {
        ...(resultados.b2b || {}),
        [monthKey]: {
          ...(resultados.b2b?.[monthKey] || {}),
          [weekKey]: {
            investido: parseMoney(data.investido),
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
      investido: acc.investido + (wk.investido || 0),
      leads:  acc.leads  + (wk.leads  || 0),
      mql:    acc.mql    + (wk.mql    || 0),
      sql:    acc.sql    + (wk.sql    || 0),
      vendas: acc.vendas + (wk.vendas || 0),
    }
  }, { investido: 0, leads: 0, mql: 0, sql: 0, vendas: 0 })

  const hasTotals = totals.leads > 0 || totals.investido > 0

  return (
    <div className="space-y-6">
      <MonthNav year={year} month={month} setYear={setYear} setMonth={setMonth} />

      {/* Weekly Cards */}
      <div className="grid grid-cols-2 gap-4">
        {weekRanges.map((week, i) => {
          const weekKey = `semana${i + 1}`
          const wkData  = monthData[weekKey]
          const isEditing = editing === weekKey

          return (
            <div key={weekKey}>
              {isEditing ? (
                <div className="glass-card p-4">
                  <div className="text-xs font-semibold text-rl-muted mb-3 uppercase tracking-wide">
                    {week.label} · {week.start}/{month + 1}–{week.end}/{month + 1}
                  </div>
                  <B2BWeekForm
                    initial={wkData}
                    onSave={data => saveWeek(weekKey, data)}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              ) : (
                <div className="glass-card p-4 h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-rl-text text-sm">{week.label}</div>
                      <div className="text-[11px] text-rl-muted">
                        {week.start}/{month + 1} – {week.end}/{month + 1}
                      </div>
                    </div>
                    <button
                      onClick={() => setEditing(weekKey)}
                      className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
                      title={wkData ? 'Editar' : 'Adicionar'}
                    >
                      {wkData ? <Edit2 size={13} /> : <Plus size={13} />}
                    </button>
                  </div>

                  {wkData ? (
                    <div className="space-y-2">
                      <div className="text-sm font-bold text-rl-gold">
                        {fmtMoney(wkData.investido)}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <span className="text-rl-muted">Leads <span className="text-rl-blue font-semibold">{wkData.leads}</span></span>
                        <span className="text-rl-muted">MQL <span className="text-rl-cyan font-semibold">{wkData.mql}</span></span>
                        <span className="text-rl-muted">SQL <span className="text-rl-purple font-semibold">{wkData.sql}</span></span>
                        <span className="text-rl-muted">Vendas <span className="text-rl-gold font-semibold">{wkData.vendas}</span></span>
                      </div>
                      {/* Mini conversion rates */}
                      {wkData.leads > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1">
                          {wkData.mql > 0 && (
                            <span className="text-[10px] bg-rl-cyan/10 text-rl-cyan border border-rl-cyan/20 px-1.5 py-0.5 rounded-full">
                              {fmtPct(wkData.mql, wkData.leads)} → MQL
                            </span>
                          )}
                          {wkData.sql > 0 && (
                            <span className="text-[10px] bg-rl-purple/10 text-rl-purple border border-rl-purple/20 px-1.5 py-0.5 rounded-full">
                              {fmtPct(wkData.sql, wkData.mql || wkData.leads)} → SQL
                            </span>
                          )}
                          {wkData.vendas > 0 && (
                            <span className="text-[10px] bg-rl-gold/10 text-rl-gold border border-rl-gold/20 px-1.5 py-0.5 rounded-full">
                              {fmtPct(wkData.vendas, wkData.sql || wkData.mql || wkData.leads)} → Venda
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-rl-muted text-center py-6 border border-dashed border-rl-border rounded-lg">
                      Sem dados ainda
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Monthly Consolidation */}
      {hasTotals && (
        <div className="space-y-5 pt-2">
          <div className="flex items-center gap-2 border-b border-rl-border pb-3">
            <TrendingUp size={16} className="text-rl-purple" />
            <h3 className="text-sm font-bold text-rl-text uppercase tracking-wide">Consolidado do Mês</h3>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Investido',   value: fmtMoney(totals.investido),                            color: 'rl-gold' },
              { label: 'Leads',       value: totals.leads.toLocaleString('pt-BR'),                   color: 'rl-blue',
                sub: totals.leads > 0 && totals.investido > 0 ? fmtMoney(totals.investido / totals.leads) + '/lead' : null },
              { label: 'MQL',         value: totals.mql.toLocaleString('pt-BR'),                     color: 'rl-cyan',
                sub: totals.mql > 0 && totals.investido > 0   ? fmtMoney(totals.investido / totals.mql)   + '/mql'  : null },
              { label: 'SQL',         value: totals.sql.toLocaleString('pt-BR'),                     color: 'rl-purple',
                sub: totals.sql > 0 && totals.investido > 0   ? fmtMoney(totals.investido / totals.sql)   + '/sql'  : null },
              { label: 'Vendas',      value: totals.vendas.toLocaleString('pt-BR'),                  color: 'rl-gold',
                sub: totals.vendas > 0 && totals.investido > 0 ? fmtMoney(totals.investido / totals.vendas) + '/venda' : null },
            ].map(item => (
              <SummaryCard key={item.label} {...item} />
            ))}
          </div>

          {/* Funnel */}
          <FunnelViz data={totals} investido={totals.investido} />
        </div>
      )}
    </div>
  )
}
