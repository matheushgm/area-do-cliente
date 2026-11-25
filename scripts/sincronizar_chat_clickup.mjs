// Traz o ClickUp Chat para o chat do VertaTask (só ClickUp → VertaTask), rodando local, sem
// limite de tempo. Idempotente pelos ids do ClickUp: rodar de novo só acrescenta o que é novo
// ou foi editado lá. Usa a mesma lógica do pull (`puxar` em api/_chat_sync_core.js).
//
//   node scripts/sincronizar_chat_clickup.mjs              últimos 7 dias
//   node scripts/sincronizar_chat_clickup.mjs --completo   histórico inteiro de todos os canais
//   node scripts/sincronizar_chat_clickup.mjs --since=2026-10-28T00:00:00Z
//   --membros    relê os membros de todos os canais e acrescenta quem falta
//   --threads    relê todas as threads com resposta (não só as que mudaram de contagem)
//   --lido       no fim, marca tudo como lido para todo mundo (a migração do ClickUp: o que veio
//                de lá já foi lido lá; sem isso cada canal abre com centenas de não lidas)
//
// Limite: o token é do Matheus, então vêm os canais públicos, os privados em que ele está e as DMs
// dele. DM entre outras pessoas a API não devolve. Reações e anexos não vêm no payload da API v3
// (anexo aparece como link no texto).
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { puxar } from '../api/_chat_sync_core.js'

function lerEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return {}
  return Object.fromEntries(fs.readFileSync(arquivo, 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '').replace(/\\n/g, '')]
  }))
}
const env = { ...lerEnv('.env'), ...lerEnv('.env.local'), ...process.env }
const TOKEN = env.CLICKUP_API_TOKEN
const TEAM = env.CLICKUP_TEAM_ID || '9009170774'
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
if (!TOKEN || !env.SUPABASE_URL || !KEY) { console.error('faltam CLICKUP_API_TOKEN, SUPABASE_URL ou SUPABASE_SECRET_KEY no .env/.env.local'); process.exit(1) }

const args = process.argv.slice(2)
const tem = (f) => args.includes(f)
const since = args.find((a) => a.startsWith('--since='))?.slice(8)
const completo = tem('--completo')
const desde = since ? new Date(since) : new Date(Date.now() - 7 * 86400000)

const sb = createClient(env.SUPABASE_URL, KEY, { auth: { persistSession: false } })
const t0 = Date.now()
const r = await puxar({ sb, token: TOKEN, team: TEAM, desde, completo, membros: tem('--membros'), threads: tem('--threads'), orcamentoMs: Infinity, log: (m) => console.error(m) })
console.log(JSON.stringify({ ...r, avisos: r.avisos.length ? r.avisos : undefined }, null, 2))

if (tem('--lido')) {
  const agora = new Date().toISOString()
  const { error, count } = await sb.from('chat_channel_members').update({ last_read_at: agora }, { count: 'exact' }).or(`last_read_at.is.null,last_read_at.lt.${agora}`)
  if (error) console.error('marcar como lido:', error.message)
  else console.error(`marcado como lido: ${count} associações`)
}
console.error(`fim em ${Math.round((Date.now() - t0) / 1000)} s`)
