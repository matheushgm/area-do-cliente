// Importa pastas, listas e tarefas do ClickUp (dump JSON gerado com a API
// v2, ver scripts/baixar_clickup_tarefas.mjs) para as tabelas tarefas_* do
// Supabase. Idempotente: faz upsert pelos ids do ClickUp.
//
//   node scripts/importar_clickup_tarefas.mjs <dump.json> [--dry]
//
// Lê SUPABASE_URL e SUPABASE_SECRET_KEY (ou SERVICE_ROLE) do .env.local.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const [,, DUMP, ...flags] = process.argv
const DRY = flags.includes('--dry')
if (!DUMP) { console.error('uso: node scripts/importar_clickup_tarefas.mjs <dump.json> [--dry]'); process.exit(1) }

function lerEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return {}
  return Object.fromEntries(fs.readFileSync(arquivo, 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
  }))
}
const env = { ...lerEnv('.env'), ...lerEnv('.env.local') }
const URL = env.SUPABASE_URL
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('SUPABASE_URL / SUPABASE_SECRET_KEY ausentes'); process.exit(1) }
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const dump = JSON.parse(fs.readFileSync(DUMP, 'utf8'))

// ─── Helpers ─────────────────────────────────────────────────────────────────
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(ltda|s\.?a\.?|me|eireli)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const ms = (v) => (v ? new Date(Number(v)).toISOString() : null)
const rotuloStatus = (k) => (['complete', 'closed', 'done'].includes(k) ? 'Concluído' : k.charAt(0).toUpperCase() + k.slice(1))

async function upsertLote(tabela, rows, onConflict, tamanho = 400) {
  const out = []
  for (let i = 0; i < rows.length; i += tamanho) {
    const lote = rows.slice(i, i + tamanho)
    if (DRY) { out.push(...lote); continue }
    const { data, error } = await sb.from(tabela).upsert(lote, { onConflict }).select('id, ' + onConflict)
    if (error) { console.error(`erro em ${tabela}:`, error.message, JSON.stringify(lote[0]).slice(0, 300)); throw error }
    out.push(...data)
    process.stderr.write(`  ${tabela}: ${Math.min(i + tamanho, rows.length)}/${rows.length}\r`)
  }
  process.stderr.write('\n')
  return out
}

// ─── Perfis e projetos ───────────────────────────────────────────────────────
const { data: perfis } = await sb.from('profiles').select('id, name, avatar, clickup_user_id, disabled')
const { data: projetos } = await sb.from('projects_v2').select('id, company_name, clickup_folder_id')

// Ids antigos do ClickUp de pessoas que têm perfil com outro id.
const ALIAS_CLICKUP = { 106097500: 118083078, 118078442: 118083078 }
const perfilPorClickup = new Map()
for (const p of perfis) if (p.clickup_user_id) perfilPorClickup.set(Number(p.clickup_user_id), p)
const perfilDe = (cuId) => perfilPorClickup.get(ALIAS_CLICKUP[cuId] || Number(cuId)) || null

// Pasta do ClickUp → projeto da Área do Cliente
const MAPA_MANUAL = {
  'Grupo Aj': 'Grupo AJ', 'Óticas Brasil': 'Oticas Brasil', 'Go vendas': 'Govendas', 'Nectar Crm': 'Nectar Crm',
  'FLASH CAR AUTO CENTER': 'Flashcar', 'Boa noite Colchões ': 'Boa Noite Colchões', 'Dr Ulyscélio': 'Ulyscélio',
  'Vital Centro de Saúde': 'Clínica Vital', 'Africa PET STORE': 'África Pet Care', 'Aliare /myFarm': 'Aliare',
  'Niko Kids': 'Niko Niko Kids', 'Dra. Laura ': 'Dra. Laura Medeiros', 'revo360': 'Revo 360', 'Mitra LAB': 'Mitra',
  'Única Distribuidora': 'Única Distribuidora / Casa do Sindico', 'Multichat 360': 'Multichat360', 'Agência Fábula ': 'Agência Fábulla',
  'MENNDEL & MELO ADVOCACIA': 'Meendel & Melo Advocacia', 'Gym Clean (RY COMERCIAL LTDA)': 'Gym Clean', 'GENIUS': 'Genius',
  'Boa Vida Stays': 'BOA VIDA INCORPORADORA LTDA', 'Dr Jorge Pinho': 'Dr. Jorge Pinho', 'Nomus ERP': 'Nomus ERP',
}
const projetoPorNorm = new Map(projetos.map((p) => [norm(p.company_name), p]))
const projetoPorFolder = new Map(projetos.filter((p) => p.clickup_folder_id).map((p) => [String(p.clickup_folder_id), p]))
function projetoDaPasta(f) {
  if (projetoPorFolder.has(f.id)) return projetoPorFolder.get(f.id)
  if (MAPA_MANUAL[f.name]) { const p = projetos.find((x) => x.company_name.trim() === MAPA_MANUAL[f.name]); if (p) return p }
  const n = norm(f.name)
  if (projetoPorNorm.has(n)) return projetoPorNorm.get(n)
  const cand = projetos.filter((p) => { const pn = norm(p.company_name); return pn && n && (pn.startsWith(n) || n.startsWith(pn)) })
  return cand.length === 1 ? cand[0] : null
}

// ─── Pastas ──────────────────────────────────────────────────────────────────
const pastasRows = []
const projetosComPasta = new Set()
for (const f of dump.folders) {
  const proj = projetoDaPasta(f)
  if (proj) projetosComPasta.add(proj.id)
  pastasRows.push({ clickup_folder_id: f.id, nome: f.name.trim(), project_id: proj?.id || null, posicao: Number(f.orderindex) || 0 })
  console.log(`pasta ${f.name.trim().padEnd(45)} → ${proj ? proj.company_name : '(sem projeto)'}`)
}
// Clientes da Área do Cliente que não têm pasta no ClickUp ganham uma pasta vazia (com lista Geral)
for (const p of projetos) {
  if (projetosComPasta.has(p.id)) continue
  pastasRows.push({ clickup_folder_id: `proj:${p.id}`, nome: p.company_name.trim(), project_id: p.id, posicao: 0 })
  console.log(`pasta nova (só na Área) ${p.company_name.trim()}`)
}
const pastasSalvas = await upsertLote('tarefas_pastas', pastasRows, 'clickup_folder_id')
const pastaIdPorFolder = new Map(pastasSalvas.map((r) => [r.clickup_folder_id, r.id]))

// ─── Listas ──────────────────────────────────────────────────────────────────
const STATUSES_PADRAO = [
  { key: '💡 backlog', label: '💡 Backlog', cor: '#87909e', tipo: 'open', ordem: 0 },
  { key: 'a fazer', label: 'A fazer', cor: '#4466ff', tipo: 'custom', ordem: 1 },
  { key: 'em progresso', label: 'Em progresso', cor: '#b660e0', tipo: 'custom', ordem: 2 },
  { key: 'em revisão', label: 'Em revisão', cor: '#aa8d80', tipo: 'custom', ordem: 3 },
  { key: 'complete', label: 'Concluído', cor: '#008844', tipo: 'closed', ordem: 4 },
]
const mapStatuses = (arr) => (arr || []).map((s) => ({ key: s.status, label: rotuloStatus(s.status), cor: s.color, tipo: s.type, ordem: Number(s.orderindex) || 0 }))
const listasRows = []
for (const f of dump.folders) {
  for (const l of f.lists) listasRows.push({ clickup_list_id: l.id, pasta_id: pastaIdPorFolder.get(f.id), nome: l.name.trim(), descricao: l.content || null, statuses: mapStatuses(l.statuses), posicao: Number(l.orderindex) || 0 })
}
for (const l of dump.looseLists) listasRows.push({ clickup_list_id: l.id, pasta_id: null, nome: l.name.trim(), descricao: l.content || null, statuses: mapStatuses(l.statuses), posicao: Number(l.orderindex) || 0 })
for (const p of projetos) {
  if (projetosComPasta.has(p.id)) continue
  listasRows.push({ clickup_list_id: `proj:${p.id}:geral`, pasta_id: pastaIdPorFolder.get(`proj:${p.id}`), nome: 'Geral', statuses: STATUSES_PADRAO, posicao: 0 })
}
// listas sem statuses (herdam do space) recebem os do space
const spaceStatuses = mapStatuses(dump.space?.statuses)
for (const l of listasRows) if (!l.statuses.length) l.statuses = spaceStatuses.length ? spaceStatuses : STATUSES_PADRAO
const listasSalvas = await upsertLote('tarefas_listas', listasRows, 'clickup_list_id')
const listaIdPorCu = new Map(listasSalvas.map((r) => [r.clickup_list_id, r.id]))

// ─── Tarefas ─────────────────────────────────────────────────────────────────
// Reaproveita ids já existentes (reimportação) para não quebrar links.
const idExistente = new Map()
if (!DRY) {
  for (let de = 0; ; de += 1000) {
    const { data } = await sb.from('tarefas_itens').select('id, clickup_task_id').not('clickup_task_id', 'is', null).range(de, de + 999)
    for (const r of data || []) idExistente.set(r.clickup_task_id, r.id)
    if (!data || data.length < 1000) break
  }
}
const { randomUUID } = await import('node:crypto')
const idDe = new Map()
for (const t of dump.tasks) idDe.set(t.id, idExistente.get(t.id) || randomUUID())

const IGNORAR_CAMPOS = new Set(['Cliente', 'Tipo de tarefa', 'Dificuldade', 'Departamento'])
function valorCampo(f) {
  if (f.value === undefined || f.value === null || f.value === '') return undefined
  const opts = f.type_config?.options || []
  if (f.type === 'drop_down') {
    const o = opts.find((o) => o.id === f.value || o.orderindex === f.value || String(o.orderindex) === String(f.value))
    return (o?.name || o?.label || String(f.value)).trim()
  }
  if (f.type === 'labels') {
    const vals = Array.isArray(f.value) ? f.value : [f.value]
    return vals.map((v) => { const o = opts.find((o) => o.id === v); return (o?.label || o?.name || String(v)).trim() })
  }
  if (['attachment', 'list_relationship', 'automatic_progress', 'formula', 'progress', 'tasks'].includes(f.type)) return undefined
  if (typeof f.value === 'object') return undefined
  return f.value
}

const semPerfil = {}
const tarefasRows = dump.tasks.map((t) => {
  const responsaveis = [], extras = []
  for (const a of t.assignees || []) {
    const p = perfilDe(a.id)
    if (p && !p.disabled) responsaveis.push(p.id)
    else {
      semPerfil[a.username] = (semPerfil[a.username] || 0) + 1
      const nome = p?.name || a.username
      extras.push({ clickup_id: a.id, nome, iniciais: a.initials || nome.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase(), cor: a.color || null })
    }
  }
  let tipo = null, dificuldade = null, departamento = []
  const campos = {}
  for (const f of t.custom_fields || []) {
    const nome = f.name.trim()
    const v = valorCampo(f)
    if (v === undefined) continue
    if (nome === 'Tipo de tarefa') tipo = String(v).trim()
    else if (nome === 'Dificuldade') dificuldade = String(v).trim()
    else if (nome === 'Departamento') departamento = Array.isArray(v) ? v : [v]
    else if (!IGNORAR_CAMPOS.has(nome)) campos[nome] = v
  }
  const criador = perfilDe(t.creator?.id)
  return {
    id: idDe.get(t.id),
    lista_id: listaIdPorCu.get(t._listId),
    parent_id: null,
    clickup_task_id: t.id,
    clickup_url: t.url,
    titulo: t.name || '(sem título)',
    descricao: t.markdown_description || t.description || null,
    status: t.status?.status || 'a fazer',
    status_tipo: t.status?.type === 'closed' ? 'closed' : t.status?.type === 'open' ? 'open' : 'custom',
    prioridade: t.priority?.priority || null,
    responsaveis,
    responsaveis_extra: extras,
    data_inicio: ms(t.start_date),
    data_vencimento: ms(t.due_date),
    data_conclusao: ms(t.date_done || t.date_closed),
    estimativa_min: t.time_estimate ? Math.round(t.time_estimate / 60000) : null,
    tipo_tarefa: tipo,
    dificuldade,
    departamento,
    campos,
    tags: (t.tags || []).map((x) => x.name),
    checklists: (t.checklists || []).map((c) => ({ id: c.id, nome: c.name, itens: (c.items || []).map((i) => ({ id: i.id, nome: i.name, feito: !!i.resolved })) })),
    anexos: [],
    posicao: Number(t.orderindex) || 0,
    arquivada: !!t.archived,
    criado_por: criador?.id || null,
    criador_nome: t.creator?.username || null,
    created_at: ms(t.date_created) || new Date().toISOString(),
    updated_at: ms(t.date_updated) || ms(t.date_created) || new Date().toISOString(),
    _parent: t.parent || null,
  }
}).filter((r) => r.lista_id)

console.log('responsáveis sem perfil ativo (vão como texto):', JSON.stringify(semPerfil))
console.log('tarefas a importar:', tarefasRows.length)

// fase 1: sem parent; fase 2: só as subtarefas, com parent
const limpar = (r) => { const { _parent, ...x } = r; return x }
await upsertLote('tarefas_itens', tarefasRows.map(limpar), 'clickup_task_id')
const subs = tarefasRows.filter((r) => r._parent && idDe.has(r._parent)).map((r) => ({ ...limpar(r), parent_id: idDe.get(r._parent) }))
console.log('subtarefas:', subs.length)
await upsertLote('tarefas_itens', subs, 'clickup_task_id')

console.log(DRY ? 'DRY RUN concluído' : 'Importação concluída')
