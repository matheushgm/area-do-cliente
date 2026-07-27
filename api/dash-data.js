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
  // O canal Meta tem dezenas de milhares de linhas (>33k) → paginar em SÉRIE
  // fazia 30+ idas-e-voltas ao Supabase e estourava o timeout do gateway (504).
  // Agora: 1 request descobre o total (header content-range) e as páginas
  // restantes são buscadas em PARALELO com concorrência limitada.
  const PAGE = 1000
  const CONCURRENCY = 6
  const MAX_ROWS = 200000 // trava de segurança
  // Ordena por row_key (PK, ÚNICO). Ordem não-única (ex.: account,day — várias
  // linhas por conta+dia, uma por anúncio) torna a paginação por offset instável:
  // linhas empatadas podem duplicar/pular na borda das páginas buscadas em paralelo.
  const base = `${SUPABASE_URL}/rest/v1/dash_insights?channel=eq.${channel}${acctFilter}&select=data&order=row_key.asc`
  const headersFor = (offset, withCount) => {
    const h = {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${jwt}`,        // RLS aplicada como o usuário
      Range: `${offset}-${offset + PAGE - 1}`,
      'Range-Unit': 'items',
    }
    // count=exact só na 1ª página (recontar em toda página sobrecarrega o Postgres).
    if (withCount) h.Prefer = 'count=exact'
    return h
  }

  const rows = []
  try {
    // 1ª página + total de linhas (content-range: "0-999/33206")
    const first = await fetch(base, { headers: headersFor(0, true) })
    if (!first.ok) return jsonErr('Falha ao ler dados.', 502)
    const firstBatch = await first.json()
    for (const row of firstBatch) rows.push(row.data)

    const total = parseInt((first.headers.get('content-range') || '').split('/')[1], 10)
    if (Number.isFinite(total)) {
      // Caminho rápido: sabemos o total → buscamos as páginas restantes em paralelo.
      const offsets = []
      for (let o = PAGE; o < Math.min(total, MAX_ROWS); o += PAGE) offsets.push(o)
      for (let i = 0; i < offsets.length; i += CONCURRENCY) {
        const wave = offsets.slice(i, i + CONCURRENCY)
        const results = await Promise.all(
          wave.map(o => fetch(base, { headers: headersFor(o) }).then(async r => {
            if (!r.ok) throw new Error(`page ${o}: HTTP ${r.status}`)
            return r.json()
          }))
        )
        for (const batch of results) for (const row of batch) rows.push(row.data)
      }
    } else if (firstBatch.length === PAGE) {
      // Fallback: sem total no header → pagina em série até vir uma página curta
      // (evita truncar silenciosamente os dados se o content-range faltar).
      let offset = PAGE
      for (;;) {
        const r = await fetch(base, { headers: headersFor(offset) })
        if (!r.ok) return jsonErr('Falha ao ler dados.', 502)
        const batch = await r.json()
        for (const row of batch) rows.push(row.data)
        if (batch.length < PAGE) break
        offset += PAGE
        if (offset > MAX_ROWS) break
      }
    }
  } catch (e) {
    return jsonErr('Erro ao consultar os dados.', 500)
  }

  return new Response(toCSV(rows), {
    status: 200,
    headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'private, max-age=300' },
  })
}
