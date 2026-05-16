// Helpers compartilhados pela UI do resultado do Kickoff.
// Usados pelo KickoffPillarBars (modal por pilar) e pelo KickoffAnswersModal
// (lista única com todas as perguntas/respostas).

import { fmtMoney } from '../Resultados/resultadosHelpers'

/**
 * Converte uma resposta crua em texto formatado pra exibição.
 * Retorna 'Sem resposta' como string padrão quando a resposta está vazia.
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
    return '— sem resposta —'
  }
  const { type, options } = question

  switch (type) {
    case 'single':
    case 'scale': {
      const opt = (options || []).find((o) => o.value === answer)
      return opt ? opt.label : String(answer)
    }
    case 'yesno': {
      const v   = isYesNoObj ? answer.value : answer
      const dsc = isYesNoObj ? (answer.description || '').trim() : ''
      const opt = (options || []).find((o) => o.value === v)
      const label = opt ? opt.label : String(v)
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
      return n > 0 ? fmtMoney(n) : '— sem valor —'
    }
    case 'percent': {
      if (answer === 'unknown') return 'Não sei calcular'
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
  if (score < 31) return 'Crítico — precisa de atenção imediata'
  if (score < 51) return 'Frágil — risco no curto prazo'
  if (score < 71) return 'Em estruturação — base existente, falta padronizar'
  if (score < 86) return 'Saudável — pronto pra acelerar'
  return 'Excelente — vantagem competitiva clara'
}
