// Regras puras do módulo Sprints do VertaTask. Modelo do ClickUp (planejar → confirmar o
// compromisso → acompanhar → tratar o transbordo), com uma sprint para cada pessoa por semana.
// Horas sempre em minutos aqui dentro; datas de sprint são 'YYYY-MM-DD' locais, como em vertatask.js.
import { paraDiaLocal, paraISODia, hojeISO, somarDias, diasEntre, fmtDiaMes, fmtHoras } from './vertatask'

// Espelho do DEFAULT_CONFIG de api/_atividades_engine.js, só para a tela não quebrar sem a API.
// A fonte de verdade é a action=config de /api/atividades, a mesma da Capacidade do time.
export const CONFIG_SPRINT_PADRAO = {
  capacidade_padrao_horas_dia: 6, capacidade_por_pessoa: {}, horas_padrao_sem_estimativa: 1,
  horas_por_tipo: {}, horas_por_dificuldade: {}, dias_uteis: [1, 2, 3, 4, 5], feriados: [], dias_atraso_maximo: 14,
}

// Folga para o que entra no meio da semana: até aqui a carga está saudável.
export const FOLGA_RECOMENDADA = 0.15

export const fmtMin = (min) => fmtHoras((min || 0) / 60)
const norm = (s) => String(s || '').trim().toLowerCase()
const diaDe = (v) => (v ? paraISODia(new Date(v)) : null)
export const nTarefas = (n) => `${n} ${n === 1 ? 'tarefa' : 'tarefas'}`
export const fmtPeriodo = (s) => `${fmtDiaMes(s.inicio)} a ${fmtDiaMes(s.fim)}`

/** Horas da tarefa, na mesma ordem do motor do Atividades: estimativa > tipo > dificuldade > padrão. */
export function minutosDaTarefa(tarefa, cfg = CONFIG_SPRINT_PADRAO) {
  const est = Number(tarefa?.estimativa_min)
  if (Number.isFinite(est) && est > 0) return { min: Math.round(est), origem: 'estimativa' }
  const achar = (mapa, valor) => {
    if (!valor || !mapa) return null
    const k = Object.keys(mapa).find((x) => norm(x) === norm(valor))
    return k ? Number(mapa[k]) : null
  }
  const porTipo = achar(cfg.horas_por_tipo, tarefa?.tipo_tarefa)
  if (porTipo != null) return { min: Math.round(porTipo * 60), origem: `tipo: ${String(tarefa.tipo_tarefa).trim()}` }
  const porDif = achar(cfg.horas_por_dificuldade, tarefa?.dificuldade)
  if (porDif != null) return { min: Math.round(porDif * 60), origem: `dificuldade: ${tarefa.dificuldade}` }
  return { min: Math.round(Number(cfg.horas_padrao_sem_estimativa ?? 1) * 60), origem: 'padrão' }
}

export function diasUteisDoPeriodo(inicio, fim, cfg = CONFIG_SPRINT_PADRAO) {
  const uteis = cfg.dias_uteis || CONFIG_SPRINT_PADRAO.dias_uteis
  const feriados = cfg.feriados || []
  const dias = []
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
    if (uteis.includes(paraDiaLocal(d).getDay()) && !feriados.includes(d)) dias.push(d)
  }
  return dias
}

/** 'futura' | 'ativa' | 'encerrada' (passou da data, falta concluir) | 'concluida' */
export function faseDaSprint(s, hoje = hojeISO()) {
  if (!s) return null
  if (s.concluida_em) return 'concluida'
  if (hoje < s.inicio) return 'futura'
  if (hoje > s.fim) return 'encerrada'
  return 'ativa'
}
export const ROTULO_FASE_SPRINT = { futura: 'Em planejamento', ativa: 'Em andamento', encerrada: 'Falta concluir', concluida: 'Concluída' }

/** Modo que a tela abre em cada fase da sprint. */
export const modoPadrao = (fase) => (fase === 'futura' ? 'planejar' : fase === 'encerrada' ? 'fechar' : 'acompanhar')

/** A sprint que a tela abre: a próxima em planejamento (é a reunião de sexta), senão a atual, senão a última. */
export function sprintPadrao(sprints, hoje = hojeISO()) {
  if (!sprints.length) return null
  const ordem = [...sprints].sort((a, b) => a.inicio.localeCompare(b.inicio))
  const ativa = ordem.find((s) => faseDaSprint(s, hoje) === 'ativa')
  const futura = ordem.find((s) => faseDaSprint(s, hoje) === 'futura')
  const aberta = ordem.find((s) => faseDaSprint(s, hoje) === 'encerrada')
  return aberta || futura || ativa || ordem[ordem.length - 1]
}

const segundaDepoisDe = (iso) => somarDias(iso, (8 - paraDiaLocal(iso).getDay()) % 7 || 7)

/**
 * Próxima sprint de um squad: começa na segunda seguinte a hoje e à última dele, com a mesma
 * duração da sprint mais recente de qualquer squad (o time usa segunda a sexta). O número é o da
 * semana: se o outro squad já tem sprint nessa semana, é o mesmo; senão, o maior + 1. Sem sprint
 * nenhuma, parte da pasta Sprint do ClickUp ("Sprint 30 (11/2 - 11/8)").
 */
export function sugerirSprint(doSquad, listas = [], hoje = hojeISO(), todas = doSquad) {
  const ultimoFim = doSquad.reduce((m, s) => (s.fim > m ? s.fim : m), '')
  let inicio = segundaDepoisDe(hoje)
  if (ultimoFim && segundaDepoisDe(ultimoFim) > inicio) inicio = segundaDepoisDe(ultimoFim)
  const recente = [...todas].sort((a, b) => b.inicio.localeCompare(a.inicio))[0]
  const fim = somarDias(inicio, recente ? diasEntre(recente.inicio, recente.fim) : 4)
  const mesmaSemana = todas.find((s) => s.inicio === inicio)
  let numero = mesmaSemana ? mesmaSemana.numero : todas.reduce((m, s) => Math.max(m, s.numero || 0), 0) + 1
  if (!todas.length) {
    numero = 0
    for (const l of listas) {
      const m = /^sprint\s+(\d+)/i.exec(l.nome || '')
      if (m && diaDe(l.data_inicio) && diaDe(l.data_inicio) < inicio) numero = Math.max(numero, Number(m[1]))
    }
    numero += 1
  }
  return { numero, nome: `Sprint ${numero}`, inicio, fim }
}

/** Quem vem marcado na sprint nova do squad: as pessoas da anterior, ou os membros do squad. */
export function pessoasPadraoDoSquad(squad, anteriores = []) {
  if (anteriores.length) return anteriores.map((p) => p.pessoa_id)
  return (squad?.members || []).map((m) => m.profile_id).filter(Boolean)
}

/** Linhas de tarefas_sprint_pessoas das pessoas escolhidas, sem desativados e sem o usuário "Cliente". */
export function participantesDaSprint({ membros, ids = null, inicio, fim, cfg = CONFIG_SPRINT_PADRAO }) {
  const dias = diasUteisDoPeriodo(inicio, fim, cfg).length
  const ativos = (membros || []).filter((m) => !m.disabled && norm(m.name) !== 'cliente')
  const escolhidos = ids ? new Set(ids) : null
  return ativos.filter((m) => !escolhidos || escolhidos.has(m.id)).map((m) => ({
    pessoa_id: m.id,
    dias_disponiveis: dias,
    horas_dia: Number((m.clickup_user_id && cfg.capacidade_por_pessoa?.[m.clickup_user_id]) ?? cfg.capacidade_padrao_horas_dia ?? 6),
  }))
}

export const capacidadeMin = (p) => Math.round(Number(p?.dias_disponiveis || 0) * Number(p?.horas_dia || 0) * 60)

/** 'folga' (dentro do recomendado) | 'justa' (sem espaço para imprevisto) | 'passou' | 'vazia' */
export function saudeDaCarga(planejadoMin, capMin) {
  if (!capMin) return { nivel: planejadoMin ? 'passou' : 'vazia', pct: 0, limiteMin: 0 }
  const pct = planejadoMin / capMin
  const limiteMin = Math.round(capMin * (1 - FOLGA_RECOMENDADA))
  if (!planejadoMin) return { nivel: 'vazia', pct: 0, limiteMin }
  if (pct > 1) return { nivel: 'passou', pct, limiteMin }
  if (planejadoMin > limiteMin) return { nivel: 'justa', pct, limiteMin }
  return { nivel: 'folga', pct, limiteMin }
}

/** Situação de um item, juntando a linha da sprint e a tarefa dela. */
export function classificarItem(item, tarefa, sprint, cfg = CONFIG_SPRINT_PADRAO) {
  const { min: minVivo, origem } = tarefa ? minutosDaTarefa(tarefa, cfg) : { min: item.min_compromisso || 0, origem: 'padrão' }
  const fechada = tarefa?.status_tipo === 'closed'
  const diaConclusao = fechada ? diaDe(tarefa.data_conclusao || tarefa.data_fechamento) : null
  const antecipada = item.resultado ? item.resultado === 'antecipada' : !!(diaConclusao && diaConclusao < sprint.inicio)
  const concluida = item.resultado ? item.resultado === 'concluida' : fechada && !antecipada
  return {
    item, tarefa: tarefa || null, titulo: tarefa?.titulo || item.titulo || 'Tarefa removida',
    min: minVivo, origemHoras: origem, inferida: origem !== 'estimativa',
    removida: !!item.removida_em, antecipada, concluida, diaConclusao,
    fora: !!item.fora_do_plano, transbordo: item.origem === 'transbordo',
    aberta: !item.removida_em && !antecipada && !concluida,
  }
}

/** Números da sprint de uma pessoa. Sem confirmar, o compromisso é a previsão do momento (como no ClickUp). */
export function resumoDaPessoa(linhaPessoa, itens, tarefas, sprint, cfg = CONFIG_SPRINT_PADRAO, outrosMin = 0) {
  const lista = (itens || []).map((i) => classificarItem(i, tarefas[i.tarefa_id], sprint, cfg))
  const confirmada = !!linhaPessoa?.confirmada_em
  const ativos = lista.filter((c) => !c.removida && !c.antecipada)
  const horas = (c) => (confirmada && !c.fora && c.item.min_compromisso != null ? c.item.min_compromisso : c.min)
  const soma = (arr, f = (c) => c.min) => arr.reduce((a, c) => a + f(c), 0)
  const comprometidos = confirmada ? lista.filter((c) => !c.fora && !c.antecipada && (c.item.min_compromisso != null || !c.removida)) : ativos
  const feitos = ativos.filter((c) => c.concluida)
  const abertas = ativos.filter((c) => c.aberta)
  const foras = ativos.filter((c) => c.fora)
  const removidas = lista.filter((c) => c.removida)
  const compromissoMin = soma(comprometidos, horas)
  const entregueCompromissoMin = soma(comprometidos.filter((c) => c.concluida && !c.removida), horas)
  const capMin = capacidadeMin(linhaPessoa)
  const planejadoMin = soma(ativos)
  return {
    lista, ativos, abertas, feitos, foras, removidas, confirmada,
    // quem está nos dois squads tem uma capacidade só: a carga soma o que assumiu no outro
    capMin, planejadoMin, outrosMin, totalMin: planejadoMin + outrosMin, saude: saudeDaCarga(planejadoMin + outrosMin, capMin),
    compromissoMin, compromissoTarefas: comprometidos.length,
    feitoMin: soma(feitos), feitoTarefas: feitos.length, entregueCompromissoMin,
    restanteMin: soma(abertas), foraMin: soma(foras), removidaMin: soma(removidas),
    semEstimativa: ativos.filter((c) => c.inferida).length,
    semMeta: ativos.filter((c) => !c.item.meta_id).length,
    sayDo: compromissoMin ? entregueCompromissoMin / compromissoMin : null,
  }
}

/** Soma do time: a linha de cima da visão geral. */
export function resumoDoTime(resumos) {
  const r = { capMin: 0, planejadoMin: 0, compromissoMin: 0, compromissoTarefas: 0, feitoMin: 0, feitoTarefas: 0, entregueCompromissoMin: 0, restanteMin: 0, foraMin: 0, removidaMin: 0, abertas: 0, foras: 0, removidas: 0, semEstimativa: 0, semMeta: 0, confirmadas: 0, pessoas: resumos.length }
  for (const x of resumos) {
    for (const k of ['capMin', 'planejadoMin', 'compromissoMin', 'compromissoTarefas', 'feitoMin', 'feitoTarefas', 'entregueCompromissoMin', 'restanteMin', 'foraMin', 'removidaMin', 'semEstimativa', 'semMeta']) r[k] += x[k]
    r.abertas += x.abertas.length; r.foras += x.foras.length; r.removidas += x.removidas.length
    if (x.confirmada) r.confirmadas++
  }
  r.saude = saudeDaCarga(r.planejadoMin, r.capMin)
  r.sayDo = r.compromissoMin ? r.entregueCompromissoMin / r.compromissoMin : null
  return r
}

/**
 * Burndown em dias úteis: ponto 0 = começo da sprint, depois o fim de cada dia útil até hoje.
 * A guia reta sai do compromisso; o real inclui o que entrou fora do plano no dia em que entrou.
 */
export function calcularBurndownSprint(sprint, classificados, cfg = CONFIG_SPRINT_PADRAO, hoje = hojeISO(), confirmada = true) {
  const dias = diasUteisDoPeriodo(sprint.inicio, sprint.fim, cfg)
  const horas = (c) => (confirmada && !c.fora && c.item.min_compromisso != null ? c.item.min_compromisso : c.min)
  const base = classificados.filter((c) => !c.antecipada)
  const compromisso = base.filter((c) => !c.fora && (c.item.min_compromisso != null || !c.removida)).reduce((a, c) => a + horas(c), 0)
  const restanteEm = (d) => base.reduce((a, c) => {
    if (c.fora && diaDe(c.item.adicionada_em) > d) return a
    if (c.removida && diaDe(c.item.removida_em) <= d) return a
    if (c.concluida && (!c.diaConclusao || c.diaConclusao <= d)) return a
    return a + horas(c)
  }, 0)
  const n = dias.length
  const ideal = [compromisso, ...dias.map((_, i) => (n ? Math.max(0, compromisso * (1 - (i + 1) / n)) : 0))]
  const real = [compromisso]
  for (const d of dias) { if (d <= hoje) real.push(restanteEm(d)); else break }
  return { dias, ideal, real: hoje < sprint.inicio ? [] : real, compromisso, maximo: Math.max(compromisso, ...real, 1) }
}

const ordemPrioridade = { urgent: 0, urgente: 0, high: 1, alta: 1, normal: 2, low: 3, baixa: 3 }
function comparaBacklog(a, b) {
  const pa = ordemPrioridade[norm(a.prioridade)] ?? 2
  const pb = ordemPrioridade[norm(b.prioridade)] ?? 2
  if (pa !== pb) return pa - pb
  const va = diaDe(a.data_vencimento) || '9999'
  const vb = diaDe(b.data_vencimento) || '9999'
  if (va !== vb) return va.localeCompare(vb)
  return (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR')
}

/**
 * Backlog de uma pessoa para o planejamento, na ordem da conversa de sexta. O transbordo vem
 * primeiro (o que ficou aberto da sprint anterior), depois o que está atrasado e o que vence
 * na semana. Atrasada há mais de `dias_atraso_maximo` fica num grupo à parte e recolhido: é o mesmo
 * corte de "zumbi" da Capacidade do time, e a escolha dela é decidir se ainda vale fazer.
 */
export function gruposDoBacklog(tarefas, { sprint, idsNaSprint = new Set(), idsTransbordo = new Set(), hoje = hojeISO(), cfg = CONFIG_SPRINT_PADRAO }) {
  const limiteZumbi = somarDias(hoje, -Number(cfg.dias_atraso_maximo ?? 14))
  const grupos = {
    transbordo: { key: 'transbordo', titulo: 'Da sprint anterior, ainda abertas', aberto: true, tarefas: [] },
    atrasadas: { key: 'atrasadas', titulo: 'Atrasadas', aberto: true, tarefas: [] },
    antes: { key: 'antes', titulo: 'Vencem antes de a sprint começar', aberto: true, tarefas: [] },
    semana: { key: 'semana', titulo: 'Vencem nesta sprint', aberto: true, tarefas: [] },
    semData: { key: 'semData', titulo: 'Sem data', aberto: false, tarefas: [] },
    depois: { key: 'depois', titulo: 'Vencem depois da sprint', aberto: false, tarefas: [] },
    zumbis: { key: 'zumbis', titulo: `Atrasadas há mais de ${cfg.dias_atraso_maximo ?? 14} dias`, aberto: false, tarefas: [] },
  }
  for (const t of tarefas) {
    if (t.status_tipo === 'closed' || t.arquivada || idsNaSprint.has(t.id)) continue
    const v = diaDe(t.data_vencimento)
    if (idsTransbordo.has(t.id)) grupos.transbordo.tarefas.push(t)
    else if (!v) grupos.semData.tarefas.push(t)
    else if (v < limiteZumbi) grupos.zumbis.tarefas.push(t)
    else if (v < hoje) grupos.atrasadas.tarefas.push(t)
    else if (v < sprint.inicio) grupos.antes.tarefas.push(t)
    else if (v <= sprint.fim) grupos.semana.tarefas.push(t)
    else grupos.depois.tarefas.push(t)
  }
  return Object.values(grupos).filter((g) => g.tarefas.length).map((g) => ({ ...g, tarefas: g.tarefas.sort(comparaBacklog) }))
}

/** Entrega média das últimas sprints concluídas da pessoa (o retrato de cada uma, não as tarefas de hoje). */
export function velocidadeDaPessoa(sprints, pessoas, pessoaId, antesDe, qtd = 3) {
  const concluidas = sprints.filter((s) => s.concluida_em && s.inicio < antesDe).sort((a, b) => b.inicio.localeCompare(a.inicio))
  const linhas = []
  for (const s of concluidas) {
    const p = pessoas.find((x) => x.sprint_id === s.id && x.pessoa_id === pessoaId)
    if (p && p.entregue_min != null) linhas.push(p)
    if (linhas.length === qtd) break
  }
  if (!linhas.length) return null
  const comp = linhas.reduce((a, p) => a + (p.compromisso_min || 0), 0)
  const ent = linhas.reduce((a, p) => a + (p.entregue_compromisso_min || 0), 0)
  return {
    sprints: linhas.length,
    mediaEntregueMin: Math.round(linhas.reduce((a, p) => a + (p.entregue_min || 0), 0) / linhas.length),
    sayDo: comp ? ent / comp : null,
  }
}

/**
 * Progresso de uma meta: atividades concluídas sobre o total. Conta por atividade, não por hora: só
 * uma parte das tarefas tem estimativa, e "3 de 5" não dá margem a discussão na reunião. A mesma
 * tarefa com duas pessoas conta uma vez. Depois de concluída a sprint, vale o retrato gravado.
 */
export function progressoDaMeta(meta, classificados) {
  const porTarefa = new Map()
  for (const c of classificados) {
    if (c.item.meta_id !== meta.id || c.removida || c.antecipada) continue
    const atual = porTarefa.get(c.item.tarefa_id)
    if (!atual || (c.concluida && !atual.concluida)) porTarefa.set(c.item.tarefa_id, c)
  }
  const unicas = [...porTarefa.values()]
  const total = meta.resultado_total ?? unicas.length
  const feitas = meta.resultado_feitas ?? unicas.filter((c) => c.concluida).length
  const pct = meta.resultado_pct ?? (total ? Math.round((feitas / total) * 100) : 0)
  return {
    feitas, total, pct, batida: total > 0 && feitas >= total,
    abertas: unicas.filter((c) => c.aberta),
    horasMin: unicas.reduce((a, c) => a + c.min, 0),
  }
}

/** A linha de cima da tela de metas: quantas foram batidas e o % geral das atividades. */
export function resumoDasMetas(metas, classificados) {
  const ps = metas.map((m) => progressoDaMeta(m, classificados))
  const feitas = ps.reduce((a, p) => a + p.feitas, 0)
  const total = ps.reduce((a, p) => a + p.total, 0)
  return { metas: metas.length, batidas: ps.filter((p) => p.batida).length, feitas, total, pct: total ? Math.round((feitas / total) * 100) : 0 }
}

/**
 * O que concluir a sprint vai gravar (a RPC tarefas_sprint_concluir só aplica). Tarefa aberta vai
 * para a próxima sprint, a menos que a decisão seja voltar ao backlog; se a sprint da pessoa
 * na próxima semana já está confirmada, ela entra como fora do plano. Meta que não bateu continua
 * na próxima sprint com as atividades que transbordaram, a menos que seja encerrada.
 */
export function planoDeFechamento({ sprint, proxima, pessoas, itens, tarefas, metas = [], cfg = CONFIG_SPRINT_PADRAO, proximasPessoas = [], novoId = () => crypto.randomUUID() }) {
  const resultados = []
  const novos = []
  const retratos = []
  const classificados = []
  for (const p of pessoas) {
    const doItem = itens.filter((i) => i.sprint_id === sprint.id && i.pessoa_id === p.pessoa_id)
    const r = resumoDaPessoa(p, doItem, tarefas, sprint, cfg)
    classificados.push(...r.lista)
    retratos.push({ linha: p, r })
  }
  const retratoMetas = []
  const novasMetas = []
  const metaNova = new Map()
  for (const m of metas) {
    const pr = progressoDaMeta(m, classificados)
    retratoMetas.push({ id: m.id, resultado_pct: pr.pct, resultado_feitas: pr.feitas, resultado_total: pr.total })
    if (proxima && !pr.batida && m.decisao !== 'encerra') {
      const id = novoId()
      metaNova.set(m.id, id)
      novasMetas.push({ id, sprint_id: proxima.id, titulo: m.titulo, descricao: m.descricao || null, responsavel_id: m.responsavel_id || null, pasta_id: m.pasta_id || null, continua_de: m.id })
    }
  }
  const pessoasOut = []
  for (const { linha: p, r } of retratos) {
    let transbordo = 0
    for (const c of r.lista) {
      if (c.removida) continue
      if (c.antecipada) { resultados.push({ id: c.item.id, resultado: 'antecipada' }); continue }
      if (c.concluida) { resultados.push({ id: c.item.id, resultado: 'concluida' }); continue }
      if (c.item.decisao === 'backlog') { resultados.push({ id: c.item.id, resultado: 'devolvida' }); continue }
      resultados.push({ id: c.item.id, resultado: 'transbordou' })
      transbordo++
      if (proxima) {
        const dest = proximasPessoas.find((x) => x.pessoa_id === p.pessoa_id)
        if (dest) novos.push({ sprint_id: proxima.id, pessoa_id: p.pessoa_id, tarefa_id: c.item.tarefa_id, titulo: c.titulo, fora_do_plano: !!dest.confirmada_em, meta_id: metaNova.get(c.item.meta_id) || null })
      }
    }
    pessoasOut.push({
      id: p.id, compromisso_min: r.compromissoMin, compromisso_tarefas: r.compromissoTarefas,
      entregue_min: r.feitoMin, entregue_tarefas: r.feitoTarefas, entregue_compromisso_min: r.entregueCompromissoMin,
      fora_min: r.foraMin, transbordo_tarefas: transbordo,
    })
  }
  return {
    resultados, novos, pessoas: pessoasOut, metas: retratoMetas, novasMetas,
    transbordo: resultados.filter((x) => x.resultado === 'transbordou').length,
    devolvidas: resultados.filter((x) => x.resultado === 'devolvida').length,
    batidas: retratoMetas.filter((m) => m.resultado_total > 0 && m.resultado_feitas >= m.resultado_total).length,
  }
}
