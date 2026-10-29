// Mão de volta VertaTask → ClickUp. Esvazia a fila tarefas_outbox (preenchida
// por trigger a cada escrita de pessoa logada em tarefas_itens/comentarios)
// escrevendo no ClickUp: cria a tarefa (e, se preciso, a pasta e a lista),
// atualiza só os campos que mudaram, exclui, comenta. Depois grava de volta
// na linha clickup_task_id/url/clickup_updated_at com clickup_sync_at =
// updated_at = agora (chave de serviço: não re-enfileira e a sincronização
// diária não acha que foi editada na Área).
//
// Usado por api/tarefas-push.js (chamado pelo front logo após cada escrita,
// com debounce) e no começo de api/tarefas-sync.js (empurra antes de puxar).
//
// Duas proteções contra duplicar tarefa no ClickUp (bug de 23/10/2026):
//  * os itens são REIVINDICADOS (status 'processando', RPC da migration 110) antes de
//    processar: pushes em paralelo nunca pegam o mesmo item;
//  * logo após o POST o id do ClickUp vai para o item da fila e para a linha; se o
//    webhook taskCreated já tiver inserido uma cópia, ela é absorvida pela original.
// A criação manda os campos personalizados no próprio POST (1 chamada por tarefa) e
// `resumo.restantes` diz quanto ficou na fila, para o chamador continuar.
import { mapStatuses, mapChecklists } from './_tarefas_clickup_map.js'

const CLICKUP_BASE = 'https://api.clickup.com/api/v2'
const SPACE_CLIENTES = '90090377342'
// Campos personalizados do space Clientes (mesmos ids de api/atividades.js)
const CF = {
  cliente:      '3ea9499a-17e0-4c72-b6fc-894b5c1517a1',
  tipoTarefa:   'f5414822-7ed6-48fc-98a2-8389a7828fdf',
  dificuldade:  'b800f04f-2787-4ac8-a5c1-bb8549db8b78',
  departamento: 'e60bebff-b035-49c2-879b-972777ed041e',
}
const PRIORIDADE = { urgent: 1, high: 2, normal: 3, low: 4 }
const MAX_TENTATIVAS = 5
const TTL_PROCESSANDO_S = 300 // item 'processando' há mais que isso = rodada morreu; volta à fila

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const ms = (iso) => (iso ? new Date(iso).getTime() : null)
const isoDe = (v) => (v ? new Date(Number(v)).toISOString() : null)

// Sem tempo na invocação (a função tem 60 s na Vercel): a chamada não começa, ou a espera
// do 429 passaria do prazo. O item volta à fila sem contar tentativa. Antes as esperas do
// 429 (até 84 s numa chamada) estouravam os 60 s, a Vercel matava a função, os itens
// ficavam 'processando' até o ttl e o front parava de chamar (28/10/2026).
function semTempo(msg) { const e = new Error(msg); e.semTempo = true; return e }
// .catch que engole erro do ClickUp mas deixa passar o "sem tempo"
const ignora = (fallback) => (e) => { if (e?.semTempo) throw e; return typeof fallback === 'function' ? fallback(e) : fallback }

function fazClickup(token, prazo = Infinity) {
  return async function cu(method, path, body) {
    for (let tent = 0; tent < 6; tent++) {
      if (Date.now() > prazo) throw semTempo(`ClickUp ${method} ${path}: sem tempo nesta invocação`)
      const res = await fetch(`${CLICKUP_BASE}${path}`, {
        method, headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      if (res.status === 429) {
        const espera = Math.max((Number(res.headers.get('retry-after')) || 0) * 1000, 4000 * (tent + 1))
        if (Date.now() + espera > prazo) throw semTempo(`ClickUp ${method} ${path}: limite de requisições e sem tempo para esperar`)
        await sleep(espera); continue
      }
      const txt = await res.text()
      let json = null; try { json = JSON.parse(txt) } catch { json = null }
      if (!res.ok) { const e = new Error(json?.err || `ClickUp ${method} ${path}: ${res.status}`); e.status = res.status; e.ecode = json?.ECODE; throw e }
      return json
    }
    throw new Error(`ClickUp ${method} ${path}: limite de requisições`)
  }
}

function optionId(fields, fieldId, name) {
  const f = (fields || []).find((x) => x.id === fieldId)
  if (!f || !name) return null
  const opts = f?.type_config?.options || []
  const alvo = norm(name)
  const exato = opts.find((o) => norm(o.name || o.label) === alvo)
  if (exato) return exato.id
  const parcial = opts.find((o) => { const n = norm(o.name || o.label); return n && (alvo.includes(n) || n.includes(alvo)) })
  return parcial ? parcial.id : null
}

// Data sem hora no ClickUp = 04:00 de São Paulo. Quem edita no VertaTask usa
// <input type="date"> (meia-noite local), então mandamos a data do dia às 04:00
// no fuso de São Paulo e due_date_time=false, igual ao que o ClickUp faz.
function dataClickUp(iso, comHora) {
  if (!iso) return null
  if (comHora) return ms(iso)
  const d = new Date(iso)
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return new Date(`${dia}T04:00:00-03:00`).getTime()
}

// Junta a fila reivindicada por tarefa (docs/plano-sincronizacao-clickup.md, item 1): numa edição
// em massa cada campo mexido vira um item, e em 28/10/2026 foram 427 itens para 99 tarefas (~900
// chamadas, 69 min para esvaziar). Os 'atualizar' da mesma tarefa viram UMA unidade com a união
// dos campos (um PUT, uma leitura de responsáveis), na posição do último deles; 'criar', 'excluir'
// e 'comentar' seguem um por unidade. 'atualizar' de tarefa que tem 'excluir' na mesma rodada é
// cancelado (a tarefa vai sumir do ClickUp). O push lê o estado ATUAL da linha, então a união dos
// campos manda o valor final de cada um. Pura, para testar com Node.
export function agruparFila(fila) {
  const ordem = [...(fila || [])].sort((a, b) => a.id - b.id)
  const excluidas = new Set(ordem.filter((i) => i.operacao === 'excluir' && i.tarefa_id).map((i) => i.tarefa_id))
  const canceladas = []
  const grupos = new Map() // tarefa_id → itens 'atualizar'
  const soltas = []
  for (const it of ordem) {
    if (it.operacao === 'atualizar' && it.tarefa_id) {
      if (excluidas.has(it.tarefa_id)) { canceladas.push(it); continue }
      if (!grupos.has(it.tarefa_id)) grupos.set(it.tarefa_id, [])
      grupos.get(it.tarefa_id).push(it)
    } else soltas.push({ item: it, ids: [it.id], _pos: it.id })
  }
  const unidades = [...soltas]
  for (const itens of grupos.values()) {
    const ultimo = itens[itens.length - 1]
    const campos = [...new Set(itens.flatMap((i) => i.campos || []))]
    const tentativas = Math.max(...itens.map((i) => i.tentativas || 0))
    unidades.push({ item: { ...ultimo, campos, tentativas }, ids: itens.map((i) => i.id), _pos: ultimo.id })
  }
  unidades.sort((a, b) => a._pos - b._pos)
  return { unidades: unidades.map(({ _pos, ...u }) => u), canceladas }
}

export async function empurrar({ sb, token, limite = 120, orcamentoMs = 45_000, log = () => {} }) {
  const inicio = Date.now()
  const cu = fazClickup(token, inicio + orcamentoMs)
  const estourou = () => Date.now() - inicio > orcamentoMs
  const resumo = { processadas: 0, criadas: 0, atualizadas: 0, excluidas: 0, comentadas: 0, erros: 0, devolvidas: 0, agrupadas: 0, canceladas: 0, copias_absorvidas: 0, pastas_criadas: 0, listas_criadas: 0, avisos: [] }
  // avisos do item em processamento vão também para tarefas_outbox.avisos (painel Sincronização)
  let avisosItem = null
  const aviso = (m) => { if (resumo.avisos.length < 50) resumo.avisos.push(m); if (avisosItem && avisosItem.length < 10) avisosItem.push(m); log('aviso: ' + m) }

  // Reivindica os itens (status 'processando'): cada item é de uma rodada só. Sem a RPC
  // (migration 110 ainda não aplicada) cai na leitura antiga, sem proteção, e avisa.
  let fila, reivindicada = true
  const reiv = await sb.rpc('tarefas_outbox_reivindicar', { p_limite: limite, p_ttl_s: TTL_PROCESSANDO_S })
  if (reiv.error) {
    reivindicada = false
    aviso(`outbox sem reivindicação (${reiv.error.message}); aplique a migration 110`)
    const { data, error } = await sb.from('tarefas_outbox').select('*').eq('status', 'pendente').order('id').limit(limite)
    if (error) throw new Error(`outbox: ${error.message}`)
    fila = data || []
  } else fila = (reiv.data || []).sort((a, b) => a.id - b.id)
  resumo.restantes = 0
  if (!fila.length) return resumo

  const [{ data: perfis }, { data: listas }, { data: pastas }, { data: projetos }] = await Promise.all([
    sb.from('profiles').select('id, name, clickup_user_id'),
    sb.from('tarefas_listas').select('id, nome, pasta_id, clickup_list_id, clickup_space_id, statuses'),
    sb.from('tarefas_pastas').select('id, nome, project_id, clickup_folder_id, clickup_space_id, espaco'),
    sb.from('projects_v2').select('id, company_name'),
  ])
  const perfil = new Map((perfis || []).map((p) => [p.id, p]))
  const lista = new Map((listas || []).map((l) => [l.id, l]))
  const pasta = new Map((pastas || []).map((p) => [p.id, p]))
  const projeto = new Map((projetos || []).map((p) => [p.id, p]))
  const camposPorLista = new Map()
  const camposDa = async (listId) => {
    if (!camposPorLista.has(listId)) camposPorLista.set(listId, (await cu('GET', `/list/${listId}/field`).catch(ignora(null)))?.fields || [])
    return camposPorLista.get(listId)
  }
  const agora = () => new Date().toISOString()
  // Sem a coluna avisos (migration 121 ainda não aplicada) grava sem eles: o item nunca
  // pode ficar 'processando' por causa do rastro.
  // marca a unidade inteira (os itens juntados da mesma tarefa recebem o mesmo resultado)
  const marcar = async (ids, patch) => {
    const p = { ...patch, processed_at: agora() }
    if (avisosItem?.length) p.avisos = [...avisosItem]
    const r = await sb.from('tarefas_outbox').update(p).in('id', ids)
    if (r.error && p.avisos) { delete p.avisos; return sb.from('tarefas_outbox').update(p).in('id', ids) }
    return r
  }
  // devolve o item à fila sem contar tentativa (outra rodada está criando a mesma tarefa)
  const devolver = (ids) => sb.from('tarefas_outbox').update({ status: 'pendente', reivindicado_em: null }).in('id', [].concat(ids))
  // O webhook taskCreated pode chegar antes de o vínculo ser gravado na linha original e
  // inserir uma cópia com o mesmo clickup_task_id; a gravação então bate na unique. A cópia
  // é absorvida (filhos e comentários passam para a original) e apagada, e a gravação é
  // refeita. Apagar com a chave de serviço não enfileira 'excluir': a tarefa do ClickUp
  // continua, agora ligada à original.
  async function absorverCopia(tarefaId, cuId) {
    const { data: copia } = await sb.from('tarefas_itens').select('id').eq('clickup_task_id', cuId).neq('id', tarefaId).maybeSingle()
    if (!copia) return false
    await sb.from('tarefas_itens').update({ parent_id: tarefaId }).eq('parent_id', copia.id)
    await sb.from('tarefas_comentarios').update({ tarefa_id: tarefaId }).eq('tarefa_id', copia.id)
    const { error } = await sb.from('tarefas_itens').delete().eq('id', copia.id)
    if (error) throw new Error(`cópia ${copia.id} da tarefa ${cuId}: ${error.message}`)
    resumo.copias_absorvidas++
    aviso(`tarefa ${cuId}: o webhook criou uma cópia antes do vínculo; cópia absorvida pela original`)
    return true
  }
  const ehUnique = (e) => !!e && (e.code === '23505' || /duplicate key|unique/i.test(e.message || ''))
  async function gravarEspelho(tarefaId, task, extra = {}) {
    const patch = {
      clickup_task_id: String(task.id), clickup_url: task.url || `https://app.clickup.com/t/${task.id}`,
      clickup_updated_at: isoDe(task.date_updated) || agora(), clickup_sync_at: agora(), updated_at: agora(), ...extra,
    }
    let { error } = await sb.from('tarefas_itens').update(patch).eq('id', tarefaId)
    if (ehUnique(error) && await absorverCopia(tarefaId, String(task.id))) ({ error } = await sb.from('tarefas_itens').update(patch).eq('id', tarefaId))
    if (error) throw new Error(`gravar vínculo ${task.id} na tarefa ${tarefaId}: ${error.message}`)
  }

  // Pasta/lista criadas no VertaTask ainda não existem no ClickUp: cria lá.
  async function garantirPasta(p) {
    if (p.clickup_folder_id) return p.clickup_folder_id
    const f = await cu('POST', `/space/${p.clickup_space_id || SPACE_CLIENTES}/folder`, { name: p.nome })
    await sb.from('tarefas_pastas').update({ clickup_folder_id: String(f.id), clickup_space_id: String(p.clickup_space_id || SPACE_CLIENTES), espaco: p.espaco || 'Clientes' }).eq('id', p.id)
    p.clickup_folder_id = String(f.id); resumo.pastas_criadas++
    return p.clickup_folder_id
  }
  async function garantirLista(l) {
    if (l.clickup_list_id) return l.clickup_list_id
    let nova
    if (l.pasta_id && pasta.get(l.pasta_id)) nova = await cu('POST', `/folder/${await garantirPasta(pasta.get(l.pasta_id))}/list`, { name: l.nome })
    else nova = await cu('POST', `/space/${l.clickup_space_id || SPACE_CLIENTES}/list`, { name: l.nome })
    const statuses = mapStatuses(nova.statuses)
    await sb.from('tarefas_listas').update({ clickup_list_id: String(nova.id), clickup_space_id: String(l.clickup_space_id || SPACE_CLIENTES), ...(statuses.length ? { statuses } : {}) }).eq('id', l.id)
    l.clickup_list_id = String(nova.id); if (statuses.length) l.statuses = statuses; resumo.listas_criadas++
    return l.clickup_list_id
  }
  const statusValido = (l, status) => (l?.statuses || []).some((s) => norm(s.key) === norm(status)) ? (l.statuses.find((s) => norm(s.key) === norm(status)).key) : null
  const assigneesDe = (row) => (row.responsaveis || []).map((id) => Number(perfil.get(id)?.clickup_user_id)).filter((n) => n > 0)
  const paiCu = async (row) => {
    if (!row.parent_id) return null
    const { data } = await sb.from('tarefas_itens').select('clickup_task_id').eq('id', row.parent_id).maybeSingle()
    return data?.clickup_task_id || null
  }
  const TODOS_OS_CAMPOS = new Set(['tipo_tarefa', 'dificuldade', 'departamento', 'cliente'])
  // Resolve os campos personalizados do space para o formato da API ({ id, value }).
  // value null = campo vazio: no update vira DELETE, na criação é só omitido.
  async function valoresCampos(row, l, quais) {
    const fields = await camposDa(l.clickup_list_id)
    const out = []
    const resolve = (fid, nome, valor, lista = false) => {
      if (valor == null || valor === '' || (Array.isArray(valor) && !valor.length)) { out.push({ id: fid, value: null }); return }
      const vals = (Array.isArray(valor) ? valor : [valor]).map((v) => optionId(fields, fid, v)).filter(Boolean)
      if (!vals.length) { aviso(`tarefa ${row.clickup_task_id || row.titulo}: opção "${valor}" não existe no campo ${nome} desta lista`); return }
      out.push({ id: fid, value: lista ? vals : vals[0] })
    }
    if (quais.has('tipo_tarefa')) resolve(CF.tipoTarefa, 'Tipo de tarefa', row.tipo_tarefa)
    if (quais.has('dificuldade')) resolve(CF.dificuldade, 'Dificuldade', row.dificuldade)
    if (quais.has('departamento')) resolve(CF.departamento, 'Departamento', row.departamento, true)
    if (quais.has('cliente')) { const p = pasta.get(l.pasta_id); const nome = p?.project_id ? projeto.get(p.project_id)?.company_name : null; if (nome) resolve(CF.cliente, 'Cliente', nome) }
    return out
  }
  async function camposPersonalizados(row, l, taskId, quais) {
    for (const c of await valoresCampos(row, l, quais)) {
      if (c.value == null) await cu('DELETE', `/task/${taskId}/field/${c.id}`).catch(ignora())
      else await cu('POST', `/task/${taskId}/field/${c.id}`, { value: c.value })
    }
  }

  // Checklists: compara o da linha com o do ClickUp e aplica a diferença. Os ids do ClickUp
  // são os que a linha guarda (vêm da sincronização); checklist ou item com id que o ClickUp
  // não conhece nasceu aqui e é criado lá. O que só existe no ClickUp é apagado, MAS só se já
  // existia na última sincronização (`desde`): o que foi criado lá depois ainda não chegou à
  // linha e não foi removido por ninguém, então fica. A ordem dos itens não é replicada.
  // Depois a linha recebe a versão do ClickUp (ids novos incluídos).
  async function sincronizarChecklists(taskId, locais, remotos, desde) {
    const limite = ms(desde) ?? 0
    const conhecido = (x) => Number(x?.date_created) > 0 && Number(x.date_created) <= limite
    const checarTempo = () => { if (estourou()) throw new Error('tempo esgotado no checklist; tento de novo na próxima rodada') }
    const remPorId = new Map((remotos || []).map((c) => [String(c.id), c]))
    const vistos = new Set()
    for (const c of locais || []) {
      const nome = String(c.nome || '').trim() || 'Checklist'
      let rc = remPorId.get(String(c.id))
      if (rc) {
        vistos.add(String(rc.id))
        if (rc.name !== nome) await cu('PUT', `/checklist/${rc.id}`, { name: nome })
      } else {
        rc = (await cu('POST', `/task/${taskId}/checklist`, { name: nome })).checklist
      }
      const itensRem = new Map((rc.items || []).map((i) => [String(i.id), i]))
      const itensVistos = new Set()
      for (const it of c.itens || []) {
        checarTempo()
        const nomeItem = String(it.nome || '').trim()
        if (!nomeItem) continue
        const ri = itensRem.get(String(it.id))
        if (ri) {
          itensVistos.add(String(ri.id))
          if (ri.name !== nomeItem || !!ri.resolved !== !!it.feito) await cu('PUT', `/checklist/${rc.id}/checklist_item/${ri.id}`, { name: nomeItem, resolved: !!it.feito })
        } else {
          const antes = new Set([...itensRem.keys(), ...itensVistos])
          const r = await cu('POST', `/checklist/${rc.id}/checklist_item`, { name: nomeItem })
          const novo = (r?.checklist?.items || []).find((x) => !antes.has(String(x.id)))
          if (novo) { itensVistos.add(String(novo.id)); itensRem.set(String(novo.id), novo); if (it.feito) await cu('PUT', `/checklist/${rc.id}/checklist_item/${novo.id}`, { resolved: true }) }
        }
      }
      for (const [id, ri] of itensRem) {
        if (itensVistos.has(id)) continue
        if (!conhecido(ri)) { aviso(`tarefa ${taskId}: item "${ri.name}" do checklist foi criado no ClickUp depois da última sincronização; mantido`); continue }
        await cu('DELETE', `/checklist/${rc.id}/checklist_item/${id}`).catch((e) => { if (e.status !== 404) throw e })
      }
    }
    for (const [id, rc] of remPorId) {
      if (vistos.has(id)) continue
      if (!conhecido(rc)) { aviso(`tarefa ${taskId}: checklist "${rc.name}" foi criado no ClickUp depois da última sincronização; mantido`); continue }
      await cu('DELETE', `/checklist/${id}`).catch((e) => { if (e.status !== 404) throw e })
    }
  }

  const { unidades, canceladas } = agruparFila(fila)
  if (canceladas.length) {
    await sb.from('tarefas_outbox').update({ status: 'cancelado', erro: 'tarefa excluída na mesma rodada', processed_at: agora() }).in('id', canceladas.map((i) => i.id))
    resumo.canceladas = canceladas.length
  }
  const devolverDesde = (idx) => (reivindicada ? devolver(unidades.slice(idx).flatMap((u) => u.ids)) : null) // sem esperar o ttl

  for (const [idx, u] of unidades.entries()) {
    const item = u.item
    if (estourou()) {
      aviso('tempo esgotado; o resto fica para a próxima chamada')
      await devolverDesde(idx)
      break
    }
    resumo.processadas += u.ids.length
    resumo.agrupadas += u.ids.length - 1 // itens que foram juntos com outro (só do que foi processado)
    avisosItem = []
    try {
      if (item.operacao === 'excluir') {
        await cu('DELETE', `/task/${item.clickup_task_id}`).catch((e) => { if (e.status !== 404) throw e })
        resumo.excluidas++
      } else if (item.operacao === 'comentar') {
        const { data: c } = await sb.from('tarefas_comentarios').select('id, texto, autor_id, clickup_comment_id').eq('id', item.comentario_id).maybeSingle()
        const { data: row } = await sb.from('tarefas_itens').select('clickup_task_id').eq('id', item.tarefa_id).maybeSingle()
        if (!c) throw new Error('comentário não existe mais')
        if (!c.clickup_comment_id) {
          if (!row?.clickup_task_id) throw new Error('tarefa ainda não existe no ClickUp (criação pendente); tento de novo depois')
          const autor = perfil.get(c.autor_id)?.name
          const r = await cu('POST', `/task/${row.clickup_task_id}/comment`, { comment_text: autor ? `${c.texto}\n\n(${autor}, via VertaTask)` : c.texto, notify_all: false })
          await sb.from('tarefas_comentarios').update({ clickup_comment_id: String(r.id) }).eq('id', c.id)
        }
        resumo.comentadas++
      } else {
        const { data: row } = await sb.from('tarefas_itens').select('*').eq('id', item.tarefa_id).maybeSingle()
        if (!row) throw new Error('tarefa não existe mais')
        const l = lista.get(row.lista_id)
        if (!l) throw new Error('lista não encontrada')
        await garantirLista(l)
        if (item.operacao === 'criar' || !row.clickup_task_id) {
          if (row.clickup_task_id) { await marcar(u.ids, { status: 'ok' }); continue } // já criada por outro item da fila
          // outra rodada está criando esta tarefa agora: este item espera a próxima rodada
          const { data: emCurso } = await sb.from('tarefas_outbox').select('id').eq('tarefa_id', row.id).eq('operacao', 'criar').eq('status', 'processando').neq('id', item.id).limit(1)
          if (emCurso?.length) { await devolver(u.ids); resumo.devolvidas++; continue }
          // tentativa anterior criou no ClickUp mas falhou antes de gravar o vínculo: reaproveita
          let task = item.clickup_task_id ? await cu('GET', `/task/${item.clickup_task_id}`).catch(ignora(null)) : null
          if (task) {
            await camposPersonalizados(row, l, task.id, TODOS_OS_CAMPOS)
            task = await cu('GET', `/task/${task.id}`).catch(ignora(task))
          } else {
            // campos personalizados vão no próprio POST: 1 chamada por tarefa (eram 6 ou 7, o
            // que não deixava um template inteiro caber numa rodada de 50 s)
            const cfs = (await valoresCampos(row, l, TODOS_OS_CAMPOS)).filter((c) => c.value != null)
            const payload = {
              name: row.titulo || '(sem título)',
              markdown_description: row.descricao || undefined,
              assignees: assigneesDe(row),
              priority: PRIORIDADE[row.prioridade] || undefined,
              due_date: dataClickUp(row.data_vencimento, row.vencimento_com_hora) ?? undefined, due_date_time: !!row.vencimento_com_hora,
              start_date: dataClickUp(row.data_inicio, row.inicio_com_hora) ?? undefined, start_date_time: !!row.inicio_com_hora,
              time_estimate: row.estimativa_min ? row.estimativa_min * 60000 : undefined,
              tags: row.tags?.length ? row.tags : undefined,
              parent: (await paiCu(row)) || undefined,
              custom_fields: cfs.length ? cfs : undefined,
            }
            const st = statusValido(l, row.status); if (st) payload.status = st
            try { task = await cu('POST', `/list/${l.clickup_list_id}/task`, payload) }
            catch (e) { if (e.ecode === 'OAUTH_023' && payload.assignees.length) { task = await cu('POST', `/list/${l.clickup_list_id}/task`, { ...payload, assignees: [] }); aviso(`tarefa ${row.titulo}: o ClickUp não deixou atribuir o responsável por este token`) } else throw e }
            // id do ClickUp no item da fila antes de tudo: o webhook taskCreated já casa a
            // tarefa (e não insere cópia), e uma nova tentativa não cria de novo
            await sb.from('tarefas_outbox').update({ clickup_task_id: String(task.id) }).eq('id', item.id)
            if (row.status_tipo === 'closed' && !st) aviso(`tarefa ${row.titulo}: status "${row.status}" não existe na lista do ClickUp`)
          }
          if (row.checklists?.length) {
            await sincronizarChecklists(task.id, row.checklists, task.checklists, null)
            task = await cu('GET', `/task/${task.id}`).catch(ignora(task))
            await gravarEspelho(row.id, task, { checklists: mapChecklists(task.checklists) })
          } else await gravarEspelho(row.id, task)
          resumo.criadas++
        } else {
          const quais = new Set(item.campos || [])
          const body = {}
          if (quais.has('titulo')) body.name = row.titulo
          if (quais.has('descricao')) body.markdown_description = row.descricao || ''
          if (quais.has('prioridade')) body.priority = PRIORIDADE[row.prioridade] || null
          if (quais.has('data_vencimento')) { body.due_date = dataClickUp(row.data_vencimento, row.vencimento_com_hora); body.due_date_time = !!row.vencimento_com_hora }
          if (quais.has('data_inicio')) { body.start_date = dataClickUp(row.data_inicio, row.inicio_com_hora); body.start_date_time = !!row.inicio_com_hora }
          if (quais.has('estimativa_min')) body.time_estimate = row.estimativa_min ? row.estimativa_min * 60000 : null
          if (quais.has('arquivada')) body.archived = !!row.arquivada
          if (quais.has('parent_id')) body.parent = (await paiCu(row)) || null
          if (quais.has('status')) { const st = statusValido(l, row.status); if (st) body.status = st; else aviso(`tarefa ${row.clickup_task_id}: status "${row.status}" não existe na lista do ClickUp`) }
          if (quais.has('responsaveis')) {
            const atual = await cu('GET', `/task/${row.clickup_task_id}`)
            const tem = new Set((atual.assignees || []).map((a) => Number(a.id)))
            const quer = new Set(assigneesDe(row))
            body.assignees = { add: [...quer].filter((x) => !tem.has(x)), rem: [...tem].filter((x) => !quer.has(x)) }
          }
          if (quais.has('lista_id')) aviso(`tarefa ${row.clickup_task_id}: mover de lista não é replicado no ClickUp (mova lá também)`)
          let task = null
          if (Object.keys(body).length) task = await cu('PUT', `/task/${row.clickup_task_id}`, body)
          if (quais.has('tags')) {
            const atual = task || await cu('GET', `/task/${row.clickup_task_id}`)
            const tem = new Set((atual.tags || []).map((t) => t.name))
            for (const t of row.tags || []) if (!tem.has(t)) await cu('POST', `/task/${row.clickup_task_id}/tag/${encodeURIComponent(t)}`).catch(ignora((e) => aviso(`tag ${t}: ${e.message}`)))
            for (const t of tem) if (!(row.tags || []).includes(t)) await cu('DELETE', `/task/${row.clickup_task_id}/tag/${encodeURIComponent(t)}`).catch(ignora())
          }
          const cfs = new Set([...quais].filter((k) => ['tipo_tarefa', 'dificuldade', 'departamento'].includes(k)))
          if (cfs.size) await camposPersonalizados(row, l, row.clickup_task_id, cfs)
          if (quais.has('checklists')) {
            const atual = await cu('GET', `/task/${row.clickup_task_id}`)
            await sincronizarChecklists(row.clickup_task_id, row.checklists, atual.checklists, row.clickup_sync_at)
          }
          // o PUT já devolve a tarefa com date_updated: só relê quando algo foi por outra chamada
          const reler = !task || quais.has('tags') || cfs.size > 0 || quais.has('checklists')
          const final = reler ? await cu('GET', `/task/${row.clickup_task_id}`).catch(ignora(task)) : task
          if (final) await gravarEspelho(row.id, final, quais.has('checklists') ? { checklists: mapChecklists(final.checklists) } : {})
          resumo.atualizadas++
        }
      }
      await marcar(u.ids, { status: 'ok', erro: null })
    } catch (e) {
      if (e.semTempo) {
        // não é erro do item: ele e o resto voltam à fila, sem contar tentativa
        aviso(`tempo esgotado (${e.message}); o resto fica para a próxima chamada`)
        await devolverDesde(idx)
        resumo.processadas -= u.ids.length
        resumo.agrupadas -= u.ids.length - 1
        break
      }
      resumo.erros++
      const tentativas = (item.tentativas || 0) + 1
      const desiste = tentativas >= MAX_TENTATIVAS || e.status === 404 || e.status === 400
      await marcar(u.ids, { status: desiste ? 'erro' : 'pendente', tentativas, erro: e.message, ...(desiste ? {} : { processed_at: null }), ...(reivindicada ? { reivindicado_em: null } : {}) })
      aviso(`${item.operacao} ${item.tarefa_id || item.comentario_id}: ${e.message}${desiste ? ' (desisti)' : ''}`)
    }
  }
  resumo.duracao_s = Math.round((Date.now() - inicio) / 100) / 10
  // o que ficou na fila (tempo esgotado, devolvidos, enfileirado durante a rodada): quem
  // chamou continua enquanto houver, em vez de esperar a próxima escrita ou o cron
  const { count } = await sb.from('tarefas_outbox').select('id', { count: 'exact', head: true }).eq('status', 'pendente')
  resumo.restantes = count ?? 0
  log(`push: ${resumo.agrupadas} itens juntados, ${resumo.criadas} criadas, ${resumo.atualizadas} atualizadas, ${resumo.excluidas} excluídas, ${resumo.comentadas} comentários, ${resumo.erros} erros, ${resumo.devolvidas} devolvidas, ${resumo.copias_absorvidas} cópias absorvidas`)
  return resumo
}
