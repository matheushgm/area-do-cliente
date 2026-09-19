import { getUser, jsonErr } from './_http.js'
// Edge function — serve os dados do Dashboard de Tráfego (versão API) lendo da
// tabela public.dash_insights no Supabase, SOMENTE para usuários autenticados.
// Valida o JWT da sessão (igual api/anthropic.js) e repassa esse mesmo JWT ao
// PostgREST, de modo que a RLS (SELECT só para authenticated) seja aplicada.
// Os dados NUNCA ficam no repositório nem em arquivo público.
export const config = { runtime: 'edge' }

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

const PAGE = 1000        // linhas por requisição ao PostgREST
const CONCURRENCY = 8    // fatias lidas ao mesmo tempo
const SLICE_TARGET = 5   // dias por fatia (~2 mil linhas no canal Meta)
const MAX_ROWS = 200000  // trava de segurança

const iso = d => d.toISOString().slice(0, 10)
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d) }

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY // chave publishable (sb_...)
  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr('Servidor não configurado.', 500)

  // ── Autenticação ───────────────────────────────────────────────────────────
  const auth = await getUser(req)
  if (!auth.ok) return jsonErr(auth.message, 401)
  const jwt = auth.jwt

  // ── Parâmetros ─────────────────────────────────────────────────────────────
  const url = new URL(req.url)
  const channel = url.searchParams.get('channel')
  // meta_status = snapshot do status ATUAL de cada campanha/conjunto/anúncio
  // (1 linha por entidade, sem dia) — evita o dashboard mostrar como ativo o
  // que já foi pausado.
  // google_ads = nível de anúncio do Google (com a URL de destino);
  // google_pages = páginas de destino (landing_page_view). Os dois são lidos
  // sob demanda, sempre com `account`, ao abrir a página de um cliente.
  const ALLOWED = ['meta', 'google', 'google_terms', 'meta_status', 'google_ads', 'google_pages']
  if (!ALLOWED.includes(channel)) {
    return jsonErr('channel inválido.', 400)
  }
  // Filtro opcional por conta (pode repetir: ?account=A&account=B) — usado pelos
  // termos de pesquisa (google_terms) e pela página do cliente, que só precisa
  // das contas vinculadas ao projeto em vez do canal inteiro. Sem isso o canal
  // Meta (60 mil linhas) estourava os 25s da Edge ao abrir "Resultados".
  const accountList = url.searchParams.getAll('account').map(a => a.trim()).filter(Boolean)
  const account = accountList.length > 0
  // Sintaxe PostgREST: eq.X para uma conta, in.("A","B") para várias (aspas
  // internas escapadas com barra invertida).
  const acctFilter = accountList.length === 1
    ? `&account=eq.${encodeURIComponent(accountList[0])}`
    : accountList.length > 1
      ? `&account=in.(${encodeURIComponent(accountList.map(a => '"' + a.replace(/"/g, '\\"') + '"').join(','))})`
      : ''
  // Janela opcional de dias (ex.: dias=16 para o preset de 7 dias + comparação).
  // Sem o parâmetro, devolve o histórico inteiro do canal.
  const diasRaw = parseInt(url.searchParams.get('dias') || '', 10)
  const dias = Number.isFinite(diasRaw) && diasRaw > 0 ? Math.min(diasRaw, 3650) : null

  const headers = {
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${jwt}`, // RLS aplicada como o usuário
  }
  const base = `${SUPABASE_URL}/rest/v1/dash_insights?channel=eq.${channel}${acctFilter}`

  // Uma página que falhe derruba a resposta INTEIRA (o dashboard mostra
  // "meta: HTTP 500") — e falhas transitórias acontecem sob requisições
  // paralelas (hiccup de rede/Supabase). Retry curto por página (3 tentativas,
  // backoff 250/500ms) absorve isso sem estourar o limite de 25s da Edge.
  const getPage = async (qs, offset, label) => {
    let lastErr
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(`${base}${qs}&select=data&order=row_key.asc`, {
          headers: { ...headers, Range: `${offset}-${offset + PAGE - 1}`, 'Range-Unit': 'items' },
        })
        if (r.ok) return r.json()
        lastErr = new Error(`${label}+${offset}: HTTP ${r.status}`)
      } catch (e) {
        lastErr = new Error(`${label}+${offset}: ${e?.message || e}`)
      }
      await new Promise(res => setTimeout(res, 250 * (attempt + 1)))
    }
    throw lastErr
  }

  // Lê TUDO que casa com `qs`, paginando por Range. Usado só em recortes
  // pequenos (uma fatia de dias, uma conta, o snapshot de status), onde o
  // offset nunca passa de alguns milhares.
  //
  // Por que não paginar o canal inteiro assim: OFFSET faz o Postgres reler
  // todas as linhas anteriores, então o custo cresce ao QUADRADO do tamanho da
  // tabela. Com 55 mil linhas, a página do fim já leva ~3,6s sozinha, contra um
  // statement_timeout de 8s no papel `authenticated` — e cada falha dessas
  // derruba a resposta inteira em 504. Daí o fatiamento por dia abaixo.
  const readAll = async (qs, label) => {
    const out = []
    for (let offset = 0; ; offset += PAGE) {
      const batch = await getPage(qs, offset, label)
      for (const row of batch) out.push(row.data)
      if (batch.length < PAGE || out.length > MAX_ROWS) return out
    }
  }

  // Menor e maior dia do canal, para saber onde começa e termina o fatiamento.
  // Duas consultas baratas: ambas resolvem no índice (channel, day).
  const edgeDay = async dir => {
    const r = await fetch(`${base}&select=day&order=day.${dir}&limit=1`, { headers })
    if (!r.ok) throw new Error(`limites de data: HTTP ${r.status}`)
    const j = await r.json()
    return j[0]?.day || null
  }

  let rows
  try {
    // meta_status não tem coluna `day` (1 linha por entidade, sem histórico), e
    // a busca por conta já devolve um recorte pequeno: nos dois casos vale ler
    // direto, sem fatiar.
    if (channel === 'meta_status' || account) {
      const since = dias ? `&day=gte.${addDays(iso(new Date()), -dias)}` : ''
      rows = await readAll(channel === 'meta_status' ? '' : since, channel)
    } else {
      const hoje = iso(new Date())
      const janela = dias ? addDays(hoje, -dias) : null
      const [minDia, ultimo] = await Promise.all([edgeDay('asc'), edgeDay('desc')])
      // Começa no mais recente entre o início da janela pedida e o primeiro dia
      // que existe no canal: fatiar antes disso só geraria consultas vazias.
      const inicio = janela && minDia && janela > minDia ? janela : minDia
      if (!inicio || !ultimo) {
        rows = []
      } else {
        // Fatias de dias, lidas em PARALELO. Cada fatia é uma consulta rasa e
        // indexada por (channel, day): nenhuma chega perto do statement_timeout
        // de 8s, e o custo total passa a crescer de forma linear com a tabela.
        const fatias = []
        for (let d = inicio; d <= ultimo; d = addDays(d, SLICE_TARGET)) {
          const fim = addDays(d, SLICE_TARGET)
          fatias.push(`&day=gte.${d}&day=lt.${fim}`)
        }
        rows = []
        for (let i = 0; i < fatias.length; i += CONCURRENCY) {
          const lote = fatias.slice(i, i + CONCURRENCY)
          const res = await Promise.all(lote.map((qs, j) => readAll(qs, `${channel} fatia ${i + j}`)))
          for (const parte of res) for (const row of parte) rows.push(row)
          if (rows.length > MAX_ROWS) break
        }
      }
    }
  } catch (e) {
    // Mensagem com a causa (fatia/status) para diagnóstico — endpoint é
    // autenticado, não vaza nada sensível.
    return jsonErr(`Erro ao consultar os dados (${e?.message || e}).`, 500)
  }

  return new Response(toCSV(rows), {
    status: 200,
    headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'private, max-age=300' },
  })
}
