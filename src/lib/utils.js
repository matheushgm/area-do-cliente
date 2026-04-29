// Funções utilitárias puras compartilhadas entre páginas e componentes

export function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')
}

// n == null cobre tanto null quanto undefined sem tratar 0 como inválido
export function fmtCurrency(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// MRR normalizado: programas (contractModel === 'aceleracao') são contratos
// fechados divididos em 3 meses; assessoria mensal já é cobrança recorrente
// e mantém o contractValue cheio.
export function mrrValue(p) {
  const v = Number(p?.contractValue) || 0
  return p?.contractModel === 'aceleracao' ? v / 3 : v
}

// Lista de e-mails autorizados a ver o relatório /squads-report.
// Restrito a sócios — Matheus Martins e Eduardo Moura.
const SQUADS_REPORT_EMAILS = new Set([
  'matheus@revenuelab.com.br',
  'eduardo@revenuelab.com.br',
])

export function canViewSquadsReport(user) {
  if (!user?.email) return false
  return SQUADS_REPORT_EMAILS.has(String(user.email).toLowerCase().trim())
}

// Compatível com IDs numéricos legados e UUIDs
export function hashId(id) {
  if (!id) return 0
  const n = Number(id)
  return !isNaN(n) && isFinite(n) ? n : String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}
