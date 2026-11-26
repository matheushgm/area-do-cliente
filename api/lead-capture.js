import { jsonCors, preflight, sb, msg } from './_http.js'
// Public Edge Function — captação de leads das landing pages.
// A LP faz POST /api/lead-capture?t=<ingest_token> com um JSON qualquer.
// O payload inteiro é gravado como um registro do banco correspondente e,
// se o banco tiver integração com CRM ativa, o lead é encaminhado (best-effort:
// falha no CRM nunca perde o lead nem quebra a resposta para a LP).
import { sendToCrm } from './_crm.js'
import { conversoesDoLead } from './_ab.js'

export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const json = jsonCors

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return json({ error: msg(req, { pt: 'Método não permitido.', en: 'Method not allowed.' }) }, 405)
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: msg(req, { pt: 'Servidor não configurado.', en: 'Server not configured.' }) }, 500)

  const url   = new URL(req.url)
  const token = url.searchParams.get('t') || url.searchParams.get('token')
  if (!token) return json({ error: msg(req, { pt: 'Token de captação ausente.', en: 'Missing capture token.' }) }, 400)

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
    return json({ error: msg(req, { pt: 'Corpo inválido.', en: 'Invalid body.' }) }, 400)
  }

  // Remove chaves de controle que não são dados do lead.
  delete payload.t
  delete payload.token
  delete payload._token

  // Teste A/B: o kit /ab.js manda em `_ab` quais variantes a pessoa viu. Não é
  // dado do lead, então sai do payload e vira conversão ligada ao registro.
  const ab = payload._ab
  delete payload._ab

  // Resolve o banco pelo token.
  const { data: bancos, status: bStatus } = await sb(
    `/bancos_dados?ingest_token=eq.${encodeURIComponent(token)}&select=id,crm_config`
  )
  if (bStatus !== 200 || !Array.isArray(bancos) || !bancos.length) {
    return json({ error: msg(req, { pt: 'Banco de dados não encontrado para este token.', en: 'No database found for this token.' }) }, 404)
  }

  const banco = bancos[0]

  // 1) Grava o lead — isto é o que não pode falhar.
  const { status: iStatus, data: ins } = await sb('/bancos_dados_registros', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify({ banco_id: banco.id, dados: payload, origem: 'webhook' }),
  })
  if (iStatus >= 400) return json({ error: msg(req, { pt: 'Erro ao gravar lead.', en: 'Could not save the lead.' }), detail: ins }, 500)

  const registroId = Array.isArray(ins) ? ins[0]?.id : ins?.id

  // 1b) Conversão do teste A/B. Best-effort: nunca derruba a captação.
  if (ab) {
    try { await conversoesDoLead(ab, registroId, req.headers.get('referer')) } catch { /* segue */ }
  }

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
