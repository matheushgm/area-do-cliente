// Engine puro de scoring do diagnóstico Kickoff.
// Sem dependência de React. Recebe respostas + lista de perguntas e devolve
// scores por pilar, score geral, estágio e próximos passos.

import { PILLARS, getStage, NEXT_STEPS } from './KickoffQuestions'

// ─── Score de uma única resposta ──────────────────────────────────────────────
// Retorna número 0-100 ou null se a pergunta não está respondida.
export function extractScore(question, answer) {
  if (question == null) return null

  // não respondida (null/undefined/'' ou array vazio)
  const isEmpty =
    answer == null ||
    answer === '' ||
    (Array.isArray(answer) && answer.length === 0)
  if (isEmpty) return null

  const { type, options, scoreFn } = question

  switch (type) {
    case 'single':
    case 'yesno':
    case 'scale': {
      const opt = (options || []).find((o) => o.value === answer)
      return opt ? Number(opt.score) || 0 : 0
    }

    case 'multi': {
      // Se o autor da pergunta especificou scoreFn, usa ele (ex: countScore).
      if (typeof scoreFn === 'function') return clamp(scoreFn(answer))
      // Caso contrário, média dos scores das opções marcadas.
      const arr = Array.isArray(answer) ? answer : []
      if (!arr.length) return null
      const sum = arr.reduce((acc, v) => {
        const opt = (options || []).find((o) => o.value === v)
        return acc + (opt ? Number(opt.score) || 0 : 0)
      }, 0)
      return clamp(sum / arr.length)
    }

    case 'number':
    case 'money':
    case 'text':
    case 'percent':
      return typeof scoreFn === 'function' ? clamp(scoreFn(answer)) : 0

    default:
      return 0
  }
}

function clamp(n) {
  if (Number.isNaN(n) || n == null) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

// ─── Scores por pilar ─────────────────────────────────────────────────────────
// Retorna { [pillarId]: { score, answered, total } }.
// `score` = média ponderada dos extractScores das perguntas respondidas;
// `answered` = quantas perguntas afetando aquele pilar foram respondidas;
// `total` = total de perguntas que afetam o pilar (independente de resposta).
export function computePillarScores(answers = {}, questions = []) {
  const acc = {}
  for (const pillar of PILLARS) {
    acc[pillar.id] = { sum: 0, weightSum: 0, answered: 0, total: 0 }
  }

  for (const q of questions) {
    for (const pid of q.pillarIds || []) {
      if (!acc[pid]) continue
      acc[pid].total += 1
    }

    const score = extractScore(q, answers[q.id])
    if (score == null) continue

    const w = Number(q.weight ?? 1)
    for (const pid of q.pillarIds || []) {
      if (!acc[pid]) continue
      acc[pid].sum += score * w
      acc[pid].weightSum += w
      acc[pid].answered += 1
    }
  }

  const result = {}
  for (const pid of Object.keys(acc)) {
    const { sum, weightSum, answered, total } = acc[pid]
    result[pid] = {
      score: weightSum > 0 ? Math.round(sum / weightSum) : 0,
      answered,
      total,
    }
  }
  return result
}

// ─── Score geral ──────────────────────────────────────────────────────────────
// Média simples dos 9 pilares (todos com peso igual no agregado).
export function computeOverall(pillarScores = {}) {
  const values = PILLARS.map((p) => pillarScores[p.id]?.score ?? 0)
  if (!values.length) return 0
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  return Math.round(avg)
}

// ─── Classifica estágio ───────────────────────────────────────────────────────
export function classifyStage(overallScore) {
  return getStage(overallScore)
}

// ─── Top N pilares mais fracos ────────────────────────────────────────────────
export function topWeaknesses(pillarScores = {}, n = 3) {
  return PILLARS
    .map((p) => ({ id: p.id, label: p.label, score: pillarScores[p.id]?.score ?? 0 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
}

// ─── Próximos passos ─────────────────────────────────────────────────────────
export function generateNextSteps(weaknesses = [], businessType = 'b2b') {
  return weaknesses
    .map((w) => NEXT_STEPS[w.id]?.[businessType])
    .filter(Boolean)
}

// ─── Atalho: roda tudo de uma vez ────────────────────────────────────────────
export function fullDiagnosis(answers, questions, businessType) {
  const pillarFull = computePillarScores(answers, questions)
  // Forma simplificada: só os scores numéricos por pilar.
  const scores = Object.fromEntries(Object.entries(pillarFull).map(([k, v]) => [k, v.score]))
  const totalScore = computeOverall(pillarFull)
  const stage = classifyStage(totalScore)
  const weaknesses = topWeaknesses(pillarFull, 3)
  const nextSteps = generateNextSteps(weaknesses, businessType)
  return {
    scores,
    pillarFull,
    totalScore,
    stageId:    stage.id,
    stageLabel: stage.label,
    stageColor: stage.color,
    stageDesc:  stage.desc,
    weaknesses: weaknesses.map((w) => w.id),
    weaknessesDetail: weaknesses,
    nextSteps,
  }
}
