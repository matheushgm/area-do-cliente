// Registra o webhook ClickUp → VertaTask (api/clickup-webhook.js) no workspace.
//
//   node scripts/registrar_webhook_clickup.mjs                      lista os webhooks do workspace
//   node scripts/registrar_webhook_clickup.mjs criar --url=<URL>    cria (um só, para o workspace inteiro)
//   node scripts/registrar_webhook_clickup.mjs atualizar --id=<id> [--url=<URL>]
//                                                                   regrava URL/eventos e reativa um suspenso
//   node scripts/registrar_webhook_clickup.mjs apagar --id=<id>
//
// URL de produção: https://<domínio>/api/clickup-webhook. O ClickUp devolve o secret
// só na criação: guarde em CLICKUP_WEBHOOK_SECRET (e o id em CLICKUP_WEBHOOK_ID) na
// Vercel, sem quebra de linha. O webhook é do workspace todo; o endpoint descarta o
// que não é dos spaces sincronizados (SPACES_PADRAO / CLICKUP_SYNC_SPACE_IDS).
// Lê CLICKUP_API_TOKEN e CLICKUP_TEAM_ID de .env e .env.local.
import fs from 'node:fs'

const [acao = 'listar', ...resto] = process.argv.slice(2)
const args = Object.fromEntries(resto.map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true] }))

function lerEnv(f) {
  try { return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })) } catch { return {} }
}
const env = { ...lerEnv('.env'), ...lerEnv('.env.local'), ...process.env }
const limpo = (v) => String(v || '').replace(/\\n/g, '').trim()
const TOKEN = limpo(env.CLICKUP_API_TOKEN)
const TEAM = limpo(env.CLICKUP_TEAM_ID) || '9009170774'
if (!TOKEN) { console.error('CLICKUP_API_TOKEN ausente'); process.exit(1) }

const EVENTOS = [
  'taskCreated', 'taskUpdated', 'taskDeleted', 'taskMoved',
  'taskStatusUpdated', 'taskPriorityUpdated', 'taskAssigneeUpdated', 'taskDueDateUpdated',
  'taskTagUpdated', 'taskTimeEstimateUpdated', 'taskCommentPosted', 'taskCommentUpdated',
]

async function clickup(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.clickup.com/api/v2${path}`, {
    method, headers: { Authorization: TOKEN, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) { console.error(`ClickUp ${method} ${path}: ${res.status} ${json?.err || ''} ${json?.ECODE || ''}`); process.exit(1) }
  return json
}

const exige = (k) => { if (!args[k] || args[k] === true) { console.error(`--${k}=... é obrigatório`); process.exit(1) } return args[k] }

if (acao === 'listar') {
  const { webhooks = [] } = await clickup(`/team/${TEAM}/webhook`)
  if (!webhooks.length) console.log('Nenhum webhook neste workspace.')
  for (const w of webhooks) {
    console.log(`${w.id}  ${w.health?.status || '?'} (falhas: ${w.health?.fail_count ?? 0})  ${w.endpoint}`)
    console.log(`   eventos: ${(w.events || []).join(', ')}${w.space_id ? `  space ${w.space_id}` : ''}`)
  }
} else if (acao === 'criar') {
  const url = exige('url')
  const { webhooks = [] } = await clickup(`/team/${TEAM}/webhook`)
  const igual = webhooks.find((w) => w.endpoint === url)
  if (igual) { console.error(`Já existe o webhook ${igual.id} para essa URL. Use "atualizar --id=${igual.id}".`); process.exit(1) }
  const r = await clickup(`/team/${TEAM}/webhook`, { method: 'POST', body: { endpoint: url, events: EVENTOS } })
  console.log(`Webhook criado: ${r.id}`)
  console.log(`CLICKUP_WEBHOOK_ID=${r.id}`)
  console.log(`CLICKUP_WEBHOOK_SECRET=${r.webhook?.secret || '(o ClickUp não devolveu o secret)'}`)
} else if (acao === 'atualizar') {
  const id = exige('id')
  const { webhooks = [] } = await clickup(`/team/${TEAM}/webhook`)
  const atual = webhooks.find((w) => w.id === id)
  if (!atual) { console.error(`Webhook ${id} não encontrado.`); process.exit(1) }
  const r = await clickup(`/webhook/${id}`, { method: 'PUT', body: { endpoint: args.url && args.url !== true ? args.url : atual.endpoint, events: EVENTOS, status: 'active' } })
  console.log(`Webhook ${id} atualizado: ${r.webhook?.endpoint || ''} (${r.webhook?.health?.status || 'active'})`)
} else if (acao === 'apagar') {
  const id = exige('id')
  await clickup(`/webhook/${id}`, { method: 'DELETE' })
  console.log(`Webhook ${id} apagado.`)
} else {
  console.error(`Ação desconhecida: ${acao} (listar | criar | atualizar | apagar)`)
  process.exit(1)
}
