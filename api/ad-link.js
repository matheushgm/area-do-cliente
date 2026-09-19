import { getUser, jsonErr } from './_http.js'
// Edge function — retorna o destino (link real) de um anúncio do Meta.
// O dado da planilha tem só o TIPO de destino (WhatsApp/Site/...); o link em si
// (LP) não é coletado, então buscamos no criativo via Graph API (token só no
// servidor). Valida o JWT da sessão, igual aos outros endpoints.
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  const META_TOKEN = process.env.META_TOKEN || process.env.META_ACCESS_TOKEN
  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr('Servidor não configurado.', 500)
  if (!META_TOKEN) return jsonErr('Indisponível: META_TOKEN não configurada na Vercel.', 503)

  const auth = await getUser(req)
  if (!auth.ok) return jsonErr(auth.message, 401)

  const adId = (new URL(req.url).searchParams.get('ad_id') || '').trim()
  if (!/^\d+$/.test(adId)) return jsonErr('ad_id inválido.', 400)

  let ad
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${adId}?fields=creative{object_story_spec,asset_feed_spec,call_to_action_type}&access_token=${encodeURIComponent(META_TOKEN)}`)
    ad = await r.json()
    if (!r.ok || ad.error) return jsonErr('Meta: ' + (ad.error?.message || 'falha ao ler o anúncio'), 502)
  } catch (e) { return jsonErr('Erro ao chamar a API do Meta.', 502) }

  const cr = ad.creative || {}, oss = cr.object_story_spec || {}, afs = cr.asset_feed_spec || {}
  const ld = oss.link_data || {}, vd = oss.video_data || {}
  const cta = ld.call_to_action || vd.call_to_action || {}
  const link = ld.link
    || cta.value?.link
    || (afs.link_urls && afs.link_urls[0]?.website_url)
    || null
  const ctaType = cta.type || cr.call_to_action_type || null

  return new Response(JSON.stringify({ link: link || null, cta: ctaType }), {
    status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=300' },
  })
}
