// Client helper do Planejador de Atividades (/api/atividades).
// Toda chamada leva o JWT da sessão Supabase; o token do ClickUp fica só no servidor.
import { supabase } from './supabase'

async function call(action, payload = {}) {
  // Preview de desenvolvimento (/dev/atividades) responde localmente; código morto em produção.
  if (import.meta.env.DEV && typeof window !== 'undefined' && window.__atividadesMock) {
    return window.__atividadesMock(action, payload)
  }
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  if (!accessToken) throw new Error('Sessão expirada. Faça login de novo.')

  const res = await fetch('/api/atividades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch {
    throw new Error('A API de atividades não respondeu JSON. Rode o app com `vercel dev` (porta 3000): `npm run dev` não serve as rotas /api.')
  }
  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`)
    err.code = data?.error?.code || null
    throw err
  }
  return data
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

/** Cria a tarefa aprovada no ClickUp e registra no histórico. */
export function criarAtividade(payload) {
  return call('criar', payload)
}
