import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  Loader2, AlertTriangle, Check, X, Edit2, Plus,
  CheckCircle2, CalendarDays, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { fmtMoney, fmtPct, parseMoney, getWeekRanges, MONTH_NAMES } from '../components/Resultados/resultadosHelpers'

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

// ─── Week Form ─────────────────────────────────────────────────────────────────
function WeekForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    investido:     initial.investido     != null ? String(initial.investido).replace('.', ',')     : '',
    receitaVendas: initial.receitaVendas != null ? String(initial.receitaVendas).replace('.', ',') : '',
    leads:  initial.leads  || '',
    mql:    initial.mql    || '',
    sql:    initial.sql    || '',
    vendas: initial.vendas || '',
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-field">Valor Investido</label>
          <input className="input-field" placeholder="R$ 0,00" value={form.investido}
            onChange={(e) => set('investido', e.target.value)} />
        </div>
        <div>
          <label className="label-field">Receita de Vendas</label>
          <input className="input-field" placeholder="R$ 0,00" value={form.receitaVendas}
            onChange={(e) => set('receitaVendas', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[['leads', 'Leads'], ['mql', 'MQL'], ['sql', 'SQL'], ['vendas', 'Vendas']].map(([k, lbl]) => (
          <div key={k}>
            <label className="label-field">{lbl}</label>
            <input className="input-field" type="number" min="0" placeholder="0"
              value={form[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
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
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }
  const next = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }
  return (
    <div className="flex items-center gap-3">
      <button onClick={prev} className="p-2 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-colors">
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-semibold text-rl-text min-w-[130px] text-center">
        {MONTH_NAMES[month]} {year}
      </span>
      <button onClick={next} className="p-2 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-colors">
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function B2BClientForm() {
  const { token } = useParams()
  const today     = new Date()

  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [companyName, setCompanyName] = useState('')
  const [resultados, setResultados]   = useState({})
  const [saveStatus, setSaveStatus]   = useState('idle')
  const [year, setYear]               = useState(today.getFullYear())
  const [month, setMonth]             = useState(today.getMonth())
  const [editing, setEditing]         = useState(null)
  const debounceRef = useRef(null)

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/b2b-results?token=${encodeURIComponent(token)}`)
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
        const res = await fetch('/api/b2b-results', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            token,
            b2bData: { b2b: updated.b2b },
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

  const monthKey   = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthData  = resultados.b2b?.[monthKey] || {}
  const weekRanges = getWeekRanges(year, month)

  // ── Save week ───────────────────────────────────────────────────────────────
  const saveWeek = (weekKey, data) => {
    const next = {
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
    }
    setResultados(next)
    scheduleSave(next)
    setEditing(null)
  }

  // ── Totals ──────────────────────────────────────────────────────────────────
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
  const roas = totals.investido > 0 ? totals.receitaVendas / totals.investido : 0

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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-rl-muted font-medium uppercase tracking-wider">Resultados B2B</p>
            <h1 className="text-lg font-bold text-rl-text">{companyName}</h1>
          </div>
          <SaveBadge status={saveStatus} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Instrução */}
        <div className="glass-card p-5 border-l-4 border-rl-blue/50">
          <p className="text-sm text-rl-text font-medium mb-1 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-rl-blue" /> Como preencher
          </p>
          <p className="text-sm text-rl-muted leading-relaxed">
            Preencha os dados semanais de investimento, receita e funil (Leads → MQL → SQL → Vendas).
            Os dados são salvos automaticamente.
          </p>
        </div>

        <MonthNav year={year} month={month} setYear={setYear} setMonth={setMonth} />

        {/* Monthly Summary */}
        {hasTotals && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Investido', value: fmtMoney(totals.investido),          color: 'rl-gold'   },
              { label: 'Receita',   value: fmtMoney(totals.receitaVendas),       color: 'rl-green'  },
              { label: 'ROAS',      value: roas > 0 ? roas.toFixed(2) + 'x' : '—', color: roas >= 3 ? 'rl-green' : roas >= 1.5 ? 'rl-gold' : 'rl-purple' },
              { label: 'Leads',     value: totals.leads.toLocaleString('pt-BR'), color: 'rl-blue'   },
              { label: 'MQL',       value: totals.mql.toLocaleString('pt-BR'),   color: 'rl-cyan'   },
              { label: 'Vendas',    value: totals.vendas.toLocaleString('pt-BR'), color: 'rl-gold'   },
            ].map((c) => (
              <div key={c.label} className={`glass-card p-4 text-center border border-${c.color}/20`}>
                <p className="text-[10px] text-rl-muted uppercase tracking-wide mb-1">{c.label}</p>
                <p className={`text-sm font-bold text-${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Weekly Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {weekRanges.map((week, i) => {
            const weekKey  = `semana${i + 1}`
            const wkData   = monthData[weekKey]
            const isEdit   = editing === weekKey
            const wkRoas   = wkData?.investido > 0 ? (wkData.receitaVendas || 0) / wkData.investido : 0

            return (
              <div key={weekKey} className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-rl-text">{week.label}</p>
                    <p className="text-xs text-rl-muted">
                      {MONTH_NAMES[month].slice(0, 3)} {week.start}–{week.end}
                    </p>
                  </div>
                  {!isEdit && (
                    <button
                      onClick={() => setEditing(weekKey)}
                      className="text-rl-muted hover:text-rl-text p-1.5 rounded-lg hover:bg-rl-surface"
                    >
                      {wkData ? <Edit2 size={14} /> : <Plus size={14} />}
                    </button>
                  )}
                </div>

                {isEdit ? (
                  <WeekForm
                    initial={wkData}
                    onSave={(data) => saveWeek(weekKey, data)}
                    onCancel={() => setEditing(null)}
                  />
                ) : wkData ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-rl-gold/5 border border-rl-gold/20 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] text-rl-muted uppercase tracking-wide mb-1">Investido</p>
                        <p className="text-xs font-bold text-rl-gold">{fmtMoney(wkData.investido)}</p>
                      </div>
                      <div className="bg-rl-green/5 border border-rl-green/20 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] text-rl-muted uppercase tracking-wide mb-1">Receita</p>
                        <p className="text-xs font-bold text-rl-green">{fmtMoney(wkData.receitaVendas)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      <div className="text-center bg-rl-surface rounded-lg py-1.5">
                        <p className="text-[9px] text-rl-muted">Leads</p>
                        <p className="text-xs font-bold text-rl-blue">{wkData.leads}</p>
                      </div>
                      <div className="text-center bg-rl-surface rounded-lg py-1.5">
                        <p className="text-[9px] text-rl-muted">MQL</p>
                        <p className="text-xs font-bold text-rl-cyan">{wkData.mql}</p>
                      </div>
                      <div className="text-center bg-rl-surface rounded-lg py-1.5">
                        <p className="text-[9px] text-rl-muted">SQL</p>
                        <p className="text-xs font-bold text-rl-purple">{wkData.sql}</p>
                      </div>
                      <div className="text-center bg-rl-surface rounded-lg py-1.5">
                        <p className="text-[9px] text-rl-muted">Vendas</p>
                        <p className="text-xs font-bold text-rl-gold">{wkData.vendas}</p>
                      </div>
                    </div>
                    {wkRoas > 0 && (
                      <div className="flex items-center justify-between bg-rl-surface rounded-lg px-3 py-2">
                        <span className="text-[11px] text-rl-muted">ROAS</span>
                        <span className={`text-xs font-bold ${
                          wkRoas >= 3   ? 'text-rl-green'  :
                          wkRoas >= 1.5 ? 'text-rl-gold'   :
                                          'text-rl-purple'
                        }`}>
                          {wkRoas.toFixed(2)}x
                        </span>
                      </div>
                    )}
                    {wkData.leads > 0 && wkData.mql > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        <span className="text-[10px] bg-rl-cyan/10 text-rl-cyan border border-rl-cyan/20 px-1.5 py-0.5 rounded-full">
                          {fmtPct(wkData.mql, wkData.leads)} → MQL
                        </span>
                        {wkData.sql > 0 && (
                          <span className="text-[10px] bg-rl-purple/10 text-rl-purple border border-rl-purple/20 px-1.5 py-0.5 rounded-full">
                            {fmtPct(wkData.sql, wkData.mql)} → SQL
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
                  <p className="text-xs text-rl-muted text-center py-4">Sem dados para esta semana</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 pb-8 text-center">
          <p className="text-xs text-rl-muted">Os dados são salvos automaticamente conforme você preenche.</p>
          <p className="text-xs text-rl-muted/50 mt-1">Revenue Lab © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}
