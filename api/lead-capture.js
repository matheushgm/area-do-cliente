// Public Edge Function — captação de leads das landing pages.
// A LP faz POST /api/lead-capture?t=<ingest_token> com um JSON qualquer.
// O payload inteiro é gravado como um registro do banco correspondente e,
// se o banco tiver integração com CRM ativa, o lead é encaminhado (best-effort:
// falha no CRM nunca perde o lead nem quebra a resposta para a LP).
import { sendToCrm } from './_crm.js'

export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  })
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         opts.prefer || 'return=representation',
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { data, status: res.status }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Servidor não configurado.' }, 500)

  const url   = new URL(req.url)
  const token = url.searchParams.get('t') || url.searchParams.get('token')
  if (!token) return json({ error: 'Token de captação ausente.' }, 400)

  // Aceita JSON ou form-urlencoded (para <form> nativo sem JS).
  let payload = {}
  const ct = req.headers.get('content-type') || ''
  try {
    if (ct.includes('application/json')) {
      payload = await req.json()
    } else {
      const form = await req.formData()
      for (const [k, v] of form.entries()) payload[k] = v
    }
  } catch {
    return json({ error: 'Corpo inválido.' }, 400)
  }

  // Remove chaves de controle que não são dados do lead.
  delete payload.t
  delete payload.token
  delete payload._token

  // Resolve o banco pelo token.
  const { data: bancos, status: bStatus } = await sb(
    `/bancos_dados?ingest_token=eq.${encodeURIComponent(token)}&select=id,crm_config`
  )
  if (bStatus !== 200 || !Array.isArray(bancos) || !bancos.length) {
    return json({ error: 'Banco de dados não encontrado para este token.' }, 404)
  }

  const banco = bancos[0]

  // 1) Grava o lead — isto é o que não pode falhar.
  const { status: iStatus, data: ins } = await sb('/bancos_dados_registros', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify({ banco_id: banco.id, dados: payload, origem: 'webhook' }),
  })
  if (iStatus >= 400) return json({ error: 'Erro ao gravar lead.', detail: ins }, 500)

  const registroId = Array.isArray(ins) ? ins[0]?.id : ins?.id

  // 2) Encaminha para o CRM, se configurado. Best-effort: qualquer erro aqui
  //    é apenas registrado no lead; a LP continua recebendo sucesso.
  const cfg = banco.crm_config
  if (cfg?.enabled && cfg?.endpoint && registroId) {
    try {
      const result = await sendToCrm(cfg, payload)
      await sb(`/bancos_dados_registros?id=eq.${registroId}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: JSON.stringify({
          crm_status: result.ok ? 'ok' : 'erro',
          crm_response: `${result.status} ${String(result.response || '').slice(0, 1000)}`.trim(),
        }),
      })
    } catch (e) {
      await sb(`/bancos_dados_registros?id=eq.${registroId}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: JSON.stringify({ crm_status: 'erro', crm_response: `Falha inesperada: ${e.message}` }),
      })
    }
  }

  return json({ success: true })
}
