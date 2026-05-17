// Constantes compartilhadas pelo módulo de Debriefing.

// ─── Status do anúncio ────────────────────────────────────────────────────────
export const STATUS_OPTIONS = [
  {
    id: 'para_subir',
    label: 'Para Subir',
    color: '#64748B',
    bgColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  {
    id: 'em_andamento',
    label: 'Em Andamento',
    color: '#0284C7',
    bgColor: '#E0F2FE',
    borderColor: '#7DD3FC',
  },
  {
    id: 'finalizado',
    label: 'Finalizado',
    color: '#059669',
    bgColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
]

export const STATUS_BY_ID = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.id, s]))

// ─── Resultado do anúncio (quando finalizado) ────────────────────────────────
export const RESULTADO_OPTIONS = [
  { id: 'ruim',      label: 'Ruim',      emoji: '😞', color: '#EF4444', bgColor: '#FEE2E2', borderColor: '#FCA5A5' },
  { id: 'bom',       label: 'Bom',       emoji: '👍', color: '#EAB308', bgColor: '#FEF3C7', borderColor: '#FCD34D' },
  { id: 'excelente', label: 'Excelente', emoji: '🌟', color: '#15803D', bgColor: '#D1FAE5', borderColor: '#6EE7B7' },
]

export const RESULTADO_BY_ID = Object.fromEntries(RESULTADO_OPTIONS.map((r) => [r.id, r]))

// ─── Default status pra novos anúncios ───────────────────────────────────────
export const DEFAULT_STATUS = 'para_subir'

// Helper: formata date string yyyy-mm-dd pra dd/mm/yyyy
export function fmtDateBR(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// Helper: data de hoje no formato yyyy-mm-dd
export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
