// Serverless Function (Node) — sincronização incremental ClickUp → Tarefas.
// GET/POST /api/tarefas-sync   (Authorization: Bearer <CRON_SECRET> ou JWT do usuário)
//   ?since=<ISO>   opcional: força o ponto de partida (padrão: último início - 15 min)
//   ?comentarios=0 opcional: pula a leitura de comentários
//
// Traz do space Clientes do ClickUp o que mudou desde a última rodada: pastas
// e listas novas (e statuses atualizados), tarefas criadas/editadas (com
// subtarefas e fechadas) e os comentários das tarefas abertas que mudaram.
// Mão única: nada é escrito no ClickUp.
//
// Conflito: se uma tarefa foi editada na Área depois da última sincronização
// e o ClickUp está mais antigo que essa edição, a Área vence (a tarefa é
// pulada). Caso contrário o lado mais recente (o ClickUp) vence.
//
// Roda pelo cron da Vercel (uma vez por dia, limite do plano Hobby), pelo
// botão "Sincronizar" da página /tarefas e automaticamente ao abrir a página
// quando a última rodada tem mais de 30 minutos.
import { createClient } from '@supabase/supabase-js'
import { STATUSES_PADRAO, mapStatuses, mapTarefa, mapComentario, fazPerfilDe, projetoDaPasta } from './_tarefas_clickup_map.js'

export const config = { maxDuration: 60 }

const CLICKUP_BASE = 'https://api.clickup.com/api/v2'
const MARGEM_MS = 15 * 60 * 1000
const MAX_PAGINAS = 30
const MAX_COMENTARIOS = 40
const ORCAMENTO_MS = 50 * 1000

// jsonb reordena as chaves: compara numa forma canônica.
function canon(v) {
  return JSON.stringify(v, (k, val) => (val && typeof val === 'object' && !Array.isArray(val)) ? Object.fromEntries(Object.keys(val).sort().map((x) => [x, val[x]])) : val)
}

function envClean(name) {
  return String(process.env[name] || '').replace(/\\n/g, '').trim()
}

async function clickup(path, token) {
  for (let tent = 0; tent < 3; tent++) {
    const res = await fetch(`${CLICKUP_BASE}${path}`, { headers: { Authorization: token } })
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000)); continue }
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const err = new Error(json?.err || `ClickUp ${path}: ${res.status}`)
      err.status = res.status
      throw err
    }
    return json
  }
  throw new Error(`ClickUp ${path}: limite de requisições`)
}

async function autorizar(req) {
  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  const cron = envClean('CRON_SECRET')
  if (cron && token && token === cron) return { ok: true, via: 'cron' }
  if (!token) return { ok: false }
  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY },
  })
  return res.ok ? { ok: true, via: 'user' } : { ok: false }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const TOKEN = envClean('CLICKUP_API_TOKEN')
  const TEAM = envClean('CLICKUP_TEAM_ID') || '9009170774'
  const SPACE = envClean('CLICKUP_CLIENTES_SPACE_ID') || '90090377342'
  if (!SUPABASE_URL || !SERVICE_KEY || !TOKEN) return res.status(500).json({ error: 'Servidor não configurado.' })

  const auth = await autorizar(req)
  if (!auth.ok) return res.status(401).json({ error: 'Não autorizado.' })

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const body = req.method === 'POST' ? (req.body || {}) : {}
  const qp = (k) => body[k] ?? req.query?.[k]
  const inicio = Date.now()
  const resumo = { via: auth.via, pastas_novas: 0, listas_novas: 0, listas_atualizadas: 0, tarefas_recebidas: 0, criadas: 0, atualizadas: 0, puladas_conflito: 0, comentarios: 0, avisos: [] }

  // ── Ponto de partida ──────────────────────────────────────────────────────
  const { data: estado } = await sb.from('tarefas_sync').select('*').eq('id', 'clickup').maybeSingle()
  let desde = qp('since') ? new Date(qp('since')) : (estado?.ultimo_inicio ? new Date(new Date(estado.ultimo_inicio).getTime() - MARGEM_MS) : new Date(Date.now() - 86400000))
  if (isNaN(desde.getTime())) desde = new Date(Date.now() - 86400000)
  resumo.desde = desde.toISOString()
  await sb.from('tarefas_sync').upsert({ id: 'clickup', ultimo_inicio: new Date(inicio).toISOString(), updated_at: new Date().toISOString() })

  try {
    const [{ data: perfis }, { data: projetos }, { data: pastas }, { data: listas }] = await Promise.all([
      sb.from('profiles').select('id, name, clickup_user_id, disabled'),
      sb.from('projects_v2').select('id, company_name, clickup_folder_id'),
      sb.from('tarefas_pastas').select('id, clickup_folder_id, nome'),
      sb.from('tarefas_listas').select('id, clickup_list_id, pasta_id, statuses'),
    ])
    const perfilDe = fazPerfilDe(perfis || [])
    const pastaPorCu = new Map((pastas || []).filter((p) => p.clickup_folder_id).map((p) => [p.clickup_folder_id, p]))
    const listaPorCu = new Map((listas || []).filter((l) => l.clickup_list_id).map((l) => [l.clickup_list_id, l]))

    // ── Estrutura: pastas e listas ────────────────────────────────────────
    const [folders, soltas] = await Promise.all([
      clickup(`/space/${SPACE}/folder?archived=false`, TOKEN).then((r) => r?.folders || []),
      clickup(`/space/${SPACE}/list?archived=false`, TOKEN).then((r) => r?.lists || []),
    ])
    for (const f of folders) {
      if (!pastaPorCu.has(f.id)) {
        const proj = projetoDaPasta(f, projetos || [])
        const { data, error } = await sb.from('tarefas_pastas').insert({ clickup_folder_id: f.id, nome: f.name.trim(), project_id: proj?.id || null, posicao: Number(f.orderindex) || 0 }).select().single()
        if (error) { resumo.avisos.push(`pasta ${f.name}: ${error.message}`); continue }
        pastaPorCu.set(f.id, data)
        resumo.pastas_novas++
      }
    }
    const todasListas = [...soltas.map((l) => ({ ...l, _folder: null })), ...folders.flatMap((f) => (f.lists || []).map((l) => ({ ...l, _folder: f.id })))]
    for (const l of todasListas) {
      const statuses = mapStatuses(l.statuses)
      const existente = listaPorCu.get(l.id)
      if (!existente) {
        const pasta = l._folder ? pastaPorCu.get(l._folder) : null
        const { data, error } = await sb.from('tarefas_listas').insert({
          clickup_list_id: l.id, pasta_id: pasta?.id || null, nome: l.name.trim(), descricao: l.content || null,
          statuses: statuses.length ? statuses : STATUSES_PADRAO, posicao: Number(l.orderindex) || 0,
        }).select().single()
        if (error) { resumo.avisos.push(`lista ${l.name}: ${error.message}`); continue }
        listaPorCu.set(l.id, data)
        resumo.listas_novas++
      } else if (statuses.length && canon(statuses) !== canon(existente.statuses)) {
        await sb.from('tarefas_listas').update({ statuses }).eq('id', existente.id)
        resumo.listas_atualizadas++
      }
    }

    // ── Tarefas alteradas desde `desde` ───────────────────────────────────
    const recebidas = []
    for (let page = 0; page < MAX_PAGINAS; page++) {
      const qs = new URLSearchParams({
        'space_ids[]': SPACE, include_closed: 'true', subtasks: 'true', include_markdown_description: 'true',
        order_by: 'updated', date_updated_gt: String(desde.getTime()), page: String(page),
      })
      const r = await clickup(`/team/${TEAM}/task?${qs}`, TOKEN)
      const batch = r?.tasks || []
      recebidas.push(...batch)
      if (r?.last_page === true || batch.length < 100) break
      if (page === MAX_PAGINAS - 1) resumo.avisos.push('mais de 3.000 tarefas alteradas: rode de novo para continuar')
      if (Date.now() - inicio > ORCAMENTO_MS) { resumo.avisos.push('tempo esgotado ao paginar; rode de novo'); break }
    }
    resumo.tarefas_recebidas = recebidas.length

    // Linhas existentes das tarefas recebidas (e dos pais delas)
    const idsCu = new Set(recebidas.map((t) => t.id))
    for (const t of recebidas) if (t.parent) idsCu.add(t.parent)
    const existentes = new Map()
    const arr = [...idsCu]
    for (let i = 0; i < arr.length; i += 200) {
      const { data } = await sb.from('tarefas_itens').select('id, clickup_task_id, updated_at, clickup_sync_at, clickup_updated_at').in('clickup_task_id', arr.slice(i, i + 200))
      for (const r of data || []) existentes.set(r.clickup_task_id, r)
    }

    // Pais que não estão no banco nem no lote: busca no ClickUp
    const faltamPais = [...new Set(recebidas.filter((t) => t.parent && !existentes.has(t.parent) && !recebidas.some((x) => x.id === t.parent)).map((t) => t.parent))]
    for (const pid of faltamPais.slice(0, 20)) {
      try { const pai = await clickup(`/task/${pid}?include_markdown_description=true`, TOKEN); if (pai?.id) recebidas.push(pai) } catch (e) { resumo.avisos.push(`pai ${pid}: ${e.message}`) }
    }

    const { randomUUID } = await import('node:crypto')
    const idDe = new Map()
    for (const t of recebidas) idDe.set(t.id, existentes.get(t.id)?.id || randomUUID())

    const agora = new Date().toISOString()
    const linhas = []
    // pais primeiro, para o FK de parent_id
    const ordenadas = [...recebidas].sort((a, b) => (a.parent ? 1 : 0) - (b.parent ? 1 : 0))
    for (const t of ordenadas) {
      const lista = listaPorCu.get(t.list?.id)
      if (!lista) { resumo.avisos.push(`tarefa ${t.id} numa lista desconhecida (${t.list?.id})`); continue }
      const ex = existentes.get(t.id)
      const row = mapTarefa(t, perfilDe)
      if (ex) {
        // editada na Área depois da última sincronização?
        const editadaNaArea = ex.clickup_sync_at && new Date(ex.updated_at).getTime() > new Date(ex.clickup_sync_at).getTime() + 1000
        if (editadaNaArea && new Date(row.clickup_updated_at).getTime() <= new Date(ex.updated_at).getTime()) { resumo.puladas_conflito++; continue }
        if (ex.clickup_updated_at && new Date(row.clickup_updated_at).getTime() <= new Date(ex.clickup_updated_at).getTime()) continue // nada novo
        resumo.atualizadas++
      } else {
        resumo.criadas++
      }
      const parentId = t.parent ? (idDe.get(t.parent) || existentes.get(t.parent)?.id || null) : null
      linhas.push({ ...row, id: idDe.get(t.id), lista_id: lista.id, parent_id: parentId, clickup_sync_at: agora, _aberta: row.status_tipo !== 'closed', _novo: !ex })
    }
    for (let i = 0; i < linhas.length; i += 200) {
      const lote = linhas.slice(i, i + 200).map((r) => { const c = { ...r }; delete c._aberta; delete c._novo; return c })
      const { error } = await sb.from('tarefas_itens').upsert(lote, { onConflict: 'clickup_task_id' })
      if (error) throw new Error(`upsert tarefas: ${error.message}`)
    }

    // ── Comentários das tarefas abertas que mudaram ───────────────────────
    if (qp('comentarios') !== '0') {
      const candidatas = linhas.filter((l) => l._aberta).slice(0, MAX_COMENTARIOS)
      for (const l of candidatas) {
        if (Date.now() - inicio > ORCAMENTO_MS) { resumo.avisos.push('tempo esgotado nos comentários; o resto vem na próxima rodada'); break }
        try {
          const r = await clickup(`/task/${l.clickup_task_id}/comment`, TOKEN)
          const cs = (r?.comments || []).map((c) => mapComentario(c, l.id, perfilDe)).filter(Boolean)
          if (!cs.length) continue
          const { data: jaTem } = await sb.from('tarefas_comentarios').select('clickup_comment_id').in('clickup_comment_id', cs.map((c) => c.clickup_comment_id))
          const novos = cs.filter((c) => !(jaTem || []).some((j) => j.clickup_comment_id === c.clickup_comment_id))
          if (novos.length) {
            const { error } = await sb.from('tarefas_comentarios').upsert(novos, { onConflict: 'clickup_comment_id' })
            if (!error) resumo.comentarios += novos.length
          }
        } catch (e) { resumo.avisos.push(`comentários ${l.clickup_task_id}: ${e.message}`) }
      }
    }

    resumo.duracao_s = Math.round((Date.now() - inicio) / 100) / 10
    await sb.from('tarefas_sync').upsert({ id: 'clickup', ultimo_inicio: new Date(inicio).toISOString(), ultimo_fim: new Date().toISOString(), ultimo_ok: true, resumo, updated_at: new Date().toISOString() })
    return res.status(200).json({ ok: true, ...resumo })
  } catch (e) {
    resumo.erro = e.message
    // mantém o ultimo_inicio anterior para a próxima rodada cobrir o mesmo intervalo
    await sb.from('tarefas_sync').upsert({ id: 'clickup', ultimo_inicio: estado?.ultimo_inicio || new Date(desde).toISOString(), ultimo_fim: new Date().toISOString(), ultimo_ok: false, resumo, updated_at: new Date().toISOString() })
    return res.status(500).json({ ok: false, error: e.message, ...resumo })
  }
}
