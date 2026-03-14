export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  const num = Number(n)
  if (!isFinite(num)) return '—'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

export function getWeekRanges(year, month) {
  const days = getDaysInMonth(year, month)
  return [
    { label: 'Semana 1', start: 1,  end: Math.min(7,  days) },
    { label: 'Semana 2', start: 8,  end: Math.min(14, days) },
    { label: 'Semana 3', start: 15, end: Math.min(21, days) },
    { label: 'Semana 4', start: 22, end: days },
  ]
}
