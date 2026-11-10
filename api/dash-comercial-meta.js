import { getUser, jsonErr } from './_http.js'
// Edge function: mídia paga (Meta) do Dashboard Comercial, ferramenta interna em
// public/ferramentas/dashboard-comercial/. Porta do api/meta.js do repo
// eduardomouras/dashboard-comercial-verta, com login obrigatório (lá o endpoint era
// aberto). GET ?since=YYYY-MM-DD&until=YYYY-MM-DD → gasto, leads e MQLs por campanha
// da conta Matheus Business. Token só no servidor (META_TOKEN da Vercel).
export const config = { runtime: 'edge' }

const ACCOUNT = 'act_1307754696082194'   // Matheus Business
const ACCOUNT_NAME = 'Matheus Business'
const API = 'https://graph.facebook.com/v19.0'

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

// soma valores de um array de actions/conversions cujo tipo casa com o filtro
function sumBy(arr, pred) {
  let t = 0
  for (const a of arr || []) if (pred(a.action_type)) t += parseFloat(a.value) || 0
  return t
}
const isLead = (t) => t === 'lead'
// conversão personalizada MQL_REV_DASH: o Meta a expõe como ...fb_pixel_custom.mql
const isMql = (t) => t.startsWith('offsite_conversion.fb_pixel_custom') && /\bmql\b/i.test(t)

const ok = (body) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=300' },
})
const erro = (status, error, extra = {}) => new Response(JSON.stringify({ ok: false, error, ...extra }), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
})

export default async function handler(req) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return jsonErr('Servidor não configurado.', 500)
  const token = process.env.META_TOKEN || process.env.META_ACCESS_TOKEN
  if (!token) return erro(500, 'META_TOKEN não configurado no servidor.')

  const auth = await getUser(req)
  if (!auth.ok) return erro(401, auth.message + ' Entre na Área do Cliente e recarregue.')

  const q = new URL(req.url).searchParams
  const since = q.get('since'), until = q.get('until')
  if (!isDate(since) || !isDate(until)) return erro(400, 'Parâmetros since/until devem ser YYYY-MM-DD.')

  const base = `${API}/${ACCOUNT}/insights`
    + `?level=campaign&limit=200`
    + `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`
    + `&fields=${encodeURIComponent('campaign_id,campaign_name,spend,actions,conversions')}`
    + `&access_token=${encodeURIComponent(token)}`

  try {
    const campaigns = []
    let url = base, guard = 0
    // pagina os resultados (contas com muitas campanhas)
    while (url && guard++ < 20) {
      const r = await fetch(url)
      const j = await r.json()
      if (j.error) {
        const e = j.error
        const expirado = e.code === 190
        return erro(expirado ? 401 : 502, expirado
          ? 'Token do Meta expirou ou foi revogado. Atualize META_TOKEN na Vercel.'
          : ('Meta: ' + (e.message || 'erro desconhecido')), { code: e.code || null })
      }
      for (const c of j.data || []) {
        campaigns.push({
          id: c.campaign_id,
          name: c.campaign_name || '(sem nome)',
          spend: parseFloat(c.spend) || 0,
          leads: sumBy(c.actions, isLead),
          mqls: sumBy(c.conversions, isMql),
        })
      }
      url = (j.paging && j.paging.next) || null
    }
    return ok({ ok: true, account: ACCOUNT_NAME, since, until, fetchedAt: new Date().toISOString(), campaigns })
  } catch (err) {
    return erro(502, 'Falha ao contatar o Meta: ' + (err.message || err))
  }
}
