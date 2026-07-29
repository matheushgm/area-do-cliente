// Constantes da Central de Landing Pages.
// A aprovação do cliente reusa as constantes/formato da Central de anúncios
// (mesmo ciclo pendente → aprovado/reprovado, mesmos timestamps).
export { APROVACAO_OPTIONS, APROVACAO_BY_ID, fmtDateBR, fmtDateTimeBR, todayISO } from '../Debriefing/debriefingData'

// ─── Status da landing page ──────────────────────────────────────────────────
export const LP_STATUS_OPTIONS = [
  {
    id: 'em_producao',
    label: 'Em Produção',
    color: '#64748B',
    bgColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  {
    id: 'no_ar',
    label: 'No Ar',
    color: '#059669',
    bgColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  {
    id: 'desativada',
    label: 'Desativada',
    color: '#B91C1C',
    bgColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
]

export const LP_STATUS_BY_ID = Object.fromEntries(LP_STATUS_OPTIONS.map((s) => [s.id, s]))

export const LP_DEFAULT_STATUS = 'em_producao'
