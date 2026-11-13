// Constantes da Central de Landing Pages.
// A aprovação do cliente reusa as constantes/formato da Central de anúncios
// (mesmo ciclo pendente → aprovado/reprovado, mesmos timestamps).
export { APROVACAO_OPTIONS, APROVACAO_BY_ID, fmtDateBR, fmtDateTimeBR, todayISO } from '../Debriefing/debriefingData'
import { t, localeAtual } from '../../i18n'

// ─── Status da landing page ──────────────────────────────────────────────────
export const LP_STATUS_OPTIONS = [
  {
    id: 'em_producao',
    // rótulo no idioma atual (o id é o valor gravado)
    get label() { return t('lpCentral.status.em_producao') },
    color: '#64748B',
    bgColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  {
    id: 'no_ar',
    get label() { return t('lpCentral.status.no_ar') },
    color: '#059669',
    bgColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  {
    id: 'desativada',
    get label() { return t('lpCentral.status.desativada') },
    color: '#B91C1C',
    bgColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
]

export const LP_STATUS_BY_ID = Object.fromEntries(LP_STATUS_OPTIONS.map((s) => [s.id, s]))

export const LP_DEFAULT_STATUS = 'em_producao'

// Rótulo do status de aprovação do cliente (o status gravado continua em pt).
export function rotuloAprovacao(status) {
  return status ? t(`lpCentral.aprovacaoStatus.${status}`) : ''
}

// yyyy-mm-dd → data curta no idioma atual (lida como data local, sem fuso).
export function fmtDataLp(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  if (!m) return '—'
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(localeAtual(), { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Timestamp ISO → "data às hora" no idioma atual (registros de aprovação).
export function fmtDataHoraLp(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const loc = localeAtual()
  return t('lpCentral.dataHora', {
    data: d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }),
  })
}
