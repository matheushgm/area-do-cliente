import { useState, useCallback, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import {
  LineChart, TrendingUp, Calculator, CheckCircle2, DollarSign, Target, Users2, AlertTriangle,
  Download, FileDown,
} from 'lucide-react'
import { downloadBlob, slugify } from '../lib/htmlToJpg'
import { exportPlanejamentoMarketingPDF } from '../utils/exportPDF'

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const DEFAULT_DATA = {
  faturamentoAtual: '',
  mesesDecorridos:  '',
  metaAnual:        '',
  ticketMedio:      '',
  verbaMidia:       '',
  taxaLeadMQL:      '',
  taxaMQLSQL:       '',
  taxaSQLVenda:     '',
  realizado:        {},
  distribuicao:     'composto',
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
  const verba            = numVal(d.verbaMidia)
  const rLead            = numVal(d.taxaLeadMQL)  / 100
  const rMQL             = numVal(d.taxaMQLSQL)   / 100
  const rSQL             = numVal(d.taxaSQLVenda) / 100
  const realizado        = d.realizado || {}

  const mesesRestantes = 12 - mesesDecorridos

  // Faturamento realizado por mês passado. Se o mês tem valor digitado, usa-o;
  // senão, cai na média (faturamento total ÷ meses, ou média dos meses preenchidos).
  const hasReal = (i) => realizado[i] != null && realizado[i] !== '' && numVal(realizado[i]) > 0
  const pastIdx = Array.from({ length: mesesDecorridos }, (_, i) => i)
  const filled  = pastIdx.filter(hasReal).map((i) => numVal(realizado[i]))
  const typedMedia = (faturamentoAtual > 0 && mesesDecorridos > 0) ? faturamentoAtual / mesesDecorridos : 0
  const fallback = typedMedia > 0
    ? typedMedia
    : (filled.length ? filled.reduce((a, b) => a + b, 0) / filled.length : 0)
  const effReal = (i) => hasReal(i) ? numVal(realizado[i]) : fallback

  const realizadoTotal = pastIdx.reduce((s, i) => s + effReal(i), 0)
  const mediaMensal    = mesesDecorridos > 0 ? realizadoTotal / mesesDecorridos : 0
  // Base da projeção = último mês realizado (progressão continua de onde o cliente está).
  const baseFuturo     = mesesDecorridos > 0 ? effReal(mesesDecorridos - 1) : mediaMensal
  const gap            = Math.max(0, metaAnual - realizadoTotal)
  const projetadoMedia = realizadoTotal + mediaMensal * mesesRestantes

  // Crescimento composto necessário nos meses restantes para fechar o gap,
  // partindo do último mês realizado.
  const g = solveMonthlyGrowth(baseFuturo, mesesRestantes, gap)
  const metaBatidaNoRitmo = baseFuturo > 0 && gap <= 0

  // Distribuição do crescimento nos meses restantes:
  //   'composto' → mesma % todo mês (curva exponencial, concentra no fim do ano)
  //   'linear'   → mesmo incremento em R$ todo mês (a % cai suavemente, curva mais reta)
  //   'igual'    → mesma meta em R$ todo mês (restante da meta ÷ meses restantes)
  const distribuicao = ['linear', 'igual'].includes(d.distribuicao) ? d.distribuicao : 'composto'
  // Passo fixo (R$) do modo linear: soma dos k meses restantes = gap.
  const stepLinear = mesesRestantes > 0
    ? (gap - mesesRestantes * baseFuturo) / (mesesRestantes * (mesesRestantes + 1) / 2)
    : 0
  // Meta única (igual) por mês restante.
  const metaIgual = mesesRestantes > 0 ? gap / mesesRestantes : 0

  // Meta de faturamento por mês (12 posições).
  const meta = MONTHS.map((_, i) => {
    if (i < mesesDecorridos) return effReal(i)            // passado → realizado (ou média)
    if (metaBatidaNoRitmo)   return baseFuturo            // já bate a meta → mantém o último mês
    if (mesesRestantes <= 0 || gap <= 0) return null      // sem meses/gap a planejar
    const n = i - mesesDecorridos + 1                     // posição no futuro (1..k)
    if (distribuicao === 'igual')  return metaIgual
    if (distribuicao === 'linear') return Math.max(0, baseFuturo + n * stepLinear)
    return g == null ? null : baseFuturo * Math.pow(1 + g, n) // composto
  })

  const metaFirstFuture = meta[mesesDecorridos] ?? null   // 1º mês de plano (base da verba)

  // Funil reverso + investimento e custos por mês (só nos meses de plano).
  const rows = meta.map((m, i) => {
    // Crescimento mês a mês (realizado no passado, projetado no futuro).
    const prev = meta[i - 1]
    const crescimento = (i > 0 && m != null && prev != null && prev > 0) ? m / prev - 1 : null
    const isFuture = i >= mesesDecorridos
    if (!isFuture || m == null) {
      return { meta: m, crescimento, vendas: null, sqls: null, mqls: null, leads: null,
               investimento: null, cpl: null, cpmql: null, cpsql: null, cac: null }
    }
    const vendas = ticket > 0 ? m / ticket : null
    const sqls   = (vendas != null && rSQL  > 0) ? vendas / rSQL : null
    const mqls   = (sqls   != null && rMQL  > 0) ? sqls   / rMQL : null
    const leads  = (mqls   != null && rLead > 0) ? mqls   / rLead : null
    // Verba acompanha a meta do mês (proporcional ao 1º mês de plano) — mantém o
    // custo por lead/venda estável em qualquer modo de distribuição.
    const investimento = (verba > 0 && metaFirstFuture > 0) ? verba * (m / metaFirstFuture) : null
    const cost = (den) => (investimento != null && den != null && den > 0) ? investimento / den : null
    return {
      meta: m, crescimento, vendas, sqls, mqls, leads,
      investimento, cpl: cost(leads), cpmql: cost(mqls), cpsql: cost(sqls), cac: cost(vendas),
    }
  })

  const sum = (sel) => rows.reduce((s, r) => s + (sel(r) || 0), 0)
  const totals = {
    meta:         sum(r => r.meta),
    vendas:       sum(r => r.vendas),
    sqls:         sum(r => r.sqls),
    mqls:         sum(r => r.mqls),
    leads:        sum(r => r.leads),
    investimento: sum(r => r.investimento),
  }
  // Custos totais = investimento total ÷ volume total (blended, não soma de custos).
  const blended = (den) => den > 0 ? totals.investimento / den : null
  totals.cpl   = blended(totals.leads)
  totals.cpmql = blended(totals.mqls)
  totals.cpsql = blended(totals.sqls)
  totals.cac   = blended(totals.vendas)

  // Crescimento de referência p/ o KPI: no linear é a média (CAGR) do caminho, já que
  // a taxa varia mês a mês; no composto coincide com `g`.
  const metaFinal = mesesRestantes > 0 ? meta[11] : null
  const crescimentoRef = metaBatidaNoRitmo ? 0
    : (baseFuturo > 0 && mesesRestantes > 0 && metaFinal > 0)
      ? Math.pow(metaFinal / baseFuturo, 1 / mesesRestantes) - 1
      : null

  return {
    mesesDecorridos, mesesRestantes, mediaMensal, metaAnual, gap,
    realizadoTotal, baseFuturo, projetadoMedia, g, distribuicao, crescimentoRef,
    metaBatidaNoRitmo, rows, totals,
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
    ['Faturamento até o momento (R$)', round(plan.realizadoTotal)],
    ['Meses decorridos', round(numVal(data.mesesDecorridos))],
    ['Meta anual (R$)', round(numVal(data.metaAnual))],
    ['Ticket médio (R$)', round(numVal(data.ticketMedio))],
    ['Verba de mídia — mês vigente (R$)', round(numVal(data.verbaMidia))],
    ['Taxa Lead → MQL (%)', raw(data.taxaLeadMQL)],
    ['Taxa MQL → SQL (%)', raw(data.taxaMQLSQL)],
    ['Taxa SQL → Venda (%)', raw(data.taxaSQLVenda)],
    [],
    ['Indicadores'],
    ['Distribuição do crescimento', plan.distribuicao === 'linear' ? 'Linear (suavizado)' : plan.distribuicao === 'igual' ? 'Meta única (igual por mês)' : 'Composto (fixo)'],
    ['Média mensal (R$)', round(plan.mediaMensal)],
    ['Projeção mantendo a média (R$)', round(plan.projetadoMedia)],
    [plan.distribuicao === 'composto' ? 'Crescimento necessário/mês (%)' : 'Crescimento médio/mês (%)', pct(plan.crescimentoRef)],
    ...(plan.distribuicao === 'igual' ? [['Meta por mês — igual (R$)', round(plan.mesesRestantes > 0 ? plan.gap / plan.mesesRestantes : 0)]] : []),
    ['Gap para a meta (R$)', round(plan.gap)],
    ['Investimento total no plano (R$)', round(plan.totals.investimento)],
    [],
    ['Indicador', ...MONTHS, 'Total'],
    ['Meta de faturamento (R$)', ...plan.rows.map(r => round(r.meta)), round(plan.totals.meta)],
    ['Crescimento (%)', ...plan.rows.map(r => r.crescimento == null ? '' : pct(r.crescimento)), ''],
    ['Novas vendas', ...plan.rows.map(r => ceil(r.vendas)), ceil(plan.totals.vendas)],
    ['SQLs', ...plan.rows.map(r => ceil(r.sqls)), ceil(plan.totals.sqls)],
    ['MQLs', ...plan.rows.map(r => ceil(r.mqls)), ceil(plan.totals.mqls)],
    ['Leads', ...plan.rows.map(r => ceil(r.leads)), ceil(plan.totals.leads)],
    ['Investimento em mídia (R$)', ...plan.rows.map(r => round(r.investimento)), round(plan.totals.investimento)],
    ['CPL (R$)', ...plan.rows.map(r => round(r.cpl)), round(plan.totals.cpl)],
    ['CPMql (R$)', ...plan.rows.map(r => round(r.cpmql)), round(plan.totals.cpmql)],
    ['CPSql (R$)', ...plan.rows.map(r => round(r.cpsql)), round(plan.totals.cpsql)],
    ['CAC (R$)', ...plan.rows.map(r => round(r.cac)), round(plan.totals.cac)],
  ]

  return '\uFEFF' + rows.map(r => r.map(esc).join(';')).join('\r\n')
}

// ─── Linha editável de Meta/Faturamento ─────────────────────────────────────────
// Meses passados viram inputs de faturamento realizado; meses futuros são a meta projetada.
function MetaRow({ metaCells, total, mesesDecorridos, realizado, onEdit }) {
  return (
    <tr className="border-b border-rl-border/30 font-semibold">
      <th scope="row" className="sticky left-0 z-10 bg-rl-card text-left py-2.5 pr-4 pl-1 whitespace-nowrap text-xs text-rl-text font-semibold">
        Meta de faturamento
      </th>
      {metaCells.map((v, i) => {
        if (i < mesesDecorridos) {
          return (
            <td key={i} className="py-1.5 px-2 text-right">
              <input
                type="number"
                value={realizado?.[i] ?? ''}
                onChange={(e) => onEdit(i, e.target.value)}
                placeholder={v == null ? '0' : String(Math.round(v))}
                title="Faturamento realizado — preencha com o dado real do cliente"
                className="w-24 text-right bg-rl-surface border border-rl-border rounded-lg px-2 py-1 text-xs font-mono text-rl-text focus:outline-none focus:border-rl-cyan/60"
              />
            </td>
          )
        }
        return (
          <td key={i} className={`py-2.5 px-3 text-right whitespace-nowrap text-xs font-mono ${v == null ? 'text-rl-muted' : 'text-rl-green'}`}>
            {fmtBRL(v)}
          </td>
        )
      })}
      <td className="py-2.5 px-3 text-right whitespace-nowrap text-xs font-mono font-bold text-rl-green border-l border-rl-border">
        {fmtBRL(total)}
      </td>
    </tr>
  )
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

  const setRealizado = useCallback((monthIdx, value) => {
    setData(prev => {
      const nextReal = { ...(prev.realizado || {}) }
      if (value === '' || value == null) delete nextReal[monthIdx]
      else nextReal[monthIdx] = value
      const next = { ...prev, realizado: nextReal }
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

  const handleExportPDF = useCallback(() => {
    exportPlanejamentoMarketingPDF(data, computePlan(data), project)
  }, [data, project])

  const kpis = [
    { label: 'Faturamento até o momento', value: fmtBRL(plan.realizadoTotal), Icon: DollarSign, color: 'text-rl-text' },
    { label: `Média mensal (${plan.mesesDecorridos} ${plan.mesesDecorridos === 1 ? 'mês' : 'meses'})`, value: fmtBRL(plan.mediaMensal), Icon: Calculator, color: 'text-rl-cyan' },
    { label: 'Meta anual', value: fmtBRL(plan.metaAnual), Icon: Target, color: 'text-rl-green' },
    { label: 'Projeção mantendo a média', value: fmtBRL(plan.projetadoMedia), Icon: LineChart, color: plan.projetadoMedia >= plan.metaAnual && plan.metaAnual > 0 ? 'text-rl-green' : 'text-rl-gold' },
    plan.distribuicao === 'igual'
      ? { label: 'Meta por mês (igual)', value: (plan.mesesRestantes > 0 && plan.gap > 0) ? fmtBRL(plan.gap / plan.mesesRestantes) : '—', Icon: TrendingUp, color: 'text-rl-purple' }
      : { label: plan.distribuicao === 'linear' ? 'Crescimento médio/mês' : 'Crescimento necessário/mês', value: plan.crescimentoRef != null ? fmtPct(plan.crescimentoRef) : '—', Icon: TrendingUp, color: 'text-rl-purple' },
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
          <button
            type="button"
            onClick={handleExportPDF}
            className="btn-secondary inline-flex items-center gap-1.5 text-xs px-3 py-2"
          >
            <FileDown className="w-3.5 h-3.5" /> Baixar PDF
          </button>
        </div>
      </div>

      {/* Configuração */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-rl-text">⚙️ Números-chave</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NumField label="Faturamento até o momento" value={data.faturamentoAtual} prefix="R$"
            hint="Acumulado no ano (ou preencha mês a mês na tabela abaixo)" onChange={e => set('faturamentoAtual', e.target.value)} />
          <NumField label="Meses decorridos" value={data.mesesDecorridos} min={1}
            hint="Quantos meses já fecharam no ano" onChange={e => set('mesesDecorridos', e.target.value)} />
          <NumField label="Meta anual de faturamento" value={data.metaAnual} prefix="R$"
            hint="Quanto quer faturar no ano todo" onChange={e => set('metaAnual', e.target.value)} />
          <NumField label="Ticket médio" value={data.ticketMedio} prefix="R$"
            hint="Valor médio por venda" onChange={e => set('ticketMedio', e.target.value)} />
          <NumField label="Verba de mídia (mês vigente)" value={data.verbaMidia} prefix="R$"
            hint={`Investimento em ${MONTHS[plan.mesesDecorridos] || 'no mês atual'} — cresce junto com a meta`}
            onChange={e => set('verbaMidia', e.target.value)} />
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
            No ritmo atual você já bate a meta anual — o plano abaixo mantém o último faturamento.
          </span>
        </div>
      )}

      {/* Planilha mês a mês */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h3 className="text-sm font-semibold text-rl-text">📅 Plano mês a mês</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-rl-muted">Distribuição:</span>
            <div className="flex items-center gap-0.5 bg-rl-surface rounded-lg p-0.5 border border-rl-border">
              {[
                { k: 'composto', l: 'Composto', t: 'Mesma % todo mês (curva exponencial, concentra no fim do ano)' },
                { k: 'linear',   l: 'Linear',   t: 'Mesmo incremento em R$ todo mês — a % cai suavemente, curva mais reta' },
                { k: 'igual',    l: 'Igual',    t: 'Mesma meta em R$ para todos os meses restantes (restante da meta ÷ meses restantes)' },
              ].map(o => (
                <button key={o.k} type="button" title={o.t} onClick={() => set('distribuicao', o.k)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    (data.distribuicao || 'composto') === o.k ? 'bg-rl-cyan text-white shadow-glow' : 'text-rl-muted hover:text-rl-text'
                  }`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-rl-muted mb-3">
          Edite o faturamento realizado dos meses passados (campos). <b>Composto</b>: mesma % todo mês · <b>Linear</b>: % cai suave (curva mais reta) · <b>Igual</b>: mesma meta em R$ todo mês.
        </p>
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
              <MetaRow metaCells={plan.rows.map(r => r.meta)} total={plan.totals.meta}
                mesesDecorridos={plan.mesesDecorridos} realizado={data.realizado} onEdit={setRealizado} />
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
              <SheetRow label="Investimento em mídia" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.investimento)} total={plan.totals.investimento}
                format={fmtBRL} bold accent="text-rl-gold" />
              <SheetRow label="CPL" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.cpl)} total={plan.totals.cpl} format={fmtBRL} accent="text-rl-blue" />
              <SheetRow label="CPMql" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.cpmql)} total={plan.totals.cpmql} format={fmtBRL} accent="text-rl-purple" />
              <SheetRow label="CPSql" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.cpsql)} total={plan.totals.cpsql} format={fmtBRL} accent="text-rl-cyan" />
              <SheetRow label="CAC" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.cac)} total={plan.totals.cac} format={fmtBRL} accent="text-rl-green" />
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-rl-muted mt-3 flex items-center gap-1.5">
          <Users2 className="w-3 h-3 shrink-0" />
          Funil reverso: Meta ÷ ticket = vendas · vendas ÷ taxa SQL→venda = SQLs · SQLs ÷ taxa MQL→SQL = MQLs · MQLs ÷ taxa Lead→MQL = Leads.
          A verba cresce no mesmo ritmo da meta; CPL/CPMql/CPSql/CAC = investimento do mês ÷ leads/MQLs/SQLs/vendas (a coluna Total usa o custo médio ponderado).
        </p>
      </div>
    </div>
  )
}
