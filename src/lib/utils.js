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

// Resolve a data de início do ciclo: contractDate se preenchida,
// senão createdAt como fallback. Retorna { startTime, source } onde
// source é 'contract' | 'created' | null.
function _resolveStart(project) {
  if (!project) return { startTime: NaN, source: null }
  const fromContract = _parseDateMillis(project.contractDate)
  if (!isNaN(fromContract)) return { startTime: fromContract, source: 'contract' }
  const fromCreated = _parseDateMillis(project.createdAt)
  if (!isNaN(fromCreated)) return { startTime: fromCreated, source: 'created' }
  return { startTime: NaN, source: null }
}

// Resolve as duas pontas da janela do contrato (startTime + endTime).
function _resolveWindow(project) {
  const { startTime, source } = _resolveStart(project)
  if (isNaN(startTime)) return { startTime: NaN, endTime: NaN, source: null, isChurned: false }
  const isChurned = project?.momento === 'churn' && !!project?.churnDate
  const endTime = isChurned ? _parseDateMillis(project.churnDate) : Date.now()
  if (isNaN(endTime) || endTime < startTime) return { startTime: NaN, endTime: NaN, source, isChurned }
  return { startTime, endTime, source, isChurned }
}

// Detalhamento do LTV — informa o tipo de cobrança, número de parcelas
// pagas, valor de cada parcela e o LTV total. Usado pela UI para mostrar
// a fórmula correta ("2 cobranças × R$ X" / "Pagamento à vista" / etc).
export function ltvBreakdown(project) {
  if (!project) return null
  const totalContract = Number(project.contractValue) || 0
  if (totalContract <= 0) return null

  const { startTime, endTime, source, isChurned } = _resolveWindow(project)
  if (isNaN(startTime)) return null

  const isAceleracao   = project.contractModel === 'aceleracao'
  const isUnico        = project.contractPaymentType === 'unico'
  const days           = (endTime - startTime) / 86400000

  // ── Programa de Aceleração + Valor Único: cliente paga integral no início.
  if (isAceleracao && isUnico) {
    return {
      kind: 'unico',
      source,
      isChurned,
      ltv: totalContract,
      installmentValue: totalContract,
      cobrancas: 1,
      installments: 1,
      label: 'Pagamento integral à vista',
      explainFormula: '1 pagamento único',
    }
  }

  // Modelo mensal de cobrança: cada 30 dias = nova cobrança.
  // Mês 1 cobrado no dia 0 (assinatura).
  const cobrancasNominais = Math.max(1, Math.floor(days / 30) + 1)

  // ── Programa de Aceleração + Parcelado (3x).
  if (isAceleracao) {
    const cap              = 3
    const cobrancas        = Math.min(cobrancasNominais, cap)
    const installmentValue = totalContract / cap
    return {
      kind: 'aceleracao_parcelado',
      source,
      isChurned,
      ltv: cobrancas * installmentValue,
      installmentValue,
      cobrancas,
      installments: cap,
      label: `Parcela ${cobrancas} de ${cap}`,
      explainFormula: `${cobrancas} de ${cap} parcelas`,
    }
  }

  // ── Assessoria Mensal: cobrança recorrente sem cap.
  return {
    kind: 'assessoria',
    source,
    isChurned,
    ltv: cobrancasNominais * totalContract,
    installmentValue: totalContract,
    cobrancas: cobrancasNominais,
    installments: null, // sem cap
    label: `${cobrancasNominais} ${cobrancasNominais === 1 ? 'cobrança mensal' : 'cobranças mensais'}`,
    explainFormula: `${cobrancasNominais} ${cobrancasNominais === 1 ? 'cobrança' : 'cobranças'}`,
  }
}

// LTV total do cliente: soma de tudo que ele pagou desde o início do contrato
// até hoje (ou até a churnDate, se já saiu). Considera o modelo de contrato:
// - aceleracao + unico:    contractValue (pago integral no início)
// - aceleracao + mensal:   min(meses, 3) × (contractValue / 3)
// - assessoria:            meses × contractValue (sem cap)
// Início do ciclo: contractDate → createdAt como fallback.
export function calcLTV(project) {
  return ltvBreakdown(project)?.ltv ?? 0
}

// Meses ativos do contrato — duração contínua, usada apenas para o label
// descritivo "X meses ativos" no UI (não impacta o LTV).
export function activeMonths(project) {
  const { startTime, endTime } = _resolveWindow(project)
  if (isNaN(startTime)) return 0
  return (endTime - startTime) / 86400000 / 30.4375
}

// Indica se o LTV foi calculado a partir de contractDate ou createdAt.
// Usado para mostrar aviso na UI quando o time ainda não preencheu a
// data de assinatura.
export function ltvStartSource(project) {
  return _resolveStart(project).source
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
