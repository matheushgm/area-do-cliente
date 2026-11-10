import { getUser, hmacHex, jsonErr, lerPaginado, serviceKey } from './_http.js'
// Edge function — LINK PÚBLICO DE UM ANÚNCIO do Meta (página /anuncio/<token>).
//
// POST (time logado, JWT): { cliente, ad_id, de, ate } → { url }. O token é
//   `<payload>.<assinatura>`: payload = base64url do JSON { c, a, de, ate } e
//   assinatura = HMAC (SUPABASE_SERVICE_ROLE_KEY, que nunca sai do servidor) de
//   `anuncio|<payload>`. Assim quem recebe o link não troca o anúncio, a conta nem
//   o período: qualquer mudança invalida a assinatura.
// GET ?s=<token>              → nome do anúncio, período e métricas do período.
// GET ?s=<token>&preview=FMT  → HTML do preview do Meta (sem o token do Meta).
//
// Mesmo cuidado do api/ad-preview-public.js: o META_TOKEN enxerga todas as contas
// da BM, então só respondemos depois de provar no dash_insights que o ad_id é da
// conta assinada no token.
export const config = { runtime: 'edge', regions: ['iad1'] }

const ALLOWED_FMT = [
  'MOBILE_FEED_STANDARD', 'DESKTOP_FEED_STANDARD', 'INSTAGRAM_STANDARD',
  'FACEBOOK_STORY_MOBILE', 'INSTAGRAM_STORY',
]
const ISO = /^\d{4}-\d{2}-\d{2}$/

// Mesmo parser BR do num() de public/dash-teste/vendor/dashboardData.js.
function num(s) {
  if (s == null) return 0
  if (typeof s === 'number') return s
  s = String(s)
  if (!s || s === '-') return 0
  s = s.replace(/R\$\s*/g, '').replace(/%/g, '').trim()
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  return parseFloat(s) || 0
}

function safeEq(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const b64url = (str) => {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const unb64url = (s) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

const json = (body, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache } })

// Linhas de insight do anúncio na conta (ad_id é global no Meta). `de`/`ate`
// opcionais: sem eles serve só para provar a posse.
async function linhasDoAnuncio(SUPABASE_URL, KEY, cliente, adId, de, ate, limite) {
  let url = `${SUPABASE_URL}/rest/v1/dash_insights?channel=eq.meta&account=eq.${encodeURIComponent(cliente)}` +
    `&data->>ad_id=eq.${encodeURIComponent(adId)}&select=day,data&order=day.asc,row_key.asc`
  if (de) url += `&day=gte.${de}`
  if (ate) url += `&day=lte.${ate}`
  if (limite) url += `&limit=${limite}`
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` }
  if (limite) {
    const r = await fetch(url, { headers })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return r.json()
  }
  return lerPaginado(url, headers, { rotulo: 'anuncio-publico' })
}

async function gerarLink(req, SUPABASE_URL, SECRET, KEY) {
  const auth = await getUser(req)
  if (!auth.ok) return jsonErr(auth.message, 401)
  const body = await req.json().catch(() => ({}))
  const cliente = String(body.cliente || '').trim()
  const adId = String(body.ad_id || '').trim()
  const de = String(body.de || '').trim(), ate = String(body.ate || '').trim()
  if (!cliente) return jsonErr('cliente obrigatório.', 400)
  if (!/^\d+$/.test(adId)) return jsonErr('ad_id inválido.', 400)
  if (!ISO.test(de) || !ISO.test(ate) || de > ate) return jsonErr('Período inválido.', 400)

  // Confere que o anúncio é da conta antes de assinar, para não gerar link que
  // depois só daria erro.
  try {
    const hit = await linhasDoAnuncio(SUPABASE_URL, KEY, cliente, adId, null, null, 1)
    if (!hit.length) return jsonErr('Anúncio não encontrado nesta conta.', 404)
  } catch (e) {
    return jsonErr('Falha ao validar o anúncio.', 502)
  }

  const payload = b64url(JSON.stringify({ c: cliente, a: adId, de, ate }))
  const sig = await hmacHex(SECRET, `anuncio|${payload}`)
  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`
  return json({ url: `${origin}/anuncio/${payload}.${sig}` })
}

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  // HMAC com o mesmo segredo dos outros links públicos; leitura do banco com a
  // chave de serviço atual (sb_secret, com fallback na service_role).
  const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || serviceKey()
  const KEY = serviceKey()
  if (!SUPABASE_URL || !SECRET || !KEY) return jsonErr('Servidor não configurado.', 500)

  if (req.method === 'POST') return gerarLink(req, SUPABASE_URL, SECRET, KEY)
  if (req.method !== 'GET') return jsonErr('Método não permitido.', 405)

  // ── Token ───────────────────────────────────────────────────────────────────
  const url = new URL(req.url)
  const s = (url.searchParams.get('s') || '').trim()
  const [payload, sig] = s.split('.')
  if (!payload || !sig) return jsonErr('Link incompleto.', 400)
  const expected = await hmacHex(SECRET, `anuncio|${payload}`)
  if (!safeEq(sig.toLowerCase(), expected)) return jsonErr('Link inválido.', 403)
  let tok
  try { tok = JSON.parse(unb64url(payload)) } catch (e) { return jsonErr('Link inválido.', 403) }
  const cliente = String(tok.c || ''), adId = String(tok.a || ''), de = String(tok.de || ''), ate = String(tok.ate || '')
  if (!cliente || !/^\d+$/.test(adId) || !ISO.test(de) || !ISO.test(ate)) return jsonErr('Link inválido.', 403)

  // ── Preview ─────────────────────────────────────────────────────────────────
  const fmt = url.searchParams.get('preview')
  if (fmt) {
    const META_TOKEN = process.env.META_TOKEN || process.env.META_ACCESS_TOKEN
    if (!META_TOKEN) return jsonErr('Preview indisponível no momento.', 503)
    const F = fmt.toUpperCase()
    if (!ALLOWED_FMT.includes(F)) return jsonErr('Formato de preview inválido.', 400)
    try {
      const hit = await linhasDoAnuncio(SUPABASE_URL, KEY, cliente, adId, null, null, 1)
      if (!hit.length) return jsonErr('Anúncio não encontrado.', 404)
    } catch (e) {
      return jsonErr('Falha ao validar o anúncio.', 502)
    }
    let prev
    try {
      const r = await fetch(`https://graph.facebook.com/v19.0/${adId}/previews?ad_format=${F}&access_token=${encodeURIComponent(META_TOKEN)}`)
      prev = await r.json()
      if (!r.ok || prev.error) return jsonErr('Não foi possível gerar o preview deste formato.', 502)
    } catch (e) {
      return jsonErr('Erro ao chamar o Meta.', 502)
    }
    const m = (prev?.data?.[0]?.body || '').match(/src="([^"]+)"/)
    if (!m) return jsonErr('Sem preview disponível para este formato.', 404)
    let html
    try { html = await (await fetch(m[1].replace(/&amp;/g, '&'))).text() } catch (e) { return jsonErr('Erro ao carregar o preview.', 502) }
    html = html.split(META_TOKEN).join('').split(encodeURIComponent(META_TOKEN)).join('')
    return json({ html }, 200, 'private, max-age=300')
  }

  // ── Métricas do período ─────────────────────────────────────────────────────
  // Mesmas fórmulas da tabela de anúncios do viewer: CTR = cliques no link ÷
  // impressões, CPM = gasto ÷ impressões × 1000, taxa de conversão = conversões ÷
  // cliques no link, CPL = gasto ÷ conversões (coluna "Conversões").
  let rows
  try {
    rows = await linhasDoAnuncio(SUPABASE_URL, KEY, cliente, adId, de, ate)
  } catch (e) {
    return jsonErr('Falha ao ler as métricas.', 502)
  }
  if (!rows.length) {
    // Sem linha no período: ainda prova a posse para devolver ao menos o preview.
    const hit = await linhasDoAnuncio(SUPABASE_URL, KEY, cliente, adId, null, null, 1).catch(() => [])
    if (!hit.length) return jsonErr('Anúncio não encontrado.', 404)
  }
  let spend = 0, impr = 0, clicks = 0, conv = 0, nome = '', ultimoDia = ''
  for (const { day, data: r } of rows) {
    spend += num(r['Valor investido'])
    impr += num(r['Impressões'])
    clicks += num(r['Número de cliques no link'])
    conv += num(r['Conversões'])
    if (r['Nome do Anúncio'] && day >= ultimoDia) { nome = r['Nome do Anúncio']; ultimoDia = day }
  }
  if (!nome) {
    const hit = await linhasDoAnuncio(SUPABASE_URL, KEY, cliente, adId, null, null, 1).catch(() => [])
    nome = hit[0]?.data?.['Nome do Anúncio'] || ''
  }
  const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100)
  return json({
    anuncio: { nome },
    periodo: { de, ate },
    metricas: {
      ctr: impr > 0 ? r2((clicks / impr) * 100) : null,
      cpm: impr > 0 ? r2((spend / impr) * 1000) : null,
      taxa_conversao: clicks > 0 ? r2((conv / clicks) * 100) : null,
      cpl: conv > 0 ? r2(spend / conv) : null,
      conversoes: conv,
      impressoes: impr,
    },
  }, 200, 'public, max-age=300')
}
