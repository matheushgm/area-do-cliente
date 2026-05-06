// Client helper para chamar a Edge Function /api/clickup.
// Faz a chamada de forma fail-soft: o cadastro do cliente nunca é
// bloqueado por falha do ClickUp.
import { supabase } from './supabase'

/**
 * Cria pasta + lista de onboarding no ClickUp para o cliente recém-criado.
 * @param {object} params
 * @param {string} params.companyName        - Nome da empresa (vira nome da pasta)
 * @param {string|null} [params.startDateISO] - yyyy-mm-dd; default = hoje
 * @param {number[]} [params.assigneeIds]    - IDs ClickUp dos membros do squad
 * @returns {Promise<{ ok: boolean, folderId?: string, listId?: string, listUrl?: string, error?: string }>}
 */
export async function createClickUpClientFolder({ companyName, startDateISO, assigneeIds }) {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' }
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    if (!accessToken) return { ok: false, error: 'Sessão expirada.' }

    const res = await fetch('/api/clickup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'create_client_folder',
        companyName,
        startDateISO: startDateISO || null,
        assigneeIds: Array.isArray(assigneeIds) ? assigneeIds : [],
      }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message || `HTTP ${res.status}`,
      }
    }
    return {
      ok: true,
      folderId: data.folderId,
      listId:   data.listId,
      listUrl:  data.listUrl,
      tasksUpdated: data.tasksUpdated,
      tasksFound:   data.tasksFound,
    }
  } catch (e) {
    return { ok: false, error: e?.message || 'Erro inesperado.' }
  }
}

/**
 * Lista membros do workspace do ClickUp (id + name + email).
 * Usado para popular o dropdown de mapeamento na gestão de usuários.
 */
export async function listClickUpMembers() {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.', members: [] }
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    if (!accessToken) return { ok: false, error: 'Sessão expirada.', members: [] }

    const res = await fetch('/api/clickup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ action: 'list_workspace_members' }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: data?.error?.message || `HTTP ${res.status}`, members: [] }
    return { ok: true, members: data.members || [] }
  } catch (e) {
    return { ok: false, error: e?.message || 'Erro inesperado.', members: [] }
  }
}
