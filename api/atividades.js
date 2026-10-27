import { getUser, sb } from './_http.js'
// Serverless Function (Node) — Planejador de Atividades.
// POST /api/atividades  { action, ...payload }   (JWT do Supabase no Authorization)
//
//   action=config    → configuração mesclada (padrão do motor + atividades_config)
//   action=carga     → carga do time (sem tarefa nova): agenda projetada por
//                      pessoa para o painel de capacidade
//   action=sugerir   → lê as tarefas abertas dos responsáveis e devolve a
//                      agenda projetada + data de entrega sugerida
//   action=listas    → listas (com status) da pasta do cliente (do espelho)
//
// FONTE DOS DADOS (desde 2026-10-18): as tabelas tarefas_* do Supabase, o
// espelho do ClickUp que o VertaTask usa (api/_atividades_fonte.js). Antes a
// leitura era na API do ClickUp ao vivo, pessoa por pessoa, e os dois módulos
// não batiam. `assignees` aceita clickup_user_id (número) ou o uuid do perfil
// (quem não tem ClickUp). As escritas (criar, estimar, tipar) continuam indo
// para o ClickUp, que ainda é a origem, e são refletidas no espelho na hora.
//   action=tipar     → grava o "Tipo de tarefa" numa tarefa do ClickUp e, com
//                      ele, a estimativa em horas que o tipo define
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
// Runtime Node (não Edge): as escritas no ClickUp (criar/tipar) encadeiam
// várias chamadas e podem passar dos 25s do Edge.

import {
  DEFAULT_CONFIG,
  planejarParaPessoa,
  resumirConcluida,
  hojeISO,
  isoToMillis,
  addDays,
  diffDias,
} from './_atividades_engine.js'
import { carregarMapas, resolverPessoas, abertasDe, concluidasEntre, listasDaPasta, espelharTarefaClickUp } from './_atividades_fonte.js'

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
  const ids = (Array.isArray(body.assignees) ? body.assignees : [body.assignee]).filter((v) => v != null && v !== '')
  if (ids.length === 0) return { status: 400, error: 'Informe ao menos um responsável.' }
  const horas = body.horas != null ? Number(body.horas) : null
  if (horas != null && !(horas > 0)) return { status: 400, error: 'Horas estimadas inválidas.' }

  const cfg = await carregarConfig()
  const hoje = hojeISO()
  const naoAntesDe = /^\d{4}-\d{2}-\d{2}$/.test(body.naoAntesDe || '') ? body.naoAntesDe : null
  const dataDesejada = /^\d{4}-\d{2}-\d{2}$/.test(body.dataDesejada || '') ? body.dataDesejada : null

  const resultados = []
  const erros = []
  const mapas = await carregarMapas()
  for (const { chave, perfil, erro } of resolverPessoas(ids, mapas)) {
    if (!perfil) { erros.push({ clickupUserId: chave, error: erro }); continue }
    try {
      const tasks = await abertasDe(perfil.id, mapas)
      resultados.push({ ...planejarParaPessoa({ clickupUserId: chave, tasks, horas, naoAntesDe, dataDesejada, config: cfg, hoje }), profileId: perfil.id })
    } catch (e) {
      erros.push({ clickupUserId: chave, profileId: perfil.id, error: e?.message || 'Falha ao ler as tarefas', code: e?.code || null })
    }
  }
  return { data: { hoje, geradoEm: new Date().toISOString(), resultados, erros, config: { capacidade_padrao_horas_dia: cfg.capacidade_padrao_horas_dia, dias_atraso_maximo: cfg.dias_atraso_maximo } } }
}

/** Carga do time para o painel de capacidade: mesma leitura, sem tarefa nova. */
async function actionCarga(body, ctx) {
  const ids = (Array.isArray(body.assignees) ? body.assignees : []).filter((v) => v != null && v !== '')
  if (ids.length === 0) return { status: 400, error: 'Informe as pessoas do time.' }
  if (ids.length > 30) return { status: 400, error: 'No máximo 30 pessoas por chamada.' }
  const cfg = await carregarConfig()
  const hoje = hojeISO()
  const pessoas = []
  const erros = []
  const mapas = await carregarMapas()
  await Promise.all(resolverPessoas(ids, mapas).map(async ({ chave, perfil, erro }) => {
    if (!perfil) { erros.push({ clickupUserId: chave, error: erro }); return }
    try {
      const tasks = await abertasDe(perfil.id, mapas)
      pessoas.push({ ...planejarParaPessoa({ clickupUserId: chave, tasks, horas: null, config: cfg, hoje, diasResumo: 10 }), profileId: perfil.id })
    } catch (e) {
      erros.push({ clickupUserId: chave, profileId: perfil.id, error: e?.message || 'Falha ao ler as tarefas', code: e?.code || null })
    }
  }))
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
  const mapas = await carregarMapas()
  const tasks = await concluidasEntre(desde, ate, mapas)
  const truncado = false
  // o recorte por dia (São Paulo) é feito aqui, no resumo
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
  const esp = await espelharTarefaClickUp(task, await carregarMapas())
  if (!esp.ok) console.warn('[atividades] espelho (estimar):', esp.motivo)
  return { data: { ok: true, taskId, horas, time_estimate: task?.time_estimate ?? null, espelhado: esp.ok } }
}

/**
 * Define o "Tipo de tarefa" (dropdown do ClickUp) de uma tarefa existente. O
 * tipo é quem define o tempo: as horas configuradas para ele viram a
 * estimativa nativa da tarefa (a não ser que o cliente mande aplicarHoras=false).
 */
async function actionTipar(body, ctx) {
  const taskId = String(body.taskId || '').trim()
  const tipo = String(body.tipo || '').trim()
  if (!/^[a-z0-9]+$/i.test(taskId)) return { status: 400, error: 'taskId inválido.' }
  if (!tipo) return { status: 400, error: 'Tipo de tarefa é obrigatório.' }

  // A própria tarefa traz os campos acessíveis com as opções ao vivo
  const task = await clickup('GET', `/task/${taskId}`, ctx.token)
  const opt = optionId(task?.custom_fields || [], CF.tipoTarefa, tipo)
  if (!opt) return { status: 400, error: `A opção "${tipo}" não existe no campo Tipo de tarefa desta lista do ClickUp.` }
  await clickup('POST', `/task/${taskId}/field/${CF.tipoTarefa}`, ctx.token, { value: opt })

  const cfg = await carregarConfig()
  const key = Object.keys(cfg.horas_por_tipo || {}).find((k) => norm(k) === norm(tipo))
  const horas = key ? Number(cfg.horas_por_tipo[key]) : null
  let time_estimate = task?.time_estimate ?? null
  let final = task
  if (horas > 0 && body.aplicarHoras !== false) {
    final = await clickup('PUT', `/task/${taskId}`, ctx.token, { time_estimate: Math.round(horas * 3600000) })
    time_estimate = final?.time_estimate ?? null
  } else {
    final = await clickup('GET', `/task/${taskId}`, ctx.token) // relê com o campo gravado
  }
  const esp = await espelharTarefaClickUp(final, await carregarMapas())
  if (!esp.ok) console.warn('[atividades] espelho (tipar):', esp.motivo)
  return { data: { ok: true, taskId, tipo: key || tipo, horas, time_estimate, espelhado: esp.ok } }
}

async function actionListas(body, ctx) {
  const folderId = String(body.folderId || '').trim()
  if (!folderId) return { status: 400, error: 'folderId é obrigatório.' }
  let listas = listasDaPasta(folderId, await carregarMapas())
  if (!listas.length) {
    // pasta ainda não sincronizada: cai no ClickUp
    const r = await clickup('GET', `/folder/${folderId}/list?archived=false`, ctx.token)
    listas = (r?.lists || []).map((l) => ({ id: String(l.id), name: l.name, statuses: (l.statuses || []).map((s) => ({ status: s.status, type: s.type, color: s.color })) }))
  }
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
  const assigneeId = Number(body.assigneeClickupId) // uuid de perfil sem ClickUp vira NaN: cria sem responsável lá, com responsável aqui
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
  // Início depois do vencimento faz o ClickUp empurrar o vencimento para o
  // início. Com data escolhida antes da sugerida, o início sugerido (dia em
  // que o responsável fica livre) cai depois dela: limita à data escolhida.
  if (/^\d{4}-\d{2}-\d{2}$/.test(body.dataInicio || '')) {
    payload.start_date = isoToMillis(body.dataInicio > dueDate ? dueDate : body.dataInicio)
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

  // reflete no espelho (VertaTask + Capacidade) agora, sem esperar a sincronização
  const mapas = await carregarMapas()
  const esp = await espelharTarefaClickUp(task, mapas)
  if (!esp.ok) console.warn('[atividades] espelho (criar):', esp.motivo)
  else if (body.responsavelProfileId && !(assigneeId > 0)) {
    // responsável sem ClickUp: fica só no espelho
    await sb(`/tarefas_itens?id=eq.${esp.id}`, { method: 'PATCH', body: JSON.stringify({ responsaveis: [body.responsavelProfileId] }) })
  }

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
      vertataskId: esp.ok ? esp.id : null,
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
    else if (action === 'tipar') out = await actionTipar(body, ctx)
    else if (action === 'criar') out = await actionCriar(body, ctx)
    else return res.status(400).json({ error: { message: 'Ação não suportada.' } })

    if (out.error) return res.status(out.status || 400).json({ error: { message: out.error } })
    return res.status(200).json(out.data)
  } catch (e) {
    const status = e?.status >= 400 && e?.status < 600 ? e.status : 502
    const hint = e?.code === 'OAUTH_025' || e?.code === 'OAUTH_027'
      ? ' O token do ClickUp (CLICKUP_API_TOKEN) parece inválido ou revogado: gere um novo em ClickUp → Configurações → Apps → API Token e atualize a variável na Vercel.'
      : ''
    return res.status(status).json({ error: { message: (e?.message || 'Erro ao ler as tarefas') + hint, code: e?.code || null } })
  }
}
