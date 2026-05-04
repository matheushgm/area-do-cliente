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

// Parse de date string yyyy-mm-dd ou ISO timestamp.
function _parseDateMillis(iso) {
  if (!iso) return NaN
  const s = typeof iso === 'string' && iso.length === 10 ? iso + 'T00:00:00' : iso
  const t = new Date(s).getTime()
  return isNaN(t) ? NaN : t
}

// LTV histórico de um cliente: MRR × meses entre data de assinatura e
// (a) churnDate, se o cliente já saiu; (b) hoje, caso contrário.
// Retorna 0 quando não há contractDate ou os cálculos resultarem inválidos.
export function calcLTV(project) {
  if (!project) return 0
  const startTime = _parseDateMillis(project.contractDate)
  if (isNaN(startTime)) return 0
  const isChurned = project.momento === 'churn' && project.churnDate
  const endTime = isChurned ? _parseDateMillis(project.churnDate) : Date.now()
  if (isNaN(endTime) || endTime < startTime) return 0
  const months = (endTime - startTime) / 86400000 / 30.4375 // média de dias por mês
  const mrr = mrrValue(project)
  return mrr * months
}

// Meses ativos do contrato (mesma janela usada no calcLTV) — útil pra exibir
// "MRR × N meses" no perfil.
export function activeMonths(project) {
  if (!project) return 0
  const startTime = _parseDateMillis(project.contractDate)
  if (isNaN(startTime)) return 0
  const isChurned = project.momento === 'churn' && project.churnDate
  const endTime = isChurned ? _parseDateMillis(project.churnDate) : Date.now()
  if (isNaN(endTime) || endTime < startTime) return 0
  return (endTime - startTime) / 86400000 / 30.4375
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
