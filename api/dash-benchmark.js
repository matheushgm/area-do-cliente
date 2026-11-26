import { getUser, jsonErr, msg } from './_http.js'
// Edge function: benchmark interno do Dashboard de Tráfego. Chama a RPC
// dash_benchmark (migration 106), que soma por conta os últimos N dias fechados
// sem as campanhas de topo, e devolve { meta: [...], google: [...] } só para
// usuário logado (a RPC é executada com o JWT de quem pediu).
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr(msg(req, { pt: 'Servidor não configurado.', en: 'Server not configured.' }), 500)
  const auth = await getUser(req)
  if (!auth.ok) return jsonErr(auth.message, 401)

  const dias = parseInt(new URL(req.url).searchParams.get('dias') || '30', 10)
  const p_days = Number.isFinite(dias) ? Math.min(Math.max(dias, 1), 365) : 30
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/dash_benchmark`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${auth.jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_days }),
    })
    if (!r.ok) return jsonErr(msg(req, { pt: 'Falha ao ler o benchmark: HTTP ', en: 'Could not load the benchmark: HTTP ' }) + r.status, 502)
    return new Response(JSON.stringify({ dias: p_days, ...(await r.json()) }), {
      status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=300' },
    })
  } catch (e) { return jsonErr(msg(req, { pt: 'Erro ao consultar o banco.', en: 'Database query failed.' }), 502) }
}
