// Edge Function — notificação Slack quando um cliente novo é criado.
// POST /api/slack com body { action: 'notify_new_client', payload: {...} }
//
// Variáveis de ambiente esperadas (servidor):
//   SLACK_BOT_TOKEN          — Bot User OAuth Token (xoxb-...)
//   SLACK_NOTIFY_USER_ID     — Slack user_id do destinatário (default: U094B4EFGG0)
//   SUPABASE_URL + SUPABASE_ANON_KEY — para validar JWT do caller
export const config = { runtime: 'edge' }

const SLACK_API = 'https://slack.com/api'
const DEFAULT_NOTIFY_USER = 'U094B4EFGG0' // Matheus Martins

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

async function slack(method, path, token, body) {
  const res = await fetch(`${SLACK_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || data?.ok === false) {
    const err = new Error(`Slack ${method} ${path} falhou: ${data?.error || res.status}`)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
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

  // Configuração de ambiente
  const token   = process.env.SLACK_BOT_TOKEN
  const userId  = process.env.SLACK_NOTIFY_USER_ID || DEFAULT_NOTIFY_USER
  if (!token) return jsonErr('SLACK_BOT_TOKEN não configurado.', 500)

  let body
  try { body = await req.json() }
  catch { return jsonErr('Body inválido.', 400) }

  const action = body?.action
  if (action !== 'notify_new_client') {
    return jsonErr('Ação não suportada.', 400)
  }

  const p = body?.payload || {}
  const companyName    = p.companyName || 'Cliente sem nome'
  const responsible    = p.responsibleName || null
  const responsibleRole = p.responsibleRole || null
  const contractValue  = Number(p.contractValue) || 0
  const contractModel  = p.contractModel || null
  const contractDate   = p.contractDate || null
  const squadName      = p.squadName || null
  const createdByName  = p.createdByName || null
  const projectUrl     = p.projectUrl || null
  const clickupUrl     = p.clickupUrl || null

  // Bonita formatação rica usando blocks. Markdown também funciona como
  // fallback, mas blocks renderiza mais limpo no Slack.
  const valueLabel = contractModel === 'aceleracao' ? 'Programa' : 'Mensalidade'
  const valueStr   = `${fmtCurrencyBR(contractValue)} · ${valueLabel}`

  const fields = [
    { type: 'mrkdwn', text: `*Cliente*\n${companyName}` },
  ]
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
    {
      type: 'header',
      text: { type: 'plain_text', text: '🎉 Novo cliente cadastrado', emoji: true },
    },
    { type: 'section', fields: fields.slice(0, 10) }, // Slack aceita até 10 fields
  ]

  // Botões de link (se houver URLs)
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
    // Slack precisa do channel ser o user_id do destinatário pra mandar DM.
    // chat.postMessage com `channel: U…` envia direto pro DM de Matheus.
    const data = await slack('POST', '/chat.postMessage', token, {
      channel: userId,
      text: `Novo cliente cadastrado: ${companyName}`, // fallback
      blocks,
    })
    return jsonOk({ ok: true, ts: data?.ts, channel: data?.channel })
  } catch (e) {
    return jsonErr(
      e?.message || 'Erro ao enviar notificação Slack',
      e?.status >= 400 ? e.status : 502,
      { detail: e?.body }
    )
  }
}
