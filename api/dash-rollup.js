import { getUser, jsonErr, lerPaginado, filtroDias } from './_http.js'
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
//
// Região iad1 (Virgínia), a mesma do banco (us-east-1): rodando perto do usuário
// (gru1) cada página do PostgREST pagava a travessia do continente.
export const config = { runtime: 'edge', regions: ['iad1'] }

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

  // Janela: `dias=N` ou `de`/`ate` (ver filtroDias). Sem nada, o histórico inteiro.
  const { qs: janela } = filtroDias(url)

  // Filtro opcional por conta (repetível: ?account=A&account=B), mesma sintaxe do
  // /api/dash-data. O viewer embutido na página do cliente pede só as contas do
  // projeto em vez do canal inteiro.
  const accountList = url.searchParams.getAll('account').map(a => a.trim()).filter(Boolean)
  const acctFilter = accountList.length === 1
    ? `&account=eq.${encodeURIComponent(accountList[0])}`
    : accountList.length > 1
      ? `&account=in.(${encodeURIComponent(accountList.map(a => '"' + a.replace(/"/g, '\\"') + '"').join(','))})`
      : ''

  const cols = COLS[channel]
  const select = cols.map(([c]) => c).join(',')
  // A ordem bate com a PK (channel, account, day, campaign): o Postgres pagina
  // direto pelo índice e o Range é estável entre as páginas paralelas.
  const base = `${SUPABASE_URL}/rest/v1/dash_daily?channel=eq.${channel}${acctFilter}${janela}`
    + `&select=${select}&order=account.asc,day.asc,campaign.asc`

  let rows
  try {
    rows = await lerPaginado(base, { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt}` }, { rotulo: channel })
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
