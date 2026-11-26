import { getUser, json, jsonErr, msg } from './_http.js'
// Edge function — salva a mídia de um anúncio do Meta no Banco de Anúncios.
// Fluxo (tudo no servidor): valida o JWT da sessão → pela Graph API (token só no
// servidor) resolve o vídeo/imagem do criativo + a copy → baixa a mídia →
// re-hospeda no bucket público `ad-bank` do Supabase → insere a linha em
// `ad_bank`. A URL da Meta expira/tem CORS, por isso re-hospedamos. Storage e
// insert usam o JWT do usuário (respeita a RLS, igual o app React faz).
export const config = { runtime: 'edge' }

const ok = (obj) => json(obj)

function extFromType(ct) {
  ct = ct || ''
  if (/mp4/.test(ct)) return 'mp4'
  if (/webm/.test(ct)) return 'webm'
  if (/quicktime|mov/.test(ct)) return 'mov'
  if (/png/.test(ct)) return 'png'
  if (/webp/.test(ct)) return 'webp'
  if (/gif/.test(ct)) return 'gif'
  if (/jpe?g/.test(ct)) return 'jpg'
  return null
}

export default async function handler(req) {
  if (req.method !== 'POST') return jsonErr(msg(req, { pt: 'Use POST.', en: 'Use POST.' }), 405)
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  const META_TOKEN = process.env.META_TOKEN || process.env.META_ACCESS_TOKEN
  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr(msg(req, { pt: 'Servidor não configurado.', en: 'Server not configured.' }), 500)
  if (!META_TOKEN) return jsonErr(msg(req, { pt: 'Indisponível: META_TOKEN não configurada na Vercel.', en: 'Unavailable: META_TOKEN isn\'t set on Vercel.' }), 503)

  // ── Autenticação ───────────────────────────────────────────────────────────
  const auth = await getUser(req)
  if (!auth.ok) return jsonErr(auth.message, 401)
  const jwt = auth.jwt

  // ── Parâmetros ─────────────────────────────────────────────────────────────
  let body = {}
  try { body = await req.json() } catch (e) { /* ignore */ }
  const adId = String(body.ad_id || '').trim()
  const funil = String(body.funil || '').trim()
  const account = String(body.account || '').trim()
  const passedTitle = String(body.title || '').trim()
  const refFrom = String(body.ref_from || '').trim() || null
  const refTo = String(body.ref_to || '').trim() || null
  const numOrNull = v => (v === null || v === undefined || v === '' || !Number.isFinite(+v)) ? null : +v
  const ctrLink = numOrNull(body.ctr_link), convRate = numOrNull(body.conv_rate), hookRate = numOrNull(body.hook_rate)
  const conversions = numOrNull(body.conversions), leads = numOrNull(body.leads), purchases = numOrNull(body.purchases)
  const spendVal = numOrNull(body.spend), costPerConv = numOrNull(body.cost_per_conv)
  if (!/^\d+$/.test(adId)) return jsonErr(msg(req, { pt: 'ad_id inválido.', en: 'Invalid ad_id.' }), 400)
  if (!funil) return jsonErr(msg(req, { pt: 'Selecione o funil.', en: 'Select the funnel stage.' }), 400)

  // ── 1) Resolve a mídia do criativo na Graph API ────────────────────────────
  let ad
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${adId}?fields=name,creative{id,video_id,image_url,thumbnail_url,body,object_story_spec,asset_feed_spec}&access_token=${encodeURIComponent(META_TOKEN)}`)
    ad = await r.json()
    if (!r.ok || ad.error) return jsonErr('Meta: ' + (ad.error?.message || msg(req, { pt: 'falha ao ler o anúncio', en: 'failed to read the ad' })), 502)
  } catch (e) { return jsonErr(msg(req, { pt: 'Erro ao chamar a API do Meta.', en: 'Error calling the Meta API.' }), 502) }

  const cr = ad.creative || {}, oss = cr.object_story_spec || {}, afs = cr.asset_feed_spec || {}
  const copy = oss.video_data?.message || oss.link_data?.message || (afs.bodies && afs.bodies[0]?.text) || cr.body || ''
  const videoId = cr.video_id || oss.video_data?.video_id || (afs.videos && afs.videos[0]?.video_id)
  // Link de destino (LP) do criativo — mesmo resolvedor do api/ad-link.
  const _ld = oss.link_data || {}, _vd = oss.video_data || {}, _cta = _ld.call_to_action || _vd.call_to_action || {}
  const destLink = _ld.link || _cta.value?.link || (afs.link_urls && afs.link_urls[0]?.website_url) || null

  let mediaUrl = null, type = 'estatico'
  if (videoId) {
    try {
      const vr = await fetch(`https://graph.facebook.com/v19.0/${videoId}?fields=source&access_token=${encodeURIComponent(META_TOKEN)}`)
      const vj = await vr.json()
      if (vj.source) { mediaUrl = vj.source; type = 'video' }
    } catch (e) { /* cai pra imagem */ }
  }
  if (!mediaUrl) {
    mediaUrl = cr.image_url || oss.link_data?.picture || (afs.images && afs.images[0]?.url) || cr.thumbnail_url || null
    type = 'estatico'
  }
  if (!mediaUrl) return jsonErr(msg(req, { pt: 'Não encontrei o vídeo/imagem deste anúncio (pode ser um formato não suportado).', en: 'Couldn\'t find this ad\'s video/image (it may be an unsupported format).' }), 404)

  // ── 2) Baixa a mídia ───────────────────────────────────────────────────────
  let buf, ct
  try {
    const mr = await fetch(mediaUrl)
    if (!mr.ok) return jsonErr(msg(req, { pt: 'Falha ao baixar a mídia do anúncio.', en: 'Failed to download the ad\'s media.' }), 502)
    buf = await mr.arrayBuffer()
    ct = mr.headers.get('content-type') || (type === 'video' ? 'video/mp4' : 'image/jpeg')
  } catch (e) { return jsonErr(msg(req, { pt: 'Erro ao baixar a mídia.', en: 'Error downloading the media.' }), 502) }
  const ext = extFromType(ct) || (type === 'video' ? 'mp4' : 'jpg')

  // ── 3) Re-hospeda no bucket `ad-bank` (como o usuário, via JWT) ─────────────
  const path = `${crypto.randomUUID()}.${ext}`
  try {
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/ad-bank/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON, 'content-type': ct },
      body: buf,
    })
    if (!up.ok) return jsonErr(msg(req, { pt: 'Falha ao salvar no storage: ', en: 'Failed to save to storage: ' }) + (await up.text()).slice(0, 200), 502)
  } catch (e) { return jsonErr(msg(req, { pt: 'Erro ao salvar no storage.', en: 'Error saving to storage.' }), 502) }
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/ad-bank/${path}`

  // ── 4) Cria a linha em `ad_bank` ───────────────────────────────────────────
  const title = (passedTitle || ad.name || '').slice(0, 200) || null
  const notes = [account ? `Cliente: ${account}` : null, copy || null].filter(Boolean).join('\n\n').slice(0, 2000) || null
  let item
  try {
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/ad_bank`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON, 'content-type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ type, funil, title, url: publicUrl, notes,
        dest_link: destLink, ref_from: refFrom, ref_to: refTo, ctr_link: ctrLink, conv_rate: convRate, hook_rate: hookRate,
        conversions, leads, purchases, spend: spendVal, cost_per_conv: costPerConv }),
    })
    if (!ins.ok) return jsonErr(msg(req, { pt: 'Falha ao registrar no Banco de Anúncios: ', en: 'Failed to save to the Ad Library: ' }) + (await ins.text()).slice(0, 200), 502)
    item = (await ins.json())[0]
  } catch (e) { return jsonErr(msg(req, { pt: 'Erro ao registrar no Banco de Anúncios.', en: 'Error saving to the Ad Library.' }), 502) }

  return ok({ ok: true, type, item })
}
