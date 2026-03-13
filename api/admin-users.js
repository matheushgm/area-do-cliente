// Edge Runtime: proxy seguro para operações admin do Supabase Auth
export const config = { runtime: 'edge' }

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Servidor não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' }, 500)
  }

  // Verificar JWT do caller
  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.replace('Bearer ', '').trim()
  if (!jwt) return json({ error: 'Unauthorized' }, 401)

  const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SERVICE_KEY },
  })

  if (!meRes.ok) {
    return json({ error: 'Sessão inválida ou expirada.' }, 401)
  }

  const me = await meRes.json()

  if (me?.user_metadata?.role !== 'admin') {
    return json({ error: 'Forbidden: apenas admins podem executar esta ação.' }, 403)
  }

  let body
  try { body = await req.json() }
  catch { return json({ error: 'Corpo da requisição inválido.' }, 400) }

  const { action, userId, ...data } = body

  // ── Criar usuário ──────────────────────────────────────────────────────────
  if (action === 'create_user') {
    const { name, email, password, role } = data
    if (!name || !email || !password || !role) {
      return json({ error: 'Campos obrigatórios: name, email, password, role.' }, 400)
    }
    const avatar = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, avatar, role },
      }),
    })
    const text = await res.text()
    return new Response(text, { status: res.status, headers: { 'content-type': 'application/json' } })
  }

  // ── Atualizar usuário (email, nome, role) ──────────────────────────────────
  if (action === 'update_user') {
    if (!userId) return json({ error: 'userId obrigatório.' }, 400)
    const { name, email, role } = data
    const avatar = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : undefined
    const payload = {}
    if (email) payload.email = email
    if (name || role) {
      payload.user_metadata = {}
      if (name)   payload.user_metadata.name   = name
      if (avatar) payload.user_metadata.avatar = avatar
      if (role)   payload.user_metadata.role   = role
    }
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    return new Response(text, { status: res.status, headers: { 'content-type': 'application/json' } })
  }

  // ── Desativar / reativar usuário ───────────────────────────────────────────
  if (action === 'toggle_user') {
    if (!userId) return json({ error: 'userId obrigatório.' }, 400)
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ban_duration: data.disable ? '876600h' : 'none' }),
    })
    const text = await res.text()
    return new Response(text, { status: res.status, headers: { 'content-type': 'application/json' } })
  }

  return json({ error: `Ação desconhecida: ${action}` }, 400)
}
