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
  return { id: uid(), name: '', percentage: 0 }
}
