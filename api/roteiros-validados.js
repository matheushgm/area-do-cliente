// Edge function AUTENTICADA (só o time logado) — CRUD dos "Roteiros Validados"
// de um projeto: transcrições de anúncios em vídeo que performaram bem, salvas
// como material de aprendizado para gerar copy nova. Usa SERVICE_ROLE no servidor
// (mesmo padrão de api/criativos-users).
//
//   action=list    → lista os roteiros do projeto (mais novo → mais antigo)
//   action=create  → salva uma transcrição no projeto
//   action=delete  → remove um roteiro (id + projectId)
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const clip = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation',
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { data, status: res.status }
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!SUPABASE_URL || !SUPABASE_ANON || !SERVICE_KEY) return json({ error: 'Servidor não configurado.' }, 500)

  // ── Autenticação (só o time logado) ─────────────────────────────────────────
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json({ error: 'Não autorizado.' }, 401)
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON },
  })
  if (!authRes.ok) return json({ error: 'Sessão inválida ou expirada.' }, 401)
  const user = await authRes.json().catch(() => ({}))

  let body
  try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }
  const action = body?.action
  const projectId = String(body?.projectId || '').trim()
  if (!projectId) return json({ error: 'projectId obrigatório.' }, 400)
  const pid = encodeURIComponent(projectId)

  // ── list ────────────────────────────────────────────────────────────────────
  if (action === 'list') {
    const { data } = await sb(`/roteiros_validados?project_id=eq.${pid}&select=id,ad_id,ad_name,account,transcription,user_name,user_email,created_at&order=created_at.desc&limit=500`)
    return json({ items: Array.isArray(data) ? data : [] })
  }

  // ── create ────────────────────────────────────────────────────────────────────
  if (action === 'create') {
    const transcription = clip(body.transcription, 20000)
    if (!transcription) return json({ error: 'transcription obrigatória.' }, 400)
    const row = {
      project_id: projectId,
      ad_id: clip(body.ad_id, 64) || null,
      ad_name: clip(body.ad_name, 300) || null,
      account: clip(body.account, 200) || null,
      transcription,
      user_id: user?.id || null,
      user_email: user?.email || null,
      user_name: user?.user_metadata?.name || user?.user_metadata?.full_name || null,
    }
    const { data, status } = await sb('/roteiros_validados', { method: 'POST', body: JSON.stringify(row) })
    if (status >= 300) return json({ error: 'Falha ao salvar o roteiro.' }, 502)
    return json({ item: Array.isArray(data) ? data[0] : data })
  }

  // ── delete ────────────────────────────────────────────────────────────────────
  if (action === 'delete') {
    const id = clip(body.id, 64)
    if (!id) return json({ error: 'id obrigatório.' }, 400)
    const { status } = await sb(`/roteiros_validados?id=eq.${encodeURIComponent(id)}&project_id=eq.${pid}`, { method: 'DELETE', prefer: 'return=minimal' })
    if (status >= 300) return json({ error: 'Falha ao remover.' }, 502)
    return json({ ok: true })
  }

  return json({ error: 'Ação desconhecida.' }, 400)
}
