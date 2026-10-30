// Carga inicial das relações do VertaTask no ClickUp (migration 126). As relações criadas
// antes da fila (tarefas_relacoes sem gatilho até 30/10/2026) nunca foram para lá; este
// script manda as que têm as duas tarefas no ClickUp. Idempotente: dependência que já existe
// lá ("Dependency already exists") conta como feita, e link repetido o ClickUp ignora.
//
// O envio passa pela fila (tarefas_outbox, 'relacionar') e pelo mesmo push do app: enquanto o
// item está na fila, a volta não mexe no par. Na carga de 30/10/2026, mandando direto ao ClickUp,
// o webhook releu uma tarefa entre duas dependências da mesma cadeia, não achou a segunda lá e
// apagou a relação daqui (a volta recriou 1,4 s depois, sem o autor original).
//
//   node scripts/enviar_relacoes_clickup.mjs --dry   # só mostra o plano
//   node scripts/enviar_relacoes_clickup.mjs         # envia
//
// Lê SUPABASE_URL, SUPABASE_SECRET_KEY (ou SERVICE_ROLE) e CLICKUP_API_TOKEN de .env e .env.local.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chamadaRelacao, chavePar, vaiProClickup } from '../api/_tarefas_relacoes.js'
import { empurrar } from '../api/_tarefas_push_core.js'

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
  const motivo = !vaiProClickup(r.tipo) ? '"duplicada de" fica só no VertaTask' : !a || !b ? 'tarefa não existe' : !a.clickup_task_id || !b.clickup_task_id ? 'tarefa sem ClickUp' : a.clickup_removida_at || b.clickup_removida_at ? 'tarefa apagada no ClickUp' : null
  if (motivo) { puladas.push({ r, a, b, motivo }); continue }
  if (r.tipo === 'relacionada') { const k = chavePar(a.id, b.id); if (links.has(k)) { puladas.push({ r, a, b, motivo: 'mesmo link da relação inversa' }); continue } links.add(k) }
  enviar.push({ r, a, b, chamada: chamadaRelacao(r.tipo, a.clickup_task_id, b.clickup_task_id) })
}

const nome = (t) => (t?.titulo || '?').slice(0, 48)
console.log(`${rels.length} relações: ${enviar.length} para enviar, ${puladas.length} puladas\n`)
for (const { r, a, b, chamada } of enviar) console.log(`  ${r.tipo.padEnd(11)} "${nome(a)}" → "${nome(b)}"   ${chamada.method} ${chamada.path}${chamada.body ? ' ' + JSON.stringify(chamada.body) : ''}`)
if (puladas.length) { console.log('\nPuladas:'); for (const { r, a, b, motivo } of puladas) console.log(`  ${r.tipo.padEnd(11)} "${nome(a)}" → "${nome(b)}"   (${motivo})`) }

if (dry) { console.log('\n--dry: nada enviado.'); process.exit(0) }

// enfileira (chave de serviço: o gatilho não roda) e esvazia a fila com o push do app
const { data: novos, error: errFila } = await sb.from('tarefas_outbox').insert(enviar.map(({ r }) => ({
  tarefa_id: r.tarefa_id, operacao: 'relacionar',
  payload: { relacao_id: r.id, tarefa_id: r.tarefa_id, relacionada_id: r.relacionada_id, tipo: r.tipo },
}))).select('id')
if (errFila) { console.error(`fila: ${errFila.message}`); process.exit(1) }
const idsFila = novos.map((x) => x.id)
console.log(`\n${idsFila.length} itens na fila; enviando…`)
for (let rodada = 0; rodada < 30; rodada++) {
  const r = await empurrar({ sb, token: TOKEN, orcamentoMs: 120_000 })
  const { count } = await sb.from('tarefas_outbox').select('id', { count: 'exact', head: true }).in('id', idsFila).in('status', ['pendente', 'processando'])
  console.log(`  rodada ${rodada + 1}: ${r.relacoes} relações, ${r.erros} erros; faltam ${count}`)
  if (!count) break
}
const { data: fim } = await sb.from('tarefas_outbox').select('status, erro').in('id', idsFila)
const cont = {}
for (const f of fim || []) cont[f.status] = (cont[f.status] || 0) + 1
console.log('\nresultado:', cont)
for (const f of (fim || []).filter((x) => x.status === 'erro')) console.log(`  ✗ ${f.erro}`)
