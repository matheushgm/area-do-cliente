// Vendas quebradas por unidade — espelha a planilha que o cliente já mantém:
// uma linha por dia do mês e, para cada unidade, quantidade de vendas e valor,
// fechando com o total do dia e o total do mês.
//
// A fonte de verdade é `resultados.b2c_unidades[YYYY-MM][DD][unidadeId]`. Quem
// chama é responsável por somar o dia de volta em `b2c[YYYY-MM][DD]` (vendas /
// valorVendas), para que KPIs, ROAS e gráficos continuem lendo de um lugar só.

import { useState } from 'react'
import { Edit2, Plus, Check, X, Store } from 'lucide-react'
import { fmtMoney, parseMoney, getDaysInMonth, MONTH_NAMES } from './resultadosHelpers'

const UNIT_STYLE = [
  { text: 'text-rl-blue',   bg: 'bg-rl-blue/5',   border: 'border-rl-blue/20',   bar: 'rgb(var(--rl-blue))'   },
  { text: 'text-rl-cyan',   bg: 'bg-rl-cyan/5',   border: 'border-rl-cyan/20',   bar: 'rgb(var(--rl-cyan))'   },
  { text: 'text-rl-gold',   bg: 'bg-rl-gold/5',   border: 'border-rl-gold/20',   bar: 'rgb(var(--rl-gold))'   },
  { text: 'text-rl-purple', bg: 'bg-rl-purple/5', border: 'border-rl-purple/20', bar: 'rgb(var(--rl-purple))' },
  { text: 'text-rl-green',  bg: 'bg-rl-green/5',  border: 'border-rl-green/20',  bar: 'rgb(var(--rl-green))'  },
]
const styleOf = i => UNIT_STYLE[i % UNIT_STYLE.length]

const COLS_CLASS = {
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
}

// Soma { vendas, valorVendas } de várias entradas de unidade.
function sumUnits(entry, unidades) {
  return unidades.reduce(
    (acc, u) => {
      const v = entry?.[u.id]
      return {
        vendas:      acc.vendas      + (Number(v?.vendas)      || 0),
        valorVendas: acc.valorVendas + (Number(v?.valorVendas) || 0),
      }
    },
    { vendas: 0, valorVendas: 0 },
  )
}

// Total do mês de uma unidade específica.
function monthTotalOf(data, unidadeId) {
  return Object.values(data || {}).reduce(
    (acc, dia) => ({
      vendas:      acc.vendas      + (Number(dia?.[unidadeId]?.vendas)      || 0),
      valorVendas: acc.valorVendas + (Number(dia?.[unidadeId]?.valorVendas) || 0),
    }),
    { vendas: 0, valorVendas: 0 },
  )
}

// ─── Cartão de resumo da unidade ──────────────────────────────────────────────
function UnitCard({ unidade, total, receitaMes, index }) {
  const st     = styleOf(index)
  const ticket = total.vendas > 0 ? total.valorVendas / total.vendas : 0
  const share  = receitaMes > 0 ? (total.valorVendas / receitaMes) * 100 : 0

  return (
    <div className={`glass-card p-4 border ${st.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <Store size={14} className={st.text} />
        <span className="text-xs font-semibold uppercase tracking-wider text-rl-muted">
          {unidade.label}
        </span>
      </div>

      <div className={`text-[26px] font-bold leading-none ${st.text}`}>
        {fmtMoney(total.valorVendas)}
      </div>
      <div className="text-[11px] text-rl-muted mt-1.5">
        {total.vendas.toLocaleString('pt-BR')} vendas
        {ticket > 0 && ` · ticket ${fmtMoney(ticket)}`}
      </div>

      <div className="mt-3 pt-3 border-t border-rl-border/60">
        <div className="flex items-center justify-between text-[10px] text-rl-muted mb-1.5">
          <span>Participação na receita</span>
          <span className="font-semibold text-rl-text">{share.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-rl-border/50 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(share, 100)}%`, background: st.bar }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Tabela ───────────────────────────────────────────────────────────────────
export default function VendasPorUnidade({
  unidades,
  year,
  month,
  data = {},
  onSaveDay,
  readOnly = false,
}) {
  const [editing, setEditing] = useState(null)   // número do dia em edição
  const [form, setForm]       = useState({})     // { unidadeId: { vendas, valorVendas } }

  const days = Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1)

  const startEdit = (day) => {
    const dayKey = String(day).padStart(2, '0')
    const entry  = data[dayKey] || {}
    setForm(Object.fromEntries(unidades.map(u => ([
      u.id,
      {
        vendas:      entry[u.id]?.vendas != null ? String(entry[u.id].vendas) : '',
        valorVendas: entry[u.id]?.valorVendas != null
          ? String(entry[u.id].valorVendas).replace('.', ',')
          : '',
      },
    ]))))
    setEditing(day)
  }

  const setField = (unitId, key, value) =>
    setForm(f => ({ ...f, [unitId]: { ...f[unitId], [key]: value } }))

  const commit = (day) => {
    const perUnit = {}
    unidades.forEach(u => {
      const vendas      = Number(form[u.id]?.vendas) || 0
      const valorVendas = parseMoney(form[u.id]?.valorVendas)
      if (vendas > 0 || valorVendas > 0) perUnit[u.id] = { vendas, valorVendas }
    })
    onSaveDay(String(day).padStart(2, '0'), perUnit)
    setEditing(null)
  }

  // Totais do mês, por unidade e geral.
  const totaisPorUnidade = unidades.map(u => monthTotalOf(data, u.id))
  const totalMes = totaisPorUnidade.reduce(
    (acc, t) => ({ vendas: acc.vendas + t.vendas, valorVendas: acc.valorVendas + t.valorVendas }),
    { vendas: 0, valorVendas: 0 },
  )
  const hasData = totalMes.vendas > 0 || totalMes.valorVendas > 0

  // Uma coluna por unidade + o card de total, até o limite de 5.
  // Classes escritas por extenso porque o Tailwind não lê nome montado em runtime.
  const resumoCols = COLS_CLASS[Math.min(unidades.length + 1, 5)] || 'lg:grid-cols-3'

  return (
    <div className="space-y-4">

      {/* Resumo do mês por unidade */}
      {hasData && (
        <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 ${resumoCols}`}>
          {unidades.map((u, i) => (
            <UnitCard
              key={u.id}
              unidade={u}
              index={i}
              total={totaisPorUnidade[i]}
              receitaMes={totalMes.valorVendas}
            />
          ))}
          <div className="glass-card p-4 border border-rl-green/25">
            <div className="text-xs font-semibold uppercase tracking-wider text-rl-muted mb-3">
              Total {MONTH_NAMES[month]}
            </div>
            <div className="text-[26px] font-bold leading-none text-rl-green">
              {fmtMoney(totalMes.valorVendas)}
            </div>
            <div className="text-[11px] text-rl-muted mt-1.5">
              {totalMes.vendas.toLocaleString('pt-BR')} vendas
              {totalMes.vendas > 0 && ` · ticket ${fmtMoney(totalMes.valorVendas / totalMes.vendas)}`}
            </div>
          </div>
        </div>
      )}

      {/* Tabela diária, no formato da planilha */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 160 + unidades.length * 190 + 190 }}>
            <thead>
              <tr className="border-b border-rl-border">
                <th rowSpan={2} className="text-left px-4 py-2 text-rl-muted font-medium text-xs uppercase tracking-wide align-bottom">
                  Data
                </th>
                {unidades.map((u, i) => (
                  <th
                    key={u.id}
                    colSpan={2}
                    className={`px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wider border-l border-rl-border/50 ${styleOf(i).text}`}
                  >
                    Unidade {u.label}
                  </th>
                ))}
                <th colSpan={2} className="px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-rl-green border-l border-rl-border/50">
                  Total de vendas
                </th>
                {!readOnly && <th rowSpan={2} className="w-10 px-2 py-2" />}
              </tr>
              <tr className="border-b border-rl-border">
                {[...unidades, { id: '__total' }].map(u => [
                  <th key={`${u.id}-q`} className="px-3 py-1.5 text-right text-[10px] uppercase tracking-wide text-rl-muted font-medium border-l border-rl-border/50">
                    Qtd.
                  </th>,
                  <th key={`${u.id}-v`} className="px-3 py-1.5 text-right text-[10px] uppercase tracking-wide text-rl-muted font-medium">
                    Valor
                  </th>,
                ])}
              </tr>
            </thead>

            <tbody>
              {days.map(day => {
                const dayKey = String(day).padStart(2, '0')
                const entry  = data[dayKey]
                const total  = sumUnits(entry, unidades)
                const isEdit = editing === day
                const vazio  = total.vendas === 0 && total.valorVendas === 0

                if (isEdit) {
                  return (
                    <tr key={day} className="border-b border-rl-border bg-rl-surface/40">
                      <td className="px-4 py-2 text-xs font-medium text-rl-text whitespace-nowrap">
                        {dayKey}/{String(month + 1).padStart(2, '0')}
                      </td>
                      {unidades.map((u, i) => [
                        <td key={`${u.id}-q`} className="px-2 py-2 border-l border-rl-border/50">
                          <input
                            className="input-field w-full text-right text-xs px-2 py-1"
                            type="number" min="0" placeholder="0"
                            value={form[u.id]?.vendas ?? ''}
                            onChange={e => setField(u.id, 'vendas', e.target.value)}
                          />
                        </td>,
                        <td key={`${u.id}-v`} className="px-2 py-2">
                          <input
                            className={`input-field w-full text-right text-xs px-2 py-1 ${styleOf(i).text}`}
                            placeholder="R$ 0,00"
                            value={form[u.id]?.valorVendas ?? ''}
                            onChange={e => setField(u.id, 'valorVendas', e.target.value)}
                          />
                        </td>,
                      ])}
                      {(() => {
                        const prev = unidades.reduce(
                          (acc, u) => ({
                            vendas:      acc.vendas      + (Number(form[u.id]?.vendas) || 0),
                            valorVendas: acc.valorVendas + parseMoney(form[u.id]?.valorVendas),
                          }),
                          { vendas: 0, valorVendas: 0 },
                        )
                        return [
                          <td key="tq" className="px-3 py-2 text-right text-xs font-bold text-rl-text border-l border-rl-border/50">
                            {prev.vendas || '—'}
                          </td>,
                          <td key="tv" className="px-3 py-2 text-right text-xs font-bold text-rl-green">
                            {prev.valorVendas > 0 ? fmtMoney(prev.valorVendas) : '—'}
                          </td>,
                        ]
                      })()}
                      <td className="px-2 py-2">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => commit(day)}
                            className="text-rl-green hover:text-rl-green p-1 rounded hover:bg-rl-green/10"
                            title="Salvar"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            className="text-rl-muted hover:text-rl-text p-1 rounded"
                            title="Cancelar"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr
                    key={day}
                    className={`border-b border-rl-border/30 hover:bg-rl-surface/20 transition-colors ${vazio ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-2 text-xs font-medium text-rl-text whitespace-nowrap">
                      {dayKey}/{String(month + 1).padStart(2, '0')}
                    </td>
                    {unidades.map((u, i) => {
                      const v = entry?.[u.id]
                      return [
                        <td key={`${u.id}-q`} className="px-3 py-2 text-right text-xs text-rl-text border-l border-rl-border/50">
                          {v?.vendas ? v.vendas.toLocaleString('pt-BR') : '—'}
                        </td>,
                        <td key={`${u.id}-v`} className={`px-3 py-2 text-right text-xs font-medium ${styleOf(i).text}`}>
                          {v?.valorVendas ? fmtMoney(v.valorVendas) : '—'}
                        </td>,
                      ]
                    })}
                    <td className="px-3 py-2 text-right text-xs font-bold text-rl-text border-l border-rl-border/50">
                      {total.vendas ? total.vendas.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-rl-green">
                      {total.valorVendas ? fmtMoney(total.valorVendas) : '—'}
                    </td>
                    {!readOnly && (
                      <td className="px-2 py-2">
                        <button
                          onClick={() => startEdit(day)}
                          className="text-rl-muted hover:text-rl-text transition-colors p-1 rounded"
                          title="Lançar vendas do dia"
                        >
                          {vazio ? <Plus size={12} /> : <Edit2 size={12} />}
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>

            {hasData && (
              <tfoot>
                <tr className="border-t-2 border-rl-border bg-rl-surface/60">
                  <td className="px-4 py-3 text-xs font-bold text-rl-text uppercase tracking-wide whitespace-nowrap">
                    Total do mês
                  </td>
                  {unidades.map((u, i) => [
                    <td key={`${u.id}-q`} className="px-3 py-3 text-right text-xs font-bold text-rl-text border-l border-rl-border/50">
                      {totaisPorUnidade[i].vendas.toLocaleString('pt-BR')}
                    </td>,
                    <td key={`${u.id}-v`} className={`px-3 py-3 text-right text-xs font-bold ${styleOf(i).text}`}>
                      {fmtMoney(totaisPorUnidade[i].valorVendas)}
                    </td>,
                  ])}
                  <td className="px-3 py-3 text-right text-xs font-bold text-rl-text border-l border-rl-border/50">
                    {totalMes.vendas.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-bold text-rl-green">
                    {fmtMoney(totalMes.valorVendas)}
                  </td>
                  {!readOnly && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {!readOnly && (
        <p className="text-[11px] text-rl-muted">
          O total de cada dia alimenta automaticamente as vendas e a receita da visão Diário,
          então CAC, ticket e ROAS do mês continuam batendo.
        </p>
      )}
    </div>
  )
}
