// Client helper do Planejador de Atividades (/api/atividades).
// Toda chamada leva o JWT da sessão Supabase; o token do ClickUp fica só no servidor.
import { apiFetch } from './api'

function call(action, payload = {}) {
  return apiFetch('/api/atividades', { body: { action, ...payload } })
}

/** Configuração do cálculo (padrão do motor mesclado com atividades_config). */
export function carregarConfigAtividades() {
  return call('config')
}

/**
 * Agenda projetada + data sugerida para um ou mais responsáveis.
 * @param {object} p
 * @param {number[]} p.assignees   clickup_user_id dos responsáveis
 * @param {number|null} p.horas    horas da nova tarefa (null = só a carga)
 * @param {string|null} p.naoAntesDe   yyyy-mm-dd
 * @param {string|null} p.dataDesejada yyyy-mm-dd (avalia sobrecarga se for antes da sugerida)
 */
export function sugerirAtividade({ assignees, horas, naoAntesDe = null, dataDesejada = null }) {
  return call('sugerir', { assignees, horas, naoAntesDe, dataDesejada })
}

/**
 * Carga do time para o painel de capacidade (sem tarefa nova).
 * @param {object} p
 * @param {number[]} p.assignees  até 12 clickup_user_id por chamada
 * @param {boolean} [p.refresh]   ignora o cache do servidor
 */
export function cargaTime({ assignees, refresh = false }) {
  return call('carga', { assignees, refresh })
}

/** Listas (com status) da pasta ClickUp do cliente. */
export function listarListasClickUp(folderId) {
  return call('listas', { folderId })
}

/** Grava a estimativa (horas) numa tarefa do ClickUp. */
export function estimarTarefa({ taskId, horas, assigneeClickupId = null }) {
  return call('estimar', { taskId, horas, assigneeClickupId })
}

/** Cria a tarefa aprovada no ClickUp e registra no histórico. */
export function criarAtividade(payload) {
  return call('criar', payload)
}

/**
 * Tarefas concluídas no workspace entre dois dias (inclusive, yyyy-mm-dd),
 * para o relatório de entregas. Máximo de 31 dias por chamada.
 * @param {object} p
 * @param {string} p.desde
 * @param {string} p.ate
 * @param {boolean} [p.refresh]  ignora o cache do servidor
 */
export function tarefasConcluidas({ desde, ate, refresh = false }) {
  return call('concluidas', { desde, ate, refresh })
}
