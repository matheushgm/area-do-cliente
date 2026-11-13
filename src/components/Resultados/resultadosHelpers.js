import { fmtCurrency } from '../../lib/utils'
import { t, idiomaAtual, localeAtual } from '../../i18n'
// Nomes em português: quem lê o PDF e o ROI ainda usa este array; na tela, use nomeMes().
export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Nome do mês (0-11) no idioma da tela, com inicial maiúscula.
export function nomeMes(m) {
  if (idiomaAtual() === 'pt') return MONTH_NAMES[m]
  const s = new Date(2000, m, 1).toLocaleDateString(localeAtual(), { month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// "dia/mês" no formato do idioma (pt 5/3, en 3/5). `pad` = dois dígitos (05/03).
export function diaMes(dia, mes0, pad = false) {
  const f = (n) => (pad ? String(n).padStart(2, '0') : String(n))
  return idiomaAtual() === 'pt' ? `${f(dia)}/${f(mes0 + 1)}` : `${f(mes0 + 1)}/${f(dia)}`
}

export const fmtMoney = (n) => fmtCurrency(n, 2)

// Sem centavos — usado em painéis densos (scorecards) onde precisão de
// centavos só atrapalha a leitura rápida.
export function fmtMoneyShort(n) {
  if (!n && n !== 0) return '—'
  const num = Number(n)
  if (!isFinite(num)) return '—'
  return num.toLocaleString(localeAtual(), { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function fmtPct(a, b) {
  if (!b || b === 0) return '—'
  return ((a / b) * 100).toFixed(1) + '%'
}

export function parseMoney(str) {
  if (!str && str !== 0) return 0
  return parseFloat(String(str).replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// Dia da semana abreviado ("seg", "ter"…) de um dia do mês. `month` é 0-based.
export function weekdayShort(year, month, day) {
  const d = new Date(year, month, day)
  if (idiomaAtual() === 'pt') return WEEKDAYS_SHORT[d.getDay()]
  return d.toLocaleDateString(localeAtual(), { weekday: 'short' })
}

// Plano MENSAL derivado da Calculadora de ROI (mesmas fórmulas do
// ROICalculator.jsx). É a "meta" contra a qual o realizado é comparado.
// Retorna null quando não há roiCalc ou o lucro por venda é zero.
export function computeRoiPlan(roiCalc) {
  if (!roiCalc) return null
  const {
    mediaOrcamento = 0, custoMarketing = 0, ticketMedio = 0, qtdCompras = 1,
    margemBruta = 40, roiDesejado = 0,
    taxaLead2MQL = 30, taxaMQL2SQL = 50, taxaSQL2Venda = 20,
  } = roiCalc

  const totalInvestimento = mediaOrcamento + custoMarketing
  const lucroPorVenda     = ticketMedio * qtdCompras * (margemBruta / 100)
  if (!lucroPorVenda) return null

  const retornoAlvo = totalInvestimento * (1 + roiDesejado / 100)
  const vendas = Math.ceil(retornoAlvo / lucroPorVenda)
  const sql    = taxaSQL2Venda        ? Math.ceil(vendas / (taxaSQL2Venda / 100)) : null
  const mql    = taxaMQL2SQL  && sql  ? Math.ceil(sql    / (taxaMQL2SQL  / 100))  : null
  const leads  = taxaLead2MQL && mql  ? Math.ceil(mql    / (taxaLead2MQL / 100))  : null

  return {
    mediaOrcamento, custoMarketing, totalInvestimento, ticketMedio, roiDesejado,
    leads, mql, sql, vendas,
    faturamento: vendas * ticketMedio * qtdCompras,
    // CPL/CPMQL/CPSQL usam só a verba de mídia; o CAC inclui o fee de gestão —
    // mesma convenção da Calculadora de ROI.
    cpl:   leads  ? mediaOrcamento   / leads  : null,
    cpMql: mql    ? mediaOrcamento   / mql    : null,
    cpSql: sql    ? mediaOrcamento   / sql    : null,
    cac:   vendas ? totalInvestimento / vendas : null,
  }
}

export function getWeekRanges(year, month) {
  const days = getDaysInMonth(year, month)
  return [
    { label: t('resultados.semana', { n: 1 }), start: 1,  end: Math.min(7,  days) },
    { label: t('resultados.semana', { n: 2 }), start: 8,  end: Math.min(14, days) },
    { label: t('resultados.semana', { n: 3 }), start: 15, end: Math.min(21, days) },
    { label: t('resultados.semana', { n: 4 }), start: 22, end: days },
  ]
}

// O PDF (src/utils/exportPDF.js) ainda é só em português: as semanas vão com o rótulo em pt.
export const semanasPdf = (ranges) => ranges.map((w, i) => ({ ...w, label: `Semana ${i + 1}` }))
