// Edge Runtime: sem timeout fixo, suporta streaming nativo
export const config = { runtime: 'edge' }

function jsonErr(message, status) {
  return new Response(
    JSON.stringify({ error: { message } }),
    { status, headers: { 'content-type': 'application/json' } }
  )
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // ── Verificar autenticação ────────────────────────────────────────────────
  const SUPABASE_URL  = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return jsonErr('Servidor não configurado corretamente.', 500)
  }

  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return jsonErr('Não autorizado.', 401)

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON },
  })
  if (!authRes.ok) return jsonErr('Sessão inválida ou expirada.', 401)

  // ── Validar env e body ────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return jsonErr('ANTHROPIC_API_KEY não configurada no servidor.', 500)

  let body
  try { body = await req.json() }
  catch {
    return jsonErr('Corpo da requisição inválido.', 400)
  }

  // Permitir apenas campos esperados pela API da Anthropic
  const { model, max_tokens, system, messages, stream } = body
  const payload = { model, max_tokens, system, messages, stream }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':          apiKey,
        'anthropic-version':  '2023-06-01',
        'anthropic-beta':     'prompt-caching-2024-07-31,pdfs-2024-09-25',
        'content-type':       'application/json',
      },
      body: JSON.stringify(payload),
    })

    // Passthrough direto — funciona para streaming (text/event-stream) e JSON normal
    const contentType = response.headers.get('content-type') || 'application/json'
    return new Response(response.body, {
      status: response.status,
      headers: { 'content-type': contentType },
    })

  } catch (err) {
    console.error('[/api/anthropic] Erro interno:', err)
    return new Response(
      JSON.stringify({ error: { message: 'Erro interno. Tente novamente.' } }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}
