// Constantes compartilhadas pelo módulo de Debriefing.

// ─── Status do anúncio ────────────────────────────────────────────────────────
export const STATUS_OPTIONS = [
  {
    // Copy recém-gerada em Criativos com IA: existe na central, mas nunca foi
    // pro cliente nem pro ar. É o estoque de onde saem as levas de aprovação.
    id: 'rascunho',
    label: 'Rascunho',
    color: '#475569',
    bgColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
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

// Status de quem nasce de uma copy gerada em Criativos com IA.
export const DRAFT_STATUS = 'rascunho'

// ─── Etapas da central (as três abas) ────────────────────────────────────────
// A etapa é DERIVADA do anúncio, não um campo — assim nada fica fora de lugar
// quando o designer anexa a peça ou o cliente responde. Cada anúncio aparece em
// exatamente uma aba, nesta ordem de precedência:
//   1. tem algo pendente com o cliente (copy ou peça) → Ads para aprovação
//   2. tem mídia (link ou anexo)                      → Design pronto
//   3. resto                                          → Ads em rascunho
export const ETAPAS = [
  { id: 'design',    label: 'Design pronto',     desc: 'Peças que o designer já subiu, prontas pra rodar.' },
  { id: 'aprovacao', label: 'Ads para aprovação', desc: 'Esperando o cliente responder, seja a copy ou a peça.' },
  { id: 'rascunho',  label: 'Ads em rascunho',    desc: 'Copies que ainda não foram pro cliente nem pro ar.' },
]

export function etapaDoAd(ad) {
  const copyPendente = (ad?.copyAprovacao?.status || '') === 'pendente'
  const midiaPendente = (ad?.aprovacao?.status || '') === 'pendente'
  if (copyPendente || midiaPendente) return 'aprovacao'
  if ((ad?.url || '').trim() || ad?.attachmentPath) return 'design'
  return 'rascunho'
}

// Anúncio que pode entrar numa leva de aprovação de copy: tem texto e não está
// com o cliente agora.
export function podeEnviarCopy(ad) {
  return !!(ad?.copy || '').trim() && (ad?.copyAprovacao?.status || '') !== 'pendente'
}

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
