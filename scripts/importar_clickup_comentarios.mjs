// Importa os comentários do ClickUp das tarefas ABERTAS (as fechadas não
// entram: seriam ~10 mil requests). Idempotente pelo clickup_comment_id.
//   node scripts/importar_clickup_comentarios.mjs
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function lerEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return {}
  return Object.fromEntries(fs.readFileSync(arquivo, 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '').replace(/\\n/g, '')]
  }))
}
const env = { ...lerEnv('.env'), ...lerEnv('.env.local') }
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const TOKEN = env.CLICKUP_API_TOKEN
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function cu(path) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch('https://api.clickup.com/api/v2' + path, { headers: { Authorization: TOKEN } })
    if (res.status === 429) { const w = Number(res.headers.get('retry-after') || 30); await sleep(w * 1000 + 500); continue }
    const j = await res.json().catch(() => null)
    if (!res.ok) { if (res.status >= 500) { await sleep(3000); continue } return null }
    return j
  }
  return null
}

const { data: perfis } = await sb.from('profiles').select('id, clickup_user_id')
const ALIAS = { 106097500: 118083078, 118078442: 118083078 }
const perfilDe = (id) => perfis.find((p) => Number(p.clickup_user_id) === (ALIAS[id] || Number(id)))?.id || null

const tarefas = []
for (let de = 0; ; de += 1000) {
  const { data } = await sb.from('tarefas_itens').select('id, clickup_task_id').neq('status_tipo', 'closed').not('clickup_task_id', 'is', null).range(de, de + 999)
  tarefas.push(...(data || []))
  if (!data || data.length < 1000) break
}
console.error('tarefas abertas:', tarefas.length)

let total = 0
const lote = []
async function flush() {
  if (!lote.length) return
  const { error } = await sb.from('tarefas_comentarios').upsert(lote.splice(0), { onConflict: 'clickup_comment_id' })
  if (error) console.error('erro upsert:', error.message)
}
for (let i = 0; i < tarefas.length; i++) {
  const t = tarefas[i]
  const r = await cu(`/task/${t.clickup_task_id}/comment`)
  for (const c of r?.comments || []) {
    const texto = (c.comment_text || '').trim()
    if (!texto) continue
    lote.push({
      tarefa_id: t.id, clickup_comment_id: String(c.id), texto,
      autor_id: perfilDe(c.user?.id), autor_nome: c.user?.username || null,
      created_at: new Date(Number(c.date)).toISOString(),
    })
    total++
  }
  if (lote.length >= 200) await flush()
  if (i % 50 === 0) console.error(`${i}/${tarefas.length} tarefas, ${total} comentários`)
  await sleep(650) // ~90 req/min (limite do token pessoal é 100/min)
}
await flush()
console.error('DONE comentários:', total)
