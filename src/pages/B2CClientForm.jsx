import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  Loader2, AlertTriangle, Check, X, Edit2, Plus,
  CheckCircle2, CalendarDays,
} from 'lucide-react'
import { fmtMoney, parseMoney, getDaysInMonth, getWeekRanges, MONTH_NAMES } from '../components/Resultados/resultadosHelpers'

// ─── Save badge ────────────────────────────────────────────────────────────────
function SaveBadge({ status }) {
  if (status === 'saving') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-muted">
      <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
    </span>
  )
  if (status === 'saved') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-green">
      <CheckCircle2 className="w-3 h-3" /> Salvo
    </span>
  )
  return null
}

// ─── Day Form ──────────────────────────────────────────────────────────────────
function DayForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    investido:   initial.investido   != null ? String(initial.investido).replace('.', ',')   : '',
    leads:       initial.leads       || '',
    valorVendas: initial.valorVendas != null ? String(initial.valorVendas).replace('.', ',') : '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const inv  = parseMoney(form.investido)
  const lds  = Number(form.leads) || 0
  const vend = parseMoney(form.valorVendas)
  const cpl  = lds > 0 && inv > 0 ? inv / lds : null
  const roas = inv > 0             ? vend / inv : null

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
      {(cpl !== null || roas !== null) && (
        <div className="flex gap-3 text-xs">
          {cpl !== null && (
            <span className="bg-rl-cyan/10 border border-rl-cyan/20 text-rl-cyan px-2 py-1 rounded-lg">
              CPL: {fmtMoney(cpl)}
            </span>
          )}
          {roas !== null && (
            <span className={`px-2 py-1 rounded-lg border ${
              roas >= 3   ? 'bg-rl-green/10  border-rl-green/20  text-rl-green'  :
              roas >= 1.5 ? 'bg-rl-gold/10   border-rl-gold/20   text-rl-gold'   :
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

// ─── Week Form ─────────────────────────────────────────────────────────────────
function WeekForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    investido:   initial.investido   != null ? String(initial.investido).replace('.', ',')   : '',
    leads:       initial.leads       || '',
    valorVendas: initial.valorVendas != null ? String(initial.valorVendas).replace('.', ',') : '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const inv  = parseMoney(form.investido)
  const lds  = Number(form.leads) || 0
  const vend = parseMoney(form.valorVendas)
  const cpl  = lds > 0 && inv > 0 ? inv / lds : null
  const roas = inv > 0             ? vend / inv : null

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
      {(cpl !== null || roas !== null) && (
        <div className="flex gap-3 text-xs">
          {cpl !== null && (
            <span className="bg-rl-cyan/10 border border-rl-cyan/20 text-rl-cyan px-2 py-1 rounded-lg">
              CPL: {fmtMoney(cpl)}
            </span>
          )}
          {roas !== null && (
            <span className={`px-2 py-1 rounded-lg border ${
              roas >= 3   ? 'bg-rl-green/10  border-rl-green/20  text-rl-green'  :
              roas >= 1.5 ? 'bg-rl-gold/10   border-rl-gold/20   text-rl-gold'   :
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

// ─── Month Nav ─────────────────────────────────────────────────────────────────
function MonthNav({ year, month, setYear, setMonth }) {
  const prev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const next = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  return (
    <div className="flex items-center gap-3">
      <button onClick={prev} className="p-2 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-colors">
        ‹
      </button>
      <span className="text-sm font-semibold text-rl-text min-w-[130px] text-center">
        {MONTH_NAMES[month]} {year}
      </span>
      <button onClick={next} className="p-2 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-colors">
        ›
      </button>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function B2CClientForm() {
  const { token } = useParams()
  const today     = new Date()

  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [companyName, setCompanyName] = useState('')
  const [resultados, setResultados]   = useState({})
  const [saveStatus, setSaveStatus]   = useState('idle')
  const [mode, setMode]         = useState('diario')
  const [year, setYear]         = useState(today.getFullYear())
  const [month, setMonth]       = useState(today.getMonth())
  const [editing, setEditing]       = useState(null)
  const [editingWeek, setEditingWeek] = useState(null)
  const debounceRef = useRef(null)

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/b2c-results?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar.')
        setCompanyName(data.companyName || '')
        setResultados(data.resultados  || {})
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  // ── Debounced save ──────────────────────────────────────────────────────────
  const scheduleSave = useCallback((updated) => {
    clearTimeout(debounceRef.current)
    setSaveStatus('saving')
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/b2c-results', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            token,
            b2cData: {
              b2c:         updated.b2c,
              b2c_semanas: updated.b2c_semanas,
            },
          }),
        })
        if (!res.ok) throw new Error()
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      } catch {
        setSaveStatus('idle')
      }
    }, 1500)
  }, [token])

  const monthKey  = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthData = resultados.b2c?.[monthKey] || {}
  const weekData  = resultados.b2c_semanas?.[monthKey] || {}
  const daysInMon = getDaysInMonth(year, month)
  const weeks     = getWeekRanges(year, month)
  const days      = Array.from({ length: daysInMon }, (_, i) => i + 1)

  // ── Save day ────────────────────────────────────────────────────────────────
  const saveDay = (day, data) => {
    const dayKey = String(day).padStart(2, '0')
    const next = {
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
    }
    setResultados(next)
    scheduleSave(next)
    setEditing(null)
  }

  // ── Save week ───────────────────────────────────────────────────────────────
  const saveWeek = (weekIdx, data) => {
    const next = {
      ...resultados,
      b2c_semanas: {
        ...(resultados.b2c_semanas || {}),
        [monthKey]: {
          ...(resultados.b2c_semanas?.[monthKey] || {}),
          [String(weekIdx)]: {
            investido:   parseMoney(data.investido),
            leads:       Number(data.leads) || 0,
            valorVendas: parseMoney(data.valorVendas),
          },
        },
      },
    }
    setResultados(next)
    scheduleSave(next)
    setEditingWeek(null)
  }

  // ── Totals ──────────────────────────────────────────────────────────────────
  const dailyTotals = Object.values(monthData).reduce(
    (acc, d) => ({ investido: acc.investido + (d.investido || 0), leads: acc.leads + (d.leads || 0), valorVendas: acc.valorVendas + (d.valorVendas || 0) }),
    { investido: 0, leads: 0, valorVendas: 0 }
  )
  const weeklyTotals = Object.values(weekData).reduce(
    (acc, d) => ({ investido: acc.investido + (d.investido || 0), leads: acc.leads + (d.leads || 0), valorVendas: acc.valorVendas + (d.valorVendas || 0) }),
    { investido: 0, leads: 0, valorVendas: 0 }
  )
  const totals = mode === 'diario' ? dailyTotals : weeklyTotals
  const cpl    = totals.leads > 0 && totals.investido > 0 ? totals.investido / totals.leads : 0
  const roas   = totals.investido > 0 ? totals.valorVendas / totals.investido : 0

  // ── Loading / Error ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-rl-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-rl-purple animate-spin" />
          <p className="text-rl-muted text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-rl-dark flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-rl-text">Link inválido</h2>
          <p className="text-sm text-rl-muted">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-rl-dark">
      {/* Header */}
      <div className="border-b border-rl-border bg-rl-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-rl-muted font-medium uppercase tracking-wider">Resultados B2C</p>
            <h1 className="text-lg font-bold text-rl-text">{companyName}</h1>
          </div>
          <SaveBadge status={saveStatus} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Instrução */}
        <div className="glass-card p-5 border-l-4 border-rl-green/50">
          <p className="text-sm text-rl-text font-medium mb-1 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-rl-green" /> Como preencher
          </p>
          <p className="text-sm text-rl-muted leading-relaxed">
            Preencha os dados de investimento, leads e vendas. Você pode optar por registrar diariamente ou semanalmente. Os dados são salvos automaticamente.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-2 bg-rl-surface border border-rl-border rounded-xl p-1 w-fit">
          {[
            { id: 'diario',  label: 'Diário' },
            { id: 'semanal', label: 'Semanal' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => { setMode(opt.id); setEditing(null); setEditingWeek(null) }}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === opt.id
                  ? 'bg-gradient-rl text-white shadow-glow'
                  : 'text-rl-muted hover:text-rl-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <MonthNav year={year} month={month} setYear={setYear} setMonth={setMonth} />

        {/* Monthly Summary */}
        {totals.investido > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Investido', value: fmtMoney(totals.investido),          color: 'rl-gold'  },
              { label: 'Leads',     value: totals.leads.toLocaleString('pt-BR'), color: 'rl-blue'  },
              { label: 'Vendas',    value: fmtMoney(totals.valorVendas),         color: 'rl-green' },
              { label: 'CPL',       value: fmtMoney(cpl),                        color: 'rl-cyan'  },
              { label: 'ROAS',      value: roas > 0 ? roas.toFixed(2) + 'x' : '—', color: roas >= 3 ? 'rl-green' : roas >= 1.5 ? 'rl-gold' : 'rl-purple' },
            ].map(c => (
              <div key={c.label} className={`glass-card p-4 text-center border border-${c.color}/20`}>
                <p className="text-[10px] text-rl-muted uppercase tracking-wide mb-1">{c.label}</p>
                <p className={`text-sm font-bold text-${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── DIÁRIO ────────────────────────────────────────────────────────── */}
        {mode === 'diario' && (
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
                            <DayForm
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
                        <td className="px-4 py-2.5 font-medium text-rl-text text-xs whitespace-nowrap">{day}/{month + 1}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-rl-text">{d ? fmtMoney(d.investido) : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-rl-blue font-medium">{d ? d.leads : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-rl-green font-medium">{d ? fmtMoney(d.valorVendas) : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-rl-cyan">{d && dayCpl > 0 ? fmtMoney(dayCpl) : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          {d && dayRoas > 0 ? (
                            <span className={`font-semibold ${dayRoas >= 3 ? 'text-rl-green' : dayRoas >= 1.5 ? 'text-rl-gold' : 'text-rl-purple'}`}>
                              {dayRoas.toFixed(2)}x
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => setEditing(day)} className="text-rl-muted hover:text-rl-text p-1 rounded">
                            {d ? <Edit2 size={12} /> : <Plus size={12} />}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SEMANAL ───────────────────────────────────────────────────────── */}
        {mode === 'semanal' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {weeks.map((week, idx) => {
              const wKey   = String(idx + 1)
              const w      = weekData[wKey]
              const isEdit = editingWeek === idx
              const wCpl   = w?.leads > 0 && w?.investido > 0 ? w.investido / w.leads : 0
              const wRoas  = w?.investido > 0 ? (w.valorVendas || 0) / w.investido : 0

              return (
                <div key={idx} className="glass-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-rl-text">{week.label}</p>
                      <p className="text-xs text-rl-muted">
                        {MONTH_NAMES[month].slice(0, 3)} {week.start}–{week.end}
                      </p>
                    </div>
                    {!isEdit && (
                      <button
                        onClick={() => setEditingWeek(idx)}
                        className="text-rl-muted hover:text-rl-text p-1.5 rounded-lg hover:bg-rl-surface"
                      >
                        {w ? <Edit2 size={14} /> : <Plus size={14} />}
                      </button>
                    )}
                  </div>

                  {isEdit ? (
                    <WeekForm
                      initial={w}
                      onSave={data => saveWeek(idx + 1, data)}
                      onCancel={() => setEditingWeek(null)}
                    />
                  ) : w ? (
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
                        <p className="text-[10px] text-rl-muted uppercase tracking-wide mb-1">Vendas</p>
                        <p className="text-sm font-bold text-rl-green">{fmtMoney(w.valorVendas)}</p>
                      </div>
                      {(wCpl > 0 || wRoas > 0) && (
                        <div className="col-span-3 flex gap-2">
                          {wCpl > 0 && (
                            <span className="text-xs bg-rl-cyan/10 border border-rl-cyan/20 text-rl-cyan px-3 py-1 rounded-lg">
                              CPL: {fmtMoney(wCpl)}
                            </span>
                          )}
                          {wRoas > 0 && (
                            <span className={`text-xs px-3 py-1 rounded-lg border font-semibold ${
                              wRoas >= 3   ? 'bg-rl-green/10  border-rl-green/20  text-rl-green'  :
                              wRoas >= 1.5 ? 'bg-rl-gold/10   border-rl-gold/20   text-rl-gold'   :
                                             'bg-rl-purple/10 border-rl-purple/20 text-rl-purple'
                            }`}>
                              ROAS: {wRoas.toFixed(2)}x
                            </span>
                          )}
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

        {/* Footer */}
        <div className="pt-4 pb-8 text-center">
          <p className="text-xs text-rl-muted">Os dados são salvos automaticamente conforme você preenche.</p>
          <p className="text-xs text-rl-muted/50 mt-1">Revenue Lab © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}
