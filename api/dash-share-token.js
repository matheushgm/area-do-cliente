// Edge function — gera o LINK PÚBLICO (somente leitura) do dashboard de UM cliente.
// Apenas usuários autenticados (o time) podem gerar o link. O token é um HMAC do
// par `cliente|canal` com um segredo de servidor (SUPABASE_SERVICE_ROLE_KEY, que
// nunca sai do servidor). Assim /api/dash-public só devolve dados quando o token
// confere — impedindo trocar ?cliente= no link para ver os dados de outro cliente.
export const config = { runtime: 'edge' }

function jsonErr(message, status) {
  return new Response(JSON.stringify({ error: { message } }), {
    status, headers: { 'content-type': 'application/json' },
  })
}

// HMAC-SHA256(secret, msg) em hex (Web Crypto, disponível no runtime edge).
async function hmacHex(secret, msg) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY // chave publishable (sb_...)
  const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY // segredo de servidor p/ o HMAC
  if (!SUPABASE_URL || !SUPABASE_ANON || !SECRET) return jsonErr('Servidor não configurado.', 500)

  // ── Autenticação (só o time logado gera link) ───────────────────────────────
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return jsonErr('Não autorizado.', 401)
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON },
  })
  if (!authRes.ok) return jsonErr('Sessão inválida ou expirada.', 401)

  // ── Parâmetros ──────────────────────────────────────────────────────────────
  const url = new URL(req.url)
  const cliente = (url.searchParams.get('cliente') || '').trim()
  const canal = url.searchParams.get('canal')
  if (!cliente) return jsonErr('cliente obrigatório.', 400)
  if (!['meta', 'google'].includes(canal)) return jsonErr('canal inválido (use meta|google).', 400)

  const token = await hmacHex(SECRET, `${cliente}|${canal}`)
  // Usa a origem da requisição do browser (app.revenuelab.com.br), não a URL
  // interna do deploy. O viewer estático é servido publicamente em /dash-teste/.
  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`
  const link = `${origin}/dash-teste/viewer.html?cliente=${encodeURIComponent(cliente)}&canal=${canal}&shared=1&t=${token}`

  return new Response(JSON.stringify({ url: link }), {
    status: 200, headers: { 'content-type': 'application/json' },
  })
}
