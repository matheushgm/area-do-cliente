// Carga inicial das relações do VertaTask no ClickUp (migration 126). As relações criadas
// antes da fila (tarefas_relacoes sem gatilho até 30/10/2026) nunca foram para lá; este
// script manda as que têm as duas tarefas no ClickUp. Idempotente: dependência que já existe
// lá ("Dependency already exists") conta como feita, e link repetido o ClickUp ignora.
//
//   node scripts/enviar_relacoes_clickup.mjs --dry   # só mostra o plano
//   node scripts/enviar_relacoes_clickup.mjs         # envia
//
// Antes de enviar, confere nos spaces das tarefas se a opção "Reschedule dependencies" do
// ClickUp está ligada: com ela, criar a dependência pode remarcar as datas da tarefa
// dependente lá, e a remarcação volta para o VertaTask pelo webhook.
//
// Lê SUPABASE_URL, SUPABASE_SECRET_KEY (ou SERVICE_ROLE) e CLICKUP_API_TOKEN de .env e .env.local.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chamadaRelacao, chavePar, ehLink } from '../api/_tarefas_relacoes.js'

const dry = process.argv.includes('--dry')
function lerEnv(f) {
  try { return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })) } catch { return {} }
}
const env = { ...lerEnv('.env'), ...lerEnv('.env.local'), ...process.env }
const limpo = (v) => String(v || '').replace(/\\n/g, '').trim()
const TOKEN = limpo(env.CLICKUP_API_TOKEN)
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
if (!env.SUPABASE_URL || !KEY || !TOKEN) { console.error('SUPABASE_URL / SUPABASE_SECRET_KEY / CLICKUP_API_TOKEN ausentes'); process.exit(1) }
const sb = createClient(env.SUPABASE_URL, KEY, { auth: { persistSession: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function cu(method, path, body) {
  for (let tent = 0; tent < 8; tent++) {
    const res = await fetch(`https://api.clickup.com/api/v2${path}`, { method, headers: { Authorization: TOKEN, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    if (res.status === 429) { await sleep(Math.max((Number(res.headers.get('retry-after')) || 0) * 1000, 5000 * (tent + 1))); continue }
    const json = await res.json().catch(() => null)
    if (!res.ok) { const e = new Error(json?.err || `${method} ${path}: ${res.status}`); e.status = res.status; e.ecode = json?.ECODE; throw e }
    return json
  }
  throw new Error(`${method} ${path}: limite de requisições`)
}

const { data: rels, error } = await sb.from('tarefas_relacoes').select('id, tarefa_id, relacionada_id, tipo, created_at').order('created_at')
if (error) { console.error(error.message); process.exit(1) }
const ids = [...new Set(rels.flatMap((r) => [r.tarefa_id, r.relacionada_id]))]
const tarefas = new Map()
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await sb.from('tarefas_itens').select('id, titulo, clickup_task_id, clickup_removida_at, lista_id').in('id', ids.slice(i, i + 200))
  for (const t of data || []) tarefas.set(t.id, t)
}

const enviar = []
const puladas = []
const links = new Set()
for (const r of rels) {
  const a = tarefas.get(r.tarefa_id), b = tarefas.get(r.relacionada_id)
  const motivo = !a || !b ? 'tarefa não existe' : !a.clickup_task_id || !b.clickup_task_id ? 'tarefa sem ClickUp' : a.clickup_removida_at || b.clickup_removida_at ? 'tarefa apagada no ClickUp' : null
  if (motivo) { puladas.push({ r, a, b, motivo }); continue }
  if (ehLink(r.tipo)) { const k = chavePar(a.id, b.id); if (links.has(k)) { puladas.push({ r, a, b, motivo: 'mesmo link de outra relação do par' }); continue } links.add(k) }
  enviar.push({ r, a, b, chamada: chamadaRelacao(r.tipo, a.clickup_task_id, b.clickup_task_id) })
}

const nome = (t) => (t?.titulo || '?').slice(0, 48)
console.log(`${rels.length} relações: ${enviar.length} para enviar, ${puladas.length} puladas\n`)
for (const { r, a, b, chamada } of enviar) console.log(`  ${r.tipo.padEnd(11)} "${nome(a)}" → "${nome(b)}"   ${chamada.method} ${chamada.path}${chamada.body ? ' ' + JSON.stringify(chamada.body) : ''}`)
if (puladas.length) { console.log('\nPuladas:'); for (const { r, a, b, motivo } of puladas) console.log(`  ${r.tipo.padEnd(11)} "${nome(a)}" → "${nome(b)}"   (${motivo})`) }

// "Reschedule dependencies" nos spaces das tarefas
const listas = [...new Set(enviar.flatMap(({ a, b }) => [a.lista_id, b.lista_id]))]
const { data: ls } = listas.length ? await sb.from('tarefas_listas').select('id, clickup_space_id').in('id', listas) : { data: [] }
const spaces = [...new Set((ls || []).map((l) => l.clickup_space_id).filter(Boolean))]
let remarca = false
for (const sid of spaces) {
  const s = await cu('GET', `/space/${sid}`).catch(() => null)
  const r = s?.features?.remap_dependency_settings
  if (r?.enabled) remarca = true
  console.log(`\nspace ${s?.name || sid}: Reschedule dependencies ${r?.enabled ? 'LIGADO' : 'desligado'}${r ? ` (${JSON.stringify(r)})` : ''}`)
}
if (remarca) console.log('\n⚠ Com "Reschedule dependencies" ligado, o ClickUp pode remarcar as datas das tarefas dependentes ao criar a dependência.')

if (dry) { console.log('\n--dry: nada enviado.'); process.exit(0) }

let ok = 0, ja = 0, falhas = 0
for (const { r, a, b, chamada } of enviar) {
  try { await cu(chamada.method, chamada.path, chamada.body); ok++ }
  catch (e) {
    if (e.ecode === 'DEPENDS_010' || /already exists/i.test(e.message)) ja++
    else { falhas++; console.log(`  ✗ ${r.tipo} "${nome(a)}" → "${nome(b)}": ${e.message}`) }
  }
}
console.log(`\n${ok} enviadas, ${ja} já existiam, ${falhas} falharam`)
