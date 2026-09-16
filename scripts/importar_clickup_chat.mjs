// Importa o dump do ClickUp Chat (scripts/baixar_clickup_chat.mjs) para as
// tabelas chat_channels / chat_channel_members / chat_messages. Idempotente
// pelos ids do ClickUp (clickup_channel_id / clickup_message_id).
//   node scripts/importar_clickup_chat.mjs <dump.json> [--dry]
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
const [arquivo, ...flags] = process.argv.slice(2)
const DRY = flags.includes('--dry')
if (!arquivo) { console.error('uso: node scripts/importar_clickup_chat.mjs <dump.json> [--dry]'); process.exit(1) }
const dump = JSON.parse(fs.readFileSync(arquivo, 'utf8'))

// ── Perfis e mapeamentos ────────────────────────────────────────────────────
const { data: perfis } = await sb.from('profiles').select('id, name, clickup_user_id, disabled')
const ALIAS = { 106097500: 118083078, 118078442: 118083078 }
const perfilDe = (id) => perfis.find((p) => Number(p.clickup_user_id) === (ALIAS[id] || Number(id))) || null
const slugDe = (p) => p.name.trim().replace(/\s+/g, '_')

const { data: projetos } = await sb.from('projects_v2').select('id, company_name, clickup_chat_channel_id')
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const projetoDe = (canal) => {
  const porId = projetos.find((p) => p.clickup_chat_channel_id && p.clickup_chat_channel_id === canal.id)
  if (porId) return porId.id
  const n = norm(canal.name)
  if (!n) return null
  return projetos.find((p) => norm(p.company_name) === n)?.id || null
}

// Tarefas do ClickUp já importadas → link interno em vez de app.clickup.com/t/…
const tarefas = new Map()
for (let de = 0; ; de += 1000) {
  const { data } = await sb.from('tarefas_itens').select('id, clickup_task_id').not('clickup_task_id', 'is', null).range(de, de + 999)
  for (const t of data || []) tarefas.set(t.clickup_task_id, t.id)
  if (!data || data.length < 1000) break
}

// ── Conversão do markdown do ClickUp para o formato do chat ─────────────────
// Menções: [@Nome](#user_mention#123) → @Nome_Do_Perfil (+ id em mentioned_user_ids)
// Tarefas: Título ([https://app.clickup.com/t/abc](…)) → [Título](/tarefas?tarefa=uuid)
function converter(md) {
  const mencionados = new Set()
  let texto = md.replace(/\[@([^\]]+)\]\(#user_mention#(\d+)\)/g, (_, nome, id) => {
    const p = perfilDe(id)
    if (p) { mencionados.add(p.id); return '@' + slugDe(p) }
    return '@' + nome.trim().replace(/\s+/g, '_')
  })
  texto = texto.replace(/([^\n(]*?)\s*\(\[https?:\/\/app\.clickup\.com\/t\/([a-z0-9]+)\]\(https?:\/\/app\.clickup\.com\/t\/[a-z0-9]+\)\)/gi, (m, titulo, cuId) => {
    const uuid = tarefas.get(cuId)
    const t = titulo.trim() || 'Tarefa'
    return uuid ? `[${t}](/tarefas?tarefa=${uuid})` : `[${t}](https://app.clickup.com/t/${cuId})`
  })
  texto = texto.replace(/\[(https?:\/\/app\.clickup\.com\/t\/([a-z0-9]+))\]\(\1\)/gi, (m, url, cuId) => {
    const uuid = tarefas.get(cuId)
    return uuid ? `[Tarefa](/tarefas?tarefa=${uuid})` : url
  })
  return { texto: texto.trim(), mencionados: [...mencionados] }
}

// ── Canais ──────────────────────────────────────────────────────────────────
let stats = { canais: 0, dmsPuladas: 0, membros: 0, mensagens: 0, respostas: 0 }
const canaisOrdenados = [...dump.channels].sort((a, b) => Number(a.created_at) - Number(b.created_at))
for (const c of canaisOrdenados) {
  if (c.archived) continue
  const membrosIds = [...new Set(c.members.map((id) => perfilDe(id)?.id).filter(Boolean))]
  const isDm = c.type === 'DM'
  if (isDm && (membrosIds.length < 2 || c.messages.length === 0)) { stats.dmsPuladas++; continue }
  if (c.type !== 'DM' && c.type !== 'CHANNEL') continue

  const linha = {
    clickup_channel_id: c.id,
    name: isDm ? null : (c.name || c.id),
    type: isDm ? 'dm' : 'channel',
    visibility: isDm || c.visibility === 'PRIVATE' ? 'private' : 'public',
    description: c.description || null,
    created_by: perfilDe(c.creator)?.id || null,
    created_at: new Date(Number(c.created_at)).toISOString(),
    project_id: isDm ? null : projetoDe(c),
  }
  stats.canais++
  if (DRY) { console.log('canal', linha.type, linha.name, 'membros', membrosIds.length, 'msgs', c.messages.length, 'projeto', linha.project_id ? 'sim' : 'não'); continue }

  const { data: canal, error } = await sb.from('chat_channels').upsert(linha, { onConflict: 'clickup_channel_id' }).select('id').single()
  if (error) { console.error('canal', c.name, error.message); continue }

  if (membrosIds.length) {
    const agora = new Date().toISOString()
    const { error: em } = await sb.from('chat_channel_members').upsert(
      membrosIds.map((uid) => ({ channel_id: canal.id, user_id: uid, last_read_at: agora })),
      { onConflict: 'channel_id,user_id', ignoreDuplicates: true },
    )
    if (em) console.error('membros', c.name, em.message)
    stats.membros += membrosIds.length
  }

  // Mensagens raiz, depois respostas (precisam do uuid do pai)
  const raizes = c.messages.filter((m) => m.type === 'message').sort((a, b) => Number(a.date) - Number(b.date))
  const linhaDe = (m, parentId) => {
    const { texto, mencionados } = converter(m.content || '')
    if (!texto) return null
    return {
      clickup_message_id: String(m.id),
      channel_id: canal.id,
      parent_id: parentId,
      user_id: perfilDe(m.user_id)?.id || null,
      content: texto,
      mentioned_user_ids: mencionados,
      created_at: new Date(Number(m.date)).toISOString(),
      edited_at: m.date_updated && Number(m.date_updated) > Number(m.date) + 1000 ? new Date(Number(m.date_updated)).toISOString() : null,
    }
  }
  const lote = raizes.map((m) => linhaDe(m, null)).filter(Boolean)
  if (lote.length) {
    const { data: inseridas, error: e1 } = await sb.from('chat_messages').upsert(lote, { onConflict: 'clickup_message_id' }).select('id, clickup_message_id')
    if (e1) { console.error('mensagens', c.name, e1.message); continue }
    stats.mensagens += lote.length
    const uuidDe = new Map(inseridas.map((r) => [r.clickup_message_id, r.id]))
    const respostas = []
    for (const m of raizes) {
      const pai = uuidDe.get(String(m.id))
      if (!pai) continue
      for (const r of (m._replies || []).sort((a, b) => Number(a.date) - Number(b.date))) {
        const l = linhaDe(r, pai); if (l) respostas.push(l)
      }
    }
    if (respostas.length) {
      const { error: e2 } = await sb.from('chat_messages').upsert(respostas, { onConflict: 'clickup_message_id' })
      if (e2) console.error('respostas', c.name, e2.message)
      stats.respostas += respostas.length
    }
  }
  console.error(linha.type, linha.name || '(dm)', lote.length, 'msgs')
}
console.error(stats)
