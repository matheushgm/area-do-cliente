import { getUser, sb } from './_http.js'
// Serverless Function (Node) — Planejador de Atividades.
// POST /api/atividades  { action, ...payload }   (JWT do Supabase no Authorization)
//
//   action=config    → configuração mesclada (padrão do motor + atividades_config)
//   action=carga     → carga do time (sem tarefa nova): agenda projetada por
//                      pessoa para o painel de capacidade; refresh:true ignora o cache
//   action=sugerir   → lê as tarefas abertas dos responsáveis no ClickUp e
//                      devolve a agenda projetada + data de entrega sugerida
//   action=listas    → listas (com status) da pasta ClickUp do cliente
//   action=estimar   → grava a estimativa (horas) numa tarefa do ClickUp e
//                      invalida o cache da pessoa
//   action=concluidas → tarefas CONCLUÍDAS no workspace entre duas datas
//                      (relatório de entregas por colaborador e por cliente)
//   action=criar     → cria a tarefa aprovada no ClickUp (pasta do cliente,
//                      responsável, datas, estimativa, campos Cliente / Tipo /
//                      Departamento / Dificuldade) e registra em
//                      atividades_planejadas
//
// Variáveis de ambiente (servidor):
//   CLICKUP_API_TOKEN, CLICKUP_TEAM_ID (default 9009170774)
//   SUPABASE_URL, SUPABASE_ANON_KEY (validar JWT)
//   SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY (gravar histórico / ler config)
//
// Runtime Node (não Edge) de propósito: a leitura do ClickUp pagina 100 tasks
// por request e pode passar dos 25s do Edge para um time inteiro.

import {
  DEFAULT_CONFIG,
  planejarParaPessoa,
  resumirConcluida,
  hojeISO,
  isoToMillis,
  addDays,
  diffDias,
} from './_atividades_engine.js'

export const config = { maxDuration: 60 }

const CLICKUP_BASE = 'https://api.clickup.com/api/v2'
const DEFAULT_TEAM = '9009170774'

// IDs dos campos personalizados do space "Clientes" (estáveis; as OPÇÕES são
// lidas ao vivo na criação, porque novos clientes viram novas opções).
const CF = {
  cliente:      '3ea9499a-17e0-4c72-b6fc-894b5c1517a1', // drop_down
  tipoTarefa:   'f5414822-7ed6-48fc-98a2-8389a7828fdf', // drop_down
  dificuldade:  'b800f04f-2787-4ac8-a5c1-bb8549db8b78', // drop_down
  departamento: 'e60bebff-b035-49c2-879b-972777ed041e', // labels
}

const PRIORIDADE = { urgent: 1, high: 2, normal: 3, low: 4 }

// As variáveis CLICKUP_* na Vercel foram salvas com uma quebra de linha colada
// no valor ("9009170774\n"): sem limpar, a URL vira /team/9009170774\n/task → 404.
function envClean(name) {
  return String(process.env[name] || '').replace(/\\n/g, '').trim()
}

// Cache em memória (a função fica quente entre requests próximos): a lista de
// tarefas abertas de uma pessoa muda pouco em 2 minutos e o ClickUp limita a
// 100 requests/min no token pessoal.
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = globalThis.__atividadesCache || (globalThis.__atividadesCache = new Map())

function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// ─── ClickUp ──────────────────────────────────────────────────────────────────

async function clickup(method, path, token, body) {
  const res = await fetch(`${CLICKUP_BASE}${path}`, {
    method,
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = null }
  if (!res.ok || json?.err) {
    const err = new Error(json?.err || `ClickUp ${method} ${path} falhou: ${res.status}`)
    err.status = res.status
    err.code = json?.ECODE || null
    err.body = json || text
    throw err
  }
  return json
}

/** Todas as tarefas ABERTAS atribuídas a uma pessoa, no workspace inteiro. */
async function openTasksOf(clickupUserId, token, teamId, { refresh = false } = {}) {
  const key = `tasks:${clickupUserId}`
  const hit = cache.get(key)
  if (!refresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tasks
  const tasks = []
  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({
      'assignees[]': String(clickupUserId),
      include_closed: 'false',
      subtasks: 'true',
      page: String(page),
    })
    const r = await clickup('GET', `/team/${teamId}/task?${qs}`, token)
    const batch = r?.tasks || []
    tasks.push(...batch)
    if (r?.last_page === true || batch.length < 100) break
  }
  cache.set(key, { at: Date.now(), tasks })
  return tasks
}

/**
 * Tarefas CONCLUÍDAS no workspace inteiro entre dois dias (inclusive), pelo
 * `date_done` do ClickUp. Pagina até 20 páginas de 100; devolve `truncado`
 * se ainda houver mais (raro: seria 2.000 tarefas fechadas no período).
 */
const CACHE_DONE_TTL_MS = 2 * 60 * 1000
async function doneTasksBetween(desde, ate, token, teamId, { refresh = false } = {}) {
  const key = `done:${desde}:${ate}`
  const hit = cache.get(key)
  if (!refresh && hit && Date.now() - hit.at < CACHE_DONE_TTL_MS) return hit.result
  const tasks = []
  let truncado = false
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({
      include_closed: 'true',
      subtasks: 'true',
      order_by: 'updated',
      date_done_gt: String(isoToMillis(desde) - 1),
      date_done_lt: String(isoToMillis(ate) + 86400000),
      page: String(page),
    })
    const r = await clickup('GET', `/team/${teamId}/task?${qs}`, token)
    const batch = r?.tasks || []
    tasks.push(...batch)
    if (r?.last_page === true || batch.length < 100) break
    if (page === 19) truncado = true
  }
  const result = { tasks, truncado }
  cache.set(key, { at: Date.now(), result })
  return result
}

// ─── Supabase ─────────────────────────────────────────────────────────────────

async function validarJwt(req) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return { error: 'Servidor não configurado.', status: 500 }
  const auth = await getUser(req)
  return auth.ok ? { ok: true, user: auth.user } : { error: auth.message, status: 401 }
}

async function carregarConfig() {
  const { data, ok } = await sb(`/atividades_config?id=eq.global&select=config`)
  const stored = ok && Array.isArray(data) && data[0]?.config ? data[0].config : {}
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    horas_por_tipo: { ...DEFAULT_CONFIG.horas_por_tipo, ...(stored.horas_por_tipo || {}) },
    horas_por_dificuldade: { ...DEFAULT_CONFIG.horas_por_dificuldade, ...(stored.horas_por_dificuldade || {}) },
    capacidade_por_pessoa: { ...(stored.capacidade_por_pessoa || {}) },
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function actionSugerir(body, ctx) {
  const ids = (Array.isArray(body.assignees) ? body.assignees : [body.assignee])
    .map(Number).filter((n) => Number.isFinite(n) && n > 0)
  if (ids.length === 0) return { status: 400, error: 'Informe ao menos um responsável (clickup_user_id).' }
  const horas = body.horas != null ? Number(body.horas) : null
  if (horas != null && !(horas > 0)) return { status: 400, error: 'Horas estimadas inválidas.' }

  const cfg = await carregarConfig()
  const hoje = hojeISO()
  const naoAntesDe = /^\d{4}-\d{2}-\d{2}$/.test(body.naoAntesDe || '') ? body.naoAntesDe : null
  const dataDesejada = /^\d{4}-\d{2}-\d{2}$/.test(body.dataDesejada || '') ? body.dataDesejada : null

  const resultados = []
  const erros = []
  // Sequencial de propósito: respeita o rate limit do ClickUp.
  for (const id of ids) {
    try {
      const tasks = await openTasksOf(id, ctx.token, ctx.teamId)
      resultados.push(planejarParaPessoa({
        clickupUserId: id, tasks, horas, naoAntesDe, dataDesejada, config: cfg, hoje,
      }))
    } catch (e) {
      erros.push({ clickupUserId: id, error: e?.message || 'Falha ao ler o ClickUp', code: e?.code || null })
    }
  }
  return { data: { hoje, geradoEm: new Date().toISOString(), resultados, erros, config: { capacidade_padrao_horas_dia: cfg.capacidade_padrao_horas_dia, dias_atraso_maximo: cfg.dias_atraso_maximo } } }
}

/** Carga do time para o painel de capacidade: mesma leitura, sem tarefa nova. */
async function actionCarga(body, ctx) {
  const ids = (Array.isArray(body.assignees) ? body.assignees : [])
    .map(Number).filter((n) => Number.isFinite(n) && n > 0)
  if (ids.length === 0) return { status: 400, error: 'Informe os clickup_user_id do time.' }
  if (ids.length > 12) return { status: 400, error: 'No máximo 12 pessoas por chamada (o front pede em lotes).' }
  const refresh = !!body.refresh
  const cfg = await carregarConfig()
  const hoje = hojeISO()
  const pessoas = []
  const erros = []
  for (const id of ids) {
    try {
      const tasks = await openTasksOf(id, ctx.token, ctx.teamId, { refresh })
      pessoas.push(planejarParaPessoa({ clickupUserId: id, tasks, horas: null, config: cfg, hoje, diasResumo: 10 }))
    } catch (e) {
      erros.push({ clickupUserId: id, error: e?.message || 'Falha ao ler o ClickUp', code: e?.code || null })
    }
  }
  return { data: { hoje, geradoEm: new Date().toISOString(), pessoas, erros, config: { capacidade_padrao_horas_dia: cfg.capacidade_padrao_horas_dia, dias_atraso_maximo: cfg.dias_atraso_maximo, horizonte_dias_uteis: cfg.horizonte_dias_uteis } } }
}

/** Relatório de concluídas: tudo que fechou entre `desde` e `ate` (inclusive). */
async function actionConcluidas(body, ctx) {
  const hoje = hojeISO()
  const isoOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '')
  const ate = isoOk(body.ate) ? body.ate : hoje
  const desde = isoOk(body.desde) ? body.desde : addDays(ate, -6)
  const span = diffDias(desde, ate)
  if (span < 0) return { status: 400, error: 'Período inválido: "desde" é depois de "ate".' }
  if (span > 31) return { status: 400, error: 'Período máximo de 31 dias por chamada.' }
  const cfg = await carregarConfig()
  const { tasks, truncado } = await doneTasksBetween(desde, ate, ctx.token, ctx.teamId, { refresh: !!body.refresh })
  // o ClickUp filtra por ms; o recorte por dia (São Paulo) é feito aqui, no resumo
  const tarefas = tasks
    .map((t) => resumirConcluida(t, cfg))
    .filter((t) => t && t.dia && t.dia >= desde && t.dia <= ate)
    .sort((a, b) => (b.concluidaEm || '').localeCompare(a.concluidaEm || ''))
  return { data: { hoje, desde, ate, geradoEm: new Date().toISOString(), total: tarefas.length, truncado, tarefas } }
}

/** Grava time_estimate numa tarefa do ClickUp (edição inline das horas no painel). */
async function actionEstimar(body, ctx) {
  const taskId = String(body.taskId || '').trim()
  const horas = Number(body.horas)
  if (!/^[a-z0-9]+$/i.test(taskId)) return { status: 400, error: 'taskId inválido.' }
  if (!(horas > 0) || horas > 200) return { status: 400, error: 'Horas inválidas (entre 0,25 e 200).' }
  const task = await clickup('PUT', `/task/${taskId}`, ctx.token, { time_estimate: Math.round(horas * 3600000) })
  const assignees = (task?.assignees || []).map((a) => Number(a.id)).filter(Boolean)
  for (const id of assignees) cache.delete(`tasks:${id}`)
  const extra = Number(body.assigneeClickupId)
  if (extra > 0) cache.delete(`tasks:${extra}`)
  return { data: { ok: true, taskId, horas, time_estimate: task?.time_estimate ?? null } }
}

async function actionListas(body, ctx) {
  const folderId = String(body.folderId || '').trim()
  if (!folderId) return { status: 400, error: 'folderId é obrigatório.' }
  const r = await clickup('GET', `/folder/${folderId}/list?archived=false`, ctx.token)
  const listas = (r?.lists || []).map((l) => ({
    id: String(l.id),
    name: l.name,
    statuses: (l.statuses || []).map((s) => ({ status: s.status, type: s.type, color: s.color })),
  }))
  // "Geral" primeiro (é a lista de operação do cliente), depois o resto
  listas.sort((a, b) => (norm(a.name) === 'geral' ? -1 : norm(b.name) === 'geral' ? 1 : 0))
  return { data: { listas } }
}

function dificuldadePorHoras(h) {
  if (h > 3) return 'Complexa'
  if (h > 1) return 'Regular'
  return 'Baixa'
}

/** Resolve o id da opção de um dropdown/labels pelo nome (sem acento/caixa). */
function optionId(fields, fieldId, name) {
  const f = fields.find((x) => x.id === fieldId)
  if (!f || !name) return null
  const opts = f?.type_config?.options || []
  const alvo = norm(name)
  const exato = opts.find((o) => norm(o.name || o.label) === alvo)
  if (exato) return exato.id
  const parcial = opts.find((o) => { const n = norm(o.name || o.label); return n && (alvo.includes(n) || n.includes(alvo)) })
  return parcial ? parcial.id : null
}

async function actionCriar(body, ctx) {
  const listId = String(body.listId || '').trim()
  const nome = String(body.titulo || '').trim()
  const horas = Number(body.horas)
  const assigneeId = Number(body.assigneeClickupId)
  const dueDate = body.dataEscolhida
  if (!listId) return { status: 400, error: 'Lista do ClickUp não informada.' }
  if (!nome) return { status: 400, error: 'Título é obrigatório.' }
  if (!(horas > 0)) return { status: 400, error: 'Horas estimadas inválidas.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate || '')) return { status: 400, error: 'Data de entrega inválida.' }

  // Campos acessíveis na lista (inclui os herdados do space): opções ao vivo
  let fields = []
  try {
    const r = await clickup('GET', `/list/${listId}/field`, ctx.token)
    fields = r?.fields || []
  } catch (e) {
    console.warn('[atividades] não consegui ler campos da lista:', e?.message)
  }

  const custom_fields = []
  const clienteOpt = optionId(fields, CF.cliente, body.clienteNome)
  if (clienteOpt) custom_fields.push({ id: CF.cliente, value: clienteOpt })
  const tipoOpt = optionId(fields, CF.tipoTarefa, body.tipoTarefa)
  if (tipoOpt) custom_fields.push({ id: CF.tipoTarefa, value: tipoOpt })
  const difOpt = optionId(fields, CF.dificuldade, dificuldadePorHoras(horas))
  if (difOpt) custom_fields.push({ id: CF.dificuldade, value: difOpt })
  const depOpt = optionId(fields, CF.departamento, body.departamento)
  if (depOpt) custom_fields.push({ id: CF.departamento, value: [depOpt] })

  // Status: "a fazer" se a lista tiver; senão o padrão da lista
  let status
  try {
    const l = await clickup('GET', `/list/${listId}`, ctx.token)
    const st = (l?.statuses || []).find((s) => norm(s.status) === 'a fazer')
    if (st) status = st.status
  } catch { /* fica no status padrão */ }

  const descricao = [
    String(body.descricao || '').trim(),
    '',
    '---',
    `Planejado pela Área do Cliente em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} por ${ctx.user?.email || 'time'}.`,
    `Estimativa: ${horas}h. Entrega sugerida pelo sistema: ${body.dataSugerida ? fmtBR(body.dataSugerida) : 'n/d'}.`,
    body.sobrecarga ? `Atenção: data escolhida ANTES da sugerida (sobrecarga de ${body.horasExcedentes || '?'}h). Justificativa: ${body.justificativa || 'não informada'}.` : '',
  ].filter((l, i) => l !== '' || i === 1).join('\n')

  const payload = {
    name: nome,
    markdown_description: descricao,
    assignees: Number.isFinite(assigneeId) && assigneeId > 0 ? [assigneeId] : [],
    due_date: isoToMillis(dueDate),
    due_date_time: false,
    time_estimate: Math.round(horas * 3600000),
    priority: PRIORIDADE[body.prioridade] || PRIORIDADE.normal,
    custom_fields,
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(body.dataInicio || '')) {
    payload.start_date = isoToMillis(body.dataInicio)
    payload.start_date_time = false
  }
  if (status) payload.status = status

  let task
  let aviso = null
  try {
    task = await clickup('POST', `/list/${listId}/task`, ctx.token, payload)
  } catch (e) {
    // Token pessoal não consegue atribuir "guests" (OAUTH_023): cria sem
    // responsável e avisa, em vez de perder a tarefa.
    if (e?.code === 'OAUTH_023' && payload.assignees.length) {
      task = await clickup('POST', `/list/${listId}/task`, ctx.token, { ...payload, assignees: [] })
      aviso = 'ClickUp não permitiu atribuir o responsável por este token (usuário convidado). Atribua manualmente na tarefa.'
    } else {
      throw e
    }
  }
  if (!custom_fields.length) aviso = [aviso, 'Campos Cliente/Tipo/Departamento não foram preenchidos (opções não encontradas na lista).'].filter(Boolean).join(' ')

  // invalida o cache do responsável: a carga dele acabou de mudar
  if (assigneeId) cache.delete(`tasks:${assigneeId}`)

  // registro no histórico (service key)
  const row = {
    project_id: body.projectId || null,
    titulo: nome,
    descricao: String(body.descricao || '').trim() || null,
    tipo_tarefa: body.tipoTarefa || null,
    departamento: body.departamento || null,
    responsavel_profile_id: body.responsavelProfileId || null,
    responsavel_clickup_id: Number.isFinite(assigneeId) && assigneeId > 0 ? assigneeId : null,
    horas_estimadas: horas,
    prioridade: body.prioridade || 'normal',
    data_inicio_sugerida: body.dataInicio || null,
    data_sugerida: body.dataSugerida || null,
    data_escolhida: dueDate,
    sobrecarga: !!body.sobrecarga,
    horas_excedentes: body.horasExcedentes != null ? Number(body.horasExcedentes) : null,
    justificativa: body.justificativa || null,
    snapshot_carga: body.snapshot || null,
    clickup_task_id: String(task.id),
    clickup_task_url: task.url || `https://app.clickup.com/t/${task.id}`,
    clickup_list_id: listId,
    status: 'criada',
    aviso,
    created_by: ctx.user?.id || null,
  }
  const ins = await sb('/atividades_planejadas', { method: 'POST', body: JSON.stringify(row) })
  if (!ins.ok) console.warn('[atividades] falha ao gravar histórico:', ins.status, ins.data)

  return {
    data: {
      taskId: String(task.id),
      url: row.clickup_task_url,
      aviso,
      registro: ins.ok && Array.isArray(ins.data) ? ins.data[0] : null,
    },
  }
}

function fmtBR(iso) {
  const [y, m, d] = String(iso).split('-')
  return `${d}/${m}/${y}`
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } })

  const auth = await validarJwt(req)
  if (auth.error) return res.status(auth.status).json({ error: { message: auth.error } })

  // Vercel já entrega req.body parseado quando o content-type é JSON; o
  // fallback cobre o caso de vir como string (ex.: outro content-type).
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
  if (!body || typeof body !== 'object') body = {}
  const action = body.action

  // Config não depende do ClickUp: serve mesmo sem token (a UI usa pra defaults)
  if (action === 'config') {
    try {
      return res.status(200).json({ config: await carregarConfig() })
    } catch (e) {
      return res.status(502).json({ error: { message: e?.message || 'Erro ao ler configuração' } })
    }
  }

  const token = envClean('CLICKUP_API_TOKEN')
  if (!token) return res.status(500).json({ error: { message: 'CLICKUP_API_TOKEN não configurado.' } })
  const teamId = envClean('CLICKUP_TEAM_ID') || DEFAULT_TEAM
  const ctx = { token, teamId, user: auth.user }

  try {
    let out
    if (action === 'sugerir') out = await actionSugerir(body, ctx)
    else if (action === 'carga') out = await actionCarga(body, ctx)
    else if (action === 'listas') out = await actionListas(body, ctx)
    else if (action === 'concluidas') out = await actionConcluidas(body, ctx)
    else if (action === 'estimar') out = await actionEstimar(body, ctx)
    else if (action === 'criar') out = await actionCriar(body, ctx)
    else return res.status(400).json({ error: { message: 'Ação não suportada.' } })

    if (out.error) return res.status(out.status || 400).json({ error: { message: out.error } })
    return res.status(200).json(out.data)
  } catch (e) {
    const status = e?.status >= 400 && e?.status < 600 ? e.status : 502
    const hint = e?.code === 'OAUTH_025' || e?.code === 'OAUTH_027'
      ? ' O token do ClickUp (CLICKUP_API_TOKEN) parece inválido ou revogado: gere um novo em ClickUp → Configurações → Apps → API Token e atualize a variável na Vercel.'
      : ''
    return res.status(status).json({ error: { message: (e?.message || 'Erro ao falar com o ClickUp') + hint, code: e?.code || null } })
  }
}
