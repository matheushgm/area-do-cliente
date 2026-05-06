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
  if (action !== 'create_client_folder') {
    return jsonErr('Ação não suportada.', 400)
  }

  const companyName  = (body?.companyName || '').trim()
  const startDateISO = body?.startDateISO || null
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
    let updatedCount = 0
    if (dueMillisList.length > 0) {
      const minDue   = Math.min(...dueMillisList)
      const offsetMs = refMillis - minDue
      // 5) Atualizar cada tarefa: due_date e start_date deslocados pelo offset
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
          if (Object.keys(patch).length === 0) return null
          await clickup('PUT', `/task/${t.id}`, token, patch)
          return t.id
        })
      )
      updatedCount = updates.filter((u) => u.status === 'fulfilled' && u.value).length
    }

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
