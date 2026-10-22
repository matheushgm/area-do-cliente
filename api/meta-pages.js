import { getUser, jsonErr } from './_http.js'
// Edge function: devolve a PÁGINA DE DESTINO (link do criativo) de uma lista de
// anúncios do Meta. O dash_insights só guarda o tipo de destino (WhatsApp/Site);
// o link em si está no criativo, então lemos via Graph API em lotes (`?ids=`).
// Alimenta a sub-aba "Landing pages" do Meta no viewer. POST { ad_ids: [..] }
// → { links: { [ad_id]: { link, cta } } }. Token só no servidor; exige login.
export const config = { runtime: 'edge' }

const LOTE = 40
const MAX_ADS = 600
const PARALELO = 4

function extrairLink(ad) {
  const cr = ad?.creative || {}, oss = cr.object_story_spec || {}, afs = cr.asset_feed_spec || {}
  const ld = oss.link_data || {}, vd = oss.video_data || {}, ph = oss.photo_data || {}
  const cta = ld.call_to_action || vd.call_to_action || {}
  const filho = (ld.child_attachments || []).find((c) => c.link)
  const link = ld.link
    || cta.value?.link
    || filho?.link
    || (afs.link_urls || []).find((x) => x.website_url)?.website_url
    || ph.url
    || null
  return { link: link || null, cta: cta.type || cr.call_to_action_type || null }
}

export default async function handler(req) {
  const META_TOKEN = process.env.META_TOKEN || process.env.META_ACCESS_TOKEN
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return jsonErr('Servidor não configurado.', 500)
  if (!META_TOKEN) return jsonErr('Indisponível: META_TOKEN não configurada na Vercel.', 503)
  if (req.method !== 'POST') return jsonErr('Use POST.', 405)

  const auth = await getUser(req)
  if (!auth.ok) return jsonErr(auth.message, 401)

  let body
  try { body = await req.json() } catch { return jsonErr('JSON inválido.', 400) }
  const ids = [...new Set((body?.ad_ids || []).map(String).filter((x) => /^\d+$/.test(x)))].slice(0, MAX_ADS)
  if (!ids.length) return new Response(JSON.stringify({ links: {}, erros: 0 }), { status: 200, headers: { 'content-type': 'application/json' } })

  const lotes = []
  for (let i = 0; i < ids.length; i += LOTE) lotes.push(ids.slice(i, i + LOTE))
  const links = {}
  let erros = 0
  const buscar = async (lote) => {
    try {
      const url = `https://graph.facebook.com/v19.0/?ids=${lote.join(',')}&fields=creative{object_story_spec,asset_feed_spec,call_to_action_type}&access_token=${encodeURIComponent(META_TOKEN)}`
      const r = await fetch(url)
      const d = await r.json()
      if (!r.ok || d.error) { erros += lote.length; return }
      for (const id of lote) if (d[id]) links[id] = extrairLink(d[id])
    } catch { erros += lote.length }
  }
  for (let i = 0; i < lotes.length; i += PARALELO) await Promise.all(lotes.slice(i, i + PARALELO).map(buscar))

  return new Response(JSON.stringify({ links, erros }), {
    status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=600' },
  })
}
