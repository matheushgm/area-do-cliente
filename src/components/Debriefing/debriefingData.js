// Constantes compartilhadas pelo módulo de Debriefing.

// ─── Status do anúncio ────────────────────────────────────────────────────────
export const STATUS_OPTIONS = [
  {
    // Copy aprovada pelo cliente no link da leva (Criativos com IA) — o anúncio
    // entra na central já nessa fila, esperando o designer produzir a peça.
    id: 'aprovado_edicao',
    label: 'Aprovado para Edição',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
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

// ─── Aprovação do cliente (link público /aprovacao/:token) ───────────────────
// Guardada em ad.aprovacao = { status, motivo, sugestao, decididoEm }.
// Anúncio sem ad.aprovacao = nunca foi enviado pro cliente.
export const APROVACAO_OPTIONS = [
  { id: 'pendente',  label: 'Aguardando', color: '#B45309', bgColor: '#FEF3C7', borderColor: '#FCD34D' },
  { id: 'aprovado',  label: 'Aprovado',   color: '#15803D', bgColor: '#D1FAE5', borderColor: '#6EE7B7' },
  { id: 'reprovado', label: 'Reprovado',  color: '#B91C1C', bgColor: '#FEE2E2', borderColor: '#FCA5A5' },
]

export const APROVACAO_BY_ID = Object.fromEntries(APROVACAO_OPTIONS.map((a) => [a.id, a]))

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

// Helper: timestamp ISO completo → "dd/mm/yyyy às HH:MM" no fuso local.
// Usado nos registros de aprovação (enviadoEm / decididoEm).
export function fmtDateTimeBR(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} às ${hh}:${mi}`
}
