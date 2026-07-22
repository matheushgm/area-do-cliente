import { useState } from 'react'
import { Plus, Edit2, Check, X, Link2, CheckCircle2, Wallet, Users, Target, Trophy } from 'lucide-react'
import { fmtMoney, parseMoney, getDaysInMonth, getWeekRanges, MONTH_NAMES } from './resultadosHelpers'
import { MonthNav, SummaryCard } from './B2BResultados'
import { KpiHero, DonutGauge, AreaChart, CostBars, CostTile, C } from './ResultadosCharts'

// ─── Form compartilhado (dia e semana) ────────────────────────────────────────
// B2C não tem MQL/SQL — o funil é Lead → Venda. O campo "Vendas (qtd)" é
// opcional e existe para permitir o cálculo do CAC; sem ele, só temos CPL.
function B2CEntryForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    investido:   initial.investido   != null ? String(initial.investido).replace('.', ',')   : '',
    leads:       initial.leads       || '',
    valorVendas: initial.valorVendas != null ? String(initial.valorVendas).replace('.', ',') : '',
    vendas:      initial.vendas      || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const inv  = parseMoney(form.investido)
  const lds  = Number(form.leads)  || 0
  const qtd  = Number(form.vendas) || 0
  const vend = parseMoney(form.valorVendas)
  const cpl  = lds > 0 && inv > 0 ? inv / lds : 0
  const cac  = qtd > 0 && inv > 0 ? inv / qtd : 0
  const roas = inv > 0 ? vend / inv : 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          <label className="label-field">Vendas (qtd)</label>
          <input className="input-field" type="number" min="0" placeholder="0" value={form.vendas}
            onChange={e => set('vendas', e.target.value)} />
        </div>
        <div>
          <label className="label-field">Vendas (R$)</label>
          <input className="input-field" placeholder="R$ 0,00" value={form.valorVendas}
            onChange={e => set('valorVendas', e.target.value)} />
        </div>
      </div>
      {inv > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          <CostTile label="Custo / Lead" value={cpl} color="blue" />
          <CostTile label="CAC" value={cac} color="gold" />
          <div className={`rounded-lg border px-2 py-1.5 text-center ${
            roas >= 3   ? 'bg-rl-green/8  border-rl-green/25  text-rl-green'  :
            roas >= 1.5 ? 'bg-rl-gold/8   border-rl-gold/25   text-rl-gold'   :
                          'bg-rl-purple/8 border-rl-purple/25 text-rl-purple'
          }`}>
            <div className="text-[9px] uppercase tracking-wider text-rl-muted leading-tight">ROAS</div>
            <div className="text-[13px] font-bold leading-tight mt-0.5">
              {roas > 0 ? `${roas.toFixed(2)}x` : '—'}
            </div>
          </div>
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

// Normaliza o payload do form antes de persistir.
const normalize = data => ({
  investido:   parseMoney(data.investido),
  leads:       Number(data.leads)  || 0,
  vendas:      Number(data.vendas) || 0,
  valorVendas: parseMoney(data.valorVendas),
})

// ─── B2C View ─────────────────────────────────────────────────────────────────
export default function B2CView({ resultados, onUpdate, clientShareToken, getOrCreateShareToken }) {
  const today = new Date()
  const [year, setYear]     = useState(today.getFullYear())
  const [month, setMonth]   = useState(today.getMonth())
  const [mode, setMode]     = useState('diario') // 'diario' | 'semanal'
  const [editing, setEditing]     = useState(null)
  const [editingWeek, setEditingWeek] = useState(null)
  const [copied, setCopied] = useState(false)

  const monthKey  = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthData = resultados.b2c?.[monthKey] || {}
  const weekData  = resultados.b2c_semanas?.[monthKey] || {}
  const daysInMon = getDaysInMonth(year, month)
  const weeks     = getWeekRanges(year, month)

  // ── Save day ────────────────────────────────────────────────────────────────
  const saveDay = (day, data) => {
    const dayKey = String(day).padStart(2, '0')
    onUpdate({
      ...resultados,
      b2c: {
        ...(resultados.b2c || {}),
        [monthKey]: { ...(resultados.b2c?.[monthKey] || {}), [dayKey]: normalize(data) },
      },
    })
    setEditing(null)
  }

  // ── Save week ───────────────────────────────────────────────────────────────
  const saveWeek = (weekIdx, data) => {
    onUpdate({
      ...resultados,
      b2c_semanas: {
        ...(resultados.b2c_semanas || {}),
        [monthKey]: { ...(resultados.b2c_semanas?.[monthKey] || {}), [String(weekIdx)]: normalize(data) },
      },
    })
    setEditingWeek(null)
  }

  const sum = rows => rows.reduce(
    (acc, d) => ({
      investido:   acc.investido   + (d.investido   || 0),
      leads:       acc.leads       + (d.leads       || 0),
      vendas:      acc.vendas      + (d.vendas      || 0),
      valorVendas: acc.valorVendas + (d.valorVendas || 0),
    }),
    { investido: 0, leads: 0, vendas: 0, valorVendas: 0 },
  )

  const dailyTotals  = sum(Object.values(monthData))
  const weeklyTotals = sum(Object.values(weekData))
  const totals = mode === 'diario' ? dailyTotals : weeklyTotals

  const perUnit = qty => (totals.investido > 0 && qty > 0 ? totals.investido / qty : 0)
  const cpl  = perUnit(totals.leads)
  const cac  = perUnit(totals.vendas)
  const roas = totals.investido > 0 ? totals.valorVendas / totals.investido : 0
  const convLeadVenda = totals.leads > 0 ? (totals.vendas / totals.leads) * 100 : 0
  const ticket = totals.vendas > 0 ? totals.valorVendas / totals.vendas : 0

  const days = Array.from({ length: daysInMon }, (_, i) => i + 1)
  const hasData = totals.investido > 0 || totals.leads > 0

  // Séries do gráfico: por dia no modo diário, por semana no semanal.
  // Cálculo barato (≤31 pontos), roda a cada render sem memoização.
  const chart = (() => {
    if (mode === 'semanal') {
      const labels = weeks.map((_, i) => `S${i + 1}`)
      const pick = key => weeks.map((_, i) => weekData[String(i + 1)]?.[key] || 0)
      return { labels, investido: pick('investido'), leads: pick('leads'), receita: pick('valorVendas') }
    }
    const labels = days.map(d => (d === 1 || d % 5 === 0 ? String(d) : ''))
    const pick = key => days.map(d => monthData[String(d).padStart(2, '0')]?.[key] || 0)
    return { labels, investido: pick('investido'), leads: pick('leads'), receita: pick('valorVendas') }
  })()

  // ── Copy share link ─────────────────────────────────────────────────────────
  // Usa getOrCreateShareToken quando disponível (gera token se ainda não
  // existir), com fallback para o clientShareToken já existente.
  const copyLink = () => {
    const token = (getOrCreateShareToken && getOrCreateShareToken()) || clientShareToken
    if (!token) return
    const url = `${window.location.origin}/b2c/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">

      {/* Nav + mode toggle + share link */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <MonthNav year={year} month={month} setYear={setYear} setMonth={setMonth} />

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-rl-surface border border-rl-border rounded-xl p-1">
            {[
              { id: 'diario',   label: 'Diário' },
              { id: 'semanal',  label: 'Semanal' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => { setMode(opt.id); setEditing(null); setEditingWeek(null) }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  mode === opt.id
                    ? 'bg-gradient-rl text-white shadow-glow'
                    : 'text-rl-muted hover:text-rl-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {(clientShareToken || getOrCreateShareToken) && (
            <button
              onClick={copyLink}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border font-medium transition-all ${
                copied
                  ? 'bg-rl-green/10 border-rl-green/30 text-rl-green'
                  : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
              }`}
              title="Copia um link para o cliente preencher os resultados B2C"
            >
              {copied ? <CheckCircle2 size={14} /> : <Link2 size={14} />}
              {copied ? 'Link copiado!' : 'Copiar link do cliente'}
            </button>
          )}
        </div>
      </div>

      {/* ── Faixa de KPIs ────────────────────────────────────────────────────── */}
      {hasData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiHero
            label="Investimento"
            value={fmtMoney(totals.investido)}
            sub={`${MONTH_NAMES[month]} ${year}`}
            color="gold"
            icon={<Wallet size={18} />}
          />
          <KpiHero
            label="Custo por Lead"
            value={cpl > 0 ? fmtMoney(cpl) : '—'}
            sub={`${totals.leads.toLocaleString('pt-BR')} leads no período`}
            color="blue"
            icon={<Users size={18} />}
          />
          <KpiHero
            label="CAC"
            value={cac > 0 ? fmtMoney(cac) : '—'}
            sub={totals.vendas > 0
              ? `${totals.vendas.toLocaleString('pt-BR')} vendas · ticket ${fmtMoney(ticket)}`
              : 'Informe a qtd. de vendas'}
            color="purple"
            icon={<Target size={18} />}
          />
          <KpiHero
            label="ROAS"
            value={roas > 0 ? `${roas.toFixed(2)}x` : '—'}
            sub={totals.valorVendas > 0 ? `${fmtMoney(totals.valorVendas)} de receita` : 'Sem receita lançada'}
            color={roas >= 3 ? 'green' : roas >= 1.5 ? 'gold' : 'red'}
            icon={<Trophy size={18} />}
          />
        </div>
      )}

      {/* ── Gráficos ─────────────────────────────────────────────────────────── */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-rl-text">
                Evolução {mode === 'diario' ? 'diária' : 'semanal'}
              </h4>
              <span className="text-[11px] text-rl-muted">pico de cada série</span>
            </div>
            <AreaChart
              labels={chart.labels}
              height={200}
              series={[
                { key: 'inv',   label: 'Investido', values: chart.investido, color: C.gold },
                { key: 'leads', label: 'Leads',     values: chart.leads,     color: C.blue },
                { key: 'rec',   label: 'Receita',   values: chart.receita,   color: C.green, area: false },
              ]}
              formatValue={(key, max) => (key === 'leads' ? max.toLocaleString('pt-BR') : fmtMoney(max))}
            />
          </div>

          <div className="glass-card p-5 flex flex-col justify-between gap-4">
            <div className="flex flex-col items-center">
              <h4 className="text-sm font-bold text-rl-text self-start mb-3">Lead → Venda</h4>
              <DonutGauge
                pct={convLeadVenda}
                label={`${convLeadVenda.toFixed(1)}%`}
                caption={totals.vendas > 0
                  ? `${totals.vendas} vendas em ${totals.leads} leads`
                  : 'Preencha a qtd. de vendas'}
                color={convLeadVenda >= 10 ? 'green' : convLeadVenda >= 4 ? 'gold' : 'purple'}
                size={126}
              />
            </div>
            <div className="pt-4 border-t border-rl-border/60">
              <div className="text-[10px] text-rl-muted uppercase tracking-wider mb-2.5 font-semibold">
                Custo por etapa · período
              </div>
              <CostBars
                items={[
                  { label: 'Custo / Lead', value: cpl,    display: cpl    > 0 ? fmtMoney(cpl)    : '—', color: 'blue' },
                  { label: 'CAC',          value: cac,    display: cac    > 0 ? fmtMoney(cac)    : '—', color: 'gold' },
                  { label: 'Ticket médio', value: ticket, display: ticket > 0 ? fmtMoney(ticket) : '—', color: 'cyan' },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Monthly Summary */}
      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <SummaryCard label="Investido" value={fmtMoney(totals.investido)}            color="rl-gold" />
          <SummaryCard label="Leads"     value={totals.leads.toLocaleString('pt-BR')}  color="rl-blue"   sub={cpl > 0 ? fmtMoney(cpl) + '/lead'  : null} />
          <SummaryCard label="Vendas"    value={totals.vendas.toLocaleString('pt-BR')} color="rl-purple" sub={cac > 0 ? fmtMoney(cac) + '/venda' : null} />
          <SummaryCard label="Receita"   value={fmtMoney(totals.valorVendas)}          color="rl-green" />
          <SummaryCard label="Ticket"    value={ticket > 0 ? fmtMoney(ticket) : '—'}   color="rl-cyan" />
          <SummaryCard
            label="ROAS"
            value={roas > 0 ? roas.toFixed(2) + 'x' : '—'}
            color={roas >= 3 ? 'rl-green' : roas >= 1.5 ? 'rl-gold' : 'rl-purple'}
          />
        </div>
      )}

      {/* ── DIÁRIO ────────────────────────────────────────────────────────── */}
      {mode === 'diario' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-rl-border">
                  {['Dia', 'Investido', 'Leads', 'Vendas', 'Receita', 'CPL', 'CAC', 'ROAS'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-rl-muted font-medium text-xs uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`}>
                      {h}
                    </th>
                  ))}
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {days.map(day => {
                  const dayKey  = String(day).padStart(2, '0')
                  const d       = monthData[dayKey]
                  const isEdit  = editing === day
                  const dayCpl  = d?.leads  > 0 && d?.investido > 0 ? d.investido / d.leads  : 0
                  const dayCac  = d?.vendas > 0 && d?.investido > 0 ? d.investido / d.vendas : 0
                  const dayRoas = d?.investido > 0 ? (d.valorVendas || 0) / d.investido : 0

                  if (isEdit) {
                    return (
                      <tr key={day} className="border-b border-rl-border bg-rl-surface/40">
                        <td className="px-4 py-3 font-medium text-rl-text text-xs whitespace-nowrap align-top">
                          {day}/{month + 1}
                        </td>
                        <td colSpan={7} className="px-4 py-3">
                          <B2CEntryForm
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
                      <td className="px-4 py-2.5 text-right text-xs text-rl-text">{d ? fmtMoney(d.investido) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-rl-blue font-medium">{d ? d.leads : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-rl-purple font-medium">{d?.vendas ? d.vendas : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-rl-green font-medium">{d ? fmtMoney(d.valorVendas) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-rl-cyan">{dayCpl > 0 ? fmtMoney(dayCpl) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-rl-gold">{dayCac > 0 ? fmtMoney(dayCac) : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-xs">
                        {d && dayRoas > 0 ? (
                          <span className={`font-semibold ${
                            dayRoas >= 3   ? 'text-rl-green' :
                            dayRoas >= 1.5 ? 'text-rl-gold'  :
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
              {dailyTotals.investido > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-rl-border bg-rl-surface/60">
                    <td className="px-4 py-3 text-xs font-bold text-rl-text uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-rl-gold">{fmtMoney(dailyTotals.investido)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-rl-blue">{dailyTotals.leads.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-rl-purple">{dailyTotals.vendas.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-rl-green">{fmtMoney(dailyTotals.valorVendas)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-rl-cyan">{cpl > 0 ? fmtMoney(cpl) : '—'}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-rl-gold">{cac > 0 ? fmtMoney(cac) : '—'}</td>
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
      )}

      {/* ── SEMANAL ───────────────────────────────────────────────────────── */}
      {mode === 'semanal' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {weeks.map((week, idx) => {
            const wKey = String(idx + 1)
            const w    = weekData[wKey]
            const isEdit = editingWeek === idx

            const wCpl  = w?.leads  > 0 && w?.investido > 0 ? w.investido / w.leads  : 0
            const wCac  = w?.vendas > 0 && w?.investido > 0 ? w.investido / w.vendas : 0
            const wRoas = w?.investido > 0 ? (w.valorVendas || 0) / w.investido : 0

            return (
              <div key={idx} className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-rl-text">{week.label}</p>
                    <p className="text-xs text-rl-muted">
                      {MONTH_NAMES[month].slice(0,3)} {week.start}–{week.end}
                    </p>
                  </div>
                  {!isEdit && (
                    <button
                      onClick={() => setEditingWeek(idx)}
                      className="text-rl-muted hover:text-rl-text transition-colors p-1.5 rounded-lg hover:bg-rl-surface"
                    >
                      {w ? <Edit2 size={14} /> : <Plus size={14} />}
                    </button>
                  )}
                </div>

                {isEdit ? (
                  <B2CEntryForm
                    initial={w}
                    onSave={data => saveWeek(idx + 1, data)}
                    onCancel={() => setEditingWeek(null)}
                  />
                ) : w ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-rl-gold/5 border border-rl-gold/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-rl-muted uppercase tracking-wide mb-1">Investido</p>
                        <p className="text-sm font-bold text-rl-gold">{fmtMoney(w.investido)}</p>
                      </div>
                      <div className="bg-rl-blue/5 border border-rl-blue/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-rl-muted uppercase tracking-wide mb-1">Leads</p>
                        <p className="text-sm font-bold text-rl-blue">{w.leads}</p>
                      </div>
                      <div className="bg-rl-green/5 border border-rl-green/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-rl-muted uppercase tracking-wide mb-1">Receita</p>
                        <p className="text-sm font-bold text-rl-green">{fmtMoney(w.valorVendas)}</p>
                      </div>
                    </div>

                    {/* Custo por etapa da semana */}
                    <div>
                      <div className="text-[10px] text-rl-muted uppercase tracking-wider mb-1.5 font-semibold">
                        Custo por etapa
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <CostTile label="Custo / Lead" value={wCpl} color="blue" />
                        <CostTile label="CAC" value={wCac} color="gold" />
                        <div className={`rounded-lg border px-2 py-1.5 text-center ${
                          wRoas >= 3   ? 'bg-rl-green/8  border-rl-green/25  text-rl-green'  :
                          wRoas >= 1.5 ? 'bg-rl-gold/8   border-rl-gold/25   text-rl-gold'   :
                                         'bg-rl-purple/8 border-rl-purple/25 text-rl-purple'
                        }`}>
                          <div className="text-[9px] uppercase tracking-wider text-rl-muted leading-tight">ROAS</div>
                          <div className="text-[13px] font-bold leading-tight mt-0.5">
                            {wRoas > 0 ? `${wRoas.toFixed(2)}x` : '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {w.vendas > 0 && (
                      <div className="flex items-center justify-between bg-rl-surface rounded-lg px-3 py-2">
                        <span className="text-[11px] text-rl-muted">{w.vendas} vendas · ticket médio</span>
                        <span className="text-xs font-bold text-rl-cyan">
                          {fmtMoney(w.valorVendas / w.vendas)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-rl-muted text-center py-4">Sem dados para esta semana</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
