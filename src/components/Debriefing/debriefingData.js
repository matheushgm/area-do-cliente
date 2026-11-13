import { todayISO } from '../../lib/utils'
import { t, localeAtual } from '../../i18n'
// Constantes compartilhadas pelo módulo de Debriefing.
// Os rótulos (`label`, `desc`, `rotulo`) saem no idioma atual a cada leitura
// (locales/{pt,en}/central.js); o `id` é o valor gravado em debriefing.ads[] e não muda.
// Também servem o portal, /aprovacao/:token e a Central de LPs.

// ─── Status do anúncio ────────────────────────────────────────────────────────
export const STATUS_OPTIONS = [
  {
    // Copy enviada pro cliente na leva de Criativos com IA: o anúncio existe,
    // mas a peça ainda não foi produzida.
    id: 'rascunho',
    get label() { return t('central.status.rascunho') },
    color: '#475569',
    bgColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  {
    // Copy aprovada pelo cliente no link da leva (Criativos com IA) — o anúncio
    // entra na central já nessa fila, esperando o designer produzir a peça.
    id: 'aprovado_edicao',
    get label() { return t('central.status.aprovado_edicao') },
    color: '#7C3AED',
    bgColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
  {
    id: 'para_subir',
    get label() { return t('central.status.para_subir') },
    color: '#64748B',
    bgColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  {
    id: 'em_andamento',
    get label() { return t('central.status.em_andamento') },
    color: '#0284C7',
    bgColor: '#E0F2FE',
    borderColor: '#7DD3FC',
  },
  {
    id: 'finalizado',
    get label() { return t('central.status.finalizado') },
    color: '#059669',
    bgColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
]

export const STATUS_BY_ID = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.id, s]))

// ─── Resultado do anúncio (quando finalizado) ────────────────────────────────
export const RESULTADO_OPTIONS = [
  { id: 'ruim',      get label() { return t('central.resultado.ruim') },      emoji: '😞', color: '#EF4444', bgColor: '#FEE2E2', borderColor: '#FCA5A5' },
  { id: 'bom',       get label() { return t('central.resultado.bom') },       emoji: '👍', color: '#EAB308', bgColor: '#FEF3C7', borderColor: '#FCD34D' },
  { id: 'excelente', get label() { return t('central.resultado.excelente') }, emoji: '🌟', color: '#15803D', bgColor: '#D1FAE5', borderColor: '#6EE7B7' },
]

export const RESULTADO_BY_ID = Object.fromEntries(RESULTADO_OPTIONS.map((r) => [r.id, r]))

// ─── Default status pra novos anúncios ───────────────────────────────────────
export const DEFAULT_STATUS = 'para_subir'

// Status de quem nasce de uma copy enviada pra aprovação em Criativos com IA.
export const DRAFT_STATUS = 'rascunho'

// ─── Etapas da central (as duas abas) ────────────────────────────────────────
// A etapa é DERIVADA do anúncio, não um campo — assim nada fica fora de lugar
// quando o designer anexa a peça. Tem mídia (link ou anexo) = design pronto;
// sem mídia, é copy que foi pro cliente e ainda espera virar peça.
export const ETAPAS = [
  { id: 'design',    get label() { return t('central.etapas.design.label') },    get desc() { return t('central.etapas.design.desc') } },
  { id: 'aprovacao', get label() { return t('central.etapas.aprovacao.label') }, get desc() { return t('central.etapas.aprovacao.desc') } },
]

export function etapaDoAd(ad) {
  if ((ad?.url || '').trim() || ad?.attachmentPath) return 'design'
  return 'aprovacao'
}

// ─── Mês de criação (blocos por mês dentro de cada aba) ─────────────────────
// "Outubro 2026" / "October 2026", no idioma atual.
function nomeDoMes(ano, mes) {
  const nome = new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString(localeAtual(), { month: 'long' })
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${ano}`
}

// Data (yyyy-mm-dd) em que o criativo foi criado: a "Data de criação" do
// cadastro (createdAt). Se faltar, o dia local em que ele entrou na central
// (addedAt, timestamp ISO). Sem nenhuma das duas, null.
export function dataDoAd(ad) {
  const criado = String(ad?.createdAt || '')
  if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}/.test(criado)) return criado.slice(0, 10)
  const d = ad?.addedAt ? new Date(ad.addedAt) : null
  if (!d || Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Agrupa os anúncios pelo mês de criação, do mais recente pro mais antigo,
// com "Sem data" no fim. Dentro do mês, mantém a ordem recebida.
export function agruparPorMes(ads) {
  const porMes = new Map()
  for (const ad of ads) {
    const chave = dataDoAd(ad)?.slice(0, 7) || null
    if (!porMes.has(chave)) porMes.set(chave, [])
    porMes.get(chave).push(ad)
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => (a === null) - (b === null) || (b || '').localeCompare(a || ''))
    .map(([chave, lista]) => {
      const [ano, mes] = (chave || '').split('-')
      return { chave, rotulo: chave ? nomeDoMes(ano, mes) : t('central.semData'), ads: lista }
    })
}

// ─── Semana do mês (blocos dentro do mês) ────────────────────────────────────
// Semana de domingo a sábado, contada dentro do mês: a Semana 1 vai do dia 1 até
// o primeiro sábado. É a semana do calendário do VertaTask, e a rotina de
// roteiros do Escritório roda aos domingos, então cada leva cai numa semana só.
// "01/11" (pt) / "11/01" (en).
function diaMes(ano, mes, dia) {
  return new Date(ano, mes - 1, dia).toLocaleDateString(localeAtual(), { day: '2-digit', month: '2-digit' })
}

export function semanaDoMes(iso) {
  const [ano, mes, dia] = String(iso || '').slice(0, 10).split('-').map(Number)
  if (!ano || !mes || !dia) return null
  const recuo = new Date(ano, mes - 1, 1).getDay() // 0 = o mês começa num domingo
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const n = Math.floor((dia - 1 + recuo) / 7) + 1
  const dd = (d) => String(d).padStart(2, '0')
  const inicio = Math.max(1, (n - 1) * 7 + 1 - recuo)
  const fim = Math.min(diasNoMes, n * 7 - recuo)
  return {
    chave: `${ano}-${dd(mes)}|s${n}`,
    n,
    periodo: inicio === fim ? diaMes(ano, mes, inicio) : t('central.periodo', { de: diaMes(ano, mes, inicio), ate: diaMes(ano, mes, fim) }),
  }
}

// Agrupa os anúncios de UM mês por semana, da mais recente pra mais antiga.
// Dentro da semana, mantém a ordem recebida.
export function agruparPorSemana(ads) {
  const porSemana = new Map()
  for (const ad of ads || []) {
    const s = semanaDoMes(dataDoAd(ad))
    if (!s) continue
    if (!porSemana.has(s.chave)) porSemana.set(s.chave, { ...s, rotulo: t('central.semanaN', { n: s.n }), ads: [] })
    porSemana.get(s.chave).ads.push(ad)
  }
  return [...porSemana.values()].sort((a, b) => b.n - a.n)
}

// ─── Pastas (organização dentro do mês) ──────────────────────────────────────
// ad.pasta é só um nome (texto); a mesma pasta pode ter anúncios de vários meses.
export function normalizarPasta(v) {
  return String(v || '').trim().replace(/\s+/g, ' ').slice(0, 60)
}

const porNomeDaPasta = (a, b) => a.localeCompare(b, localeAtual(), { numeric: true, sensitivity: 'base' })

// Pastas que já existem no projeto, em ordem alfabética (sugestão nos campos).
export function pastasDoProjeto(ads) {
  return [...new Set((ads || []).map((ad) => normalizarPasta(ad?.pasta)).filter(Boolean))].sort(porNomeDaPasta)
}

// Agrupa por pasta, em ordem alfabética, com os sem pasta no fim ("Sem pasta").
// Dentro da pasta, mantém a ordem recebida.
export function agruparPorPasta(ads) {
  const porPasta = new Map()
  for (const ad of ads || []) {
    const pasta = normalizarPasta(ad?.pasta) || null
    if (!porPasta.has(pasta)) porPasta.set(pasta, [])
    porPasta.get(pasta).push(ad)
  }
  return [...porPasta.entries()]
    .sort(([a], [b]) => (a === null) - (b === null) || (a && b ? porNomeDaPasta(a, b) : 0))
    .map(([pasta, lista]) => ({ pasta, rotulo: pasta || t('central.semPasta'), ads: lista }))
}

// ─── Aprovação do cliente (link público /aprovacao/:token) ───────────────────
// Guardada em ad.aprovacao = { status, motivo, sugestao, decididoEm }.
// Anúncio sem ad.aprovacao = nunca foi enviado pro cliente.
export const APROVACAO_OPTIONS = [
  { id: 'pendente',  get label() { return t('central.aprovacao.pendente') }, color: '#B45309', bgColor: '#FEF3C7', borderColor: '#FCD34D' },
  { id: 'aprovado',  get label() { return t('central.aprovacao.aprovado') },   color: '#15803D', bgColor: '#D1FAE5', borderColor: '#6EE7B7' },
  { id: 'reprovado', get label() { return t('central.aprovacao.reprovado') },  color: '#B91C1C', bgColor: '#FEE2E2', borderColor: '#FCA5A5' },
]

export const APROVACAO_BY_ID = Object.fromEntries(APROVACAO_OPTIONS.map((a) => [a.id, a]))

// Helper: formata date string yyyy-mm-dd pra dd/mm/yyyy (mm/dd/yyyy em inglês)
const DATA_CURTA = { day: '2-digit', month: '2-digit', year: 'numeric' }
export function fmtDateBR(iso) {
  if (!iso) return '—'
  // yyyy-mm-dd puro é lido como data local: new Date('2026-09-01') é meia-noite
  // UTC, que no Brasil ainda é 31/08, e a data saía um dia antes.
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (dia) return new Date(Number(dia[1]), Number(dia[2]) - 1, Number(dia[3])).toLocaleDateString(localeAtual(), DATA_CURTA)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(localeAtual(), DATA_CURTA)
}

export { todayISO }

// Helper: timestamp ISO completo → "dd/mm/yyyy às HH:MM" no fuso local.
// Usado nos registros de aprovação (enviadoEm / decididoEm).
export function fmtDateTimeBR(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return t('central.dataHora', { data: d.toLocaleDateString(localeAtual(), DATA_CURTA), hora: `${hh}:${mi}` })
}
