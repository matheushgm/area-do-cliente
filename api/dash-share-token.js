import { getUser, hmacHex, jsonErr } from './_http.js'
// Edge function — gera o LINK PÚBLICO (somente leitura) do dashboard de UM cliente.
// Apenas usuários autenticados (o time) podem gerar o link. O token é um HMAC do
// par `cliente|canal` com um segredo de servidor (SUPABASE_SERVICE_ROLE_KEY, que
// nunca sai do servidor). Assim /api/dash-public só devolve dados quando o token
// confere — impedindo trocar ?cliente= no link para ver os dados de outro cliente.
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY // chave publishable (sb_...)
  const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY // segredo de servidor p/ o HMAC
  if (!SUPABASE_URL || !SUPABASE_ANON || !SECRET) return jsonErr('Servidor não configurado.', 500)

  // ── Autenticação (só o time logado gera link) ───────────────────────────────
  const auth = await getUser(req)
  if (!auth.ok) return jsonErr(auth.message, 401)

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
