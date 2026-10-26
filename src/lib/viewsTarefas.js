// Visualizações (views) do VertaTask: abas dentro da pasta do cliente (ou de "Minhas" /
// "Todas"), ao lado das 4 padrão. Regras puras; os dados vêm de tarefas_views (migration 110).
//
// config de uma view = { tipo, agrupar, subtarefas, responsaveis[], concluidas, filtros, ordenar }
//   tipo        lista | quadro | calendario | gantt (a Planilha saiu: era a Lista de novo)
//   subtarefas  recolhidas (padrão) | expandidas | separar
//   responsaveis [] = todos; com gente, tarefa de qualquer um deles; SEM_RESPONSAVEL = tarefa sem ninguém
//   filtros     filtros avançados (src/lib/filtrosTarefas.js)
//   ordenar     { campo, dir } da Lista (cabeçalho clicável) ou null = ordem manual
//   calendario  mes (padrão) | semana: escala do Calendário
// A tela trabalha sobre um rascunho da config; "Salvar visualização" grava.
import { AGRUPAMENTOS } from './tarefas'
import { FILTROS_VAZIOS, normalizarFiltros } from './filtrosTarefas'

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
export const nomeResponsavelFiltro = (id, membros) => (id === SEM_RESPONSAVEL ? 'Sem responsável' : membros.find((m) => m.id === id)?.name || '—')

export const rotuloTipo = (tipo) => TIPOS_VIEW.find((t) => t.key === tipo)?.label || tipo

export const SUBTAREFAS = [
  { key: 'recolhidas', label: 'Recolhidas', extra: '(padrão)', desc: 'Sob a tarefa-pai, fechadas. Filtros e agrupamento olham só o pai.' },
  { key: 'expandidas', label: 'Expandidas', desc: 'Sob a tarefa-pai, já abertas. Filtros e agrupamento olham só o pai.' },
  { key: 'separar', label: 'Separar', desc: 'Cada subtarefa vira uma linha própria, filtrada e agrupada pelos campos dela. Use para filtrar subtarefas.' },
]
export const rotuloSubtarefas = (v) => SUBTAREFAS.find((s) => s.key === v)?.label || v

const agrupamentoValido = (v, padrao) => (AGRUPAMENTOS.some((a) => a.value === v) ? v : padrao)

export function configPadrao(tipo = 'lista') {
  return { tipo, agrupar: tipo === 'quadro' ? 'status' : 'vencimento', subtarefas: 'recolhidas', responsaveis: [], concluidas: false, filtros: FILTROS_VAZIOS, ordenar: null, calendario: 'mes' }
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
    ordenar: c.ordenar?.campo ? { campo: c.ordenar.campo, dir: c.ordenar.dir === -1 ? -1 : 1 } : null,
  }
}

const mesmos = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x))
export const igualConfig = (a, b) => a.tipo === b.tipo && a.agrupar === b.agrupar && a.subtarefas === b.subtarefas
  && mesmos(a.responsaveis, b.responsaveis) && a.concluidas === b.concluidas && JSON.stringify(a.filtros) === JSON.stringify(b.filtros)
  && JSON.stringify(a.ordenar || null) === JSON.stringify(b.ordenar || null) && (a.calendario || 'mes') === (b.calendario || 'mes')

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
 * Views do escopo prontas para as abas. Cada uma: { chave, nome, padrao, row, config, acesso, donoId }.
 * chave = tipo nas padrão (estável, mesmo antes da linha existir) e o id nas salvas.
 */
export function viewsDoEscopo(rows, e) {
  const doEsc = (rows || []).filter((r) => doEscopo(r, e))
  const padrao = TIPOS_VIEW.map((t) => {
    const row = doEsc.find((r) => r.padrao_tipo === t.key) || null
    return { chave: t.key, nome: row?.nome || t.label, padrao: true, row, config: row ? normalizarConfig({ ...row.config, tipo: t.key }, t.key) : configPadrao(t.key), acesso: 'publica', donoId: row?.dono_id || null }
  })
  const salvas = doEsc.filter((r) => !r.padrao_tipo)
    .sort((a, b) => (Number(a.posicao) - Number(b.posicao)) || String(a.created_at).localeCompare(String(b.created_at)))
    .map((row) => ({ chave: row.id, nome: row.nome, padrao: false, row, config: normalizarConfig(row.config), acesso: row.acesso, donoId: row.dono_id }))
  return { padrao, salvas }
}

/** Colunas de tarefas_views para gravar uma view no escopo. */
export const colunasEscopo = (e) => ({ escopo: e.escopo, pasta_id: e.escopo === 'pasta' ? e.pastaId : null })
