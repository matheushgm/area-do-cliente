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
//  * tarefa com item da outbox pendente/em processamento (push em andamento, inclusive a
//    criação): evento ignorado, conferido ANTES de ler a tarefa no ClickUp (o eco do push não
//    gasta chamada). O push grava o vínculo e a versão final; sem isso o
//    taskCreated inseria uma CÓPIA da tarefa antes de a original receber o clickup_task_id
//    (bug de 23/10/2026) e estados intermediários do ClickUp sobrescreviam a edição;
//  * linha que já existe mantém created_at/criado_por (pode ter nascido na Área);
//  * taskDeleted (ou 404 na leitura) = arquivada aqui com clickup_removida_at;
//  * eventos de comentário relêem os comentários da tarefa (idempotente pelo id);
//  * relações: dependência ou link criado/apagado no ClickUp chega como taskUpdated nas duas
//    tarefas, sem mudar o date_updated delas; toda tarefa lida tem as relações reconciliadas
//    (api/_tarefas_relacoes.js), mesmo quando a tarefa em si não mudou.
// Sem HTTP nem env; `clickup` pode ser injetado (testes).
import { STATUSES_PADRAO, mapStatuses, mapTarefa, mapComentario, mapLista, mapPasta, fazPerfilDe, projetoDaPasta } from './_tarefas_clickup_map.js'
import { fazClickup, SPACES_PADRAO } from './_tarefas_sync_core.js'
import { reconciliarRelacoes } from './_tarefas_relacoes.js'

const EVENTOS_COMENTARIO = new Set(['taskCommentPosted', 'taskCommentUpdated'])
// Só 404 conta como apagada: 401 também vem de token vencido, e tratar isso como
// remoção arquivaria toda tarefa que recebesse evento. O 401 de space sem acesso
// fica para a reconciliação da rodada periódica.
const naoEncontrada = (e) => e?.status === 404
const PENDENTE_RECENTE_MS = 2 * 60_000

// Push em andamento para esta tarefa (item 'processando', ou 'pendente' recente: o front dispara o
// push 1,5 s depois da escrita; um pendente antigo é de uma aba fechada antes do push, e aí o
// evento segue pelas regras normais de conflito). Quem grava a versão final é o push.
async function pushEmCurso(sb, cuId, agora) {
  const { data: fila } = await sb.from('tarefas_outbox').select('tarefa_id, status, created_at')
    .eq('clickup_task_id', String(cuId)).in('status', ['pendente', 'processando']).order('id', { ascending: false }).limit(5)
  const limiar = new Date(agora).getTime() - PENDENTE_RECENTE_MS
  return (fila || []).find((o) => o.status === 'processando' || new Date(o.created_at).getTime() > limiar) || null
}

// Campo do histórico que fala de dependência/link: a data dele não se compara com o date_updated
// (que essas mudanças não alteram), então o evento é sempre lido. Os nomes não são documentados
// pelo ClickUp; sem esse campo, a data do evento já é mais nova que o date_updated e cai na leitura.
const RELACAO_NO_HISTORICO = /depend|link/i
export const historicoDeRelacao = (historico) => (historico || []).some((h) => RELACAO_NO_HISTORICO.test(String(h?.field || '')))

/** Data (ms) da mudança mais nova que o evento descreve (history_items[].date), ou null. */
export function dataDoEvento(historico) {
  const ds = (historico || []).map((h) => Number(h?.date)).filter((n) => n > 0)
  return ds.length ? Math.max(...ds) : null
}

export async function processarEventoTarefa({ sb, token, evento, taskId, historico = null, spaces = SPACES_PADRAO, clickup = fazClickup(token), agora = new Date().toISOString() }) {
  if (!taskId) return { acao: 'ignorado', motivo: 'evento sem tarefa' }
  if (evento === 'taskDeleted') return arquivar(sb, taskId, agora)
  // Eco da nossa própria escrita: olha a fila ANTES de ler a tarefa no ClickUp. Sem isso cada
  // envio do push custava mais uma leitura (às vezes três, um evento por campo) só para
  // descobrir que era para ignorar. Evento de comentário segue: comentário feito lá no meio de
  // um envio daqui ainda precisa ser lido.
  if (!EVENTOS_COMENTARIO.has(evento)) {
    const emCurso = await pushEmCurso(sb, taskId, agora)
    if (emCurso) return { acao: 'ignorado', motivo: 'push em andamento para esta tarefa', id: emCurso.tarefa_id || undefined, semLeitura: true }
    // O push grava na linha o date_updated que o ClickUp devolveu; se a mudança do evento não é
    // mais nova que isso, o espelho já tem essa versão (é o eco, que chegou depois de o push
    // terminar). Sem data no evento, ou com data mais nova, lê a tarefa como sempre.
    const quando = historicoDeRelacao(historico) ? null : dataDoEvento(historico)
    if (quando) {
      const { data: ex } = await sb.from('tarefas_itens').select('id, clickup_updated_at').eq('clickup_task_id', String(taskId)).maybeSingle()
      if (ex?.clickup_updated_at && quando <= new Date(ex.clickup_updated_at).getTime()) return { acao: 'sem_mudanca', id: ex.id, semLeitura: true }
    }
  }

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
  try {
    const rel = await reconciliarRelacoes(sb, [t])
    if (rel.criadas || rel.removidas) r.relacoes = { criadas: rel.criadas, removidas: rel.removidas }
  } catch (e) { r.erro_relacoes = e.message }
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

  const COLS = 'id, lista_id, parent_id, updated_at, clickup_sync_at, clickup_updated_at, arquivada, anexos'
  let { data: ex } = await sb.from('tarefas_itens').select(COLS).eq('clickup_task_id', String(t.id)).maybeSingle()
  // Push em andamento para esta tarefa (vale também para o pai buscado aqui): quem grava é ele.
  const emCurso = await pushEmCurso(sb, t.id, agora)
  if (emCurso) return { acao: 'ignorado', motivo: 'push em andamento para esta tarefa', id: emCurso.tarefa_id || ex?.id }
  if (!ex) {
    // criada pelo push, mas a linha ficou sem o vínculo: liga à original em vez de inserir cópia
    const { data: criada } = await sb.from('tarefas_outbox').select('tarefa_id')
      .eq('clickup_task_id', String(t.id)).eq('operacao', 'criar').not('tarefa_id', 'is', null).order('id', { ascending: false }).limit(1)
    if (criada?.[0]?.tarefa_id) ex = (await sb.from('tarefas_itens').select(COLS).eq('id', criada[0].tarefa_id).is('clickup_task_id', null).maybeSingle()).data || null
  }
  const row = mapTarefa(t, perfilDe)

  if (ex) {
    // Mesma versão antes do conflito: a versão que já está aqui não é mudança do ClickUp (ver a rodada).
    const mesmaVersao = ex.clickup_updated_at && new Date(row.clickup_updated_at).getTime() <= new Date(ex.clickup_updated_at).getTime()
    const mesmaEstrutura = ex.lista_id === lista.id && (ex.parent_id || null) === parentId
    if (mesmaVersao && mesmaEstrutura && !(ex.arquivada && !row.arquivada)) return { acao: 'sem_mudanca', id: ex.id }
    const editadaNaArea = ex.clickup_sync_at && new Date(ex.updated_at).getTime() > new Date(ex.clickup_sync_at).getTime() + 1000
    if (editadaNaArea && new Date(row.clickup_updated_at).getTime() <= new Date(ex.updated_at).getTime()) return { acao: 'pulada_conflito', id: ex.id }
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
  // quem criou a linha continua sendo o autor (o upsert antigo trocava pelo dono do token)
  if (ex) { delete linha.created_at; delete linha.criado_por; delete linha.criador_nome }
  const { error } = ex
    ? await sb.from('tarefas_itens').update(linha).eq('id', ex.id)
    : await sb.from('tarefas_itens').upsert(linha, { onConflict: 'clickup_task_id' })
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
