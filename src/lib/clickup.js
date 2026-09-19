// Client helper para chamar a Edge Function /api/clickup.
// Faz a chamada de forma fail-soft: o cadastro do cliente nunca é
// bloqueado por falha do ClickUp.
import { apiFetch } from './api'

/**
 * Cria pasta + lista de onboarding no ClickUp para o cliente recém-criado.
 * @param {object} params
 * @param {string} params.companyName        - Nome da empresa (vira nome da pasta)
 * @param {string|null} [params.startDateISO] - yyyy-mm-dd; default = hoje
 * @param {number[]} [params.assigneeIds]    - IDs ClickUp dos membros do squad (fallback)
 * @param {Object<string, number>} [params.departmentToClickupId] - { 'Departamento': clickup_user_id }
 * @returns {Promise<{ ok: boolean, folderId?: string, listId?: string, listUrl?: string, chatChannelId?: string, error?: string }>}
 */
export async function createClickUpClientFolder({ companyName, startDateISO, assigneeIds, departmentToClickupId }) {
  try {
    const data = await apiFetch('/api/clickup', {
      body: {
        action: 'create_client_folder',
        companyName,
        startDateISO: startDateISO || null,
        assigneeIds: Array.isArray(assigneeIds) ? assigneeIds : [],
        departmentToClickupId: departmentToClickupId && typeof departmentToClickupId === 'object'
          ? departmentToClickupId
          : {},
      },
    })
    return {
      ok: true,
      folderId: data.folderId,
      listId:   data.listId,
      listUrl:  data.listUrl,
      chatChannelId: data.chatChannelId || null,
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
  try {
    const data = await apiFetch('/api/clickup', { body: { action: 'list_workspace_members' } })
    return { ok: true, members: data.members || [] }
  } catch (e) {
    return { ok: false, error: e?.message || 'Erro inesperado.', members: [] }
  }
}
