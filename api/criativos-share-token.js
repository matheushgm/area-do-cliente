// Edge function — gera o LINK PÚBLICO da ferramenta "Criativos com IA" de UM
// projeto/cliente. Apenas o time logado gera o link. O token é um HMAC do
// projectId com um segredo de servidor (SUPABASE_SERVICE_ROLE_KEY) — prova que
// o link é legítimo para aquele projeto.
//
// O acesso à ferramenta é por LOGIN (email + senha) dos usuários cadastrados
// (tabela criativos_users), gerenciados no módulo interno. O link em si não
// carrega senha.
export const config = { runtime: 'edge' }

function jsonErr(message, status) {
  return new Response(JSON.stringify({ error: { message } }), {
    status, headers: { 'content-type': 'application/json' },
  })
}

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

  if (req.method !== 'POST') return jsonErr('Método não permitido.', 405)

  // ── Autenticação (só o time logado gera link) ───────────────────────────────
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return jsonErr('Não autorizado.', 401)
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON },
  })
  if (!authRes.ok) return jsonErr('Sessão inválida ou expirada.', 401)

  // ── Parâmetros ──────────────────────────────────────────────────────────────
  let body
  try { body = await req.json() } catch { return jsonErr('JSON inválido.', 400) }
  const projectId = String(body?.projectId || '').trim()
  if (!projectId) return jsonErr('projectId obrigatório.', 400)

  const token = await hmacHex(SECRET, projectId)
  // Usa a origem da requisição do browser (app.revenuelab.com.br), não a URL
  // interna do deploy.
  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`
  const link = `${origin}/criativos/${encodeURIComponent(projectId)}/${token}`

  return new Response(JSON.stringify({ url: link }), {
    status: 200, headers: { 'content-type': 'application/json' },
  })
}
