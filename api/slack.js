// Edge Function — notificação Slack quando um cliente novo é criado.
// POST /api/slack com body { action: 'notify_new_client', payload: {...} }
//
// Variáveis de ambiente esperadas (servidor):
//   SLACK_WEBHOOK_URL        — URL do Incoming Webhook do Slack
//   SUPABASE_URL + SUPABASE_ANON_KEY — para validar JWT do caller
export const config = { runtime: 'edge' }

function jsonErr(message, status, extra) {
  return new Response(
    JSON.stringify({ error: { message, ...(extra || {}) } }),
    { status, headers: { 'content-type': 'application/json' } }
  )
}
function jsonOk(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function fmtCurrencyBR(n) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
function fmtDateBR(iso) {
  if (!iso) return '—'
  const s = typeof iso === 'string' && iso.length === 10 ? iso + 'T00:00:00' : iso
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Validar JWT do caller
  const SUPABASE_URL  = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr('Servidor não configurado.', 500)
  const authHeader = req.headers.get('authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return jsonErr('Não autorizado.', 401)
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON },
  })
  if (!authRes.ok) return jsonErr('Sessão inválida ou expirada.', 401)

  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return jsonErr('SLACK_WEBHOOK_URL não configurado.', 500)

  let body
  try { body = await req.json() }
  catch { return jsonErr('Body inválido.', 400) }

  const action = body?.action
  if (action !== 'notify_new_client') {
    return jsonErr('Ação não suportada.', 400)
  }

  const p = body?.payload || {}
  const companyName     = p.companyName || 'Cliente sem nome'
  const responsible     = p.responsibleName || null
  const responsibleRole = p.responsibleRole || null
  const contractValue   = Number(p.contractValue) || 0
  const contractModel   = p.contractModel || null
  const contractDate    = p.contractDate || null
  const squadName       = p.squadName || null
  const createdByName   = p.createdByName || null
  const projectUrl      = p.projectUrl || null
  const clickupUrl      = p.clickupUrl || null

  const valueLabel = contractModel === 'aceleracao' ? 'Programa' : 'Mensalidade'
  const valueStr   = `${fmtCurrencyBR(contractValue)} · ${valueLabel}`

  const fields = [{ type: 'mrkdwn', text: `*Cliente*\n${companyName}` }]
  if (responsible) {
    fields.push({ type: 'mrkdwn', text: `*Responsável*\n${responsible}${responsibleRole ? ` · ${responsibleRole}` : ''}` })
  }
  if (contractValue > 0) {
    fields.push({ type: 'mrkdwn', text: `*Contrato*\n${valueStr}` })
  }
  if (contractDate) {
    fields.push({ type: 'mrkdwn', text: `*Assinatura*\n${fmtDateBR(contractDate)}` })
  }
  if (squadName) {
    fields.push({ type: 'mrkdwn', text: `*Squad*\n${squadName}` })
  }
  if (createdByName) {
    fields.push({ type: 'mrkdwn', text: `*Cadastrado por*\n${createdByName}` })
  }

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: '🎉 Novo cliente cadastrado', emoji: true } },
    { type: 'section', fields: fields.slice(0, 10) },
  ]

  const actionElements = []
  if (projectUrl) {
    actionElements.push({
      type: 'button',
      text: { type: 'plain_text', text: 'Abrir perfil', emoji: true },
      url: projectUrl,
    })
  }
  if (clickupUrl) {
    actionElements.push({
      type: 'button',
      text: { type: 'plain_text', text: 'Abrir no ClickUp', emoji: true },
      url: clickupUrl,
    })
  }
  if (actionElements.length > 0) {
    blocks.push({ type: 'actions', elements: actionElements })
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Novo cliente cadastrado: ${companyName}`, // fallback p/ notificação
        blocks,
      }),
    })
    const text = await res.text()
    if (!res.ok || text !== 'ok') {
      return jsonErr(`Slack webhook retornou: ${text || res.status}`, 502)
    }
    return jsonOk({ ok: true })
  } catch (e) {
    return jsonErr(e?.message || 'Erro ao enviar notificação Slack', 502)
  }
}
