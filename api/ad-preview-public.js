// Edge function — PREVIEW de um anúncio do Meta para o LINK PÚBLICO do dashboard.
// Versão sem login do api/ad-preview.js: em vez do JWT da sessão, valida o mesmo
// token HMAC (`cliente|canal`) que o /api/dash-public usa. Está para o ad-preview
// assim como o dash-public está para o dash-data.
//
// PORQUE A CHECAGEM DE POSSE É OBRIGATÓRIA: o META_TOKEN do servidor enxerga
// TODAS as contas da BM. Sem checar, um cliente com link válido da conta dele
// poderia passar qualquer ad_id e ver o anúncio de outro cliente nosso. Por isso
// só geramos o preview depois de provar, no dash_insights, que aquele ad_id
// pertence à conta assinada no token. O ad_id do Meta é global e único, então
// (conta + ad_id) é prova suficiente de posse.
//
// Como no ad-preview.js, o token do Meta nunca chega ao browser: buscamos o HTML
// do preview aqui no servidor e devolvemos já sem o token.
export const config = { runtime: 'edge' }

function jsonErr(message, status) {
  return new Response(JSON.stringify({ error: { message } }), {
    status, headers: { 'content-type': 'application/json' },
  })
}

// Formatos de preview suportados (mesmo subset do api/ad-preview.js).
const ALLOWED_FMT = [
  'MOBILE_FEED_STANDARD', 'DESKTOP_FEED_STANDARD', 'INSTAGRAM_STANDARD',
  'FACEBOOK_STORY_MOBILE', 'INSTAGRAM_STORY',
]

async function hmacHex(secret, msg) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Comparação de tempo constante (evita timing attack ao validar o token).
function safeEq(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY // segredo do HMAC + leitura do dash_insights
  const META_TOKEN = process.env.META_TOKEN || process.env.META_ACCESS_TOKEN
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonErr('Servidor não configurado.', 500)
  if (!META_TOKEN) return jsonErr('Preview indisponível: a variável META_TOKEN não está configurada na Vercel.', 503)

  // ── Parâmetros ─────────────────────────────────────────────────────────────
  const url = new URL(req.url)
  const cliente = (url.searchParams.get('cliente') || '').trim()
  const canal = url.searchParams.get('canal')
  const token = (url.searchParams.get('t') || '').trim().toLowerCase()
  const adId = (url.searchParams.get('ad_id') || '').trim()
  const fmt = (url.searchParams.get('format') || 'MOBILE_FEED_STANDARD').toUpperCase()

  if (!cliente || !token) return jsonErr('Link incompleto.', 400)
  // Preview só existe no Meta; um link de Google nunca deve chegar aqui.
  if (canal !== 'meta') return jsonErr('Preview disponível apenas para Meta Ads.', 400)
  // ^\d+$ também barra o ad_id vazio das linhas-zero sintéticas (contas paradas),
  // que se repete entre contas e não identificaria uma conta só.
  if (!/^\d+$/.test(adId)) return jsonErr('ad_id inválido.', 400)
  if (!ALLOWED_FMT.includes(fmt)) return jsonErr('Formato de preview inválido.', 400)

  // ── 1) Token do link (mesmo HMAC do /api/dash-public) ──────────────────────
  const expected = await hmacHex(SERVICE_KEY, `${cliente}|${canal}`)
  if (!safeEq(token, expected)) return jsonErr('Link inválido ou expirado.', 403)

  // ── 2) Posse: este ad_id é mesmo da conta assinada no token? ───────────────
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/dash_insights?channel=eq.meta&account=eq.${encodeURIComponent(cliente)}` +
      `&data->>ad_id=eq.${encodeURIComponent(adId)}&select=row_key&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    )
    if (!r.ok) return jsonErr('Falha ao validar o anúncio.', 502)
    const hit = await r.json()
    // Mesma mensagem para "não é seu" e "não existe" — não confirma a existência
    // de ad_ids de outras contas para quem estiver sondando.
    if (!Array.isArray(hit) || !hit.length) return jsonErr('Anúncio não encontrado nesta conta.', 404)
  } catch (e) {
    return jsonErr('Erro ao validar o anúncio.', 500)
  }

  // ── 3) Gera o iframe de preview na Graph API ───────────────────────────────
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

  // ── 4) Proxy: busca o HTML do preview no servidor (o token fica aqui) ──────
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
