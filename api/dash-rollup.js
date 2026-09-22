import { getUser, jsonErr } from './_http.js'
// Edge function — serve o ROLLUP diário do Dashboard de Tráfego (public.dash_daily),
// somente para usuários autenticados, com a mesma checagem de JWT do /api/dash-data.
//
// Por que existe: a lista de contas da dashboard (status, diagnóstico de queda,
// candidatas a escala, pace de verba, barra de resumo) só precisa de SOMAS por
// conta/dia/campanha. Ler as linhas cruas de dash_insights para isso significava
// puxar ~55 mil registros JSONB largos (74 MB, ~37s de CPU no Postgres) a cada
// abertura da página, o que estourava o limite de 25s da Edge Function em 504.
// O rollup tem ~24 mil linhas estreitas e resolve em menos de um segundo.
//
// O CSV sai com os MESMOS nomes de coluna do canal (`Valor investido`, `Dia`,
// `Gasto`, `Data`…), então buildStats, buildDeclineDiagnosis, buildScaleCandidates
// e summaryFor consomem o rollup sem alteração nenhuma. As linhas cruas continuam
// em /api/dash-data e são lidas só ao abrir a página de um cliente.
export const config = { runtime: 'edge' }

// Mapa coluna-do-rollup → nome que o cliente já espera, por canal.
const COLS = {
  meta: [
    ['account', 'Nome da conta'], ['day', 'Dia'], ['campaign', 'Nome da campanha'],
    ['spend', 'Valor investido'], ['conv', 'Conversões'],
    ['clicks', 'Número de cliques no link'], ['impressions', 'Impressões'],
  ],
  google: [
    ['account', 'Nome da conta'], ['day', 'Data'], ['campaign', 'Campanha'],
    ['spend', 'Gasto'], ['conv', 'Conversões'],
    ['clicks', 'CLiques'], ['impressions', 'Impressões'],
  ],
}

// Página grande de propósito: o rollup inteiro do Meta sai do índice em ~12ms,
// então o custo aqui é round-trip, não banco. Se o PostgREST devolver menos que
// o pedido (limite do servidor), a paginação abaixo continua correta: ela avança
// pelo tamanho REAL de cada página, não pelo pedido.
const PAGE = 10000
const MAX_ROWS = 200000
const iso = d => d.toISOString().slice(0, 10)

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr('Servidor não configurado.', 500)

  const auth = await getUser(req)
  if (!auth.ok) return jsonErr(auth.message, 401)
  const jwt = auth.jwt

  const url = new URL(req.url)
  const channel = url.searchParams.get('channel')
  if (!COLS[channel]) return jsonErr('channel inválido (use meta|google).', 400)

  // Janela opcional em dias. Sem ela, devolve o histórico inteiro do canal.
  const diasRaw = parseInt(url.searchParams.get('dias') || '', 10)
  let since = ''
  if (Number.isFinite(diasRaw) && diasRaw > 0) {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - Math.min(diasRaw, 3650))
    since = `&day=gte.${iso(d)}`
  }

  const cols = COLS[channel]
  const select = cols.map(([c]) => c).join(',')
  // A ordem bate com a PK (channel, account, day, campaign), então o Postgres
  // pagina direto pelo índice, sem ordenar.
  const base = `${SUPABASE_URL}/rest/v1/dash_daily?channel=eq.${channel}${since}`
    + `&select=${select}&order=account.asc,day.asc,campaign.asc`
  const headers = { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt}` }

  const rows = []
  try {
    // Avança pelo tamanho REAL de cada página em vez de assumir PAGE: se o
    // PostgREST devolver menos que o pedido por limite do servidor, a paginação
    // continua correta em vez de parar cedo e perder linhas.
    for (let offset = 0; ;) {
      let batch, lastErr
      for (let attempt = 0; attempt < 3 && !batch; attempt++) {
        try {
          const r = await fetch(base, {
            headers: { ...headers, Range: `${offset}-${offset + PAGE - 1}`, 'Range-Unit': 'items' },
          })
          if (r.ok) { batch = await r.json(); break }
          lastErr = new Error(`offset ${offset}: HTTP ${r.status}`)
        } catch (e) { lastErr = new Error(`offset ${offset}: ${e?.message || e}`) }
        await new Promise(res => setTimeout(res, 250 * (attempt + 1)))
      }
      if (!batch) throw lastErr
      for (const row of batch) rows.push(row)
      if (!batch.length || rows.length > MAX_ROWS) break
      offset += batch.length
    }
  } catch (e) {
    return jsonErr(`Erro ao consultar o rollup (${e?.message || e}).`, 500)
  }

  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'
  const linhas = [cols.map(([, nome]) => esc(nome)).join(',')]
  for (const r of rows) linhas.push(cols.map(([c]) => esc(r[c])).join(','))

  return new Response(linhas.join('\n'), {
    status: 200,
    headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'private, max-age=300' },
  })
}
