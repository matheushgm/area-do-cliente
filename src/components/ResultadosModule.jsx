import { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  ChevronLeft, ChevronRight, Plus, Edit2, Check, X,
  TrendingUp, ArrowDown,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  const num = Number(n)
  if (!isFinite(num)) return '—'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(a, b) {
  if (!b || b === 0) return '—'
  return ((a / b) * 100).toFixed(1) + '%'
}

function parseMoney(str) {
  if (!str && str !== 0) return 0
  return parseFloat(String(str).replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getWeekRanges(year, month) {
  const days = getDaysInMonth(year, month)
  return [
    { label: 'Semana 1', start: 1,  end: Math.min(7,  days) },
    { label: 'Semana 2', start: 8,  end: Math.min(14, days) },
    { label: 'Semana 3', start: 15, end: Math.min(21, days) },
    { label: 'Semana 4', start: 22, end: days },
  ]
}

// ─── Model Selector ────────────────────────────────────────────────────────────
function ModelSelector({ onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-rl-text mb-2">Módulo de Resultados</h2>
        <p className="text-rl-muted text-sm max-w-md mx-auto">
          Selecione o modelo de negócio deste cliente para configurar o acompanhamento correto
        </p>
      </div>
      <div className="grid grid-cols-2 gap-6 w-full max-w-xl">
        {/* B2B */}
        <button
          onClick={() => onSelect('b2b')}
          className="glass-card p-8 text-left hover:border-rl-blue/50 transition-all cursor-pointer group"
        >
          <div className="text-4xl mb-4">🏢</div>
          <div className="text-xl font-bold text-rl-text mb-2">B2B</div>
          <div className="text-sm text-rl-muted leading-relaxed mb-4">
            Ciclo de venda longo com qualificação de leads
          </div>
          <ul className="space-y-1.5 text-xs text-rl-muted">
            <li className="flex items-center gap-1.5"><span className="text-rl-blue">✦</span> Acompanhamento semanal</li>
            <li className="flex items-center gap-1.5"><span className="text-rl-blue">✦</span> Funil: Leads → MQL → SQL → Vendas</li>
            <li className="flex items-center gap-1.5"><span className="text-rl-blue">✦</span> Custo por etapa do funil</li>
          </ul>
        </button>

        {/* B2C */}
        <button
          onClick={() => onSelect('b2c')}
          className="glass-card p-8 text-left hover:border-rl-green/50 transition-all cursor-pointer group"
        >
          <div className="text-4xl mb-4">🛒</div>
          <div className="text-xl font-bold text-rl-text mb-2">B2C</div>
          <div className="text-sm text-rl-muted leading-relaxed mb-4">
            Ciclo de venda curto, decisão rápida de compra
          </div>
          <ul className="space-y-1.5 text-xs text-rl-muted">
            <li className="flex items-center gap-1.5"><span className="text-rl-green">✦</span> Acompanhamento diário</li>
            <li className="flex items-center gap-1.5"><span className="text-rl-green">✦</span> Leads, Vendas, ROAS</li>
            <li className="flex items-center gap-1.5"><span className="text-rl-green">✦</span> Custo por lead automático</li>
          </ul>
        </button>
      </div>
    </div>
  )
}

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
function MonthNav({ year, month, setYear, setMonth }) {
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

// ─── B2B View ──────────────────────────────────────────────────────────────────
function B2BView({ resultados, onUpdate }) {
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

// ─── Summary Card helper ────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color }) {
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

// ─── B2C Day Form ──────────────────────────────────────────────────────────────
function B2CDayForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    investido:   initial.investido   != null ? String(initial.investido).replace('.', ',')   : '',
    leads:       initial.leads       || '',
    valorVendas: initial.valorVendas != null ? String(initial.valorVendas).replace('.', ',') : '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Live preview
  const inv    = parseMoney(form.investido)
  const lds    = Number(form.leads) || 0
  const vend   = parseMoney(form.valorVendas)
  const cpl    = lds > 0 && inv > 0   ? inv / lds       : null
  const roas   = inv > 0              ? vend / inv       : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label-field">Investido</label>
          <input className="input-field" placeholder="R$ 0,00" value={form.investido}
            onChange={e => set('investido', e.target.value)} />
        </div>
        <div>
          <label className="label-field">Leads</label>
          <input className="input-field" type="number" min="0" placeholder="0" value={form.leads}
            onChange={e => set('leads', e.target.value)} />
        </div>
        <div>
          <label className="label-field">Vendas (R$)</label>
          <input className="input-field" placeholder="R$ 0,00" value={form.valorVendas}
            onChange={e => set('valorVendas', e.target.value)} />
        </div>
      </div>
      {/* Live computed */}
      {(cpl !== null || roas !== null) && (
        <div className="flex gap-3 text-xs">
          {cpl !== null && (
            <span className="bg-rl-cyan/10 border border-rl-cyan/20 text-rl-cyan px-2 py-1 rounded-lg">
              CPL: {fmtMoney(cpl)}
            </span>
          )}
          {roas !== null && (
            <span className={`px-2 py-1 rounded-lg border ${
              roas >= 3    ? 'bg-rl-green/10  border-rl-green/20  text-rl-green'  :
              roas >= 1.5  ? 'bg-rl-gold/10   border-rl-gold/20   text-rl-gold'   :
                             'bg-rl-purple/10 border-rl-purple/20 text-rl-purple'
            }`}>
              ROAS: {roas.toFixed(2)}x
            </span>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => onSave(form)}
          className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm">
          <Check size={13} /> Salvar
        </button>
        <button onClick={onCancel} className="btn-secondary flex items-center gap-1 text-sm">
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── B2C View ─────────────────────────────────────────────────────────────────
function B2CView({ resultados, onUpdate }) {
  const today = new Date()
  const [year, setYear]     = useState(today.getFullYear())
  const [month, setMonth]   = useState(today.getMonth())
  const [editing, setEditing] = useState(null)

  const monthKey   = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthData  = resultados.b2c?.[monthKey] || {}
  const daysInMon  = getDaysInMonth(year, month)

  const saveDay = (day, data) => {
    const dayKey = String(day).padStart(2, '0')
    onUpdate({
      ...resultados,
      b2c: {
        ...(resultados.b2c || {}),
        [monthKey]: {
          ...(resultados.b2c?.[monthKey] || {}),
          [dayKey]: {
            investido:   parseMoney(data.investido),
            leads:       Number(data.leads) || 0,
            valorVendas: parseMoney(data.valorVendas),
          },
        },
      },
    })
    setEditing(null)
  }

  // Monthly totals
  const totals = Object.values(monthData).reduce(
    (acc, d) => ({
      investido:   acc.investido   + (d.investido   || 0),
      leads:       acc.leads       + (d.leads       || 0),
      valorVendas: acc.valorVendas + (d.valorVendas || 0),
    }),
    { investido: 0, leads: 0, valorVendas: 0 },
  )

  const cpl  = totals.leads > 0 && totals.investido > 0 ? totals.investido / totals.leads : 0
  const roas = totals.investido > 0 ? totals.valorVendas / totals.investido : 0

  const days = Array.from({ length: daysInMon }, (_, i) => i + 1)

  return (
    <div className="space-y-6">
      <MonthNav year={year} month={month} setYear={setYear} setMonth={setMonth} />

      {/* Monthly Summary */}
      {totals.investido > 0 && (
        <div className="grid grid-cols-5 gap-3">
          <SummaryCard label="Investido"  value={fmtMoney(totals.investido)}               color="rl-gold" />
          <SummaryCard label="Leads"      value={totals.leads.toLocaleString('pt-BR')}      color="rl-blue" />
          <SummaryCard label="Vendas"     value={fmtMoney(totals.valorVendas)}              color="rl-green" />
          <SummaryCard label="CPL"        value={fmtMoney(cpl)}                             color="rl-cyan" />
          <SummaryCard
            label="ROAS"
            value={roas > 0 ? roas.toFixed(2) + 'x' : '—'}
            color={roas >= 3 ? 'rl-green' : roas >= 1.5 ? 'rl-gold' : 'rl-purple'}
          />
        </div>
      )}

      {/* Daily Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rl-border">
                <th className="text-left px-4 py-3 text-rl-muted font-medium text-xs uppercase tracking-wide">Dia</th>
                <th className="text-right px-4 py-3 text-rl-muted font-medium text-xs uppercase tracking-wide">Investido</th>
                <th className="text-right px-4 py-3 text-rl-muted font-medium text-xs uppercase tracking-wide">Leads</th>
                <th className="text-right px-4 py-3 text-rl-muted font-medium text-xs uppercase tracking-wide">Vendas</th>
                <th className="text-right px-4 py-3 text-rl-muted font-medium text-xs uppercase tracking-wide">CPL</th>
                <th className="text-right px-4 py-3 text-rl-muted font-medium text-xs uppercase tracking-wide">ROAS</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {days.map(day => {
                const dayKey  = String(day).padStart(2, '0')
                const d       = monthData[dayKey]
                const isEdit  = editing === day

                const dayCpl  = d?.leads > 0 && d?.investido > 0 ? d.investido / d.leads : 0
                const dayRoas = d?.investido > 0 ? (d.valorVendas || 0) / d.investido : 0

                if (isEdit) {
                  return (
                    <tr key={day} className="border-b border-rl-border bg-rl-surface/40">
                      <td className="px-4 py-3 font-medium text-rl-text text-xs whitespace-nowrap">
                        {day}/{month + 1}
                      </td>
                      <td colSpan={5} className="px-4 py-3">
                        <B2CDayForm
                          initial={d}
                          onSave={data => saveDay(day, data)}
                          onCancel={() => setEditing(null)}
                        />
                      </td>
                      <td />
                    </tr>
                  )
                }

                return (
                  <tr
                    key={day}
                    className={`border-b border-rl-border/30 hover:bg-rl-surface/20 transition-colors ${!d ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-medium text-rl-text text-xs whitespace-nowrap">
                      {day}/{month + 1}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-rl-text">
                      {d ? fmtMoney(d.investido) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-rl-blue font-medium">
                      {d ? d.leads : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-rl-green font-medium">
                      {d ? fmtMoney(d.valorVendas) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-rl-cyan">
                      {d && dayCpl > 0 ? fmtMoney(dayCpl) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {d && dayRoas > 0 ? (
                        <span className={`font-semibold ${
                          dayRoas >= 3    ? 'text-rl-green'  :
                          dayRoas >= 1.5  ? 'text-rl-gold'   :
                                           'text-rl-purple'
                        }`}>
                          {dayRoas.toFixed(2)}x
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setEditing(day)}
                        className="text-rl-muted hover:text-rl-text transition-colors p-1 rounded"
                      >
                        {d ? <Edit2 size={12} /> : <Plus size={12} />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Totals row */}
            {totals.investido > 0 && (
              <tfoot>
                <tr className="border-t-2 border-rl-border bg-rl-surface/60">
                  <td className="px-4 py-3 text-xs font-bold text-rl-text uppercase tracking-wide">Total</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-rl-gold">{fmtMoney(totals.investido)}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-rl-blue">{totals.leads.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-rl-green">{fmtMoney(totals.valorVendas)}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-rl-cyan">{cpl > 0 ? fmtMoney(cpl) : '—'}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    <span className={roas >= 3 ? 'text-rl-green' : roas >= 1.5 ? 'text-rl-gold' : 'text-rl-purple'}>
                      {roas > 0 ? roas.toFixed(2) + 'x' : '—'}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Main Export ───────────────────────────────────────────────────────────────
export default function ResultadosModule({ project }) {
  const { updateProject } = useApp()

  const resultados = project.resultados || {}
  const modelo     = resultados.modelo

  const handleUpdate = (updated) => {
    updateProject(project.id, { resultados: updated })
  }

  const selectModel = (m) => {
    handleUpdate({ ...resultados, modelo: m })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-rl-text">Resultados</h2>
          {modelo && (
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border mt-1.5 ${
              modelo === 'b2b'
                ? 'border-rl-blue/30  text-rl-blue  bg-rl-blue/10'
                : 'border-rl-green/30 text-rl-green bg-rl-green/10'
            }`}>
              {modelo === 'b2b' ? '🏢 B2B · Semanal' : '🛒 B2C · Diário'}
            </span>
          )}
        </div>
        {modelo && (
          <button
            onClick={() => handleUpdate({ ...resultados, modelo: null })}
            className="btn-secondary text-xs"
          >
            Trocar Modelo
          </button>
        )}
      </div>

      {!modelo && <ModelSelector onSelect={selectModel} />}

      {modelo === 'b2b' && (
        <B2BView resultados={resultados} onUpdate={handleUpdate} />
      )}

      {modelo === 'b2c' && (
        <B2CView resultados={resultados} onUpdate={handleUpdate} />
      )}
    </div>
  )
}
