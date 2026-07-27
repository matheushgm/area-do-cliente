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
  // União de todas as chaves (não só rows[0]) — linhas heterogêneas (ex.: coluna
  // MQL nova só em registros recém-sincronizados) não perdem colunas.
  const headerSet = new Set()
  for (const r of rows) for (const k of Object.keys(r)) headerSet.add(k)
  const headers = [...headerSet]
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
  // O canal Meta tem dezenas de milhares de linhas (>33k). Cada página de 1000
  // linhas leva ~1,5s no Supabase → paginar em SÉRIE (34 páginas) dá ~50s e
  // estoura o limite de 25s da função Edge da Vercel (FUNCTION_INVOCATION_TIMEOUT
  // → 504). Solução: buscar as páginas em LOTES PARALELOS. Cada lote dispara
  // CONCURRENCY páginas ao mesmo tempo; para quando um lote traz uma página
  // incompleta (chegou ao fim). NÃO depende de count=exact nem do header
  // content-range (que pode não vir no runtime Edge) — só do tamanho das páginas.
  const PAGE = 1000
  const CONCURRENCY = 12 // ~3 lotes p/ 34 páginas → ~10s (validado contra o Supabase real)
  const MAX_ROWS = 200000 // trava de segurança
  // Ordena por row_key (PK, ÚNICO). Ordem não-única (ex.: account,day — várias
  // linhas por conta+dia, uma por anúncio) tornaria a paginação por offset
  // instável: linhas empatadas poderiam duplicar/pular na borda das páginas.
  const base = `${SUPABASE_URL}/rest/v1/dash_insights?channel=eq.${channel}${acctFilter}&select=data&order=row_key.asc`
  const fetchPage = offset =>
    fetch(base, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${jwt}`, // RLS aplicada como o usuário
        Range: `${offset}-${offset + PAGE - 1}`,
        'Range-Unit': 'items',
      },
    }).then(async r => {
      if (!r.ok) throw new Error(`page ${offset}: HTTP ${r.status}`)
      return r.json()
    })

  const rows = []
  try {
    let start = 0
    let done = false
    while (!done) {
      // Lote de CONCURRENCY páginas consecutivas, buscadas em paralelo.
      const offsets = []
      for (let j = 0; j < CONCURRENCY; j++) offsets.push(start + j * PAGE)
      const results = await Promise.all(offsets.map(fetchPage))
      for (const batch of results) for (const row of batch) rows.push(row.data)
      // Qualquer página incompleta no lote = chegamos ao fim dos dados.
      if (results.some(batch => batch.length < PAGE)) done = true
      else start += CONCURRENCY * PAGE
      if (start > MAX_ROWS) done = true
    }
  } catch (e) {
    return jsonErr('Erro ao consultar os dados.', 500)
  }

  return new Response(toCSV(rows), {
    status: 200,
    headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'private, max-age=300' },
  })
}
