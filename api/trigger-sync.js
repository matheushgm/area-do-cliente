// Edge function — dispara o GitHub Action de sync (dashboard-sync.yml) sob demanda
// (botão "Atualizar" da dashboard). Valida o JWT do usuário (igual /api/dash-data)
// e então chama a API do GitHub (workflow_dispatch) com um token de serviço.
export const config = { runtime: 'edge' }

const REPO = 'matheushgm/dashboard-api'
const WORKFLOW = 'sync.yml'

function jsonErr(message, status) {
  return new Response(JSON.stringify({ error: { message } }), {
    status, headers: { 'content-type': 'application/json' },
  })
}

export default async function handler(req) {
  if (req.method !== 'POST') return jsonErr('Method not allowed', 405)

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  const GH_TOKEN = process.env.GH_DISPATCH_TOKEN
  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr('Servidor não configurado.', 500)
  if (!GH_TOKEN) return jsonErr('GH_DISPATCH_TOKEN não configurado no servidor.', 500)

  // ── Autenticação (mesmo padrão de /api/dash-data) ───────────────────────────
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return jsonErr('Não autorizado.', 401)
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON },
  })
  if (!authRes.ok) return jsonErr('Sessão inválida ou expirada.', 401)

  // ── Dispara o workflow ──────────────────────────────────────────────────────
  const r = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'content-type': 'application/json',
        'User-Agent': 'revenuelab-dashboard',
      },
      body: JSON.stringify({ ref: 'main', inputs: { mode: 'incremental' } }),
    }
  )

  if (r.status === 204) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  }
  const txt = await r.text()
  return jsonErr(`Falha ao disparar atualização (GitHub ${r.status}): ${txt.slice(0, 200)}`, 502)
}
