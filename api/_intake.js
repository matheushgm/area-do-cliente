// Entrada na fila de Intake do VertaTask (tabela tarefas_intake) a partir de funções
// do servidor. Nunca derruba quem chama: se falhar, só registra no log.
// `origem_ref` é único: o mesmo evento não entra duas vezes.
import { sb } from './_http.js'

export async function registrarIntake({ project_id, titulo, descricao, origem, origem_ref, prioridade, contato, payload }) {
  try {
    const row = {
      titulo: String(titulo || '').trim().slice(0, 300),
      descricao: descricao ? String(descricao).trim().slice(0, 12000) : null,
      origem: String(origem || 'Manual').slice(0, 80),
      origem_ref: origem_ref ? String(origem_ref).slice(0, 200) : null,
      project_id: project_id || null,
      prioridade: ['urgent', 'high', 'normal', 'low'].includes(prioridade) ? prioridade : null,
      contato: contato ? String(contato).trim().slice(0, 200) : null,
      ...(payload && typeof payload === 'object' ? { payload } : {}),
    }
    if (!row.titulo) return false
    const { status } = await sb('/tarefas_intake?on_conflict=origem_ref', {
      method: 'POST',
      body: JSON.stringify(row),
      prefer: 'resolution=ignore-duplicates,return=minimal',
    })
    if (status >= 400) console.warn('[intake] não registrou:', status)
    return status < 400
  } catch (e) {
    console.warn('[intake] falha:', e?.message)
    return false
  }
}
