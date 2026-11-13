import { fmtCurrency } from '../lib/utils'
import { useState, useCallback, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import {
  LineChart, TrendingUp, Calculator, CheckCircle2, DollarSign, Target, Users2, AlertTriangle,
  Download, FileDown,
} from 'lucide-react'
import { downloadBlob, slugify } from '../lib/htmlToJpg'
import { exportPlanejamentoMarketingPDF } from '../utils/exportPDF'
import { t as tAgora, useI18n, localeAtual } from '../i18n'

// ─── Constants ────────────────────────────────────────────────────────────────
// Nomes curtos dos meses no idioma de agora (planejamentoMarketing.mesesCurtos).
const mesesCurtos = (t = tAgora) => t('planejamentoMarketing.mesesCurtos').split(',')

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
const fmtPct = (n, d=1) => (n == null || isNaN(n) || !isFinite(n)) ? '—' : `${(n*100).toFixed(d)}%`
const fmtNum = (n) => (n == null || isNaN(n) || !isFinite(n)) ? '—' : Math.ceil(n).toLocaleString(localeAtual())
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
  const meta = Array.from({ length: 12 }, (_, i) => {
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
// Rótulos no idioma de quem exporta (planejamentoMarketing.csv.*).
function buildCSV(data, plan, empresa) {
  const t = tAgora
  const C = (k) => t(`planejamentoMarketing.csv.${k}`)
  const MONTHS = mesesCurtos(t)
  const esc  = (s) => { const v = String(s ?? ''); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v }
  const round= (n) => (n == null || isNaN(n) || !isFinite(n)) ? '' : String(Math.round(n))
  const ceil = (n) => (n == null || isNaN(n) || !isFinite(n)) ? '' : String(Math.ceil(n))
  const pct  = (n) => (n == null || isNaN(n) || !isFinite(n)) ? '' : (n * 100).toFixed(1).replace('.', ',')
  const raw  = (v) => (v === '' || v == null) ? '' : String(v).replace('.', ',')

  const rows = [
    [t('planejamentoMarketing.titulo'), empresa || ''],
    [C('geradoEm'), new Date().toLocaleDateString(localeAtual())],
    [],
    [C('numerosChave')],
    [C('faturamentoAtual'), round(plan.realizadoTotal)],
    [C('mesesDecorridos'), round(numVal(data.mesesDecorridos))],
    [C('metaAnual'), round(numVal(data.metaAnual))],
    [C('ticketMedio'), round(numVal(data.ticketMedio))],
    [C('verbaMidia'), round(numVal(data.verbaMidia))],
    [C('taxaLeadMql'), raw(data.taxaLeadMQL)],
    [C('taxaMqlSql'), raw(data.taxaMQLSQL)],
    [C('taxaSqlVenda'), raw(data.taxaSQLVenda)],
    [],
    [C('indicadores')],
    [C('distribuicao'), plan.distribuicao === 'linear' ? C('distLinear') : plan.distribuicao === 'igual' ? C('distIgual') : C('distComposto')],
    [C('mediaMensal'), round(plan.mediaMensal)],
    [C('projecaoMedia'), round(plan.projetadoMedia)],
    [plan.distribuicao === 'composto' ? C('crescimentoNecessario') : C('crescimentoMedio'), pct(plan.crescimentoRef)],
    ...(plan.distribuicao === 'igual' ? [[C('metaIgual'), round(plan.mesesRestantes > 0 ? plan.gap / plan.mesesRestantes : 0)]] : []),
    [C('gap'), round(plan.gap)],
    [C('investimentoTotal'), round(plan.totals.investimento)],
    [],
    [C('indicador'), ...MONTHS, C('total')],
    [C('metaFaturamento'), ...plan.rows.map(r => round(r.meta)), round(plan.totals.meta)],
    [C('crescimento'), ...plan.rows.map(r => r.crescimento == null ? '' : pct(r.crescimento)), ''],
    [C('novasVendas'), ...plan.rows.map(r => ceil(r.vendas)), ceil(plan.totals.vendas)],
    ['SQLs', ...plan.rows.map(r => ceil(r.sqls)), ceil(plan.totals.sqls)],
    ['MQLs', ...plan.rows.map(r => ceil(r.mqls)), ceil(plan.totals.mqls)],
    ['Leads', ...plan.rows.map(r => ceil(r.leads)), ceil(plan.totals.leads)],
    [C('investimentoMidia'), ...plan.rows.map(r => round(r.investimento)), round(plan.totals.investimento)],
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
  const { t } = useI18n()
  return (
    <tr className="border-b border-rl-border/30 font-semibold">
      <th scope="row" className="sticky left-0 z-10 bg-rl-card text-left py-2.5 pr-4 pl-1 whitespace-nowrap text-xs text-rl-text font-semibold">
        {t('planejamentoMarketing.linhas.metaFaturamento')}
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
                title={t('planejamentoMarketing.realizadoDica')}
                className="w-24 text-right bg-rl-surface border border-rl-border rounded-lg px-2 py-1 text-xs font-mono text-rl-text focus:outline-none focus:border-rl-cyan/60"
              />
            </td>
          )
        }
        return (
          <td key={i} className={`py-2.5 px-3 text-right whitespace-nowrap text-xs font-mono ${v == null ? 'text-rl-muted' : 'text-rl-green'}`}>
            {fmtCurrency(v)}
          </td>
        )
      })}
      <td className="py-2.5 px-3 text-right whitespace-nowrap text-xs font-mono font-bold text-rl-green border-l border-rl-border">
        {fmtCurrency(total)}
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
  const { t } = useI18n()
  const MONTHS = mesesCurtos(t)
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
    { label: t('planejamentoMarketing.kpis.faturamentoAtual'), value: fmtCurrency(plan.realizadoTotal), Icon: DollarSign, color: 'text-rl-text' },
    { label: t('planejamentoMarketing.kpis.mediaMensal', { count: plan.mesesDecorridos }), value: fmtCurrency(plan.mediaMensal), Icon: Calculator, color: 'text-rl-cyan' },
    { label: t('planejamentoMarketing.kpis.metaAnual'), value: fmtCurrency(plan.metaAnual), Icon: Target, color: 'text-rl-green' },
    { label: t('planejamentoMarketing.kpis.projecaoMedia'), value: fmtCurrency(plan.projetadoMedia), Icon: LineChart, color: plan.projetadoMedia >= plan.metaAnual && plan.metaAnual > 0 ? 'text-rl-green' : 'text-rl-gold' },
    plan.distribuicao === 'igual'
      ? { label: t('planejamentoMarketing.kpis.metaIgual'), value: (plan.mesesRestantes > 0 && plan.gap > 0) ? fmtCurrency(plan.gap / plan.mesesRestantes) : '—', Icon: TrendingUp, color: 'text-rl-purple' }
      : { label: plan.distribuicao === 'linear' ? t('planejamentoMarketing.kpis.crescimentoMedio') : t('planejamentoMarketing.kpis.crescimentoNecessario'), value: plan.crescimentoRef != null ? fmtPct(plan.crescimentoRef) : '—', Icon: TrendingUp, color: 'text-rl-purple' },
    { label: t('planejamentoMarketing.kpis.gap'), value: fmtCurrency(plan.gap), Icon: AlertTriangle, color: plan.gap > 0 ? 'text-rl-gold' : 'text-rl-green' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-rl-text flex items-center gap-2">
            <LineChart className="w-5 h-5 text-rl-cyan" />
            {t('planejamentoMarketing.titulo')}
          </h2>
          <p className="text-xs text-rl-muted mt-0.5">
            {t('planejamentoMarketing.subtitulo')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-rl-green">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('comum.salvo')}
            </span>
          )}
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn-secondary inline-flex items-center gap-1.5 text-xs px-3 py-2"
          >
            <Download className="w-3.5 h-3.5" /> {t('planejamentoMarketing.exportarCsv')}
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="btn-secondary inline-flex items-center gap-1.5 text-xs px-3 py-2"
          >
            <FileDown className="w-3.5 h-3.5" /> {t('planejamentoMarketing.baixarPdf')}
          </button>
        </div>
      </div>

      {/* Configuração */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-rl-text">⚙️ {t('planejamentoMarketing.numerosChave')}</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NumField label={t('planejamentoMarketing.campos.faturamentoAtual')} value={data.faturamentoAtual} prefix="R$"
            hint={t('planejamentoMarketing.campos.faturamentoAtualDica')} onChange={e => set('faturamentoAtual', e.target.value)} />
          <NumField label={t('planejamentoMarketing.campos.mesesDecorridos')} value={data.mesesDecorridos} min={1}
            hint={t('planejamentoMarketing.campos.mesesDecorridosDica')} onChange={e => set('mesesDecorridos', e.target.value)} />
          <NumField label={t('planejamentoMarketing.campos.metaAnual')} value={data.metaAnual} prefix="R$"
            hint={t('planejamentoMarketing.campos.metaAnualDica')} onChange={e => set('metaAnual', e.target.value)} />
          <NumField label={t('planejamentoMarketing.campos.ticketMedio')} value={data.ticketMedio} prefix="R$"
            hint={t('planejamentoMarketing.campos.ticketMedioDica')} onChange={e => set('ticketMedio', e.target.value)} />
          <NumField label={t('planejamentoMarketing.campos.verbaMidia')} value={data.verbaMidia} prefix="R$"
            hint={MONTHS[plan.mesesDecorridos]
              ? t('planejamentoMarketing.campos.verbaMidiaDica', { mes: MONTHS[plan.mesesDecorridos] })
              : t('planejamentoMarketing.campos.verbaMidiaDicaAtual')}
            onChange={e => set('verbaMidia', e.target.value)} />
          <NumField label={t('planejamentoMarketing.campos.taxaLeadMql')} value={data.taxaLeadMQL} suffix="%"
            onChange={e => set('taxaLeadMQL', e.target.value)} />
          <NumField label={t('planejamentoMarketing.campos.taxaMqlSql')} value={data.taxaMQLSQL} suffix="%"
            onChange={e => set('taxaMQLSQL', e.target.value)} />
          <NumField label={t('planejamentoMarketing.campos.taxaSqlVenda')} value={data.taxaSQLVenda} suffix="%"
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
            {t('planejamentoMarketing.metaBatida')}
          </span>
        </div>
      )}

      {/* Planilha mês a mês */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h3 className="text-sm font-semibold text-rl-text">📅 {t('planejamentoMarketing.planoMes')}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-rl-muted">{t('planejamentoMarketing.distribuicao')}</span>
            <div className="flex items-center gap-0.5 bg-rl-surface rounded-lg p-0.5 border border-rl-border">
              {[
                { k: 'composto' },
                { k: 'linear' },
                { k: 'igual' },
              ].map(o => (
                <button key={o.k} type="button" title={t(`planejamentoMarketing.dist.${o.k}.dica`)} onClick={() => set('distribuicao', o.k)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    (data.distribuicao || 'composto') === o.k ? 'bg-rl-cyan text-white shadow-glow' : 'text-rl-muted hover:text-rl-text'
                  }`}>
                  {t(`planejamentoMarketing.dist.${o.k}.rotulo`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-rl-muted mb-3">
          {t('planejamentoMarketing.edite')} <b>{t('planejamentoMarketing.dist.composto.rotulo')}</b>{t('planejamentoMarketing.legendaComposto')} · <b>{t('planejamentoMarketing.dist.linear.rotulo')}</b>{t('planejamentoMarketing.legendaLinear')} · <b>{t('planejamentoMarketing.dist.igual.rotulo')}</b>{t('planejamentoMarketing.legendaIgual')}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-rl-border">
                <th className="sticky left-0 z-10 bg-rl-card text-left py-2 pr-4 pl-1 text-rl-muted text-xs font-medium">{t('planejamentoMarketing.indicador')}</th>
                {MONTHS.map((m, i) => (
                  <th key={m} className={`py-2 px-3 text-right text-xs font-medium whitespace-nowrap ${i < plan.mesesDecorridos ? 'text-rl-muted/70' : 'text-rl-text'}`}>{m}</th>
                ))}
                <th className="py-2 px-3 text-right text-xs font-semibold text-rl-cyan whitespace-nowrap border-l border-rl-border">{t('planejamentoMarketing.total')}</th>
              </tr>
            </thead>
            <tbody>
              <MetaRow metaCells={plan.rows.map(r => r.meta)} total={plan.totals.meta}
                mesesDecorridos={plan.mesesDecorridos} realizado={data.realizado} onEdit={setRealizado} />
              <SheetRow label={t('planejamentoMarketing.linhas.crescimento')} mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.crescimento)} total={null}
                format={(v) => v == null ? '—' : fmtPct(v)} accent="text-rl-purple" />
              <SheetRow label={t('planejamentoMarketing.linhas.novasVendas')} mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.vendas)} total={plan.totals.vendas} format={fmtNum} />
              <SheetRow label="SQLs" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.sqls)} total={plan.totals.sqls} format={fmtNum} accent="text-rl-cyan" />
              <SheetRow label="MQLs" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.mqls)} total={plan.totals.mqls} format={fmtNum} accent="text-rl-purple" />
              <SheetRow label="Leads" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.leads)} total={plan.totals.leads} format={fmtNum} accent="text-rl-blue" />
              <SheetRow label={t('planejamentoMarketing.linhas.investimentoMidia')} mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.investimento)} total={plan.totals.investimento}
                format={fmtCurrency} bold accent="text-rl-gold" />
              <SheetRow label="CPL" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.cpl)} total={plan.totals.cpl} format={fmtCurrency} accent="text-rl-blue" />
              <SheetRow label="CPMql" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.cpmql)} total={plan.totals.cpmql} format={fmtCurrency} accent="text-rl-purple" />
              <SheetRow label="CPSql" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.cpsql)} total={plan.totals.cpsql} format={fmtCurrency} accent="text-rl-cyan" />
              <SheetRow label="CAC" mesesDecorridos={plan.mesesDecorridos}
                cells={plan.rows.map(r => r.cac)} total={plan.totals.cac} format={fmtCurrency} accent="text-rl-green" />
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-rl-muted mt-3 flex items-center gap-1.5">
          <Users2 className="w-3 h-3 shrink-0" />
          {t('planejamentoMarketing.rodape1')}
          {' '}{t('planejamentoMarketing.rodape2')}
        </p>
      </div>
    </div>
  )
}
