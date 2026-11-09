// Diagnóstico de viabilidade da Oferta Matadora.
// Avalia 5 pilares e devolve um veredito final: cabe / cabe com ajustes / não cabe.
// Sem dependência de React — usado pelo Panel e pelo PDF.
//
// Os textos (pilares, vereditos, perguntas, opções e justificativas) moram em
// src/i18n/locales/{pt,en}/kickoffPerguntas.js, em `om`, e viram getters no fim do
// arquivo (mesmo esquema do KickoffQuestions). Ids, valores de opção e scores ficam aqui.
import { t } from '../../i18n'
import { ligarCampo, ligarTextos, textoPt, textosPt } from './KickoffQuestions'

/** Texto do diagnóstico de Oferta Matadora sempre em português (o que é gravado). */
export function textoOmPt(caminho) {
  return textoPt(`om.${caminho}`)
}

// ─── Os 5 pilares ─────────────────────────────────────────────────────────────
export const OM_PILLARS = [
  { id: 'dor_latente' },
  { id: 'poder_compra' },
  { id: 'encontrar_online' },
  { id: 'mercado_expansao' },
  { id: 'consciencia_autoridade' },
]

export const OM_PILLARS_BY_ID = Object.fromEntries(OM_PILLARS.map((p) => [p.id, p]))

// ─── Veredito ─────────────────────────────────────────────────────────────────
// Score geral × veredito + cor + frase de chamada
export const OM_VERDICTS = [
  {
    id: 'cabe',
    range: [75, 100],
    color: '#15803D',
    emoji: '✅',
  },
  {
    id: 'talvez',
    range: [50, 74],
    color: '#EAB308',
    emoji: '⚠️',
  },
  {
    id: 'nao_cabe',
    range: [0, 49],
    color: '#EF4444',
    emoji: '❌',
  },
]

export function getVerdict(score) {
  for (const v of OM_VERDICTS) {
    if (score >= v.range[0] && score <= v.range[1]) return v
  }
  return OM_VERDICTS[OM_VERDICTS.length - 1]
}

// ─── Perguntas ────────────────────────────────────────────────────────────────
// Cada pergunta mapeia para 1 pilar. Score é direto pelas opções.
// Nota importante: em "consciencia_mercado" e "autoridade_marca" a lógica
// é INVERTIDA — quanto MENOR a consciência/autoridade, MAIOR o score (porque
// é o cenário ideal pra oferta matadora). O texto deixa isso claro.
export const OM_QUESTIONS = [
  // ── Pilar 1: Dor latente ───────────────────────────────────────────────────
  {
    id: 'om_dor_latente',
    pillarId: 'dor_latente',
    type: 'single',
    options: [
      { value: 'aguda',     score: 100 },
      { value: 'percebida', score: 75  },
      { value: 'media',     score: 50  },
      { value: 'baixa',     score: 25  },
      { value: 'inexistente', score: 0   },
    ],
  },

  // ── Pilar 2: Poder de compra ───────────────────────────────────────────────
  {
    id: 'om_poder_compra',
    pillarId: 'poder_compra',
    type: 'single',
    options: [
      { value: 'alto_b2b',    score: 100 },
      { value: 'alto_b2c',    score: 100 },
      { value: 'medio_b2b',   score: 70  },
      { value: 'medio_b2c',   score: 65  },
      { value: 'baixo_b2c',   score: 30  },
      { value: 'desconhecido', score: 40  },
    ],
  },

  // ── Pilar 3: Facilidade de encontrar online ────────────────────────────────
  {
    id: 'om_encontrar_online',
    pillarId: 'encontrar_online',
    type: 'single',
    options: [
      { value: 'super',  score: 100 },
      { value: 'bom',    score: 70  },
      { value: 'fraco',  score: 35  },
      { value: 'invisivel', score: 5   },
    ],
  },

  // ── Pilar 4: Mercado em expansão ───────────────────────────────────────────
  {
    id: 'om_mercado_expansao',
    pillarId: 'mercado_expansao',
    type: 'single',
    options: [
      { value: 'forte_expansao', score: 100 },
      { value: 'moderada',       score: 75  },
      { value: 'estavel',        score: 50  },
      { value: 'retracao_leve',  score: 25  },
      { value: 'retracao_forte', score: 0   },
    ],
  },

  // ── Pilar 5a: Consciência do mercado ───────────────────────────────────────
  // Lógica invertida: BAIXA consciência = score ALTO (ideal pra oferta matadora)
  {
    id: 'om_consciencia',
    pillarId: 'consciencia_autoridade',
    type: 'single',
    options: [
      { value: 'inconsciente',  score: 100 },
      { value: 'problema',      score: 80  },
      { value: 'solucao',       score: 55  },
      { value: 'produto',       score: 25  },
      { value: 'pronto',         score: 0   },
    ],
  },

  // ── Pilar 5b: Autoridade da marca ──────────────────────────────────────────
  // Lógica invertida: BAIXA autoridade = score ALTO (ideal pra oferta matadora)
  {
    id: 'om_autoridade',
    pillarId: 'consciencia_autoridade',
    type: 'single',
    options: [
      { value: 'desconhecida', score: 100 },
      { value: 'pouca',        score: 85  },
      { value: 'media',        score: 50  },
      { value: 'consolidada',  score: 30  },
      { value: 'lider',         score: 10  },
    ],
  },
]

// ─── Scoring ──────────────────────────────────────────────────────────────────
// Retorna: { scores: {pillarId: 0..100}, totalScore: 0..100, verdict: {...} }
export function computeOmDiagnosis(answers = {}) {
  const acc = {}
  for (const p of OM_PILLARS) acc[p.id] = { sum: 0, count: 0 }

  for (const q of OM_QUESTIONS) {
    const ans = answers[q.id]
    if (ans == null || ans === '') continue
    const opt = (q.options || []).find((o) => o.value === ans)
    const score = opt ? Number(opt.score) || 0 : 0
    if (acc[q.pillarId]) {
      acc[q.pillarId].sum += score
      acc[q.pillarId].count += 1
    }
  }

  const scores = {}
  for (const p of OM_PILLARS) {
    const { sum, count } = acc[p.id]
    scores[p.id] = count > 0 ? Math.round(sum / count) : 0
  }

  // Score geral = média simples dos 5 pilares
  const values = OM_PILLARS.map((p) => scores[p.id])
  const totalScore = values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : 0

  // Conta quantas perguntas foram respondidas
  const answeredCount = OM_QUESTIONS.filter((q) => {
    const a = answers[q.id]
    return a != null && a !== ''
  }).length

  const verdict = getVerdict(totalScore)

  return {
    scores,
    totalScore,
    verdict,
    answeredCount,
    totalQuestions: OM_QUESTIONS.length,
  }
}

// ─── Texto da justificativa de cada pilar (pra UI e PDF) ──────────────────────
const NIVEIS_JUSTIFICATIVA = [
  { min: 75, nivel: 'favoravel', color: '#15803D' },
  { min: 50, nivel: 'atencao',   color: '#EAB308' },
  { min: -Infinity, nivel: 'risco', color: '#EF4444' },
]

export function pillarJustification(pillarId, score) {
  const { nivel, color } = NIVEIS_JUSTIFICATIVA.find((n) => score >= n.min)
  const base = `kickoffPerguntas.om.justificativas.${nivel}`
  return {
    tag: t(`${base}.tag`),
    color,
    text: textosPt(`om.justificativas.${nivel}`)[pillarId] != null ? t(`${base}.${pillarId}`) : '',
  }
}

// ─── Textos traduzidos (getters) ──────────────────────────────────────────────
function ligarTextosOm() {
  const NS = 'kickoffPerguntas.om'
  for (const p of OM_PILLARS) ligarTextos(p, textosPt(`om.pilares.${p.id}`), `${NS}.pilares.${p.id}`)
  for (const v of OM_VERDICTS) ligarTextos(v, textosPt(`om.vereditos.${v.id}`), `${NS}.vereditos.${v.id}`)
  for (const q of OM_QUESTIONS) {
    const base = `${NS}.perguntas.${q.id}`
    const tx = textosPt(`om.perguntas.${q.id}`)
    ligarTextos(q, tx, base)
    for (const o of q.options || []) {
      if (tx.opcoes?.[o.value] != null) ligarCampo(o, 'label', `${base}.opcoes.${o.value}`)
    }
  }
}
ligarTextosOm()
