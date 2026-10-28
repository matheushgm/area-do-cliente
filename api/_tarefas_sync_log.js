// Rastro da volta ClickUp → VertaTask (tabela tarefas_sync_log, migration 120), lido pelo
// painel Sincronização do VertaTask. O que virou escrita na tarefa o trigger da própria
// tabela registra (origem 'clickup', com o antes e o depois); aqui entram o que NÃO virou
// escrita (evento do webhook ignorado, eco, conflito, erro) e o resumo de cada rodada.
// Nunca derruba quem chama: sem a tabela (migration não aplicada) só devolve o erro.

// webhook: estes resultados já aparecem pelo trigger (a tarefa foi gravada)
const GRAVADAS = new Set(['criada', 'atualizada', 'removida'])

export async function registrarSyncLog(sb, linhas) {
  const ls = (linhas || []).filter(Boolean)
  for (let i = 0; i < ls.length; i += 200) {
    try {
      const { error } = await sb.from('tarefas_sync_log').insert(ls.slice(i, i + 200))
      if (error) return error.message
    } catch (e) { return e.message }
  }
  return null
}

/** Linha do log para o resultado de um evento do webhook (null = o trigger já registrou). */
export function linhaWebhook(evento, taskId, r) {
  if (GRAVADAS.has(r?.acao)) return null
  return {
    origem: 'webhook', evento: evento || null, acao: r?.acao || 'erro', tarefa_id: r?.id || null,
    clickup_task_id: taskId ? String(taskId) : null, motivo: r?.motivo || r?.erro || null,
  }
}

/** Linha do log com o resumo de uma rodada (sem os avisos longos, que ficam no detalhe). */
export function linhaRodada(resumo, { ok = true, inicio, fim } = {}) {
  const { eventos: _e, ...det } = resumo || {}
  return {
    origem: 'rodada', evento: 'rodada', acao: ok ? 'resumo' : 'erro', motivo: ok ? null : (resumo?.erro || null),
    detalhe: { ...det, inicio: inicio || null, fim: fim || null },
  }
}
