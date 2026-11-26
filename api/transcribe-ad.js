import { getUser, json, jsonErr, msg } from './_http.js'
// Edge function AUTENTICADA — transcreve o vídeo de um anúncio do Meta.
// Fluxo (tudo no servidor, sem download/upload manual): valida o JWT da sessão →
// pela Graph API (token só no servidor) resolve o video_id do criativo → pega a
// URL-fonte do vídeo → baixa os bytes → manda pra Groq (whisper-large-v3-turbo,
// pt) → devolve o texto. Nada é persistido aqui: salvar em "Roteiros Validados"
// é um segundo passo (api/roteiros-validados).
export const config = { runtime: 'edge' }

const ok = (obj) => json(obj)

export default async function handler(req) {
  if (req.method !== 'POST') return jsonErr(msg(req, { pt: 'Use POST.', en: 'Use POST.' }), 405)
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  const META_TOKEN = process.env.META_TOKEN || process.env.META_ACCESS_TOKEN
  const GROQ_KEY = process.env.GROQ_API_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr(msg(req, { pt: 'Servidor não configurado.', en: 'Server not configured.' }), 500)
  if (!META_TOKEN) return jsonErr(msg(req, { pt: 'Indisponível: META_TOKEN não configurada na Vercel.', en: 'Unavailable: META_TOKEN is not set in Vercel.' }), 503)
  if (!GROQ_KEY) return jsonErr(msg(req, { pt: 'Indisponível: GROQ_API_KEY não configurada na Vercel.', en: 'Unavailable: GROQ_API_KEY is not set in Vercel.' }), 503)

  // ── Autenticação ───────────────────────────────────────────────────────────
  const auth = await getUser(req)
  if (!auth.ok) return jsonErr(auth.message, 401)

  // ── Parâmetros ─────────────────────────────────────────────────────────────
  let body = {}
  try { body = await req.json() } catch (e) { /* ignore */ }
  const adId = String(body.ad_id || '').trim()
  if (!/^\d+$/.test(adId)) return jsonErr(msg(req, { pt: 'ad_id inválido.', en: 'Invalid ad_id.' }), 400)

  // ── 1) Resolve o vídeo do criativo na Graph API ────────────────────────────
  let ad
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${adId}?fields=name,creative{id,video_id,object_story_spec,asset_feed_spec}&access_token=${encodeURIComponent(META_TOKEN)}`)
    ad = await r.json()
    if (!r.ok || ad.error) return jsonErr('Meta: ' + (ad.error?.message || msg(req, { pt: 'falha ao ler o anúncio', en: 'could not read the ad' })), 502)
  } catch (e) { return jsonErr(msg(req, { pt: 'Erro ao chamar a API do Meta.', en: 'The Meta API call failed.' }), 502) }

  const cr = ad.creative || {}, oss = cr.object_story_spec || {}, afs = cr.asset_feed_spec || {}
  const videoId = cr.video_id || oss.video_data?.video_id || (afs.videos && afs.videos[0]?.video_id)
  if (!videoId) return jsonErr(msg(req, { pt: 'Este anúncio não é um vídeo — não há o que transcrever.', en: 'This ad is not a video, so there is nothing to transcribe.' }), 400)

  let source = null
  try {
    const vr = await fetch(`https://graph.facebook.com/v19.0/${videoId}?fields=source&access_token=${encodeURIComponent(META_TOKEN)}`)
    const vj = await vr.json()
    source = vj.source || null
  } catch (e) { /* cai pro fallback */ }

  // Fallback: vídeos de página (post impulsionado) dão erro #10 no `source` sem
  // permissão de conteúdo na página. O HTML do preview do anúncio embute as URLs
  // .mp4 do CDN — extraímos de lá (menor bitrate = arquivo menor, áudio igual).
  if (!source) {
    try {
      const pr = await fetch(`https://graph.facebook.com/v19.0/${adId}/previews?ad_format=MOBILE_FEED_STANDARD&access_token=${encodeURIComponent(META_TOKEN)}`)
      const pj = await pr.json()
      const pbody = pj.data?.[0]?.body || ''
      const iframeSrc = (pbody.match(/src="([^"]+)"/) || [])[1]
      if (iframeSrc) {
        const iframeUrl = iframeSrc.replace(/&amp;/g, '&')
        const hr = await fetch(iframeUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } })
        const html = await hr.text()
        const raw = html.match(/https:(?:\\\/|\/)(?:\\\/|\/)video[^"'\s]*?\.mp4[^"'\s]*/g) || []
        const urls = raw.map(u => u.replace(/\\\//g, '/').replace(/\\u0025/gi, '%'))
        if (urls.length) {
          // menor bitrate primeiro — basta o áudio, e fica bem abaixo dos 25MB
          urls.sort((a, b) => {
            const bit = (u) => { const m = u.match(/[?&]bitrate=(\d+)/); return m ? +m[1] : Infinity }
            return bit(a) - bit(b)
          })
          source = urls[0]
        }
      }
    } catch (e) { /* trata abaixo */ }
  }
  if (!source) return jsonErr(msg(req, { pt: 'Não consegui obter o arquivo do vídeo na Meta (nem via preview).', en: 'Couldn\'t get the video file from Meta (not even through the preview).' }), 502)

  // ── 2) Baixa os bytes do vídeo (URL da Meta expira/tem CORS; por isso é no servidor) ──
  let buf, ct
  try {
    const mr = await fetch(source)
    if (!mr.ok) return jsonErr(msg(req, { pt: 'Falha ao baixar o vídeo do anúncio.', en: 'Could not download the ad video.' }), 502)
    buf = await mr.arrayBuffer()
    ct = mr.headers.get('content-type') || 'video/mp4'
  } catch (e) { return jsonErr(msg(req, { pt: 'Erro ao baixar o vídeo.', en: 'Could not download the video.' }), 502) }

  const sizeMB = buf.byteLength / 1048576
  if (sizeMB > 24) return jsonErr(msg(req, { pt: `Vídeo grande demais para transcrição (${sizeMB.toFixed(0)}MB; limite 25MB).`, en: `Video is too large to transcribe (${sizeMB.toFixed(0)}MB; limit 25MB).` }), 413)

  // ── 3) Transcreve na Groq ──────────────────────────────────────────────────
  let text = ''
  try {
    const form = new FormData()
    form.append('file', new Blob([buf], { type: ct }), 'ad.mp4')
    form.append('model', 'whisper-large-v3-turbo')
    form.append('language', 'pt')
    form.append('response_format', 'json')
    const gr = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${GROQ_KEY}` }, body: form,
    })
    const gj = await gr.json().catch(() => ({}))
    if (!gr.ok) return jsonErr('Groq: ' + (gj.error?.message || (msg(req, { pt: 'erro ', en: 'error ' }) + gr.status)), 502)
    text = (gj.text || '').trim()
  } catch (e) { return jsonErr(msg(req, { pt: 'Erro ao transcrever com a Groq.', en: 'Transcription with Groq failed.' }), 502) }
  if (!text) return jsonErr(msg(req, { pt: 'A transcrição voltou vazia (o vídeo pode não ter áudio).', en: 'The transcription came back empty (the video may have no audio).' }), 422)

  return ok({ ok: true, ad_id: adId, ad_name: ad.name || null, transcription: text })
}
