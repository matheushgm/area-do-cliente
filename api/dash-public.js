import { hmacHex, jsonErr, lerPaginado, filtroDias } from './_http.js'
// Edge function — serve os dados de UM cliente para o LINK PÚBLICO (somente
// leitura) do dashboard. NÃO exige login: valida um token HMAC (`cliente|canal`)
// gerado por /api/dash-share-token e devolve apenas as linhas daquela conta.
// Usa SERVICE_ROLE no servidor para ler dash_insights (que tem RLS só-authenticated),
// mas filtra estritamente por `account=eq.<cliente>` — nunca devolve outras contas.
// Região iad1, a mesma do banco (ver api/dash-data.js).
export const config = { runtime: 'edge', regions: ['iad1'] }

// Monta CSV (todos os campos entre aspas) — mesmo formato de api/dash-data.js,
// para o viewer parsear igual. União de todas as chaves (linhas heterogêneas).
function toCSV(rows) {
  if (!rows.length) return ''
  const headerSet = new Set()
  for (const r of rows) for (const k of Object.keys(r)) headerSet.add(k)
  const headers = [...headerSet]
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'
  const lines = [headers.map(esc).join(',')]
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(','))
  return lines.join('\n')
}

// Comparação de tempo constante (evita timing attack ao validar o token).
function safeEq(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonErr('Servidor não configurado.', 500)

  // ── Parâmetros + validação do token ─────────────────────────────────────────
  const url = new URL(req.url)
  const cliente = (url.searchParams.get('cliente') || '').trim()
  const canal = url.searchParams.get('canal')
  const token = (url.searchParams.get('t') || '').trim().toLowerCase()
  if (!cliente || !token) return jsonErr('Link incompleto.', 400)
  if (!['meta', 'google'].includes(canal)) return jsonErr('canal inválido (use meta|google).', 400)

  const expected = await hmacHex(SERVICE_KEY, `${cliente}|${canal}`)
  if (!safeEq(token, expected)) return jsonErr('Link inválido ou expirado.', 403)

  // `dados=status` devolve o snapshot de status ATUAL das entidades (canal
  // meta_status) em vez das linhas de insights. Mesmo token, mesmo cliente —
  // só existe para o canal Meta.
  const wantStatus = url.searchParams.get('dados') === 'status'
  if (wantStatus && canal !== 'meta') return jsonErr('status só existe no canal meta.', 400)
  const channel = wantStatus ? 'meta_status' : canal
  // row_key desempata o dia: as páginas são lidas em paralelo e o Range só é
  // estável com uma ordem total.
  const order = wantStatus ? 'row_key.asc' : 'day.asc,row_key.asc'
  // Janela (`dias` ou `de`/`ate`), como no /api/dash-data. O status não tem dia.
  const janela = wantStatus ? '' : filtroDias(url).qs

  // ── Lê dash_insights só desta conta, em páginas paralelas (teto de 1000/req) ──
  let rows
  try {
    const lidas = await lerPaginado(
      `${SUPABASE_URL}/rest/v1/dash_insights?channel=eq.${encodeURIComponent(channel)}&account=eq.${encodeURIComponent(cliente)}${janela}&select=data&order=${order}`,
      // service_role: bypassa RLS, mas o filtro account=eq trava no cliente
      { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      { rotulo: channel },
    )
    rows = lidas.map(row => row.data)
  } catch (e) {
    return jsonErr('Erro ao consultar os dados.', 500)
  }

  return new Response(toCSV(rows), {
    status: 200,
    headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'public, max-age=300' },
  })
}
