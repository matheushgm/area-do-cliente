import { getUser, json, sb } from './_http.js'
// Edge Runtime: proxy seguro para operações admin do Supabase Auth
export const config = { runtime: 'edge' }

// Papéis aceitos em app_metadata.role. 'vertatask' = só o VertaTask, só dos clientes de
// vertatask_acessos (migration 142; o bloqueio de verdade é a RLS).
const PAPEIS = ['admin', 'member', 'vertatask']

// Troca os clientes liberados de um usuário só VertaTask. Outro papel = nenhum (não sobra
// acesso antigo se a pessoa voltar a ser restrita). Devolve a mensagem de erro, ou null.
async function gravarClientes(userId, role, clientes, adminId) {
  const ids = role === 'vertatask'
    ? [...new Set((Array.isArray(clientes) ? clientes : []).filter((c) => typeof c === 'string' && /^[0-9a-f-]{36}$/i.test(c)))]
    : []
  const del = await sb(`/vertatask_acessos?user_id=eq.${userId}`, { method: 'DELETE', prefer: 'return=minimal' })
  if (!del.ok) return 'Não consegui atualizar os clientes liberados.'
  if (!ids.length) return null
  const ins = await sb('/vertatask_acessos', {
    method: 'POST', prefer: 'return=minimal',
    body: JSON.stringify(ids.map((project_id) => ({ user_id: userId, project_id, criado_por: adminId || null }))),
  })
  return ins.ok ? null : 'Usuário salvo, mas os clientes liberados não foram gravados.'
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
  const auth = await getUser(req, SERVICE_KEY)
  if (!auth.ok) return json({ error: auth.message }, 401)

  if (auth.user?.app_metadata?.role !== 'admin') {
    return json({ error: 'Forbidden: apenas admins podem executar esta ação.' }, 403)
  }

  let body
  try { body = await req.json() }
  catch { return json({ error: 'Corpo da requisição inválido.' }, 400) }

  const { action, userId, ...data } = body

  if ('role' in data && data.role && !PAPEIS.includes(data.role)) {
    return json({ error: `Permissão inválida: ${data.role}.` }, 400)
  }
  if (data.role === 'vertatask' && !(Array.isArray(data.clientes) && data.clientes.length)) {
    return json({ error: 'Escolha ao menos um cliente para o acesso só VertaTask.' }, 400)
  }

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
        user_metadata: { name, avatar },
        app_metadata:  { role },
      }),
    })
    const text = await res.text()
    let criado = null
    try { criado = JSON.parse(text) } catch { /* resposta sem JSON */ }

    // E-mail já cadastrado. Sem permissão (entrou uma vez pelo Google e ficou sem papel, nem
    // aparece na lista): aproveita o cadastro. Com permissão: avisa em vez do 422 cru.
    if (!res.ok && (criado?.error_code === 'email_exists' || res.status === 422)) {
      const achado = await sb('/rpc/admin_usuario_por_email', { method: 'POST', body: JSON.stringify({ p_email: email }) })
      const existente = Array.isArray(achado.data) ? achado.data[0] : null
      if (existente?.role) {
        return json({ error: `Esse e-mail já é usuário da Área do Cliente (permissão ${existente.role}). Edite pela lista.` }, 409)
      }
      if (existente?.id) {
        const upd = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existente.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            password,
            email_confirm: true,
            user_metadata: { name, avatar },
            app_metadata: { role },
            ban_duration: 'none',
          }),
        })
        const updText = await upd.text()
        let atualizado = null
        try { atualizado = JSON.parse(updText) } catch { /* resposta sem JSON */ }
        if (!upd.ok || !atualizado?.id) {
          return json({ error: atualizado?.msg || 'Esse e-mail já tinha cadastro e não consegui liberar o acesso.' }, upd.status || 500)
        }
        const erro = await gravarClientes(atualizado.id, role, data.clientes, auth.user?.id)
        return json(erro ? { ...atualizado, aviso: erro } : atualizado, 200)
      }
    }

    if (!res.ok) {
      return json({ error: criado?.msg || criado?.error_description || criado?.error || `Não consegui criar o usuário (HTTP ${res.status}).` }, res.status)
    }
    if (criado?.id) {
      const erro = await gravarClientes(criado.id, role, data.clientes, auth.user?.id)
      if (erro) return json({ ...criado, aviso: erro }, 200)
    }
    return new Response(text, { status: res.status, headers: { 'content-type': 'application/json' } })
  }

  // ── Atualizar usuário (email, nome, role) ──────────────────────────────────
  if (action === 'update_user') {
    if (!userId) return json({ error: 'userId obrigatório.' }, 400)
    const { name, email, role, clickup_user_id } = data
    const avatar = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : undefined
    const payload = {}
    if (email) payload.email = email
    if (name) {
      payload.user_metadata = {}
      if (name)   payload.user_metadata.name   = name
      if (avatar) payload.user_metadata.avatar = avatar
    }
    if (role) payload.app_metadata = { role }
    const updates = []
    if (Object.keys(payload).length > 0) {
      updates.push(fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      }))
    }
    // clickup_user_id vai apenas em profiles (não tem espelho no Auth)
    if ('clickup_user_id' in data) {
      const profilePatch = { clickup_user_id: clickup_user_id == null || clickup_user_id === '' ? null : Number(clickup_user_id) }
      // Atualiza espelho name/email/role na tabela profiles também (se mudaram)
      if (name)  profilePatch.name = name
      if (email) profilePatch.email = email
      if (role)  profilePatch.role = role
      updates.push(fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          'content-type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(profilePatch),
      }))
    }
    const results = await Promise.all(updates)
    const falhou = results.find((r) => !r.ok)
    if (role && !falhou) {
      const erro = await gravarClientes(userId, role, data.clientes, auth.user?.id)
      if (erro) return json({ error: erro }, 500)
    }
    const lastRes = results[results.length - 1] || null
    if (!lastRes) return json({ ok: true })
    const text = await lastRes.text()
    return new Response(text, { status: lastRes.status, headers: { 'content-type': 'application/json' } })
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

  // ── Redefinir senha ───────────────────────────────────────────────────────
  if (action === 'reset_password') {
    if (!userId) return json({ error: 'userId obrigatório.' }, 400)
    const { password } = data
    if (!password || password.length < 6) {
      return json({ error: 'Senha deve ter no mínimo 6 caracteres.' }, 400)
    }
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ password }),
    })
    const text = await res.text()
    return new Response(text, { status: res.status, headers: { 'content-type': 'application/json' } })
  }

  return json({ error: `Ação desconhecida: ${action}` }, 400)
}
