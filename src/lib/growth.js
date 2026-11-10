// Movimentação da base de clientes por mês: entradas (novos), saídas (churn)
// e o Net MRR resultante. Fonte única de verdade para os cards de Churn,
// Novos Clientes e Net MRR da home.
//
// Convenções:
// - "entrada" = clientSince (primeiro contrato) → contractDate (assinatura) →
//   createdAt (ver entryDate em lib/utils.js). Renovação muda só a
//   contractDate e não conta como cliente novo.
// - "saída" = churnDate, e só conta quando momento === 'churn'.
// - MRR normalizado por mrrValue (programas de aceleração viram /3).

import { mrrValue, entryDate } from './utils'
import { idiomaAtual, localeAtual } from '../i18n'

// Lista fixa em português, mantida para quem ainda importa. Para exibir, use
// monthName / monthLabel, que seguem o idioma atual (Intl).
export const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// "Setembro" / "September" (mm = 0-11)
export function monthName(mm) {
  return maiuscula(new Intl.DateTimeFormat(localeAtual(), { month: 'long' }).format(new Date(2000, mm, 1)))
}

// "Setembro 2026" / "September 2026"
export function monthLabel(yyyy, mm) {
  return `${monthName(mm)} ${yyyy}`
}

// "set/26" / "Sep/26" — para eixos de gráfico
export function monthLabelShort(yyyy, mm) {
  const curto = new Intl.DateTimeFormat(localeAtual(), { month: 'short' }).format(new Date(2000, mm, 1)).replace('.', '')
  return `${idiomaAtual() === 'pt' ? curto.toLowerCase() : maiuscula(curto)}/${String(yyyy).slice(2)}`
}

// yyyy-mm
export function monthKey(yyyy, mm) {
  return `${yyyy}-${String(mm + 1).padStart(2, '0')}`
}

// Últimos `n` meses terminando em (yyyy, mm), do mais antigo para o mais novo.
export function lastMonths(yyyy, mm, n) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(yyyy, mm - i, 1)
    out.push({ yyyy: d.getFullYear(), mm: d.getMonth() })
  }
  return out
}

// Últimos `n` meses começando no mais recente (para o <select> de período).
export function monthOptions(yyyy, mm, n = 12) {
  const out = []
  for (let i = 0; i < n; i++) {
    const d = new Date(yyyy, mm - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    out.push({ key: monthKey(y, m), yyyy: y, mm: m, label: monthLabel(y, m) })
  }
  return out
}

function churnMillis(p) {
  if (p?.momento !== 'churn' || !p?.churnDate) return NaN
  const t = new Date(p.churnDate + 'T00:00:00').getTime()
  return isNaN(t) ? NaN : t
}

function agg(list) {
  return {
    count:    list.length,
    mrr:      list.reduce((acc, p) => acc + mrrValue(p), 0),
    contract: list.reduce((acc, p) => acc + (Number(p.contractValue) || 0), 0),
    list,
  }
}

// Clientes que ENTRARAM no mês. Inclui quem já churnou depois (a entrada
// aconteceu), para o Net MRR não ficar inflado nem furado.
export function newClientsInMonth(projects, yyyy, mm) {
  return (projects || []).filter(p => {
    const d = entryDate(p)
    return !!d && d.getFullYear() === yyyy && d.getMonth() === mm
  })
}

// Clientes que SAÍRAM no mês.
export function churnedInMonth(projects, yyyy, mm) {
  return (projects || []).filter(p => {
    const t = churnMillis(p)
    if (isNaN(t)) return false
    const d = new Date(t)
    return d.getFullYear() === yyyy && d.getMonth() === mm
  })
}

export function newStats(projects, yyyy, mm) {
  return agg(newClientsInMonth(projects, yyyy, mm))
}

export function churnStats(projects, yyyy, mm) {
  return agg(churnedInMonth(projects, yyyy, mm))
}

// MRR na virada do mês: quem já havia entrado antes do dia 1 e ainda não
// tinha saído. É a base sobre a qual o crescimento do mês é medido.
export function mrrAtMonthStart(projects, yyyy, mm) {
  const start = new Date(yyyy, mm, 1).getTime()
  return (projects || []).reduce((acc, p) => {
    const d = entryDate(p)
    if (!d || d.getTime() >= start) return acc
    const c = churnMillis(p)
    if (!isNaN(c) && c < start) return acc
    return acc + mrrValue(p)
  }, 0)
}

// Retrato completo do mês: entradas, saídas, net e taxa de crescimento.
export function netStats(projects, yyyy, mm) {
  const novos = newStats(projects, yyyy, mm)
  const churn = churnStats(projects, yyyy, mm)
  const mrrInicial = mrrAtMonthStart(projects, yyyy, mm)
  const net = novos.mrr - churn.mrr
  return {
    yyyy, mm,
    label: monthLabel(yyyy, mm),
    labelShort: monthLabelShort(yyyy, mm),
    novos,
    churn,
    net,
    netCount: novos.count - churn.count,
    mrrInicial,
    mrrFinal: mrrInicial + net,
    // % de crescimento líquido sobre a base do início do mês
    growthPct: mrrInicial > 0 ? (net / mrrInicial) * 100 : null,
    // churn de receita sobre a base do início do mês
    churnRatePct: mrrInicial > 0 ? (churn.mrr / mrrInicial) * 100 : null,
  }
}

// Série de netStats para os últimos `n` meses (mais antigo → mais novo).
export function netSeries(projects, yyyy, mm, n = 6) {
  return lastMonths(yyyy, mm, n).map(m => netStats(projects, m.yyyy, m.mm))
}
