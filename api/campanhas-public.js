// Edge Function pública (SOMENTE LEITURA) do módulo de Campanhas / Planejamento de Verba.
// Validação SÓ pelo client_share_token (sem JWT), igual a api/precificacao-form.js.
//
// Diferente das outras públicas, esta NÃO tem caminho de escrita: só GET.
// O read-only é garantido aqui no servidor — não adianta esconder botão na UI.
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      // Plano de verba não deve ficar em cache de CDN — muda toda semana.
      'Cache-Control': 'no-store',
    },
  })
}

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey:        SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { data, status: res.status }
}

// ── Sanitização de saída ───────────────────────────────────────────────────
// Devolve só os campos que a página pública precisa. Assim, se um dia entrar
// qualquer coisa a mais no JSONB `answers`, ela não vaza pelo link do cliente.
function num(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
function str(v, max = 200) {
  return String(v == null ? '' : v).slice(0, max)
}
function dateOrNull(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null
}

function sanitizeCampaign(raw) {
  return {
    id:         str(raw?.id, 60),
    name:       str(raw?.name, 200),
    percentage: num(raw?.percentage),
    startDate:  dateOrNull(raw?.startDate),
    endDate:    dateOrNull(raw?.endDate),
  }
}

function sanitizeStage(raw) {
  const campaigns = Array.isArray(raw?.campaigns) ? raw.campaigns.slice(0, 100) : []
  return {
    percentage: num(raw?.percentage),
    campaigns:  campaigns.map(sanitizeCampaign),
  }
}

function sanitizeChannel(raw) {
  return {
    id:         str(raw?.id, 60),
    name:       str(raw?.name, 100),
    percentage: num(raw?.percentage),
    stages: {
      topo:  sanitizeStage(raw?.stages?.topo),
      meio:  sanitizeStage(raw?.stages?.meio),
      fundo: sanitizeStage(raw?.stages?.fundo),
    },
  }
}

function sanitizeAccount(raw) {
  const channels = Array.isArray(raw?.channels) ? raw.channels.slice(0, 20) : []
  return {
    id:             str(raw?.id, 60),
    name:           str(raw?.name, 120),
    orcamentoTotal: num(raw?.orcamentoTotal),
    valorJaUsado:   num(raw?.valorJaUsado),
    channels:       channels.map(sanitizeChannel),
  }
}

// Normaliza para o formato novo (array de contas). Planos legados guardavam
// orcamentoTotal/channels na raiz — vira uma conta única, igual ao
// initAccounts() do CampaignPlanner interno.
function sanitizePlan(answers) {
  if (!answers || typeof answers !== 'object') return null

  let accounts = Array.isArray(answers.accounts) ? answers.accounts : []
  if (!accounts.length) {
    if (!Array.isArray(answers.channels) || !answers.channels.length) return null
    accounts = [{
      id:             'legacy',
      name:           'Conta Principal',
      orcamentoTotal: answers.orcamentoTotal ?? answers.totalBudget ?? 0,
      valorJaUsado:   answers.valorJaUsado ?? 0,
      channels:       answers.channels,
    }]
  }

  return {
    startDate: dateOrNull(answers.startDate),
    endDate:   dateOrNull(answers.endDate),
    accounts:  accounts.slice(0, 20).map(sanitizeAccount),
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'GET') {
    return json({ error: 'Método não permitido.' }, 405)
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Servidor não configurado.' }, 500)
  }

  const url   = new URL(req.url)
  const token = url.searchParams.get('token')
  // Só aceita UUID — evita mandar lixo pro PostgREST e corta fuzzing barato.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || '')
  if (!isUuid) return json({ error: 'Link inválido ou expirado.' }, 404)

  const { data: projects, status } = await sb(
    `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id,company_name`
  )
  if (status !== 200 || !Array.isArray(projects) || !projects.length) {
    // 404 genérico: não diferencia "projeto não existe" de "token errado".
    return json({ error: 'Link inválido ou expirado.' }, 404)
  }

  const project = projects[0]

  const { data: plans } = await sb(
    `/campaign_plans?project_id=eq.${encodeURIComponent(project.id)}` +
    `&select=id,name,answers,created_at&order=created_at.desc&limit=1`
  )

  const row = Array.isArray(plans) && plans.length ? plans[0] : null

  return json({
    companyName: project.company_name || '',
    plan: row
      ? { name: str(row.name, 120), ...(sanitizePlan(row.answers) || { startDate: null, endDate: null, accounts: [] }) }
      : null,
  })
}
