// Edge function AUTENTICADA (só o time logado) — gerencia os usuários da
// ferramenta pública "Criativos com IA" de um projeto e lê o histórico de
// anúncios gerados por eles. Usa SERVICE_ROLE no servidor; o hash de senha
// nunca é devolvido ao browser.
//
//   action=list-users    → lista usuários do projeto (+ contagem de gerações)
//   action=create-user   → cria usuário (email + senha + nome)
//   action=update-user   → ativa/desativa, renomeia, troca senha
//   action=delete-user   → remove usuário
//   action=history       → histórico do projeto (todas as gerações)
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  })
}

async function hmacHex(secret, msg) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Hash de senha do usuário-cliente: keyed HMAC com o segredo do servidor.
function hashSenha(projectId, email, password) {
  return hmacHex(SERVICE_KEY, `criativos-user|${projectId}|${email.toLowerCase()}|${password}`)
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

  let body
  try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }
  const action = body?.action
  const projectId = String(body?.projectId || '').trim()
  if (!projectId) return json({ error: 'projectId obrigatório.' }, 400)
  const pid = encodeURIComponent(projectId)

  // ── list-users ──────────────────────────────────────────────────────────────
  if (action === 'list-users') {
    const { data: users } = await sb(`/criativos_users?project_id=eq.${pid}&select=id,email,name,active,created_at&order=created_at.asc`)
    const list = Array.isArray(users) ? users : []
    // contagem de gerações por usuário
    const { data: hist } = await sb(`/criativos_history?project_id=eq.${pid}&select=user_id`)
    const counts = {}
    for (const h of Array.isArray(hist) ? hist : []) counts[h.user_id] = (counts[h.user_id] || 0) + 1
    return json({ users: list.map((u) => ({ ...u, generations: counts[u.id] || 0 })) })
  }

  // ── create-user ─────────────────────────────────────────────────────────────
  if (action === 'create-user') {
    const email = clip(body.email, 160).toLowerCase()
    const password = clip(body.password, 200)
    const name = clip(body.name, 120)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'E-mail inválido.' }, 400)
    if (password.length < 4) return json({ error: 'A senha precisa ter ao menos 4 caracteres.' }, 400)
    const password_hash = await hashSenha(projectId, email, password)
    const row = { project_id: projectId, email, name: name || null, password_hash, active: true }
    const { status, data } = await sb('/criativos_users', { method: 'POST', body: JSON.stringify(row) })
    if (status === 409) return json({ error: 'Já existe um usuário com esse e-mail.' }, 409)
    if (status >= 400) return json({ error: 'Erro ao criar usuário.', detail: data }, 500)
    const u = Array.isArray(data) && data[0] ? data[0] : null
    return json({ success: true, user: u ? { id: u.id, email: u.email, name: u.name, active: u.active, created_at: u.created_at, generations: 0 } : null })
  }

  // ── update-user (ativar/desativar, renomear, trocar senha) ──────────────────
  if (action === 'update-user') {
    const id = String(body.id || '').trim()
    if (!id) return json({ error: 'id obrigatório.' }, 400)
    const patch = {}
    if (typeof body.active === 'boolean') patch.active = body.active
    if (typeof body.name === 'string') patch.name = clip(body.name, 120) || null
    if (body.password) {
      const password = clip(body.password, 200)
      if (password.length < 4) return json({ error: 'A senha precisa ter ao menos 4 caracteres.' }, 400)
      // precisa do email atual para recomputar o hash
      const { data: cur } = await sb(`/criativos_users?id=eq.${encodeURIComponent(id)}&project_id=eq.${pid}&select=email&limit=1`)
      const email = Array.isArray(cur) && cur[0] ? cur[0].email : null
      if (!email) return json({ error: 'Usuário não encontrado.' }, 404)
      patch.password_hash = await hashSenha(projectId, email, password)
    }
    if (!Object.keys(patch).length) return json({ error: 'Nada para atualizar.' }, 400)
    const { status } = await sb(`/criativos_users?id=eq.${encodeURIComponent(id)}&project_id=eq.${pid}`, {
      method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(patch),
    })
    if (status >= 400) return json({ error: 'Erro ao atualizar.' }, 500)
    return json({ success: true })
  }

  // ── delete-user ─────────────────────────────────────────────────────────────
  if (action === 'delete-user') {
    const id = String(body.id || '').trim()
    if (!id) return json({ error: 'id obrigatório.' }, 400)
    const { status } = await sb(`/criativos_users?id=eq.${encodeURIComponent(id)}&project_id=eq.${pid}`, {
      method: 'DELETE', prefer: 'return=minimal',
    })
    if (status >= 400) return json({ error: 'Erro ao remover.' }, 500)
    return json({ success: true })
  }

  // ── history (todas as gerações do projeto, do mais novo ao mais antigo) ─────
  if (action === 'history') {
    const { data } = await sb(`/criativos_history?project_id=eq.${pid}&select=id,user_id,user_email,user_name,mode,funil,funil_label,detalhes,content,created_at&order=created_at.desc&limit=500`)
    return json({ history: Array.isArray(data) ? data : [] })
  }

  return json({ error: 'Ação desconhecida.' }, 400)
}
