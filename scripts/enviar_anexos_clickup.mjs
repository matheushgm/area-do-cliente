// Carga inicial dos anexos locais no ClickUp (migration 127). Os anexos enviados pelo VertaTask antes
// da fila ficaram só no bucket task-attachments; este script põe na fila 'anexar' os que estão em
// tarefa ligada ao ClickUp e passa o push do app. Acima do limite de LIMITE_ANEXO_MB ficam aqui e são
// listados, para anexar à mão no ClickUp.
//
//   node scripts/enviar_anexos_clickup.mjs --dry   # só mostra o plano
//   node scripts/enviar_anexos_clickup.mjs         # envia
//
// Lê SUPABASE_URL, SUPABASE_SECRET_KEY (ou SERVICE_ROLE) e CLICKUP_API_TOKEN de .env e .env.local.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { empurrar } from '../api/_tarefas_push_core.js'
import { LIMITE_ANEXO_BYTES, LIMITE_ANEXO_MB } from '../src/lib/anexosLimite.js'

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

const tarefas = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('tarefas_itens').select('id, titulo, clickup_task_id, anexos').neq('anexos', '[]').order('id').range(from, from + 999)
  if (error) { console.error(error.message); process.exit(1) }
  tarefas.push(...(data || [])); if (!data || data.length < 1000) break
}
const { data: naFila, error: errFila0 } = await sb.from('tarefas_outbox').select('payload').eq('operacao', 'anexar').in('status', ['pendente', 'processando', 'erro'])
if (errFila0) { console.error(errFila0.message); process.exit(1) }
const jaNaFila = new Set((naFila || []).map((f) => f.payload?.path))

const enviar = [], ficam = []
for (const t of tarefas) {
  for (const a of t.anexos || []) {
    if (!a.path || a.source === 'clickup') continue
    const motivo = !t.clickup_task_id ? 'tarefa não está no ClickUp' : Number(a.size) > LIMITE_ANEXO_BYTES ? `passa de ${LIMITE_ANEXO_MB} MB` : jaNaFila.has(a.path) ? 'já está na fila' : null
    if (motivo) ficam.push({ t, a, motivo }); else enviar.push({ t, a })
  }
}
const mb = (a) => `${(Number(a.size || 0) / 1048576).toFixed(1)} MB`
console.log(`${enviar.length} anexos para enviar, ${ficam.length} ficam\n`)
for (const { t, a } of enviar) console.log(`  "${a.name}" (${mb(a)}) → "${(t.titulo || '').slice(0, 48)}" ${t.clickup_task_id}`)
if (ficam.length) { console.log('\nFicam:'); for (const { t, a, motivo } of ficam) console.log(`  "${a.name}" (${mb(a)}) em "${(t.titulo || '').slice(0, 48)}": ${motivo}`) }
if (dry || !enviar.length) { console.log(dry ? '\n--dry: nada enviado.' : '\nNada a enviar.'); process.exit(0) }

const { data: novos, error: errFila } = await sb.from('tarefas_outbox').insert(enviar.map(({ t, a }) => ({
  tarefa_id: t.id, operacao: 'anexar', clickup_task_id: t.clickup_task_id, payload: { path: a.path, name: a.name },
}))).select('id')
if (errFila) { console.error(`fila: ${errFila.message}`); process.exit(1) }
const idsFila = novos.map((x) => x.id)
console.log(`\n${idsFila.length} itens na fila; enviando…`)
for (let rodada = 0; rodada < 30; rodada++) {
  const r = await empurrar({ sb, token: TOKEN, orcamentoMs: 120_000 })
  const { count } = await sb.from('tarefas_outbox').select('id', { count: 'exact', head: true }).in('id', idsFila).in('status', ['pendente', 'processando'])
  console.log(`  rodada ${rodada + 1}: ${r.anexos} anexos, ${r.erros} erros; faltam ${count}`)
  if (!count) break
}
const { data: fim } = await sb.from('tarefas_outbox').select('status, erro').in('id', idsFila)
const cont = {}
for (const f of fim || []) cont[f.status] = (cont[f.status] || 0) + 1
console.log('\nresultado:', cont)
for (const f of (fim || []).filter((x) => x.status === 'erro')) console.log(`  ✗ ${f.erro}`)
