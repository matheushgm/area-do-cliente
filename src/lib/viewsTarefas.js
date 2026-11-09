// Visualizações (views) do VertaTask: abas dentro da pasta do cliente (ou de "Minhas" /
// "Todas"), ao lado das 4 padrão. Regras puras; os dados vêm de tarefas_views (migration 112).
//
// config de uma view = { tipo, agrupar, subtarefas, responsaveis[], concluidas, filtros, ordenar }
//   tipo        lista | quadro | calendario | gantt (a Planilha saiu: era a Lista de novo)
//   subtarefas  recolhidas (padrão) | expandidas | separar
//   responsaveis [] = todos; com gente, tarefa de qualquer um deles; SEM_RESPONSAVEL = tarefa sem ninguém
//   filtros     filtros avançados (src/lib/filtrosTarefas.js)
//   ordenar     { campo, dir } da Lista (cabeçalho clicável) ou null = ordem manual
//   calendario  mes (padrão) | semana: escala do Calendário
//   colunas     colunas da Lista: { ordem: [k], ocultas: [k] } ou null = padrão (todas, na ordem do ClickUp)
//   colunasGantt  o mesmo para a lista de tarefas do Gantt (null = Responsável, Início e Vencimento)
// A tela trabalha sobre um rascunho da config; "Salvar visualização" grava.
import { AGRUPAMENTOS } from './tarefas'
import { FILTROS_VAZIOS, normalizarFiltros } from './filtrosTarefas'
import { t as tr } from '../i18n'

export const TIPOS_VIEW = [
  { key: 'lista', label: 'Lista' },
  { key: 'quadro', label: 'Quadro' },
  { key: 'calendario', label: 'Calendário' },
  { key: 'gantt', label: 'Gantt' },
]
/** Valor especial do filtro de responsáveis: tarefas sem responsável (nem do time, nem só do ClickUp). */
export const SEM_RESPONSAVEL = '__nenhum__'
export const temResponsavel = (it) => (it.responsaveis || []).length > 0 || (it.responsaveis_extra || []).length > 0
/** Passa no filtro de responsáveis da barra (lista vazia = todos). */
export const passaResponsaveis = (it, ids) => !ids.length || ids.some((id) => (id === SEM_RESPONSAVEL ? !temResponsavel(it) : (it.responsaveis || []).includes(id)))
export const nomeResponsavelFiltro = (id, membros) => (id === SEM_RESPONSAVEL ? tr('tarefasCampos.grupo.semResponsavel') : membros.find((m) => m.id === id)?.name || '—')

// Colunas da Lista, na ordem padrão (a do ClickUp). O Nome é fixo: sempre a primeira e sempre visível.
export const COLUNAS_LISTA = [
  { k: 'status', label: 'Status' },
  { k: 'tipo', label: 'Tipo de tarefa' },
  { k: 'resp', label: 'Responsável' },
  { k: 'criada', label: 'Data criada' },
  { k: 'venc', label: 'Data de vencimento' },
  { k: 'concluida', label: 'Data de conclusão' },
  { k: 'prio', label: 'Prioridade' },
  { k: 'sprint', label: 'Sprints' },
  { k: 'estim', label: 'Estimativa de tempo' },
  { k: 'cliente', label: 'Cliente' },
]
// Colunas da lista de tarefas do Gantt (o Nome é fixo, como na Lista). Por padrão só Responsável,
// Início e Vencimento aparecem: a lista divide a largura com a linha do tempo.
export const COLUNAS_GANTT = [
  { k: 'status', label: 'Status' },
  { k: 'resp', label: 'Responsável' },
  { k: 'inicio', label: 'Início' },
  { k: 'venc', label: 'Vencimento' },
  { k: 'duracao', label: 'Duração (dias úteis)' },
  { k: 'prio', label: 'Prioridade' },
  { k: 'estim', label: 'Estimativa de tempo' },
  { k: 'tipo', label: 'Tipo de tarefa' },
  { k: 'sprint', label: 'Sprints' },
  { k: 'cliente', label: 'Cliente' },
  { k: 'criada', label: 'Data criada' },
  { k: 'concluida', label: 'Data de conclusão' },
]
export const OCULTAS_GANTT = ['status', 'duracao', 'prio', 'estim', 'tipo', 'sprint', 'cliente', 'criada', 'concluida']

/**
 * { ordem, ocultas } válido, ou null quando igual ao padrão (ordem do catálogo e `ocultasPadrao`).
 * Coluna nova (que a view ainda não conhece) entra no fim, com a visibilidade do padrão.
 */
export function normalizarColunas(c, catalogo = COLUNAS_LISTA, ocultasPadrao = []) {
  const chaves = catalogo.map((x) => x.k)
  if (!c || !Array.isArray(c.ordem)) return null
  const ordem = c.ordem.filter((k, i) => chaves.includes(k) && c.ordem.indexOf(k) === i)
  const novas = chaves.filter((k) => !ordem.includes(k))
  ordem.push(...novas)
  const ocultas = [...(Array.isArray(c.ocultas) ? c.ocultas : []), ...novas.filter((k) => ocultasPadrao.includes(k))]
    .filter((k, i, a) => chaves.includes(k) && a.indexOf(k) === i)
  const mesmasOcultas = ocultas.length === ocultasPadrao.length && ocultas.every((k) => ocultasPadrao.includes(k))
  if (mesmasOcultas && ordem.every((k, i) => k === chaves[i])) return null
  return { ordem, ocultas: ordem.filter((k) => ocultas.includes(k)) }
}
/** Colunas na ordem da view: [{ k, label, oculta }]. */
export function colunasDaView(c, catalogo = COLUNAS_LISTA, ocultasPadrao = []) {
  const n = normalizarColunas(c, catalogo, ocultasPadrao)
  const ordem = n ? n.ordem : catalogo.map((x) => x.k)
  const ocultas = n ? n.ocultas : ocultasPadrao
  return ordem.map((k) => ({ ...catalogo.find((x) => x.k === k), label: rotuloColuna(k, catalogo), oculta: ocultas.includes(k) }))
}
/** Rótulo traduzido de uma coluna do catálogo (o `label` dos catálogos fica em português). */
export function rotuloColuna(k, catalogo = COLUNAS_LISTA) {
  const grupo = catalogo === COLUNAS_GANTT ? 'colunasGantt' : 'colunasLista'
  return catalogo.some((x) => x.k === k) ? tr(`tarefas.${grupo}.${k}`) : k
}
/** Chaves das colunas visíveis, na ordem da view. */
export const colunasVisiveis = (c) => colunasDaView(c).filter((x) => !x.oculta).map((x) => x.k)

// Coluna Nome da Lista: largura arrastada à mão, entre estes limites. É preferência de quem
// usa (localStorage `tarefas.larguraNome`, em AreaTarefas), não da view; null = o que sobrar.
export const LARGURA_NOME = { min: 200, max: 900 }
export const normalizarLarguraNome = (w) => (Number.isFinite(w) ? Math.round(Math.min(LARGURA_NOME.max, Math.max(LARGURA_NOME.min, w))) : null)

/** Patch da config ao mudar as colunas: ocultar a coluna da ordenação também tira a ordenação. */
export function patchColunas(colunas, config) {
  const campo = config.ordenar?.campo
  return campo && campo !== 'nome' && !colunasVisiveis(colunas).includes(campo) ? { colunas, ordenar: null } : { colunas }
}

export const rotuloTipo = (tipo) => (TIPOS_VIEW.some((t) => t.key === tipo) ? tr(`tarefas.views.tipo.${tipo}`) : tipo)

export const SUBTAREFAS = [
  { key: 'recolhidas', label: 'Recolhidas', extra: '(padrão)', desc: 'Sob a tarefa-pai, fechadas. Filtros e agrupamento olham só o pai.' },
  { key: 'expandidas', label: 'Expandidas', desc: 'Sob a tarefa-pai, já abertas. Filtros e agrupamento olham só o pai.' },
  { key: 'separar', label: 'Separar', desc: 'Cada subtarefa vira uma linha própria, filtrada e agrupada pelos campos dela. Use para filtrar subtarefas.' },
]
export const rotuloSubtarefas = (v) => (SUBTAREFAS.some((s) => s.key === v) ? tr(`tarefas.subtarefas.${v}.rotulo`) : v)
/** Descrição traduzida do modo de subtarefas. */
export const descSubtarefas = (v) => (SUBTAREFAS.some((s) => s.key === v) ? tr(`tarefas.subtarefas.${v}.desc`) : '')

const agrupamentoValido = (v, padrao) => (AGRUPAMENTOS.some((a) => a.value === v) ? v : padrao)

export function configPadrao(tipo = 'lista') {
  return { tipo, agrupar: tipo === 'quadro' ? 'status' : 'vencimento', subtarefas: 'recolhidas', responsaveis: [], concluidas: false, filtros: FILTROS_VAZIOS, ordenar: null, calendario: 'mes', colunas: null, colunasGantt: null }
}

/** Config de uma linha do banco (aceita o formato antigo: view/filtroResp/mostrarConcluidas/etiqueta). */
export function normalizarConfig(c = {}, tipoPadrao = 'lista') {
  const tipo = TIPOS_VIEW.some((t) => t.key === (c.tipo || c.view)) ? (c.tipo || c.view) : tipoPadrao
  const base = configPadrao(tipo)
  const resp = Array.isArray(c.responsaveis) ? c.responsaveis : (c.filtroResp && !['todos', 'eu'].includes(c.filtroResp) ? [c.filtroResp] : [])
  let filtros = normalizarFiltros(c.filtros)
  if (!c.filtros && c.etiqueta) filtros = { op: 'e', grupos: [{ id: 'etq', op: 'e', regras: [{ id: 'etq', campo: 'etiquetas', operador: 'qualquer', valor: [c.etiqueta] }] }] }
  return {
    tipo,
    agrupar: agrupamentoValido(c.agrupar, base.agrupar),
    subtarefas: SUBTAREFAS.some((s) => s.key === c.subtarefas) ? c.subtarefas : 'recolhidas',
    responsaveis: resp,
    concluidas: typeof c.concluidas === 'boolean' ? c.concluidas : !!c.mostrarConcluidas,
    filtros,
    calendario: c.calendario === 'semana' ? 'semana' : 'mes',
    colunas: normalizarColunas(c.colunas),
    colunasGantt: normalizarColunas(c.colunasGantt, COLUNAS_GANTT, OCULTAS_GANTT),
    ordenar: c.ordenar?.campo ? { campo: c.ordenar.campo, dir: c.ordenar.dir === -1 ? -1 : 1 } : null,
  }
}

const mesmos = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x))
export const igualConfig = (a, b) => a.tipo === b.tipo && a.agrupar === b.agrupar && a.subtarefas === b.subtarefas
  && mesmos(a.responsaveis, b.responsaveis) && a.concluidas === b.concluidas && JSON.stringify(a.filtros) === JSON.stringify(b.filtros)
  && JSON.stringify(a.ordenar || null) === JSON.stringify(b.ordenar || null) && (a.calendario || 'mes') === (b.calendario || 'mes')
  && JSON.stringify(normalizarColunas(a.colunas)) === JSON.stringify(normalizarColunas(b.colunas))
  && JSON.stringify(normalizarColunas(a.colunasGantt, COLUNAS_GANTT, OCULTAS_GANTT)) === JSON.stringify(normalizarColunas(b.colunasGantt, COLUNAS_GANTT, OCULTAS_GANTT))

/**
 * Onde as views da seleção moram: pasta (também para uma lista dela), "minhas" ou "todas".
 * null = sem views salvas (cycles, lista solta): só as 4 padrão, sem gravar.
 */
export function escopoDaSelecao(sel, listasMap) {
  if (sel.tipo === 'pasta') return { escopo: 'pasta', pastaId: sel.id }
  if (sel.tipo === 'lista') { const p = listasMap.get(sel.id)?.pasta_id; return p ? { escopo: 'pasta', pastaId: p } : null }
  if (sel.tipo === 'minhas' || sel.tipo === 'todas') return { escopo: sel.tipo }
  return null
}
export const chaveEscopo = (e) => (e ? (e.escopo === 'pasta' ? `pasta:${e.pastaId}` : e.escopo) : 'local')
const doEscopo = (row, e) => !!e && row.escopo === e.escopo && (e.escopo !== 'pasta' || row.pasta_id === e.pastaId)

/**
 * Views do escopo prontas para as abas. Cada uma: { chave, nome, rotulo, padrao, row, config, acesso, donoId }.
 * chave = tipo nas padrão (estável, mesmo antes da linha existir) e o id nas salvas.
 * `nome` é o dado (o gravado, ou o nome padrão em português, que é o que se grava); `rotulo` é o
 * que a aba mostra: a padrão sem nome personalizado sai traduzida.
 */
export function viewsDoEscopo(rows, e, userId) {
  const doEsc = (rows || []).filter((r) => doEscopo(r, e))
  const pessoal = padraoPessoal(e)
  const padrao = TIPOS_VIEW.map((t) => {
    const row = doEsc.find((r) => r.padrao_tipo === t.key && (!pessoal || r.dono_id === userId)) || null
    const personalizado = !!row?.nome && row.nome !== t.label
    return { chave: t.key, nome: row?.nome || t.label, rotulo: personalizado ? row.nome : rotuloTipo(t.key), padrao: true, pessoal, row, config: row ? normalizarConfig({ ...row.config, tipo: t.key }, t.key) : configPadrao(t.key), acesso: pessoal ? 'privada' : 'publica', donoId: row?.dono_id || null }
  })
  const salvas = doEsc.filter((r) => !r.padrao_tipo)
    .sort((a, b) => (Number(a.posicao) - Number(b.posicao)) || String(a.created_at).localeCompare(String(b.created_at)))
    .map((row) => ({ chave: row.id, nome: row.nome, rotulo: row.nome, padrao: false, row, config: normalizarConfig(row.config), acesso: row.acesso, donoId: row.dono_id }))
  return { padrao, salvas }
}

/** Em "Minhas tarefas" as padrão são de cada pessoa (privadas, migration 114); nos outros escopos, do time. */
export const padraoPessoal = (e) => e?.escopo === 'minhas'

/** Colunas de tarefas_views para gravar uma view no escopo. */
export const colunasEscopo = (e) => ({ escopo: e.escopo, pasta_id: e.escopo === 'pasta' ? e.pastaId : null })
