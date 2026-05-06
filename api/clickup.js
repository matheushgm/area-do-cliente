// Edge Function — integração com ClickUp.
// POST /api/clickup com body { action: 'create_client_folder', companyName, startDateISO }
// Cria uma pasta no espaço "Clientes" e uma lista a partir do template
// "ONBOARDING (LISTA GERAL)", deslocando as datas das tarefas para começar
// na data de assinatura (ou data informada).
//
// Variáveis de ambiente esperadas (servidor):
//   CLICKUP_API_TOKEN          — pessoal do ClickUp (pk_...)
//   CLICKUP_TEAM_ID            — ID do workspace (default: 9009170774)
//   CLICKUP_CLIENTES_SPACE_ID  — ID do espaço Clientes (default: 90090377342)
//   CLICKUP_TEMPLATE_LIST_ID   — template ID com prefixo t- (default: t-901312370990)
//   SUPABASE_URL + SUPABASE_ANON_KEY — para validar JWT do caller
export const config = { runtime: 'edge' }

const CLICKUP_BASE       = 'https://api.clickup.com/api/v2'
const DEFAULT_TEAM       = '9009170774'
const DEFAULT_SPACE      = '90090377342' // "Clientes"
const DEFAULT_TEMPLATE   = 't-901312370990' // ONBOARDING (LISTA GERAL)

// Custom field 'Departamento' — option IDs do ClickUp para resolver o
// nome do departamento atrelado a cada tarefa. Espelha CLICKUP_DEPARTMENTS
// em src/lib/constants.js (servidor não pode importar src/).
const CLICKUP_DEPARTMENT_FIELD_ID = 'e60bebff-b035-49c2-879b-972777ed041e'
const DEPARTMENT_OPTION_TO_NAME = {
  'a44f7b38-1972-41a6-857a-feacc52ce689': 'Gestor de tráfego',
  'a04634c3-be4e-4d30-987c-02f485ceaaf8': 'Estrategista',
  'f29de476-0d11-45e1-afc0-0a3bd9e3aa47': 'Comercial',
  '15d2487a-cbac-4ebf-873e-35154dc1c4b0': 'Cliente',
  '70447c34-6b7e-457b-842d-b41bc0a7bb07': 'Copywriter',
  'c5afae7f-be83-4d99-bfec-fa9edc93ef6f': 'Web Designer',
  '6592c59b-3fab-4c91-a0d9-2448e4d5e81d': 'Designer',
  '1f8ec57f-cbf4-413c-b8e7-a067ee991f18': 'Account Manager',
  '5bee1f1a-4595-4dc1-bf9a-1e69e6fc4f36': 'Automação / Integração',
}

// Resolve os ClickUp user IDs que devem ser atribuídos a uma tarefa.
// Prioridade: Departamento custom field → fallback assigneeIds genérico.
function resolveAssigneesForTask(task, departmentToClickupId, fallbackIds) {
  const cf = (task?.custom_fields || []).find((f) => f?.id === CLICKUP_DEPARTMENT_FIELD_ID)
  if (!cf || !cf.value || (Array.isArray(cf.value) && cf.value.length === 0)) {
    return fallbackIds
  }
  // 'labels' field: cf.value pode ser array de option IDs ou array de option objects
  const optionIds = (Array.isArray(cf.value) ? cf.value : [cf.value]).map((v) => {
    if (typeof v === 'string') return v
    return v?.id || v?.option_id || null
  }).filter(Boolean)

  const ids = []
  for (const oid of optionIds) {
    const name = DEPARTMENT_OPTION_TO_NAME[oid]
    if (!name) continue
    const cuId = departmentToClickupId?.[name]
    if (Number.isFinite(Number(cuId))) ids.push(Number(cuId))
  }
  return ids.length > 0 ? ids : fallbackIds
}

function jsonErr(message, status, extra) {
  return new Response(
    JSON.stringify({ error: { message, ...(extra || {}) } }),
    { status, headers: { 'content-type': 'application/json' } }
  )
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

// Helper para chamar ClickUp API com tratamento de erro padronizado.
async function clickup(method, path, token, body) {
  const res = await fetch(`${CLICKUP_BASE}${path}`, {
    method,
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : null } catch { json = null }
  if (!res.ok) {
    const err = new Error(`ClickUp ${method} ${path} falhou: ${res.status}`)
    err.status = res.status
    err.body   = json || text
    throw err
  }
  return json
}

// Parse de data string yyyy-mm-dd ou ISO timestamp em ms (UTC midnight).
function parseStartMillis(iso) {
  if (!iso) return null
  const s = typeof iso === 'string' && iso.length === 10 ? iso + 'T00:00:00' : iso
  const t = new Date(s).getTime()
  return isNaN(t) ? null : t
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // ── Validar JWT do caller ──────────────────────────────────────────────────
  const SUPABASE_URL  = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return jsonErr('Servidor não configurado.', 500)
  }
  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return jsonErr('Não autorizado.', 401)
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON },
  })
  if (!authRes.ok) return jsonErr('Sessão inválida ou expirada.', 401)

  // ── Configuração de ambiente ───────────────────────────────────────────────
  const token       = process.env.CLICKUP_API_TOKEN
  const spaceId     = process.env.CLICKUP_CLIENTES_SPACE_ID || DEFAULT_SPACE
  const templateId  = process.env.CLICKUP_TEMPLATE_LIST_ID  || DEFAULT_TEMPLATE
  if (!token) return jsonErr('CLICKUP_API_TOKEN não configurado.', 500)

  // ── Parse do body ──────────────────────────────────────────────────────────
  let body
  try { body = await req.json() }
  catch { return jsonErr('Body inválido.', 400) }

  const action = body?.action

  // ── Action: list_workspace_members ─────────────────────────────────────────
  // Retorna lista de usuários do ClickUp (id + name + email) para popular o
  // dropdown de mapeamento na página de gestão de usuários.
  if (action === 'list_workspace_members') {
    const teamId = process.env.CLICKUP_TEAM_ID || DEFAULT_TEAM
    try {
      const res = await clickup('GET', `/team/${teamId}`, token)
      const members = (res?.team?.members || []).map((m) => ({
        id: Number(m?.user?.id),
        name: m?.user?.username || m?.user?.email || `User ${m?.user?.id}`,
        email: m?.user?.email || null,
      })).filter((m) => Number.isFinite(m.id))
      return jsonOk({ members })
    } catch (e) {
      return jsonErr(e?.message || 'Erro ao listar membros', e?.status >= 400 ? e.status : 502, { detail: e?.body })
    }
  }

  if (action !== 'create_client_folder') {
    return jsonErr('Ação não suportada.', 400)
  }

  const companyName  = (body?.companyName || '').trim()
  const startDateISO = body?.startDateISO || null
  // assigneeIds: array de ClickUp user IDs (numéricos) — fallback usado para
  // tarefas SEM mapeamento de departamento.
  const assigneeIds  = Array.isArray(body?.assigneeIds)
    ? body.assigneeIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : []
  // departmentToClickupId: { 'Gestor de tráfego': 106160859, 'Designer': 106097500, ... }
  // Se a tarefa tem o custom field 'Departamento' preenchido, usa esse mapa
  // pra resolver o responsável. Override do assigneeIds genérico.
  const departmentToClickupId = (body?.departmentToClickupId && typeof body.departmentToClickupId === 'object')
    ? body.departmentToClickupId
    : {}
  if (!companyName) return jsonErr('companyName é obrigatório.', 400)

  // Data de referência: usa a data fornecida ou hoje.
  const refMillis = parseStartMillis(startDateISO) ?? Date.now()

  try {
    // 1) Criar pasta no espaço "Clientes" com o nome da empresa
    const folder = await clickup('POST', `/space/${spaceId}/folder`, token, {
      name: companyName,
    })
    if (!folder?.id) {
      return jsonErr('ClickUp não retornou folder válido.', 502, { folder })
    }

    // 2) Criar lista a partir do template (cria a lista vazia primeiro;
    //    o ClickUp Templates API aceita esse padrão de criação).
    const list = await clickup('POST', `/folder/${folder.id}/list_template/${templateId}`, token, {
      name: 'ONBOARDING (LISTA GERAL)',
      return_immediately: true,
    })
    // O endpoint pode retornar a lista direto OU um objeto com list dentro;
    // tentamos ambos os formatos.
    const listId = list?.id || list?.list?.id
    if (!listId) {
      return jsonErr('ClickUp não retornou list válido.', 502, { list })
    }

    // 3) Buscar tasks da lista recém-criada para deslocar as datas.
    //    O template pode levar alguns segundos pra popular; tentamos até 3x.
    let tasks = []
    for (let i = 0; i < 5; i++) {
      const r = await clickup('GET', `/list/${listId}/task?subtasks=true&include_closed=true`, token)
      tasks = r?.tasks || []
      if (tasks.length > 0) break
      // espera 1s antes do próximo retry
      await new Promise((res) => setTimeout(res, 1000))
    }

    // 4) Calcular offset: encontrar menor due_date entre as tarefas
    //    do template e usar como base para o realinhamento.
    const dueMillisList = tasks
      .map((t) => Number(t.due_date))
      .filter((n) => Number.isFinite(n) && n > 0)

    // ID especial preservado em qualquer caso (assignee "Cliente" do template)
    const CLIENTE_USER_ID = 84048101

    let updatedCount = 0
    const minDue   = dueMillisList.length > 0 ? Math.min(...dueMillisList) : null
    const offsetMs = minDue !== null ? refMillis - minDue : 0

    // 5) Atualizar cada tarefa: deslocar datas + substituir assignees.
    //    Atribui responsáveis com base no campo "Departamento" da tarefa
    //    (override) ou usa assigneeIds genérico como fallback.
    const updates = await Promise.allSettled(
      tasks.map(async (t) => {
        const patch = {}
        if (Number.isFinite(Number(t.due_date)) && Number(t.due_date) > 0) {
          patch.due_date = Number(t.due_date) + offsetMs
          patch.due_date_time = false
        }
        if (Number.isFinite(Number(t.start_date)) && Number(t.start_date) > 0) {
          patch.start_date = Number(t.start_date) + offsetMs
          patch.start_date_time = false
        }

        // Resolve quem assumir essa tarefa: prioriza departamento se houver.
        const targetAssignees = resolveAssigneesForTask(t, departmentToClickupId, assigneeIds)
        if (targetAssignees.length > 0) {
          const currentIds = (t.assignees || [])
            .map((a) => Number(a?.id))
            .filter((n) => Number.isFinite(n) && n > 0)
          const toRemove = currentIds.filter((id) => id !== CLIENTE_USER_ID && !targetAssignees.includes(id))
          const toAdd    = targetAssignees.filter((id) => !currentIds.includes(id))
          if (toRemove.length > 0 || toAdd.length > 0) {
            patch.assignees = { add: toAdd, rem: toRemove }
          }
        }

        if (Object.keys(patch).length === 0) return null
        await clickup('PUT', `/task/${t.id}`, token, patch)
        return t.id
      })
    )
    updatedCount = updates.filter((u) => u.status === 'fulfilled' && u.value).length

    // 6) URL pública da lista pra deep-link no ClientProfile.
    const teamId  = process.env.CLICKUP_TEAM_ID || DEFAULT_TEAM
    const listUrl = `https://app.clickup.com/${teamId}/v/li/${listId}`

    return jsonOk({
      folderId: String(folder.id),
      listId:   String(listId),
      listUrl,
      tasksUpdated: updatedCount,
      tasksFound:   tasks.length,
    })
  } catch (e) {
    return jsonErr(
      e?.message || 'Erro ao integrar com ClickUp',
      e?.status && e.status >= 400 && e.status < 600 ? e.status : 502,
      { detail: e?.body }
    )
  }
}
