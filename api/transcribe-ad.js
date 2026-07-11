// Edge function AUTENTICADA — transcreve o vídeo de um anúncio do Meta.
// Fluxo (tudo no servidor, sem download/upload manual): valida o JWT da sessão →
// pela Graph API (token só no servidor) resolve o video_id do criativo → pega a
// URL-fonte do vídeo → baixa os bytes → manda pra Groq (whisper-large-v3-turbo,
// pt) → devolve o texto. Nada é persistido aqui: salvar em "Roteiros Validados"
// é um segundo passo (api/roteiros-validados).
export const config = { runtime: 'edge' }

function jsonErr(message, status) {
  return new Response(JSON.stringify({ error: { message } }), { status, headers: { 'content-type': 'application/json' } })
}
function ok(obj) {
  return new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } })
}

export default async function handler(req) {
  if (req.method !== 'POST') return jsonErr('Use POST.', 405)
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  const META_TOKEN = process.env.META_TOKEN || process.env.META_ACCESS_TOKEN
  const GROQ_KEY = process.env.GROQ_API_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr('Servidor não configurado.', 500)
  if (!META_TOKEN) return jsonErr('Indisponível: META_TOKEN não configurada na Vercel.', 503)
  if (!GROQ_KEY) return jsonErr('Indisponível: GROQ_API_KEY não configurada na Vercel.', 503)

  // ── Autenticação ───────────────────────────────────────────────────────────
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return jsonErr('Não autorizado.', 401)
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON } })
  if (!authRes.ok) return jsonErr('Sessão inválida ou expirada.', 401)

  // ── Parâmetros ─────────────────────────────────────────────────────────────
  let body = {}
  try { body = await req.json() } catch (e) { /* ignore */ }
  const adId = String(body.ad_id || '').trim()
  if (!/^\d+$/.test(adId)) return jsonErr('ad_id inválido.', 400)

  // ── 1) Resolve o vídeo do criativo na Graph API ────────────────────────────
  let ad
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${adId}?fields=name,creative{id,video_id,object_story_spec,asset_feed_spec}&access_token=${encodeURIComponent(META_TOKEN)}`)
    ad = await r.json()
    if (!r.ok || ad.error) return jsonErr('Meta: ' + (ad.error?.message || 'falha ao ler o anúncio'), 502)
  } catch (e) { return jsonErr('Erro ao chamar a API do Meta.', 502) }

  const cr = ad.creative || {}, oss = cr.object_story_spec || {}, afs = cr.asset_feed_spec || {}
  const videoId = cr.video_id || oss.video_data?.video_id || (afs.videos && afs.videos[0]?.video_id)
  if (!videoId) return jsonErr('Este anúncio não é um vídeo — não há o que transcrever.', 400)

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
  if (!source) return jsonErr('Não consegui obter o arquivo do vídeo na Meta (nem via preview).', 502)

  // ── 2) Baixa os bytes do vídeo (URL da Meta expira/tem CORS; por isso é no servidor) ──
  let buf, ct
  try {
    const mr = await fetch(source)
    if (!mr.ok) return jsonErr('Falha ao baixar o vídeo do anúncio.', 502)
    buf = await mr.arrayBuffer()
    ct = mr.headers.get('content-type') || 'video/mp4'
  } catch (e) { return jsonErr('Erro ao baixar o vídeo.', 502) }

  const sizeMB = buf.byteLength / 1048576
  if (sizeMB > 24) return jsonErr(`Vídeo grande demais para transcrição (${sizeMB.toFixed(0)}MB; limite 25MB).`, 413)

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
    if (!gr.ok) return jsonErr('Groq: ' + (gj.error?.message || ('erro ' + gr.status)), 502)
    text = (gj.text || '').trim()
  } catch (e) { return jsonErr('Erro ao transcrever com a Groq.', 502) }
  if (!text) return jsonErr('A transcrição voltou vazia (o vídeo pode não ter áudio).', 422)

  return ok({ ok: true, ad_id: adId, ad_name: ad.name || null, transcription: text })
}
