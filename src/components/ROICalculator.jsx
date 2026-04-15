import PropTypes from 'prop-types'
import { useState, useMemo, useCallback } from 'react'
import { Calculator, Target, DollarSign, Save, BarChart3, TrendingUp, AlertCircle, FileDown, CalendarDays } from 'lucide-react'
import { getWeekRanges, MONTH_NAMES } from './Resultados/resultadosHelpers'
import { exportROIPDF } from '../utils/exportPDF'
import { fmtCurrency } from '../lib/utils'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import { useApp } from '../context/AppContext'
import VideoGuide from './VideoGuide'

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

// ─── Number input ─────────────────────────────────────────────────────────────
function NumInput({ label, value, onChange, prefix, suffix, hint, min = 0 }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      {hint && <p className="text-xs text-rl-muted mb-1">{hint}</p>}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`input-field ${prefix ? 'pl-10' : ''} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Benchmark data ───────────────────────────────────────────────────────────
const BENCHMARKS = {
  b2c: [
    { label: 'Lead → MQL', min: 20, max: 50 },
    { label: 'MQL → SQL',  min: 25, max: 40 },
    { label: 'SQL → Venda',min: 10, max: 30 },
  ],
  b2b: [
    { label: 'Lead → MQL', min: 10, max: 40 },
    { label: 'MQL → SQL',  min: 15, max: 40 },
    { label: 'SQL → Venda',min: 15, max: 35 },
  ],
}

// ─── ROI Calculator ───────────────────────────────────────────────────────────
export default function ROICalculator({ project, onSave }) {
  const { updateProject } = useApp()
  const [benchmarkType, setBenchmarkType] = useState(null)
  const [activeTab, setActiveTab] = useState('calculadora')

  const now = new Date()
  const numSemanas = getWeekRanges(now.getFullYear(), now.getMonth()).length
  const mesAtual   = MONTH_NAMES[now.getMonth()]

  const [calc, setCalc] = useState(() => ({
    mediaOrcamento:  Number(project.mediaBudget)    || 5000,
    custoMarketing:  Number(project.managementFee)  || 2000,
    ticketMedio:     Number(project.averageTicket)  || 500,
    qtdCompras:      1,
    margemBruta:     40,
    roiDesejado:     0,
    taxaLead2MQL:    30,
    taxaMQL2SQL:     50,
    taxaSQL2Venda:   20,
    ...(project.roiCalc || {}),
  }))

  const set = useCallback((field, val) => {
    setCalc((prev) => {
      const next = { ...prev, [field]: val }
      // Recompute result synchronously so roiResult stays in sync with roiCalc
      const { mediaOrcamento: mo, custoMarketing: cm, ticketMedio: tm, qtdCompras: qc,
              margemBruta: mb, roiDesejado: rd, taxaLead2MQL: tl, taxaMQL2SQL: ts, taxaSQL2Venda: tv } = next
      const totalInv   = mo + cm
      const lucroVenda = tm * qc * (mb / 100)
      const freshResult = lucroVenda ? (() => {
        const retAlvo  = totalInv * (1 + rd / 100)
        const vendas   = Math.ceil(retAlvo / lucroVenda)
        const sqls     = tv ? Math.ceil(vendas / (tv / 100)) : Infinity
        const mqls     = ts ? Math.ceil(sqls   / (ts / 100)) : Infinity
        const leads    = tl ? Math.ceil(mqls   / (tl / 100)) : Infinity
        const fat      = vendas * tm * qc
        const lBruto   = fat * (mb / 100)
        return {
          totalInvestimento: totalInv, lucroPorVenda: lucroVenda,
          vendasNecessarias: vendas, sqlsNecessarios: sqls, mqlsNecessarios: mqls, leadsNecessarios: leads,
          faturamento: fat, lucroBruto: lBruto, lucroLiquido: lBruto - totalInv,
          cac:             vendas ? mo / vendas : Infinity,
          vendasBreakeven: Math.ceil(totalInv / lucroVenda),
          custoPorLead:    leads  ? cm / leads  : Infinity,
          custoPorMQL:     mqls   ? cm / mqls   : Infinity,
          custoPorSQL:     sqls   ? cm / sqls   : Infinity,
        }
      })() : null
      updateProject(project.id, { roiCalc: next, ...(freshResult ? { roiResult: freshResult } : {}) })
      return next
    })
  }, [project.id, updateProject])

  const result = useMemo(() => {
    const {
      mediaOrcamento, custoMarketing, ticketMedio, qtdCompras,
      margemBruta, roiDesejado, taxaLead2MQL, taxaMQL2SQL, taxaSQL2Venda,
    } = calc

    const totalInvestimento = mediaOrcamento + custoMarketing
    const lucroPorVenda     = ticketMedio * qtdCompras * (margemBruta / 100)
    if (!lucroPorVenda) return null

    const retornoAlvo        = totalInvestimento * (1 + roiDesejado / 100)
    // Sempre arredonda para cima — não existem frações de vendas/leads/pessoas
    const vendasNecessarias  = Math.ceil(retornoAlvo / lucroPorVenda)

    const sqlsNecessarios  = taxaSQL2Venda  ? Math.ceil(vendasNecessarias / (taxaSQL2Venda  / 100)) : Infinity
    const mqlsNecessarios  = taxaMQL2SQL    ? Math.ceil(sqlsNecessarios   / (taxaMQL2SQL    / 100)) : Infinity
    const leadsNecessarios = taxaLead2MQL   ? Math.ceil(mqlsNecessarios   / (taxaLead2MQL   / 100)) : Infinity

    const faturamento  = vendasNecessarias * ticketMedio * qtdCompras
    const lucroBruto   = faturamento * (margemBruta / 100)
    const lucroLiquido = lucroBruto - totalInvestimento

    const cac              = vendasNecessarias ? mediaOrcamento / vendasNecessarias : Infinity
    const vendasBreakeven  = Math.ceil(totalInvestimento / lucroPorVenda)

    // Custo por Lead/MQL/SQL usa apenas o Custo de Marketing (gestão/operação)
    const custoPorLead  = leadsNecessarios  ? custoMarketing / leadsNecessarios  : Infinity
    const custoPorMQL   = mqlsNecessarios   ? custoMarketing / mqlsNecessarios   : Infinity
    const custoPorSQL   = sqlsNecessarios   ? custoMarketing / sqlsNecessarios   : Infinity

    return {
      totalInvestimento, lucroPorVenda,
      vendasNecessarias, sqlsNecessarios, mqlsNecessarios, leadsNecessarios,
      faturamento, lucroBruto, lucroLiquido, cac, vendasBreakeven,
      custoPorLead, custoPorMQL, custoPorSQL,
    }
  }, [calc])

  return (
    <div className="space-y-6">

      <VideoGuide videoId="6oF8IB03pvg" label="Como preencher a Calculadora de ROI" />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <Calculator className="w-5 h-5 text-rl-purple" />
            Calculadora de ROI
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            Defina seu ROI alvo e descubra quantos leads, MQLs, SQLs e vendas você precisa gerar
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <AutoSaveIndicator />
          <button
            onClick={() => exportROIPDF(calc, result, project)}
            disabled={!result}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar PDF"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-rl-surface rounded-xl border border-rl-border w-fit">
        {[
          { id: 'calculadora', label: 'Calculadora',    Icon: Calculator },
          { id: 'metas',       label: 'Metas Semanais', Icon: CalendarDays },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === id
                ? 'bg-gradient-rl text-white shadow-glow'
                : 'text-rl-muted hover:text-rl-text'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Metas Semanais Tab ────────────────────────────── */}
      {activeTab === 'metas' && (
        <div className="space-y-5">
          {!result ? (
            <div className="glass-card p-8 text-center">
              <AlertCircle className="w-8 h-8 text-rl-muted/40 mx-auto mb-2" />
              <p className="text-rl-muted text-sm">Preencha a calculadora primeiro para ver as metas semanais</p>
            </div>
          ) : (
            <>
              {/* Weeks info */}
              <div className="flex items-center justify-between glass-card px-5 py-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-rl-purple" />
                  <span className="text-sm font-semibold text-rl-text">{mesAtual}</span>
                </div>
                <span className="text-sm font-bold text-rl-purple">{numSemanas} semanas</span>
              </div>

              {/* Weekly target cards */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Leads / semana',  value: Math.ceil(result.leadsNecessarios  / numSemanas), color: 'rl-purple', bg: 'bg-rl-purple/5',  border: 'border-rl-purple/20', icon: '👥' },
                  { label: 'MQLs / semana',   value: Math.ceil(result.mqlsNecessarios   / numSemanas), color: 'rl-blue',   bg: 'bg-rl-blue/5',    border: 'border-rl-blue/20',   icon: '🎯' },
                  { label: 'SQLs / semana',   value: Math.ceil(result.sqlsNecessarios   / numSemanas), color: 'rl-cyan',   bg: 'bg-rl-cyan/5',    border: 'border-rl-cyan/20',   icon: '💎' },
                  { label: 'Vendas / semana', value: Math.ceil(result.vendasNecessarias / numSemanas), color: 'rl-green',  bg: 'bg-rl-green/5',   border: 'border-rl-green/20',  icon: '🏆' },
                ].map(({ label, value, color, bg, border, icon }) => (
                  <div key={label} className={`glass-card p-5 ${bg} border ${border} text-center`}>
                    <div className="text-2xl mb-1">{icon}</div>
                    <div className={`text-4xl font-black text-${color} mb-1`}>{fmt(value)}</div>
                    <div className="text-xs text-rl-muted font-medium">{label}</div>
                    <div className={`text-[10px] text-${color}/70 mt-1`}>
                      {fmt(value * numSemanas)} / mês
                    </div>
                  </div>
                ))}
              </div>

              {/* Custo de Marketing/semana */}
              <div className="glass-card p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-rl-muted">Custo de Marketing / semana</p>
                  <p className="text-[10px] text-rl-muted/70">{fmtCurrency(calc.custoMarketing)} ÷ {numSemanas} semanas</p>
                </div>
                <span className="text-lg font-bold text-rl-gold">
                  {fmtCurrency(calc.custoMarketing / numSemanas)}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'calculadora' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Inputs ──────────────────────────────── */}
        <div className="space-y-4">

          {/* Investimento */}
          <div className="glass-card p-5 space-y-4">
            <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" /> Investimento
            </p>
            <div className="grid grid-cols-2 gap-3">
              <NumInput
                label="Orçamento em Mídia"
                value={calc.mediaOrcamento}
                onChange={(v) => set('mediaOrcamento', v)}
                prefix="R$"
                hint="Verba para anúncios"
              />
              <NumInput
                label="Custo de Marketing"
                value={calc.custoMarketing}
                onChange={(v) => set('custoMarketing', v)}
                prefix="R$"
                hint="Fee de gestão / assessoria"
              />
            </div>
            {result && (
              <div className="flex items-center justify-between rounded-lg bg-rl-surface px-4 py-2.5">
                <span className="text-xs text-rl-muted">Total investido</span>
                <span className="text-sm font-bold text-rl-text">{fmtCurrency(result.totalInvestimento)}</span>
              </div>
            )}
          </div>

          {/* Produto */}
          <div className="glass-card p-5 space-y-4">
            <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" /> Produto / Serviço
            </p>
            <div className="grid grid-cols-2 gap-3">
              <NumInput
                label="Ticket Médio"
                value={calc.ticketMedio}
                onChange={(v) => set('ticketMedio', v)}
                prefix="R$"
              />
              <NumInput
                label="Compras por cliente (LT)"
                value={calc.qtdCompras}
                onChange={(v) => set('qtdCompras', v)}
                min={1}
                hint="Lifetime do cliente"
              />
              <div className="col-span-2">
                <NumInput
                  label="Margem Bruta"
                  value={calc.margemBruta}
                  onChange={(v) => set('margemBruta', v)}
                  suffix="%"
                  hint="% que sobra do ticket após custos do produto"
                />
              </div>
            </div>
            {result && (
              <div className="flex items-center justify-between rounded-lg bg-rl-surface px-4 py-2.5">
                <span className="text-xs text-rl-muted">Lucro por venda</span>
                <span className="text-sm font-bold text-rl-green">{fmtCurrency(result.lucroPorVenda)}</span>
              </div>
            )}
          </div>

          {/* ROI Alvo */}
          <div className="glass-card p-5 space-y-3">
            <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider flex items-center gap-2">
              <Target className="w-3.5 h-3.5" /> ROI Desejado
            </p>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-rl-muted">
                  {calc.roiDesejado === 0 ? 'Ponto de equilíbrio' : `Retorno de ${calc.roiDesejado}% sobre o investimento`}
                </span>
                <span className="text-lg font-bold text-rl-purple">{calc.roiDesejado}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={500}
                step={10}
                value={calc.roiDesejado}
                onChange={(e) => set('roiDesejado', Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #164496 ${calc.roiDesejado / 5}%, #DDE3EF ${calc.roiDesejado / 5}%)`
                }}
              />
              <div className="flex justify-between text-[10px] text-rl-muted mt-1">
                <span>0%</span><span>100%</span><span>200%</span><span>300%</span><span>500%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[0, 100, 200, 300, 400, 500].map((v) => (
                <button
                  key={v}
                  onClick={() => set('roiDesejado', v)}
                  className={`text-xs py-1.5 rounded-lg font-medium transition-all ${
                    calc.roiDesejado === v
                      ? 'bg-gradient-rl text-white'
                      : 'bg-rl-surface text-rl-muted hover:text-rl-text'
                  }`}
                >
                  {v === 0 ? 'Equilíbrio' : `ROI ${v}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Taxas do Funil */}
          <div className="glass-card p-5 space-y-3">
            {/* Header + toggle B2B/B2C */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" /> Taxas de Conversão do Funil
              </p>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-rl-muted mr-1">Benchmark:</span>
                {['b2c', 'b2b'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setBenchmarkType(benchmarkType === type ? null : type)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                      benchmarkType === type
                        ? 'bg-rl-purple text-white border-rl-purple'
                        : 'bg-rl-surface text-rl-muted border-rl-border hover:border-rl-purple/40 hover:text-rl-text'
                    }`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <NumInput label="Lead → MQL"   value={calc.taxaLead2MQL}  onChange={(v) => set('taxaLead2MQL', v)}  suffix="%" />
              <NumInput label="MQL → SQL"    value={calc.taxaMQL2SQL}   onChange={(v) => set('taxaMQL2SQL', v)}   suffix="%" />
              <NumInput label="SQL → Venda"  value={calc.taxaSQL2Venda} onChange={(v) => set('taxaSQL2Venda', v)} suffix="%" />
            </div>

            {/* Benchmark panel */}
            {benchmarkType && (
              <div className="rounded-xl border border-rl-purple/20 bg-rl-purple/5 p-3 space-y-2">
                <p className="text-[10px] font-bold text-rl-purple uppercase tracking-wider">
                  Referência de mercado — {benchmarkType.toUpperCase()}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {BENCHMARKS[benchmarkType].map((b) => (
                    <div key={b.label} className="rounded-lg bg-rl-surface p-2.5 text-center">
                      <p className="text-[10px] text-rl-muted mb-1">{b.label}</p>
                      <p className="text-sm font-bold text-rl-text">
                        {b.min}%<span className="text-rl-muted font-normal"> – </span>{b.max}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Results ─────────────────────────────── */}
        <div className="space-y-4">

          {result && (
            <div className="glass-card p-5 border border-rl-purple/20">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-rl-text">
                  Meta para ROI de <span className="text-rl-purple">{calc.roiDesejado}%</span>
                </p>
                <span className="text-xs bg-rl-purple/10 text-rl-purple border border-rl-purple/20 px-2.5 py-1 rounded-full">
                  {fmt(result.vendasNecessarias)} vendas/mês
                </span>
              </div>

              <div className="space-y-2 mb-4">
                {[
                  { label: 'Leads necessários',  value: result.leadsNecessarios,  cost: result.custoPorLead, costLabel: 'CPL (mídia)',      color: 'text-rl-purple', bg: 'bg-rl-purple/10', border: 'border-rl-purple/20', rate: null },
                  { label: 'MQLs necessários',   value: result.mqlsNecessarios,   cost: result.custoPorMQL,  costLabel: 'Custo MQL (mídia)', color: 'text-rl-blue',   bg: 'bg-rl-blue/10',   border: 'border-rl-blue/20',   rate: calc.taxaLead2MQL },
                  { label: 'SQLs necessários',   value: result.sqlsNecessarios,   cost: result.custoPorSQL,  costLabel: 'Custo SQL (mídia)', color: 'text-rl-cyan',   bg: 'bg-rl-cyan/10',   border: 'border-rl-cyan/20',   rate: calc.taxaMQL2SQL },
                  { label: 'Vendas necessárias', value: result.vendasNecessarias, cost: result.cac,          costLabel: 'CAC (mídia)',      color: 'text-rl-green',  bg: 'bg-rl-green/10',  border: 'border-rl-green/20',  rate: calc.taxaSQL2Venda },
                ].map((row) => (
                  <div key={row.label} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${row.border} ${row.bg}`}>
                    <div>
                      <p className={`text-lg font-bold ${row.color}`}>{fmt(row.value)}</p>
                      <p className="text-xs text-rl-muted">{row.label}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-rl-text">{fmtCurrency(row.cost)}</span>
                      <span className="text-[10px] text-rl-muted">{row.costLabel}</span>
                      {row.rate !== null && (
                        <span className="text-[10px] text-rl-muted bg-rl-surface px-1.5 py-0.5 rounded-md">
                          {row.rate}% conv.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-rl-muted text-center">
                ↑ calculado de baixo para cima com base nas suas taxas de conversão
              </p>
            </div>
          )}

          {result && (
            <div className="glass-card p-5 space-y-3">
              <p className="text-sm font-semibold text-rl-text mb-1">Financeiro Projetado</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-rl-surface p-3">
                  <p className="text-xs text-rl-muted mb-1">Total Investido</p>
                  <p className="text-base font-bold text-rl-text">{fmtCurrency(result.totalInvestimento)}</p>
                </div>
                <div className="rounded-xl bg-rl-surface p-3">
                  <p className="text-xs text-rl-muted mb-1">Faturamento Alvo</p>
                  <p className="text-base font-bold text-rl-purple">{fmtCurrency(result.faturamento)}</p>
                </div>
                <div className="rounded-xl bg-rl-surface p-3">
                  <p className="text-xs text-rl-muted mb-1">Lucro Bruto</p>
                  <p className="text-base font-bold text-rl-cyan">{fmtCurrency(result.lucroBruto)}</p>
                </div>
                <div className={`rounded-xl p-3 ${result.lucroLiquido >= 0 ? 'bg-rl-green/10' : 'bg-rl-red/10'}`}>
                  <p className="text-xs text-rl-muted mb-1">Lucro Líquido</p>
                  <p className={`text-base font-bold ${result.lucroLiquido >= 0 ? 'text-rl-green' : 'text-rl-red'}`}>
                    {fmtCurrency(result.lucroLiquido)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-rl-surface px-4 py-2.5 mt-1">
                <span className="text-xs text-rl-muted">CAC (custo de aquisição — mídia)</span>
                <span className="text-sm font-bold text-rl-gold">{fmtCurrency(result.cac)}</span>
              </div>
              <div className="rounded-lg border border-rl-border px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-rl-muted">Ponto de equilíbrio (ROI 0%)</p>
                  <p className="text-xs text-rl-muted">Mínimo de vendas para cobrir o investimento</p>
                </div>
                <span className="text-sm font-bold text-rl-text">{fmt(result.vendasBreakeven)} vendas</span>
              </div>
            </div>
          )}

          {!result && (
            <div className="glass-card p-8 text-center">
              <AlertCircle className="w-8 h-8 text-rl-muted/40 mx-auto mb-2" />
              <p className="text-rl-muted text-sm">Preencha os dados para ver os resultados</p>
            </div>
          )}
        </div>
      </div>
      )} {/* end activeTab === 'calculadora' */}

      {/* Save button */}
      {onSave && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => onSave(calc, result)}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar Calculadora
          </button>
        </div>
      )}
    </div>
  )
}

ROICalculator.propTypes = {
  project: PropTypes.shape({
    id:              PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    companyName:     PropTypes.string,
    businessType:    PropTypes.string,
    roiCalc:         PropTypes.object,
    roiResult:       PropTypes.object,
    completedSteps:  PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onSave: PropTypes.func,
}

NumInput.propTypes = {
  label:    PropTypes.string.isRequired,
  value:    PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  prefix:   PropTypes.string,
  suffix:   PropTypes.string,
  hint:     PropTypes.string,
  min:      PropTypes.number,
}
