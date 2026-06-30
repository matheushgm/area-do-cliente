// Edge function — serve os dados de UM cliente para o LINK PÚBLICO (somente
// leitura) do dashboard. NÃO exige login: valida um token HMAC (`cliente|canal`)
// gerado por /api/dash-share-token e devolve apenas as linhas daquela conta.
// Usa SERVICE_ROLE no servidor para ler dash_insights (que tem RLS só-authenticated),
// mas filtra estritamente por `account=eq.<cliente>` — nunca devolve outras contas.
export const config = { runtime: 'edge' }

function jsonErr(message, status) {
  return new Response(JSON.stringify({ error: { message } }), {
    status, headers: { 'content-type': 'application/json' },
  })
}

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

async function hmacHex(secret, msg) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
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

  // ── Lê dash_insights só desta conta, paginado (PostgREST limita ~1000/req) ───
  const PAGE = 1000
  let offset = 0
  const rows = []
  try {
    for (;;) {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/dash_insights?channel=eq.${encodeURIComponent(canal)}&account=eq.${encodeURIComponent(cliente)}&select=data&order=day.asc`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`, // service_role: bypassa RLS, mas o filtro account=eq trava no cliente
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
    headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'public, max-age=300' },
  })
}
