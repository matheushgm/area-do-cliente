import { useState, useCallback, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import {
  LineChart, TrendingUp, Calculator, CheckCircle2, DollarSign, Target, Users2, AlertTriangle,
  Download,
} from 'lucide-react'
import { downloadBlob, slugify } from '../lib/htmlToJpg'

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const DEFAULT_DATA = {
  faturamentoAtual: '',
  mesesDecorridos:  '',
  metaAnual:        '',
  ticketMedio:      '',
  taxaLeadMQL:      '',
  taxaMQLSQL:       '',
  taxaSQLVenda:     '',
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtBRL = (n) => {
  if (n == null || isNaN(n) || !isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:0, maximumFractionDigits:0 })
}
const fmtPct = (n, d=1) => (n == null || isNaN(n) || !isFinite(n)) ? '—' : `${(n*100).toFixed(d)}%`
const fmtNum = (n) => (n == null || isNaN(n) || !isFinite(n)) ? '—' : Math.ceil(n).toLocaleString('pt-BR')
const numVal = (v) => { const n = Number(String(v).replace(',','.')); return isNaN(n) ? 0 : n }

// ─── Math helpers ─────────────────────────────────────────────────────────────

// Soma geométrica dos meses futuros: base·Σ_{i=1..k}(1+g)^i
function geomSum(base, k, g) {
  let acc = 0
  for (let i = 1; i <= k; i++) acc += base * Math.pow(1 + g, i)
  return acc
}

// Resolve a taxa de crescimento composto mensal `g` tal que a soma dos `k` meses
// restantes (partindo de `base`) seja igual a `targetSum`. Bisseção — monotônica em g.
// Retorna null quando não há como/necessidade de calcular.
function solveMonthlyGrowth(base, k, targetSum) {
  if (!(base > 0) || !(k > 0) || !(targetSum > 0)) return null
  let lo = -0.99, hi = 5 // -99% a +500% ao mês
  // Se nem no teto conseguimos chegar ao alvo, devolve o teto.
  if (geomSum(base, k, hi) < targetSum) return hi
  for (let it = 0; it < 100; it++) {
    const mid = (lo + hi) / 2
    if (geomSum(base, k, mid) < targetSum) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// ─── Campo numérico (nível de módulo — nunca dentro do componente) ──────────────
function NumField({ label, value, onChange, prefix, suffix, hint, min }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      {hint && <p className="text-xs text-rl-muted mb-1">{hint}</p>}
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm">{prefix}</span>}
        <input
          type="number"
          min={min}
          value={value ?? ''}
          onChange={onChange}
          className={`input-field ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-10' : ''}`}
          placeholder="0"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm">{suffix}</span>}
      </div>
    </div>
  )
}

// ─── Núcleo de cálculo ──────────────────────────────────────────────────────────
function computePlan(d) {
  const faturamentoAtual = numVal(d.faturamentoAtual)
  const mesesDecorridos  = Math.min(12, Math.max(0, Math.round(numVal(d.mesesDecorridos))))
  const metaAnual        = numVal(d.metaAnual)
  const ticket           = numVal(d.ticketMedio)
  const rLead            = numVal(d.taxaLeadMQL)  / 100
  const rMQL             = numVal(d.taxaMQLSQL)   / 100
  const rSQL             = numVal(d.taxaSQLVenda) / 100

  const mesesRestantes = 12 - mesesDecorridos
  const mediaMensal    = mesesDecorridos > 0 ? faturamentoAtual / mesesDecorridos : 0
  const gap            = Math.max(0, metaAnual - faturamentoAtual)
  const projetadoMedia = faturamentoAtual + mediaMensal * mesesRestantes

  // Crescimento composto necessário nos meses restantes para fechar o gap.
  const g = solveMonthlyGrowth(mediaMensal, mesesRestantes, gap)
  const metaBatidaNoRitmo = mediaMensal > 0 && gap <= 0

  // Meta de faturamento por mês (12 posições).
  const meta = MONTHS.map((_, i) => {
    if (i < mesesDecorridos) return mediaMensal          // passado → referência (média)
    if (metaBatidaNoRitmo)   return mediaMensal          // já bate a meta → mantém ritmo
    if (g == null)           return null                 // faltam inputs
    const n = i - mesesDecorridos + 1                    // posição no futuro (1..k)
    return mediaMensal * Math.pow(1 + g, n)
  })

  // Funil reverso por mês (só nos meses de plano).
  const rows = meta.map((m, i) => {
    const isFuture = i >= mesesDecorridos
    if (!isFuture || m == null) {
      return { meta: m, crescimento: null, vendas: null, sqls: null, mqls: null, leads: null }
    }
    const vendas = ticket > 0 ? m / ticket : null
    const sqls   = (vendas != null && rSQL  > 0) ? vendas / rSQL : null
    const mqls   = (sqls   != null && rMQL  > 0) ? sqls   / rMQL : null
    const leads  = (mqls   != null && rLead > 0) ? mqls   / rLead : null
    const crescimento = metaBatidaNoRitmo ? 0 : g
    return { meta: m, crescimento, vendas, sqls, mqls, leads }
  })

  const sum = (sel) => rows.reduce((s, r) => s + (sel(r) || 0), 0)
  const totals = {
    meta:   sum(r => r.meta),
    vendas: sum(r => r.vendas),
    sqls:   sum(r => r.sqls),
    mqls:   sum(r => r.mqls),
    leads:  sum(r => r.leads),
  }

  return {
    mesesDecorridos, mesesRestantes, mediaMensal, metaAnual, gap,
    projetadoMedia, g, metaBatidaNoRitmo, rows, totals,
  }
}

// ─── Exportação CSV ─────────────────────────────────────────────────────────────
// Separador `;` + decimal com vírgula + BOM → abre certinho no Excel pt-BR e no Sheets.
function buildCSV(data, plan, empresa) {
  const esc  = (s) => { const v = String(s ?? ''); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v }
  const round= (n) => (n == null || isNaN(n) || !isFinite(n)) ? '' : String(Math.round(n))
  const ceil = (n) => (n == null || isNaN(n) || !isFinite(n)) ? '' : String(Math.ceil(n))
  const pct  = (n) => (n == null || isNaN(n) || !isFinite(n)) ? '' : (n * 100).toFixed(1).replace('.', ',')
  const raw  = (v) => (v === '' || v == null) ? '' : String(v).replace('.', ',')

  const rows = [
    ['Planejamento de Marketing', empresa || ''],
    ['Gerado em', new Date().toLocaleDateString('pt-BR')],
    [],
    ['Números-chave'],
    ['Faturamento até o momento (R$)', round(numVal(data.faturamentoAtual))],
    ['Meses decorridos', round(numVal(data.mesesDecorridos))],
    ['Meta anual (R$)', round(numVal(data.metaAnual))],
    ['Ticket médio (R$)', round(numVal(data.ticketMedio))],
    ['Taxa Lead → MQL (%)', raw(data.taxaLeadMQL)],
    ['Taxa MQL → SQL (%)', raw(data.taxaMQLSQL)],
    ['Taxa SQL → Venda (%)', raw(data.taxaSQLVenda)],
    [],
    ['Indicadores'],
    ['Média mensal (R$)', round(plan.mediaMensal)],
    ['Projeção mantendo a média (R$)', round(plan.projetadoMedia)],
    ['Crescimento necessário/mês (%)', plan.metaBatidaNoRitmo ? '0' : pct(plan.g)],
    ['Gap para a meta (R$)', round(plan.gap)],
    [],
    ['Indicador', ...MONTHS, 'Total'],
    ['Meta de faturamento (R$)', ...plan.rows.map(r => round(r.meta)), round(plan.totals.meta)],
    ['Crescimento (%)', ...plan.rows.map(r => r.crescimento == null ? '' : pct(r.crescimento)), ''],
    ['Novas vendas', ...plan.rows.map(r => ceil(r.vendas)), ceil(plan.totals.vendas)],
    ['SQLs', ...plan.rows.map(r => ceil(r.sqls)), ceil(plan.totals.sqls)],
    ['MQLs', ...plan.rows.map(r => ceil(r.mqls)), ceil(plan.totals.mqls)],
    ['Leads', ...plan.rows.map(r => ceil(r.leads)), ceil(plan.totals.leads)],
  ]

  return '\uFEFF' + rows.map(r => r.map(esc).join(';')).join('\r\n')
}

// ─── Linha da planilha ──────────────────────────────────────────────────────────
function SheetRow({ label, cells, total, format, bold, accent, mesesDecorridos }) {
  return (
    <tr className={`border-b border-rl-border/30 ${bold ? 'font-semibold' : ''}`}>
      <th
        scope="row"
        className={`sticky left-0 z-10 bg-rl-card text-left py-2.5 pr-4 pl-1 whitespace-nowrap text-xs ${
          bold ? 'text-rl-text font-semibold' : 'text-rl-muted font-medium'
        }`}
      >
        {label}
      </th>
      {cells.map((v, i) => {
        const past = i < mesesDecorridos
        return (
          <td
            key={i}
            className={`py-2.5 px-3 text-right whitespace-nowrap text-xs font-mono ${
              v == null ? 'text-rl-muted' : past ? 'text-rl-muted/70' : accent || 'text-rl-text'
            }`}
          >
            {format(v)}
          </td>
        )
      })}
      <td className={`py-2.5 px-3 text-right whitespace-nowrap text-xs font-mono font-bold ${accent || 'text-rl-text'} border-l border-rl-border`}>
        {format(total)}
      </td>
    </tr>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PlanejamentoMarketingModule({ project }) {
  const { updateProject } = useApp()
  const saveTimer = useRef(null)
  const [saved, setSaved] = useState(false)

  const [data, setData] = useState(() => {
    const stored = project.planejamentoMarketing || {}
    const defaultMeses = new Date().getMonth() || 1 // meses já fechados no ano (Jan=0 → 1)
    return {
      ...DEFAULT_DATA,
      ...stored,
      mesesDecorridos: stored.mesesDecorridos ?? String(defaultMeses),
    }
  })

  const persist = useCallback((next) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateProject(project.id, { planejamentoMarketing: next })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }, 800)
  }, [project.id, updateProject])

  const set = useCallback((key, value) => {
    setData(prev => {
      const next = { ...prev, [key]: value }
      persist(next)
      return next
    })
  }, [persist])

  const plan = useMemo(() => computePlan(data), [data])

  const empresa = project.companyName || project.company_name || ''
  const handleExportCSV = useCallback(() => {
    const csv = buildCSV(data, computePlan(data), empresa)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `planejamento-marketing-${slugify(empresa) || 'cliente'}.csv`)
  }, [data, empresa])

  const kpis = [
    { label: 'Faturamento até o momento', value: fmtBRL(numVal(data.faturamentoAtual)), Icon: DollarSign, color: 'text-rl-text' },
    { label: `Média mensal (${plan.mesesDecorridos} ${plan.mesesDecorridos === 1 ? 'mês' : 'meses'})`, value: fmtBRL(plan.mediaMensal), Icon: Calculator, color: 'text-rl-cyan' },
    { label: 'Meta anual', value: fmtBRL(plan.metaAnual), Icon: Target, color: 'text-rl-green' },
    { label: 'Projeção mantendo a média', value: fmtBRL(plan.projetadoMedia), Icon: LineChart, color: plan.projetadoMedia >= plan.metaAnual && plan.metaAnual > 0 ? 'text-rl-green' : 'text-rl-gold' },
    { label: 'Crescimento necessário/mês', value: plan.metaBatidaNoRitmo ? '0%' : (plan.g != null ? fmtPct(plan.g) : '—'), Icon: TrendingUp, color: 'text-rl-purple' },
    { label: 'Gap para a meta', value: fmtBRL(plan.gap), Icon: AlertTriangle, color: plan.gap > 0 ? 'text-rl-gold' : 'text-rl-green' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-rl-text flex items-center gap-2">
            <LineChart className="w-5 h-5 text-rl-cyan" />
            Planejamento de Marketing
          </h2>
          <p className="text-xs text-rl-muted mt-0.5">
            A partir da meta anual, calcula o crescimento necessário e o funil (leads → vendas) mês a mês.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-rl-green">
              <CheckCircle2 className="w-3.5 h-3.5" /> Salvo
            </span>
          )}
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn-secondary inline-flex items-center gap-1.5 text-xs px-3 py-2"
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Configuração */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-rl-text">⚙️ Números-chave</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NumField label="Faturamento até o momento" value={data.faturamentoAtual} prefix="R$"
            hint="Acumulado no ano até agora" onChange={e => set('faturamentoAtual', e.target.value)} />
          <NumField label="Meses decorridos" value={data.mesesDecorridos} min={1}
            hint="Quantos meses já fecharam no ano" onChange={e => set('mesesDecorridos', e.target.value)} />
          <NumField label="Meta anual de faturamento" value={data.metaAnual} prefix="R$"
            hint="Quanto quer faturar no ano todo" onChange={e => set('metaAnual', e.target.value)} />
          <NumField label="Ticket médio" value={data.ticketMedio} prefix="R$"
            hint="Valor médio por venda" onChange={e => set('ticketMedio', e.target.value)} />
          <NumField label="Taxa Lead → MQL" value={data.taxaLeadMQL} suffix="%"
            onChange={e => set('taxaLeadMQL', e.target.value)} />
          <NumField label="Taxa MQL → SQL" value={data.taxaMQLSQL} suffix="%"
            onChange={e => set('taxaMQLSQL', e.target.value)} />
          <NumField label="Taxa SQL → Venda" value={data.taxaSQLVenda} suffix="%"
            onChange={e => set('taxaSQLVenda', e.target.value)} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="glass-card p-4">
            <p className="text-xs text-rl-muted mb-1 leading-snug flex items-center gap-1.5">
              <k.Icon className="w-3.5 h-3.5 shrink-0" /> {k.label}
            </p>
            <p className={`text-base font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Aviso quando já bate a meta */}
      {plan.metaBatidaNoRitmo && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rl-green/8 border border-rl-green/25 text-rl-green">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold">
            No ritmo atual você já bate a meta anual — o plano abaixo mantém a média mensal.
          </span>
        </div>
      )}

      {/* Planilha mês a mês */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-sm font-semibold text-rl-text">📅 Plano mês a mês</h3>
          <p className="text-xs text-rl-muted">
            Meses já decorridos mostram a média (referência); os demais, o plano para bater a meta.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-rl-border">
                <th className="sticky left-0 z-10 bg-rl-card text-left py-2 pr-4 pl-1 text-rl-muted text-xs font-medium">Indicador</th>
                {MONTHS.map((m, i) => (
                  <th key={m} className={`py-2 px-3 text-right text-xs font-medium whitespace-nowrap ${i < plan.mesesDecorridos ? 'text-rl-muted/70' : 'text-rl-text'}`}>{m}</th>
                ))}
                <th className="py-2 px-3 text-right text-xs font-semibold text-rl-cyan whitespace-nowrap border-l border-rl-border">Total</th>
              </tr>
            </thead>
            <tbody>
              <SheetRow label="Meta de faturamento" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.meta)} total={plan.totals.meta}
                format={fmtBRL} bold accent="text-rl-green" />
              <SheetRow label="Crescimento" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.crescimento)} total={null}
                format={(v) => v == null ? '—' : fmtPct(v)} accent="text-rl-purple" />
              <SheetRow label="Novas vendas" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.vendas)} total={plan.totals.vendas} format={fmtNum} />
              <SheetRow label="SQLs" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.sqls)} total={plan.totals.sqls} format={fmtNum} accent="text-rl-cyan" />
              <SheetRow label="MQLs" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.mqls)} total={plan.totals.mqls} format={fmtNum} accent="text-rl-purple" />
              <SheetRow label="Leads" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.leads)} total={plan.totals.leads} format={fmtNum} accent="text-rl-blue" />
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-rl-muted mt-3 flex items-center gap-1.5">
          <Users2 className="w-3 h-3 shrink-0" />
          Funil reverso: Meta ÷ ticket = vendas · vendas ÷ taxa SQL→venda = SQLs · SQLs ÷ taxa MQL→SQL = MQLs · MQLs ÷ taxa Lead→MQL = Leads.
        </p>
      </div>
    </div>
  )
}
