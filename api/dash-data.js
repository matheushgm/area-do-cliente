// Edge function — serve os dados do Dashboard de Tráfego (versão API) lendo da
// tabela public.dash_insights no Supabase, SOMENTE para usuários autenticados.
// Valida o JWT da sessão (igual api/anthropic.js) e repassa esse mesmo JWT ao
// PostgREST, de modo que a RLS (SELECT só para authenticated) seja aplicada.
// Os dados NUNCA ficam no repositório nem em arquivo público.
export const config = { runtime: 'edge' }

function jsonErr(message, status) {
  return new Response(JSON.stringify({ error: { message } }), {
    status, headers: { 'content-type': 'application/json' },
  })
}

// Monta CSV (todos os campos entre aspas) a partir de uma lista de objetos.
function toCSV(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'
  const lines = [headers.map(esc).join(',')]
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(','))
  return lines.join('\n')
}

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY // chave publishable (sb_...)
  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr('Servidor não configurado.', 500)

  // ── Autenticação ───────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return jsonErr('Não autorizado.', 401)

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON },
  })
  if (!authRes.ok) return jsonErr('Sessão inválida ou expirada.', 401)

  // ── Parâmetro ──────────────────────────────────────────────────────────────
  const url = new URL(req.url)
  const channel = url.searchParams.get('channel')
  const ALLOWED = ['meta', 'google', 'google_terms']
  if (!ALLOWED.includes(channel)) {
    return jsonErr('channel inválido (use meta|google|google_terms).', 400)
  }
  // Filtro opcional por conta — usado pelos termos de pesquisa (google_terms),
  // que são lazy/por-cliente para não baixar todas as contas de uma vez.
  const account = url.searchParams.get('account')
  const acctFilter = account ? `&account=eq.${encodeURIComponent(account)}` : ''

  // ── Lê dash_insights paginado (PostgREST limita ~1000/req) ──────────────────
  const PAGE = 1000
  let offset = 0
  const rows = []
  try {
    for (;;) {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/dash_insights?channel=eq.${channel}${acctFilter}&select=data&order=account.asc,day.asc`,
        {
          headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${jwt}`,           // RLS aplicada como o usuário
            Range: `${offset}-${offset + PAGE - 1}`,
            'Range-Unit': 'items',
          },
        }
      )
      if (!r.ok) return jsonErr('Falha ao ler dados.', 502)
      const batch = await r.json()
      for (const row of batch) rows.push(row.data)
      if (batch.length < PAGE) break
      offset += PAGE
      if (offset > 200000) break // trava de segurança
    }
  } catch (e) {
    return jsonErr('Erro ao consultar os dados.', 500)
  }

  return new Response(toCSV(rows), {
    status: 200,
    headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'private, max-age=300' },
  })
}
