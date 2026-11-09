// Helpers compartilhados pela UI do resultado do Kickoff.
// Usados pelo KickoffPillarBars (modal por pilar) e pelo KickoffAnswersModal
// (lista única com todas as perguntas/respostas).

import { fmtMoney } from '../Resultados/resultadosHelpers'
import { t } from '../../i18n'

/**
 * Converte uma resposta crua em texto formatado pra exibição.
 * Retorna o texto de "sem resposta" (no idioma da tela) quando a resposta está vazia.
 */
export function formatAnswer(question, answer) {
  // Detecta objeto yesno-com-descrição: { value, description }
  const isYesNoObj =
    answer && typeof answer === 'object' && !Array.isArray(answer) && 'value' in answer

  if (
    answer == null ||
    answer === '' ||
    (Array.isArray(answer) && !answer.length) ||
    (isYesNoObj && !answer.value)
  ) {
    return t('kickoff.respostas.semResposta')
  }
  const { type, options } = question

  switch (type) {
    // single, scale e yesno podem vir como objeto { value, description } ou
    // { value, subAnswers } quando a pergunta tem `askDescription`. Tratamento
    // unificado.
    case 'single':
    case 'scale':
    case 'yesno': {
      const v   = isYesNoObj ? answer.value : answer
      const dsc = isYesNoObj ? (answer.description || '').trim() : ''
      const sub = isYesNoObj && answer.subAnswers && typeof answer.subAnswers === 'object'
        ? answer.subAnswers
        : null
      const opt = (options || []).find((o) => o.value === v)
      const label = opt ? opt.label : String(v)

      if (sub && question.subQuestions) {
        const parts = question.subQuestions
          .map((sq) => {
            const val = sub[sq.id]
            if (val == null || val === '') return null
            const display = val === 'unknown' ? t('kickoff.form.naoSei') : `${val}%`
            return `${sq.label}: ${display}`
          })
          .filter(Boolean)
        return parts.length ? `${label} — ${parts.join(' · ')}` : label
      }
      return dsc ? `${label} — ${dsc}` : label
    }
    case 'multi': {
      const arr = Array.isArray(answer) ? answer : [answer]
      const labels = arr.map((v) => {
        const opt = (options || []).find((o) => o.value === v)
        return opt ? opt.label : String(v)
      })
      return labels.join(', ')
    }
    case 'money': {
      const n = Number(answer) || 0
      return n > 0 ? fmtMoney(n) : t('kickoff.respostas.semValor')
    }
    case 'percent': {
      if (answer === 'unknown') return t('kickoff.respostas.naoSeiCalcular')
      const n = Number(answer)
      return isNaN(n) ? String(answer) : `${n}%`
    }
    case 'number':
      return String(answer)
    case 'text':
      return String(answer)
    default:
      return String(answer)
  }
}

/** Cor por severidade de score 0-100. */
export function severityColor(score) {
  if (score < 31) return '#EF4444'
  if (score < 51) return '#F59E0B'
  if (score < 71) return '#EAB308'
  if (score < 86) return '#22C55E'
  return '#15803D'
}

/** Texto humanizado da severidade do score. */
export function severityLabel(score) {
  return t(`kickoff.severidade.${nivelSeveridade(score)}.longo`)
}

/** Nível da severidade (chave de `kickoff.severidade`). */
export function nivelSeveridade(score) {
  if (score < 31) return 'critico'
  if (score < 51) return 'fragil'
  if (score < 71) return 'estruturacao'
  if (score < 86) return 'saudavel'
  return 'excelente'
}
