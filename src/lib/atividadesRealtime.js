// Regras puras do tempo real do módulo Atividades (sem React nem Supabase, testáveis com Node).
//
// O evento do realtime em `tarefas_itens` traz a linha nova, mas da antiga só o `id` (a tabela
// usa REPLICA IDENTITY DEFAULT). Para saber quem PERDEU uma tarefa, a Capacidade do time guarda
// um índice { tarefa → responsáveis } das tarefas abertas e o compara com cada evento.

const conta = (row) => row.status_tipo !== 'closed' && !row.arquivada

/** Junta as linhas { id, responsaveis } no índice. O que já está lá veio de um evento, mais novo. */
export function completarIndiceCarga(indice, rows) {
  for (const row of rows || []) {
    if (!indice.has(row.id)) indice.set(row.id, row.responsaveis || [])
  }
  return indice
}

/**
 * Atualiza o índice com um evento do realtime e devolve os perfis cuja carga mudou.
 * Tarefa fechada ou arquivada não pesa na carga: só afeta quem a tinha aberta.
 * Linha sem `responsaveis` (o realtime corta campos em payload muito grande) mantém os
 * responsáveis conhecidos; a releitura periódica cobre o caso raro de eles terem mudado.
 * @returns {string[]} ids de perfil
 */
export function perfisAfetadosPeloEvento(indice, { eventType, new: row, old }) {
  if (eventType === 'DELETE') {
    const antes = indice.get(old?.id) || []
    indice.delete(old?.id)
    return [...antes]
  }
  if (!row?.id) return []
  const antes = indice.get(row.id) || []
  const depois = !conta(row) ? [] : (Array.isArray(row.responsaveis) ? row.responsaveis : antes)
  if (conta(row)) indice.set(row.id, depois)
  else indice.delete(row.id)
  return [...new Set([...antes, ...depois])]
}

/**
 * O evento muda o relatório de concluídas carregado? Sim se a tarefa já está nele (reaberta,
 * renomeada, arquivada) ou se está fechada com conclusão dentro do período lido. A remoção só
 * traz o id interno, que o relatório não guarda: conta como mudança (é rara).
 * @param {{desde: string, ate: string, ids: Set<string>}} carregado  ids = id usado no relatório
 */
export function eventoMudaConcluidas(carregado, { eventType, new: row }) {
  if (!carregado) return false
  if (eventType === 'DELETE') return true
  if (!row?.id) return false
  if (carregado.ids.has(row.clickup_task_id || row.id)) return true
  if (row.status_tipo !== 'closed' || !row.data_conclusao) return false
  const quando = new Date(row.data_conclusao).getTime()
  return quando >= new Date(`${carregado.desde}T00:00:00-03:00`).getTime()
    && quando <= new Date(`${carregado.ate}T23:59:59.999-03:00`).getTime()
}

/**
 * Fila de leitura da carga do time. Toda leitura entra aqui, em lotes, uma de cada vez:
 *  - pedido novo nunca cancela o que está em andamento (a leitura de uma pessoa pelo realtime
 *    não pode derrubar a leitura do time inteiro);
 *  - quem mudou durante uma leitura volta para a fila e é lido de novo, então a última mudança
 *    nunca se perde;
 *  - quem já está na fila não é pedido duas vezes (edição em massa vira uma leitura só).
 *
 * @param {object} p
 * @param {number} p.tamanhoLote
 * @param {(chaves: Array) => Promise<any>} p.ler
 * @param {(resposta: any) => void} p.aoLer
 * @param {(erro: Error, chaves: Array, silencioso: boolean) => void} p.aoFalhar
 * @param {(estado: {ocupada: boolean, visivel: boolean, lidas: number, total: number}) => void} [p.aoProgresso]
 * @param {(info: {completa: boolean}) => void} [p.aoTerminar]  fila vazia; completa = leu todos com sucesso
 */
export function criarFilaCarga({ tamanhoLote, ler, aoLer, aoFalhar, aoProgresso = () => {}, aoTerminar = () => {} }) {
  const pendentes = new Set()
  const silenciosas = new Set() // das pendentes, as que ninguém está esperando na tela
  let execucao = null
  let visivel = false
  let lidas = 0
  let total = 0
  let completaPedida = false
  let falhou = false
  let encerrada = false

  const avisar = () => aoProgresso({ ocupada: execucao != null, visivel, lidas: Math.min(lidas, total), total })

  async function drenar() {
    while (pendentes.size > 0 && !encerrada) {
      const lote = [...pendentes].slice(0, tamanhoLote)
      const silencioso = lote.every((c) => silenciosas.has(c))
      for (const c of lote) { pendentes.delete(c); silenciosas.delete(c) }
      try {
        const resposta = await ler(lote)
        if (encerrada) return
        aoLer(resposta)
      } catch (e) {
        if (encerrada) return
        falhou = true
        aoFalhar(e, lote, silencioso)
      }
      lidas += lote.length
      avisar()
    }
  }

  /**
   * @param {Array} chaves
   * @param {object} [op]
   * @param {boolean} [op.silencioso]  sem indicador de "Lendo..." na tela e sem trocar dado bom por erro
   * @param {boolean} [op.completa]    pedido cobre o time inteiro (é o que zera a releitura periódica)
   * @returns {Promise<void>} resolve quando a fila esvaziar
   */
  function pedir(chaves, { silencioso = false, completa = false } = {}) {
    if (encerrada || chaves.length === 0) return execucao || Promise.resolve()
    for (const c of chaves) {
      if (silencioso) { if (!pendentes.has(c)) silenciosas.add(c) } else silenciosas.delete(c)
      pendentes.add(c)
    }
    if (completa) { completaPedida = true; falhou = false }
    if (!silencioso && !visivel) { visivel = true; lidas = 0; total = pendentes.size } else if (visivel) total = Math.max(total, lidas + pendentes.size)
    if (!execucao) {
      execucao = drenar().finally(() => {
        execucao = null
        const completa = completaPedida && !falhou
        completaPedida = false
        falhou = false
        visivel = false
        lidas = 0
        total = 0
        if (encerrada) return
        avisar()
        aoTerminar({ completa })
      })
    }
    avisar()
    return execucao
  }

  return {
    pedir,
    get ocupada() { return execucao != null },
    encerrar() { encerrada = true; pendentes.clear(); silenciosas.clear() },
  }
}
