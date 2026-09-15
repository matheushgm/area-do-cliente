// Motor de agenda do Planejador de Atividades.
// Arquivos com prefixo "_" não viram rota na Vercel — são só módulos.
//
// Recebe as tarefas ABERTAS de uma pessoa (vindas do ClickUp), transforma cada
// uma em horas, distribui essas horas nos dias úteis a partir de hoje e
// responde: "a partir de que dia cabe uma tarefa nova de X horas sem estourar
// a capacidade diária dessa pessoa?".
//
// Tudo aqui é puro (sem rede, sem banco) para poder ser testado com Node.

export const TZ = 'America/Sao_Paulo'

// Nomes dos campos personalizados do ClickUp usados para estimar horas quando
// o campo nativo de estimativa está vazio (que é o caso da maioria das tasks).
export const CF_TIPO_TAREFA = 'Tipo de tarefa'
export const CF_DIFICULDADE = 'Dificuldade'

export const DEFAULT_CONFIG = {
  // Horas produtivas por dia útil. 8h de expediente raramente viram 8h de
  // entrega: reuniões, WhatsApp, imprevistos. 6h é o piso realista.
  capacidade_padrao_horas_dia: 6,
  // Override por pessoa: { [clickup_user_id]: horas }
  capacidade_por_pessoa: {},
  // Task sem estimativa, sem tipo e sem dificuldade
  horas_padrao_sem_estimativa: 1,
  // Horas por "Tipo de tarefa" (campo do ClickUp) quando não há estimativa
  horas_por_tipo: {
    'Criação de Arte Estática': 2,
    'Criação de Landing Page': 6,
    'Relatório': 1.5,
    'Edição de vídeo': 3,
    'Integração': 3,
    'Copy de anúncio': 1,
    'Copy de Landing Page': 3,
    'Estratégia': 3,
    'Traqueamento': 2,
    'Reunião': 1,
    'Preenchimento de resultado': 0.5,
    'Otimização': 1,
    'Subir Criativo': 0.5,
    'Criar Campanha': 2,
    'Gravação de vídeo': 3,
    'Fotografia': 3,
    'Edição de fotografia': 2,
    'Mídia Offline': 3,
    'Motion design': 4,
    'Projeto de identidade visual': 8,
    'Branding (estratégia)': 4,
  },
  // Horas por "Dificuldade" quando não há estimativa nem tipo
  horas_por_dificuldade: { Complexa: 4, Regular: 2, Baixa: 1 },
  // Tarefa atrasada há mais dias que isso é tratada como "zumbi": aparece no
  // resumo como alerta, mas não bloqueia a agenda (senão o backlog antigo
  // empurra toda tarefa nova pra daqui a um mês).
  dias_atraso_maximo: 14,
  // Tarefas em "backlog" com data contam na agenda?
  considerar_backlog: true,
  // Tarefas sem data entram na agenda? (não: só aparecem no resumo)
  considerar_sem_data: false,
  // Quantos dias úteis à frente a agenda enxerga
  horizonte_dias_uteis: 60,
  // Hora em que o expediente termina (o painel compara as tarefas de hoje com o
  // que falta de relógio até essa hora)
  fim_expediente_hora: 18,
  // 0=dom … 6=sáb
  dias_uteis: [1, 2, 3, 4, 5],
  // 'yyyy-mm-dd'
  feriados: [],
}

// ─── Datas (sempre no fuso de São Paulo, como strings yyyy-mm-dd) ────────────

const fmtISO = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
})

/** Date (ou ms) → 'yyyy-mm-dd' no fuso de São Paulo. */
export function toISODate(input) {
  const d = input instanceof Date ? input : new Date(Number(input))
  if (isNaN(d.getTime())) return null
  return fmtISO.format(d)
}

/** 'yyyy-mm-dd' → ms da meia-noite em São Paulo (Brasil não tem mais horário de verão). */
export function isoToMillis(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null
  return new Date(`${iso}T00:00:00-03:00`).getTime()
}

export function hojeISO(now = new Date()) {
  return toISODate(now)
}

/** Soma N dias de calendário a uma data ISO. */
export function addDays(iso, n) {
  const ms = isoToMillis(iso) + n * 86400000
  return toISODate(ms)
}

/** 0=dom … 6=sáb, calculado direto do ISO (sem depender do fuso do servidor). */
export function weekday(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function isDiaUtil(iso, config = DEFAULT_CONFIG) {
  const dias = config.dias_uteis || DEFAULT_CONFIG.dias_uteis
  const feriados = config.feriados || []
  return dias.includes(weekday(iso)) && !feriados.includes(iso)
}

/** Primeiro dia útil >= iso. */
export function proximoDiaUtil(iso, config = DEFAULT_CONFIG) {
  let d = iso
  for (let i = 0; i < 60; i++) {
    if (isDiaUtil(d, config)) return d
    d = addDays(d, 1)
  }
  return d
}

/** Lista de N dias úteis a partir de `inicio` (inclusive, se for útil). */
export function diasUteis(inicio, n, config = DEFAULT_CONFIG) {
  const out = []
  let d = inicio
  let guard = 0
  while (out.length < n && guard < n * 3 + 30) {
    if (isDiaUtil(d, config)) out.push(d)
    d = addDays(d, 1)
    guard++
  }
  return out
}

export function diffDias(a, b) {
  return Math.round((isoToMillis(b) - isoToMillis(a)) / 86400000)
}

// ─── Horas de uma tarefa ─────────────────────────────────────────────────────

function norm(s) {
  return String(s || '').trim().toLowerCase()
}

/** Valor legível de um custom field dropdown/labels do ClickUp. */
function customFieldValue(task, fieldName) {
  const cf = (task?.custom_fields || []).find((f) => norm(f?.name) === norm(fieldName))
  if (!cf || cf.value === undefined || cf.value === null || cf.value === '') return null
  const options = cf?.type_config?.options || []
  const resolve = (v) => {
    if (typeof v === 'object' && v) return v.name || v.label || null
    // dropdown guarda o índice (number) ou o id (string) da opção
    const opt = options.find((o) => o.id === v || o.orderindex === v)
    return opt ? (opt.name || opt.label) : (typeof v === 'string' ? v : null)
  }
  if (Array.isArray(cf.value)) return cf.value.map(resolve).filter(Boolean)[0] || null
  return resolve(cf.value)
}

/**
 * Horas de uma tarefa: estimativa nativa > tipo de tarefa > dificuldade > padrão.
 * Devolve { horas, origem } para a UI explicar de onde veio o número.
 */
export function horasDaTarefa(task, config = DEFAULT_CONFIG) {
  const est = Number(task?.time_estimate)
  if (Number.isFinite(est) && est > 0) {
    return { horas: round2(est / 3600000), origem: 'estimativa' }
  }
  const tipo = customFieldValue(task, CF_TIPO_TAREFA)
  if (tipo) {
    const key = Object.keys(config.horas_por_tipo || {}).find((k) => norm(k) === norm(tipo))
    if (key) return { horas: Number(config.horas_por_tipo[key]), origem: `tipo: ${key}` }
  }
  const dif = customFieldValue(task, CF_DIFICULDADE)
  if (dif) {
    const key = Object.keys(config.horas_por_dificuldade || {}).find((k) => norm(k) === norm(dif))
    if (key) return { horas: Number(config.horas_por_dificuldade[key]), origem: `dificuldade: ${key}` }
  }
  return { horas: Number(config.horas_padrao_sem_estimativa ?? 1), origem: 'padrão' }
}

function round2(n) {
  return Math.round(n * 100) / 100
}

// ─── Classificação das tarefas abertas ───────────────────────────────────────

function statusNorm(task) {
  return norm(task?.status?.status)
}

function isBacklog(task) {
  const s = statusNorm(task)
  return s.includes('backlog')
}

function isClosed(task) {
  const t = task?.status?.type
  const s = statusNorm(task)
  return t === 'closed' || t === 'done' || ['complete', 'concluído', 'concluido', 'done', 'closed'].includes(s)
}

/**
 * Separa as tarefas em: consideradas (entram na agenda), zumbis (atrasadas há
 * tempo demais), semData (sem vencimento) e backlogIgnorado.
 * Cada tarefa considerada ganha `dia` = dia em que consome capacidade
 * (vencimento, ou hoje se já venceu).
 */
export function classificarTarefas(tasks, config = DEFAULT_CONFIG, hoje = hojeISO()) {
  const consideradas = []
  const zumbis = []
  const semData = []
  const backlogIgnorado = []
  const limiteZumbi = Number(config.dias_atraso_maximo ?? DEFAULT_CONFIG.dias_atraso_maximo)

  for (const t of tasks || []) {
    if (!t || isClosed(t)) continue
    const { horas, origem } = horasDaTarefa(t, config)
    const base = {
      id: t.id,
      nome: t.name,
      url: t.url,
      status: t.status?.status || null,
      lista: t.list?.name || null,
      pasta: t.folder?.name || null,
      prioridade: t.priority?.priority || null,
      horas,
      origem,
    }
    const dueISO = t.due_date ? toISODate(Number(t.due_date)) : null

    if (isBacklog(t) && !config.considerar_backlog) {
      backlogIgnorado.push({ ...base, vencimento: dueISO })
      continue
    }
    if (!dueISO) {
      if (config.considerar_sem_data) {
        consideradas.push({ ...base, vencimento: null, dia: proximoDiaUtil(hoje, config), atrasada: false })
      } else {
        semData.push(base)
      }
      continue
    }
    const atraso = diffDias(dueISO, hoje) // >0 = já venceu há N dias
    if (atraso > limiteZumbi) {
      zumbis.push({ ...base, vencimento: dueISO, diasAtraso: atraso })
      continue
    }
    // dia em que consome capacidade: hoje (se já venceu) ou o vencimento,
    // sempre empurrado para o próximo dia útil (sábado/feriado não entrega)
    const dia = proximoDiaUtil(atraso > 0 ? hoje : dueISO, config)
    consideradas.push({ ...base, vencimento: dueISO, dia, atrasada: atraso > 0, diasAtraso: Math.max(0, atraso) })
  }

  const soma = (arr) => round2(arr.reduce((s, x) => s + (x.horas || 0), 0))
  const todas = [...consideradas, ...zumbis, ...semData, ...backlogIgnorado]
  const semEstimativa = consideradas.filter((x) => x.origem !== 'estimativa')
  // distribuição por status e por pasta (cliente) para o painel do gestor
  const porStatus = {}
  for (const t of todas) {
    const k = t.status || 'sem status'
    porStatus[k] = porStatus[k] || { tarefas: 0, horas: 0 }
    porStatus[k].tarefas += 1
    porStatus[k].horas = round2(porStatus[k].horas + t.horas)
  }
  const pastaMap = {}
  for (const t of consideradas) {
    const k = t.pasta || t.lista || 'sem pasta'
    pastaMap[k] = pastaMap[k] || { pasta: k, tarefas: 0, horas: 0 }
    pastaMap[k].tarefas += 1
    pastaMap[k].horas = round2(pastaMap[k].horas + t.horas)
  }
  const porPasta = Object.values(pastaMap).sort((a, b) => b.horas - a.horas).slice(0, 5)
  return {
    consideradas,
    zumbis,
    semData,
    backlogIgnorado,
    totais: {
      abertas: todas.length,
      consideradas: consideradas.length,
      horasConsideradas: soma(consideradas),
      atrasadas: consideradas.filter((x) => x.atrasada).length,
      horasAtrasadas: soma(consideradas.filter((x) => x.atrasada)),
      zumbis: zumbis.length,
      horasZumbis: soma(zumbis),
      semData: semData.length,
      horasSemData: soma(semData),
      backlogIgnorado: backlogIgnorado.length,
      // confiabilidade do número: quantas horas vieram de tipo/dificuldade/padrão
      semEstimativa: { tarefas: semEstimativa.length, horas: soma(semEstimativa) },
    },
    porStatus,
    porPasta,
  }
}

// ─── Agenda dia a dia ────────────────────────────────────────────────────────

export function capacidadeDe(clickupUserId, config = DEFAULT_CONFIG) {
  const porPessoa = config.capacidade_por_pessoa || {}
  const v = Number(porPessoa[String(clickupUserId)])
  if (Number.isFinite(v) && v > 0) return v
  return Number(config.capacidade_padrao_horas_dia ?? DEFAULT_CONFIG.capacidade_padrao_horas_dia)
}

/**
 * Monta a agenda: um item por dia útil a partir de hoje.
 * - cargaOriginal: horas das tarefas que vencem naquele dia (atrasadas caem em hoje)
 * - cargaProjetada: depois de "rolar" o excesso de um dia para o seguinte
 *   (quem tem 14h vencendo na segunda não entrega 14h na segunda: sobra pra terça)
 * - livre: capacidade - cargaProjetada
 * Tarefas que vencem em dia não útil (sábado/feriado) contam no próximo dia útil.
 */
export function montarAgenda({ tarefas, capacidade, hoje = hojeISO(), config = DEFAULT_CONFIG }) {
  const n = Number(config.horizonte_dias_uteis ?? DEFAULT_CONFIG.horizonte_dias_uteis)
  const dias = diasUteis(hoje, n, config)
  const idx = new Map(dias.map((d, i) => [d, i]))
  const agenda = dias.map((data) => ({ data, capacidade, cargaOriginal: 0, cargaProjetada: 0, livre: capacidade, tarefas: [] }))

  const ultimo = dias[dias.length - 1]
  let alemDoHorizonte = 0
  for (const t of tarefas || []) {
    let dia = t.dia && t.dia >= hoje ? proximoDiaUtil(t.dia, config) : proximoDiaUtil(hoje, config)
    if (dia > ultimo) { alemDoHorizonte += t.horas; continue }
    const i = idx.get(dia)
    if (i === undefined) continue
    agenda[i].cargaOriginal = round2(agenda[i].cargaOriginal + t.horas)
    agenda[i].tarefas.push(t.id)
  }

  let carry = 0
  for (const d of agenda) {
    const total = d.cargaOriginal + carry
    if (total > capacidade) {
      d.cargaProjetada = capacidade
      carry = round2(total - capacidade)
    } else {
      d.cargaProjetada = round2(total)
      carry = 0
    }
    d.excedente = carry // horas que este dia empurra pro próximo
    d.livre = round2(Math.max(0, capacidade - d.cargaProjetada))
  }

  return { agenda, alemDoHorizonte: round2(alemDoHorizonte), sobraFinal: carry }
}

// ─── Sugestão de data ────────────────────────────────────────────────────────

/**
 * Encaixa `horas` na capacidade livre da agenda, a partir de `naoAntesDe`.
 * Devolve início, entrega e a alocação dia a dia. Se não couber no horizonte,
 * entrega = null.
 */
export function sugerirData({ agenda, horas, naoAntesDe = null, hoje = hojeISO() }) {
  const h = Number(horas)
  if (!Number.isFinite(h) || h <= 0) return { inicio: null, entrega: null, alocacao: [], cabe: false, motivo: 'horas inválidas' }
  const inicioMin = naoAntesDe && naoAntesDe > hoje ? naoAntesDe : hoje
  let restante = h
  const alocacao = []
  for (const d of agenda) {
    if (d.data < inicioMin) continue
    if (d.livre <= 0) continue
    const usa = round2(Math.min(d.livre, restante))
    alocacao.push({ data: d.data, horas: usa })
    restante = round2(restante - usa)
    if (restante <= 0) {
      return {
        inicio: alocacao[0].data,
        entrega: d.data,
        alocacao,
        cabe: true,
        diasUteisAteEntrega: agenda.findIndex((x) => x.data === d.data) + 1,
      }
    }
  }
  return { inicio: alocacao[0]?.data || null, entrega: null, alocacao, cabe: false, motivo: 'não cabe no horizonte', restante }
}

/**
 * Se o account insistir numa data mais cedo: quanto vai estourar?
 * Aloca as horas na capacidade livre até `dataDesejada`; o que sobrar é
 * sobrecarga (hora extra ou tarefa de outro cliente atrasando).
 */
export function avaliarDataForcada({ agenda, horas, dataDesejada, naoAntesDe = null, hoje = hojeISO() }) {
  const h = Number(horas)
  const inicioMin = naoAntesDe && naoAntesDe > hoje ? naoAntesDe : hoje
  let restante = h
  const alocacao = []
  for (const d of agenda) {
    if (d.data < inicioMin) continue
    if (d.data > dataDesejada) break
    if (d.livre <= 0) continue
    const usa = round2(Math.min(d.livre, restante))
    alocacao.push({ data: d.data, horas: usa })
    restante = round2(restante - usa)
    if (restante <= 0) break
  }
  const diasDisponiveis = agenda.filter((d) => d.data >= inicioMin && d.data <= dataDesejada).length
  const excedente = round2(Math.max(0, restante))
  return {
    cabe: excedente <= 0,
    horasExcedentes: excedente,
    diasDisponiveis,
    alocacao,
    // se estourar, quanto o dia da entrega fica acima da capacidade
    cargaNoDia: (() => {
      const dia = agenda.find((d) => d.data === dataDesejada)
      if (!dia) return null
      return round2(dia.cargaProjetada + excedente)
    })(),
  }
}

// ─── Pipeline completo para uma pessoa ───────────────────────────────────────

/**
 * Entrada: tarefas abertas cruas do ClickUp + horas da nova tarefa.
 * Saída: tudo que a UI precisa para explicar a sugestão.
 */
export function planejarParaPessoa({
  clickupUserId,
  tasks,
  horas = null,
  naoAntesDe = null,
  dataDesejada = null,
  config = DEFAULT_CONFIG,
  hoje = hojeISO(),
  diasResumo = 10,
}) {
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) }
  const capacidade = capacidadeDe(clickupUserId, cfg)
  const cls = classificarTarefas(tasks, cfg, hoje)
  const { agenda, alemDoHorizonte, sobraFinal } = montarAgenda({ tarefas: cls.consideradas, capacidade, hoje, config: cfg })

  // Sinais sobre a agenda INTEIRA (60 dias úteis), não só os 10 do resumo
  const diasEstourados = agenda.filter((d) => d.excedente > 0).length
  const maiorExcedente = round2(agenda.reduce((m, d) => Math.max(m, d.excedente || 0), 0))
  // primeiro dia em que cabe uma tarefa "de verdade": ao menos 1h e metade da capacidade
  const minimoLivre = Math.max(1, capacidade * 0.5)
  const proximoDiaLivre = agenda.find((d) => d.livre >= minimoLivre)?.data || null

  const sugestao = horas ? sugerirData({ agenda, horas, naoAntesDe, hoje }) : null
  const forcada = horas && dataDesejada
    ? avaliarDataForcada({ agenda, horas, dataDesejada, naoAntesDe, hoje })
    : null

  const resumo = agenda.slice(0, diasResumo).map((d) => ({
    data: d.data,
    diaSemana: weekday(d.data),
    capacidade: d.capacidade,
    carga: d.cargaProjetada,
    cargaOriginal: d.cargaOriginal,
    livre: d.livre,
    excedente: d.excedente,
    tarefas: d.tarefas.length,
    alocadoNovaTarefa: sugestao?.alocacao?.find((a) => a.data === d.data)?.horas || 0,
  }))

  // Tarefas que ocupam os próximos dias (pra UI mostrar "o que já está na fila")
  const idsProximos = new Set(agenda.slice(0, diasResumo).flatMap((d) => d.tarefas))
  const filaProxima = cls.consideradas
    .filter((t) => idsProximos.has(t.id))
    .sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0))
    .map((t) => ({ id: t.id, nome: t.nome, url: t.url, dia: t.dia, vencimento: t.vencimento, horas: t.horas, origem: t.origem, atrasada: t.atrasada, lista: t.lista, pasta: t.pasta, status: t.status, prioridade: t.prioridade }))

  const horasProximos = round2(resumo.reduce((s, d) => s + d.carga, 0))
  const capProximos = round2(resumo.reduce((s, d) => s + d.capacidade, 0))

  return {
    clickupUserId: Number(clickupUserId),
    hoje,
    capacidadeDia: capacidade,
    totais: {
      ...cls.totais,
      horasProximosDias: horasProximos,
      capacidadeProximosDias: capProximos,
      ocupacaoProximosDias: capProximos > 0 ? Math.round((horasProximos / capProximos) * 100) : 0,
      alemDoHorizonte,
      sobraFinal: round2(sobraFinal || 0),
      diasEstourados,
      maiorExcedente,
    },
    proximoDiaLivre,
    porStatus: cls.porStatus,
    porPasta: cls.porPasta,
    sugestao,
    forcada,
    resumo,
    filaProxima,
    zumbis: cls.zumbis.slice(0, 50),
    semData: cls.semData.slice(0, 50),
  }
}

// ─── Tarefas concluídas (relatório) ──────────────────────────────────────────

export const CF_CLIENTE = 'Cliente'
export const CF_DEPARTAMENTO = 'Departamento'

/**
 * Resume uma tarefa CONCLUÍDA do ClickUp no formato que o relatório usa.
 * `dia` é o dia (São Paulo) em que ela foi concluída; `horas` reaproveita a
 * mesma regra do planejador (estimativa > tipo > dificuldade > padrão), para
 * o esforço entregue ser comparável ao esforço planejado.
 */
export function resumirConcluida(task, config = DEFAULT_CONFIG) {
  if (!task) return null
  const doneMs = Number(task.date_done || task.date_closed || task.date_updated)
  const criadaMs = Number(task.date_created)
  const { horas, origem } = horasDaTarefa(task, config)
  const spent = Number(task.time_spent)
  return {
    id: task.id,
    nome: task.name,
    url: task.url || `https://app.clickup.com/t/${task.id}`,
    status: task.status?.status || null,
    concluidaEm: Number.isFinite(doneMs) ? new Date(doneMs).toISOString() : null,
    dia: Number.isFinite(doneMs) ? toISODate(doneMs) : null,
    criadaEm: Number.isFinite(criadaMs) ? new Date(criadaMs).toISOString() : null,
    // dias entre criar e concluir (0 = mesmo dia)
    cicloDias: Number.isFinite(doneMs) && Number.isFinite(criadaMs) ? diffDias(toISODate(criadaMs), toISODate(doneMs)) : null,
    assignees: (task.assignees || []).map((a) => ({ id: Number(a.id), nome: a.username || a.email || null })),
    lista: task.list?.name || null,
    listaId: task.list?.id ? String(task.list.id) : null,
    pasta: task.folder?.name || null,
    pastaId: task.folder?.id ? String(task.folder.id) : null,
    clienteCf: customFieldValue(task, CF_CLIENTE),
    tipoTarefa: customFieldValue(task, CF_TIPO_TAREFA),
    departamento: customFieldValue(task, CF_DEPARTAMENTO),
    horas,
    origem,
    tempoRegistrado: Number.isFinite(spent) && spent > 0 ? round2(spent / 3600000) : null,
    prioridade: task.priority?.priority || null,
    subtarefa: !!task.parent,
    parentId: task.parent || null,
  }
}
