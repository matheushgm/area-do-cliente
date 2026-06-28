// Edge function — gera o PREVIEW de um anúncio do Meta a partir do ad_id.
// Fluxo seguro: valida o JWT da sessão (igual api/dash-data.js), chama a Graph
// API com o token do Meta que vive SÓ no servidor (env META_ACCESS_TOKEN),
// pega o iframe de preview, busca o HTML no servidor (proxy) e devolve esse
// HTML já SEM o token. O navegador renderiza via <iframe srcdoc> — o token
// nunca chega ao cliente. O repositório é público, então o token jamais pode
// estar no código.
export const config = { runtime: 'edge' }

function jsonErr(message, status) {
  return new Response(JSON.stringify({ error: { message } }), {
    status, headers: { 'content-type': 'application/json' },
  })
}

// Formatos de preview suportados (subset dos ad_format da Graph API).
const ALLOWED_FMT = [
  'MOBILE_FEED_STANDARD', 'DESKTOP_FEED_STANDARD', 'INSTAGRAM_STANDARD',
  'FACEBOOK_STORY_MOBILE', 'INSTAGRAM_STORY',
]

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY // publishable (sb_...)
  const META_TOKEN = process.env.META_ACCESS_TOKEN
  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr('Servidor não configurado.', 500)
  if (!META_TOKEN) return jsonErr('Preview indisponível: a variável META_ACCESS_TOKEN ainda não foi configurada na Vercel.', 503)

  // ── Autenticação (mesmo padrão de dash-data) ───────────────────────────────
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return jsonErr('Não autorizado.', 401)
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON },
  })
  if (!authRes.ok) return jsonErr('Sessão inválida ou expirada.', 401)

  // ── Parâmetros ─────────────────────────────────────────────────────────────
  const url = new URL(req.url)
  const adId = (url.searchParams.get('ad_id') || '').trim()
  if (!/^\d+$/.test(adId)) return jsonErr('ad_id inválido.', 400)
  const fmt = (url.searchParams.get('format') || 'MOBILE_FEED_STANDARD').toUpperCase()
  if (!ALLOWED_FMT.includes(fmt)) return jsonErr('Formato de preview inválido.', 400)

  // ── 1) Gera o iframe de preview na Graph API ───────────────────────────────
  let prev
  try {
    const r = await fetch(
      `https://graph.facebook.com/v19.0/${adId}/previews?ad_format=${fmt}&access_token=${encodeURIComponent(META_TOKEN)}`
    )
    prev = await r.json()
    if (!r.ok || prev.error) return jsonErr('Meta: ' + (prev.error?.message || 'falha ao gerar o preview'), 502)
  } catch (e) {
    return jsonErr('Erro ao chamar a API do Meta.', 502)
  }
  const body = prev?.data?.[0]?.body || ''
  const m = body.match(/src="([^"]+)"/)
  if (!m) return jsonErr('Sem preview disponível para este formato.', 404)
  const src = m[1].replace(/&amp;/g, '&')

  // ── 2) Proxy: busca o HTML do preview no servidor (token fica aqui) ─────────
  let html
  try {
    const r2 = await fetch(src)
    html = await r2.text()
  } catch (e) {
    return jsonErr('Erro ao carregar o preview.', 502)
  }

  // Remove qualquer ocorrência do token antes de devolver (defesa em profundidade).
  html = html.split(META_TOKEN).join('').split(encodeURIComponent(META_TOKEN)).join('')

  return new Response(JSON.stringify({ html }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=300' },
  })
}
