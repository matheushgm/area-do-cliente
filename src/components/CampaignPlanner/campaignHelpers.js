export const CHANNEL_OPTIONS = ['Meta Ads', 'Google Ads', 'LinkedIn Ads', 'TikTok Ads', 'YouTube Ads']

export const STAGE_KEYS = ['topo', 'meio', 'fundo']

export const STAGE_META = {
  topo:  { label: 'Topo de Funil',  colorClass: 'text-rl-cyan',   bgClass: 'bg-rl-cyan/10',   borderClass: 'border-rl-cyan/20'   },
  meio:  { label: 'Meio de Funil',  colorClass: 'text-rl-purple', bgClass: 'bg-rl-purple/10', borderClass: 'border-rl-purple/20' },
  fundo: { label: 'Fundo de Funil', colorClass: 'text-rl-green',  bgClass: 'bg-rl-green/10',  borderClass: 'border-rl-green/20'  },
}

export function getDaysLeft() {
  const today   = new Date()
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return Math.max(lastDay.getDate() - today.getDate() + 1, 1)
}

export function getMonthLabel() {
  return new Date()
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase())
}

// Último dia do mês corrente em formato ISO yyyy-mm-dd (default da data final).
export function defaultEndDateISO() {
  const today   = new Date()
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const yyyy = lastDay.getFullYear()
  const mm   = String(lastDay.getMonth() + 1).padStart(2, '0')
  const dd   = String(lastDay.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Hoje em ISO yyyy-mm-dd (mín. permitido para a data final).
export function todayISO() {
  const t = new Date()
  const yyyy = t.getFullYear()
  const mm   = String(t.getMonth() + 1).padStart(2, '0')
  const dd   = String(t.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Dias restantes de hoje até a data final inclusive (mín. 1).
export function getDaysUntil(endDateISO) {
  if (!endDateISO) return getDaysLeft()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDateISO + 'T00:00:00')
  const diff = Math.round((end.getTime() - today.getTime()) / 86400000) + 1
  return Math.max(diff, 1)
}

// Dias entre data de início e data final, inclusive (mín. 1). Se startISO for
// passado, conta a partir de hoje (não vamos espalhar orçamento em dias já
// vencidos). Se for futuro, conta a partir do startISO.
export function getDaysBetween(startISO, endISO) {
  if (!endISO) return getDaysLeft()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = startISO ? new Date(startISO + 'T00:00:00') : today
  if (start < today) start.setTime(today.getTime())
  const end = new Date(endISO + 'T00:00:00')
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  return Math.max(diff, 1)
}

// Label PT-BR para o período do planejamento.
// - Se start = hoje e end = último dia do mês corrente → "Maio 2026" (legado)
// - Se start = hoje e end ≠ último dia → "até DD/MM/YYYY"
// - Caso contrário → "DD/MM até DD/MM/YYYY"
export function getPeriodLabel(startDateISO, endDateISO) {
  if (!endDateISO) return getMonthLabel()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayKey = todayISO()
  const isFromToday = !startDateISO || startDateISO === todayKey
  const end = new Date(endDateISO + 'T00:00:00')
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const endIsLastOfMonth =
    end.getFullYear() === lastOfMonth.getFullYear() &&
    end.getMonth() === lastOfMonth.getMonth() &&
    end.getDate() === lastOfMonth.getDate()

  if (isFromToday && endIsLastOfMonth) {
    return end.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      .replace(/^./, (c) => c.toUpperCase())
  }
  if (isFromToday) {
    return `até ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
  }
  const start = new Date(startDateISO + 'T00:00:00')
  return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} até ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
}

// Mantida para compat — agora delega para getPeriodLabel.
export function getEndDateLabel(endDateISO) {
  return getPeriodLabel(null, endDateISO)
}

export function fmtBRL(n) {
  if (n == null || !isFinite(n) || isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export function makeChannel(name = '') {
  return {
    id: uid(),
    name,
    percentage: 0,
    expanded: true,
    stages: {
      topo:  { percentage: 0, campaigns: [] },
      meio:  { percentage: 0, campaigns: [] },
      fundo: { percentage: 0, campaigns: [] },
    },
  }
}

export function makeCampaign() {
  return { id: uid(), name: '', percentage: 0, startDate: null, endDate: null }
}

// Label compacto de período da campanha (ex: "26/05 → 28/05").
export function formatCampaignPeriod(startISO, endISO) {
  if (!startISO || !endISO) return null
  const fmt = (iso) => {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }
  return `${fmt(startISO)} → ${fmt(endISO)}`
}
