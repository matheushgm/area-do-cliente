// Núcleo do webhook ClickUp → VertaTask: um evento de tarefa vira a leitura de SÓ
// aquela tarefa (GET /task/{id}) e a gravação no espelho, com as mesmas regras da
// rodada periódica (api/_tarefas_sync_core.js):
//  * pai antes do filho: pai que falta no espelho é buscado e gravado primeiro;
//  * lista/pasta que ainda não existe no espelho é criada (lista nova no ClickUp);
//  * conflito: tarefa editada na Área depois da última sincronização só é
//    sobrescrita se o ClickUp for mais novo;
//  * mesma versão (clickup_updated_at igual) e mesma lista/pai = nada a fazer. É o que
//    evita o eco: o push (api/_tarefas_push_core.js) grava a versão que o ClickUp
//    devolveu, então o webhook da nossa própria edição chega e é ignorado;
//  * taskDeleted (ou 404 na leitura) = arquivada aqui com clickup_removida_at;
//  * eventos de comentário relêem os comentários da tarefa (idempotente pelo id).
// Sem HTTP nem env; `clickup` pode ser injetado (testes).
import { STATUSES_PADRAO, mapStatuses, mapTarefa, mapComentario, mapLista, mapPasta, fazPerfilDe, projetoDaPasta } from './_tarefas_clickup_map.js'
import { fazClickup, SPACES_PADRAO } from './_tarefas_sync_core.js'

const EVENTOS_COMENTARIO = new Set(['taskCommentPosted', 'taskCommentUpdated'])
// Só 404 conta como apagada: 401 também vem de token vencido, e tratar isso como
// remoção arquivaria toda tarefa que recebesse evento. O 401 de space sem acesso
// fica para a reconciliação da rodada periódica.
const naoEncontrada = (e) => e?.status === 404

export async function processarEventoTarefa({ sb, token, evento, taskId, spaces = SPACES_PADRAO, clickup = fazClickup(token), agora = new Date().toISOString() }) {
  if (!taskId) return { acao: 'ignorado', motivo: 'evento sem tarefa' }
  if (evento === 'taskDeleted') return arquivar(sb, taskId, agora)

  let t
  try {
    t = await clickup(`/task/${taskId}?include_markdown_description=true`)
  } catch (e) {
    if (naoEncontrada(e)) return arquivar(sb, taskId, agora)
    throw e
  }
  if (!spaces.map(String).includes(String(t.space?.id))) return { acao: 'ignorado', motivo: `fora dos spaces sincronizados (${t.space?.id})` }

  const { data: perfis } = await sb.from('profiles').select('id, name, clickup_user_id, disabled')
  const ctx = { sb, clickup, agora, perfilDe: fazPerfilDe(perfis || []), spaces }
  const r = await gravarTarefa(t, ctx, 0)
  if (EVENTOS_COMENTARIO.has(evento) && r.id) r.comentarios = await gravarComentarios(t.id, r.id, ctx)
  return r
}

async function arquivar(sb, taskId, agora) {
  const { data, error } = await sb.from('tarefas_itens')
    .update({ arquivada: true, clickup_removida_at: agora, clickup_sync_at: agora, updated_at: agora })
    .eq('clickup_task_id', String(taskId)).select('id')
  if (error) throw new Error(`arquivar ${taskId}: ${error.message}`)
  return { acao: data?.length ? 'removida' : 'ignorado', motivo: data?.length ? undefined : 'tarefa não está no espelho' }
}

/** Grava a tarefa (e, antes, o pai e a lista, se faltarem). Devolve { acao, id }. */
async function gravarTarefa(t, ctx, profundidade) {
  const { sb, clickup, agora, perfilDe } = ctx
  const lista = await garantirLista(t.list?.id, ctx)
  if (!lista) return { acao: 'ignorado', motivo: `lista ${t.list?.id} não encontrada no ClickUp` }

  let parentId = null
  if (t.parent) {
    const { data: pai } = await sb.from('tarefas_itens').select('id').eq('clickup_task_id', String(t.parent)).maybeSingle()
    if (pai) parentId = pai.id
    else if (profundidade < 4) {
      try {
        const tp = await clickup(`/task/${t.parent}?include_markdown_description=true`)
        parentId = (await gravarTarefa(tp, ctx, profundidade + 1)).id || null
      } catch { /* pai inacessível: a tarefa entra sem pai, como na rodada periódica */ }
    }
  }

  const { data: ex } = await sb.from('tarefas_itens')
    .select('id, lista_id, parent_id, updated_at, clickup_sync_at, clickup_updated_at, arquivada, anexos')
    .eq('clickup_task_id', String(t.id)).maybeSingle()
  const row = mapTarefa(t, perfilDe)

  if (ex) {
    const editadaNaArea = ex.clickup_sync_at && new Date(ex.updated_at).getTime() > new Date(ex.clickup_sync_at).getTime() + 1000
    if (editadaNaArea && new Date(row.clickup_updated_at).getTime() <= new Date(ex.updated_at).getTime()) return { acao: 'pulada_conflito', id: ex.id }
    const mesmaVersao = ex.clickup_updated_at && new Date(row.clickup_updated_at).getTime() <= new Date(ex.clickup_updated_at).getTime()
    const mesmaEstrutura = ex.lista_id === lista.id && (ex.parent_id || null) === parentId
    if (mesmaVersao && mesmaEstrutura && !(ex.arquivada && !row.arquivada)) return { acao: 'sem_mudanca', id: ex.id }
  }

  // anexos do ClickUp vêm no GET /task: troca só os de source 'clickup', mantém os locais
  const anexosCu = (t.attachments || []).map((a) => ({
    source: 'clickup', id: String(a.id), name: a.title || a.name || 'arquivo', url: a.url, size: Number(a.size) || null,
    type: a.mimetype || null, thumbnail: a.thumbnail_medium || a.thumbnail_small || null, created_at: a.date ? new Date(Number(a.date)).toISOString() : null,
  }))
  const locais = (ex?.anexos || []).filter((a) => a.source !== 'clickup')
  const linha = {
    ...row, id: ex?.id || globalThis.crypto.randomUUID(), lista_id: lista.id, parent_id: parentId,
    anexos: [...locais, ...anexosCu], clickup_sync_at: agora, updated_at: agora,
  }
  const { error } = await sb.from('tarefas_itens').upsert(linha, { onConflict: 'clickup_task_id' })
  if (error) throw new Error(`gravar ${t.id}: ${error.message}`)
  return { acao: ex ? 'atualizada' : 'criada', id: linha.id }
}

/** Lista do espelho pelo id do ClickUp; se não existe, cria (e a pasta dela). */
async function garantirLista(listaCu, ctx) {
  if (!listaCu) return null
  const { sb, clickup } = ctx
  const { data: ex } = await sb.from('tarefas_listas').select('id').eq('clickup_list_id', String(listaCu)).maybeSingle()
  if (ex) return ex

  let l
  try { l = await clickup(`/list/${listaCu}`) } catch (e) { if (naoEncontrada(e)) return null; throw e }
  const spaceId = String(l.space?.id || '')
  let pastaId = null
  if (l.folder?.id && !l.folder.hidden) {
    const { data: p } = await sb.from('tarefas_pastas').select('id').eq('clickup_folder_id', String(l.folder.id)).maybeSingle()
    if (p) pastaId = p.id
    else {
      const [f, s, { data: projetos }] = await Promise.all([
        clickup(`/folder/${l.folder.id}`),
        clickup(`/space/${spaceId}`).catch(() => null),
        sb.from('projects_v2').select('id, company_name, clickup_folder_id'),
      ])
      const proj = projetoDaPasta(f, projetos || [])
      const { data: nova, error } = await sb.from('tarefas_pastas')
        .upsert({ ...mapPasta(f, { spaceId, espaco: s?.name || null }), project_id: proj?.id || null }, { onConflict: 'clickup_folder_id' }).select('id').single()
      if (error) throw new Error(`pasta ${l.folder.id}: ${error.message}`)
      pastaId = nova.id
    }
  }
  const statuses = mapStatuses(l.statuses)
  const { data: nova, error } = await sb.from('tarefas_listas')
    .upsert({ ...mapLista(l, { pastaId, spaceId }), statuses: statuses.length ? statuses : STATUSES_PADRAO }, { onConflict: 'clickup_list_id' }).select('id').single()
  if (error) throw new Error(`lista ${listaCu}: ${error.message}`)
  return nova
}

async function gravarComentarios(taskCu, tarefaId, { sb, clickup, perfilDe }) {
  const r = await clickup(`/task/${taskCu}/comment`)
  const cs = (r?.comments || []).map((c) => mapComentario(c, tarefaId, perfilDe)).filter(Boolean)
  if (!cs.length) return 0
  const { data: jaTem } = await sb.from('tarefas_comentarios').select('clickup_comment_id').in('clickup_comment_id', cs.map((c) => c.clickup_comment_id))
  const novos = cs.filter((c) => !(jaTem || []).some((j) => j.clickup_comment_id === c.clickup_comment_id))
  if (!novos.length) return 0
  const { error } = await sb.from('tarefas_comentarios').upsert(novos, { onConflict: 'clickup_comment_id' })
  if (error) throw new Error(`comentários ${taskCu}: ${error.message}`)
  return novos.length
}
