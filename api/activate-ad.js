import { getUser, jsonErr, msg } from './_http.js'
// Edge function — ativa em 1 clique um teste 'paused_ready' (botão "Ativar" da
// Central de anúncios). Chama a Meta API direto (rápido) com o META_TOKEN,
// liga conjunto + anúncio, e agenda o veredito para +7 dias.
export const config = { runtime: 'edge' }

const GRAPH = 'https://graph.facebook.com/v19.0'
// Piloto — só estas contas podem ser ativadas (espelha o guardrail do motor).
const PILOT = new Set(['act_5346279295414773', 'act_1307754696082194'])

async function metaSetStatus(id, status, token) {
  const r = await fetch(`${GRAPH}/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ status, access_token: token }),
  })
  const d = await r.json().catch(() => ({}))
  if (d.error) throw new Error(d.error.error_user_msg || d.error.message || 'erro Meta')
  return d
}

export default async function handler(req) {
  if (req.method !== 'POST') return jsonErr('Method not allowed', 405)

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  const META_TOKEN = process.env.META_TOKEN
  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr(msg(req, { pt: 'Servidor não configurado.', en: 'Server not configured.' }), 500)
  if (!META_TOKEN) return jsonErr(msg(req, { pt: 'META_TOKEN não configurado no servidor.', en: 'META_TOKEN isn\'t set on the server.' }), 500)

  // ── Auth ────────────────────────────────────────────────────────────────────
  const auth = await getUser(req)
  if (!auth.ok) return jsonErr(auth.message, 401)
  const jwt = auth.jwt

  let body
  try { body = await req.json() } catch { return jsonErr(msg(req, { pt: 'Body inválido.', en: 'Invalid body.' }), 400) }
  const testId = body?.test_id
  if (!testId) return jsonErr(msg(req, { pt: 'test_id obrigatório.', en: 'test_id is required.' }), 400)

  // ── Lê o teste (RLS authenticated, via JWT do usuário) ──────────────────────
  const sbHeaders = { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt}` }
  const rowRes = await fetch(
    `${SUPABASE_URL}/rest/v1/creative_tests?id=eq.${testId}&select=account_id,adset_id,ad_id,status`,
    { headers: sbHeaders }
  )
  const rows = await rowRes.json().catch(() => [])
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row) return jsonErr(msg(req, { pt: 'Teste não encontrado.', en: 'Test not found.' }), 404)
  if (!PILOT.has(row.account_id)) return jsonErr(msg(req, { pt: 'Conta fora do piloto (bloqueado).', en: 'This account isn\'t in the pilot (blocked).' }), 403)
  if (!row.adset_id || !row.ad_id) return jsonErr(msg(req, { pt: 'Teste ainda não publicado.', en: 'Test not published yet.' }), 400)
  if (row.status === 'active') return jsonErr(msg(req, { pt: 'Esse teste já está ativo.', en: 'This test is already active.' }), 409)

  // ── Ativa no Meta (conjunto e anúncio; a campanha já está ativa) ────────────
  try {
    await metaSetStatus(row.adset_id, 'ACTIVE', META_TOKEN)
    await metaSetStatus(row.ad_id, 'ACTIVE', META_TOKEN)
  } catch (e) {
    return jsonErr(msg(req, { pt: `Falha ao ativar no Meta: ${e.message}`, en: `Failed to activate on Meta: ${e.message}` }), 502)
  }

  // ── Marca ativo + agenda veredito (+7 dias) ─────────────────────────────────
  const now = new Date()
  const evalAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/creative_tests?id=eq.${testId}`, {
    method: 'PATCH',
    headers: { ...sbHeaders, 'content-type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'active',
      activated_at: now.toISOString(),
      evaluate_at: evalAt.toISOString(),
      updated_at: now.toISOString(),
    }),
  })
  if (!patchRes.ok) {
    const t = await patchRes.text()
    return jsonErr(msg(req, { pt: `Ativado no Meta, mas falhou ao gravar status: ${t.slice(0, 160)}`, en: `Activated on Meta, but failed to save the status: ${t.slice(0, 160)}` }), 500)
  }

  return new Response(JSON.stringify({ ok: true, evaluate_at: evalAt.toISOString() }), {
    status: 200, headers: { 'content-type': 'application/json' },
  })
}
