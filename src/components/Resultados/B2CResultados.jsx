import { useState } from 'react'
import { Plus, Edit2, Check, X } from 'lucide-react'
import { fmtMoney, fmtPct, parseMoney, getDaysInMonth } from './resultadosHelpers'
import { MonthNav, SummaryCard } from './B2BResultados'

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
export default function B2CView({ resultados, onUpdate }) {
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
