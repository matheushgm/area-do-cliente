// Relações entre tarefas (tarefas_relacoes) ⇄ ClickUp. Usado pelo push (ida), pela rodada
// periódica e pelo webhook (volta).
//
// Mapeamento (o lado de quem bloqueia é `tarefa_id`: o template grava "D bloqueia X" quando X
// tem D em depende_de, e o painel mostra "Bloqueia" do lado de tarefa_id):
//   bloqueia A → B  ⇄ dependência do ClickUp { task_id: B, depends_on: A } (B espera A)
//   relacionada     ⇄ link { task_id, link_id } (sem direção)
//   duplica         → link também: o ClickUp não tem "duplicada de". Na volta um link vira
//                     'relacionada'; um 'duplica' daqui que já tem o link lá é mantido.
// No GET /task (e na listagem de tarefas) a dependência e o link aparecem nas DUAS tarefas,
// com o mesmo registro. Mudar dependência ou link no ClickUp dispara taskUpdated nas duas, mas
// NÃO muda o date_updated delas: por isso a volta reconcilia as relações de toda tarefa lida,
// mesmo quando a tarefa em si não mudou.
import { registrarSyncLog } from './_tarefas_sync_log.js'

const LINK = new Set(['relacionada', 'duplica'])
export const ehLink = (tipo) => LINK.has(tipo)
const par = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)
export const chavePar = par

/** Chamadas ao ClickUp para criar ({ method, path, body }) ou desfazer a relação, com os ids do ClickUp. */
export function chamadaRelacao(tipo, cuDe, cuPara, desfazer = false) {
  if (tipo === 'bloqueia') {
    return desfazer
      ? { method: 'DELETE', path: `/task/${cuPara}/dependency?depends_on=${encodeURIComponent(cuDe)}` }
      : { method: 'POST', path: `/task/${cuPara}/dependency`, body: { depends_on: cuDe } }
  }
  return { method: desfazer ? 'DELETE' : 'POST', path: `/task/${cuDe}/link/${cuPara}` }
}

/** Relações do ClickUp de uma tarefa lida: [{ tipo: 'bloqueia', de, para } | { tipo: 'link', de, para }] (ids do ClickUp). */
export function relacoesDoClickup(t) {
  const out = []
  for (const d of t?.dependencies || []) if (d?.task_id && d?.depends_on) out.push({ tipo: 'bloqueia', de: String(d.depends_on), para: String(d.task_id) })
  for (const l of t?.linked_tasks || []) if (l?.task_id && l?.link_id) out.push({ tipo: 'link', de: String(l.task_id), para: String(l.link_id) })
  return out
}

async function emFatias(ids, fn) {
  const out = []
  for (let i = 0; i < ids.length; i += 200) { const { data, error } = await fn(ids.slice(i, i + 200)); if (error) throw new Error(error.message); out.push(...(data || [])) }
  return out
}

/**
 * Volta: para cada tarefa lida do ClickUp, o ClickUp é a verdade das relações dela com tarefas
 * que existem aqui (com clickup_task_id): cria o que falta, apaga o que sumiu. Grava com a chave
 * de serviço (não enfileira). Par com envio em aberto na fila (pendente, enviando ou com erro) não
 * é mexido: a mudança daqui ainda não chegou lá, ou falhou e está no painel.
 * Só considera tarefas que vieram com os campos `dependencies`/`linked_tasks`.
 */
export async function reconciliarRelacoes(sb, tarefasCu, { log = () => {} } = {}) {
  const lidas = (tarefasCu || []).filter((t) => t?.id && Array.isArray(t.dependencies) && Array.isArray(t.linked_tasks))
  const resumo = { criadas: 0, removidas: 0, protegidas: 0 }
  if (!lidas.length) return resumo
  const doCu = lidas.map((t) => ({ t, rels: relacoesDoClickup(t) }))

  // ids do VertaTask das tarefas lidas e das citadas nas relações delas
  const cus = [...new Set(doCu.flatMap(({ t, rels }) => [String(t.id), ...rels.flatMap((r) => [r.de, r.para])]))]
  const idDoCu = new Map()
  const cuDoId = new Map()
  for (const r of await emFatias(cus, (f) => sb.from('tarefas_itens').select('id, clickup_task_id').in('clickup_task_id', f))) {
    idDoCu.set(String(r.clickup_task_id), r.id); cuDoId.set(r.id, String(r.clickup_task_id))
  }
  const lidasAqui = doCu.filter(({ t }) => idDoCu.has(String(t.id)))
  if (!lidasAqui.length) return resumo
  const idsLidas = lidasAqui.map(({ t }) => idDoCu.get(String(t.id)))

  // relações daqui que tocam as tarefas lidas
  const porId = new Map()
  for (const col of ['tarefa_id', 'relacionada_id']) {
    for (const r of await emFatias(idsLidas, (f) => sb.from('tarefas_relacoes').select('id, tarefa_id, relacionada_id, tipo').in(col, f))) porId.set(r.id, r)
  }
  const locais = [...porId.values()]
  // a outra ponta pode não estar entre as citadas pelo ClickUp: busca o vínculo dela
  const semCu = [...new Set(locais.flatMap((r) => [r.tarefa_id, r.relacionada_id]).filter((id) => !cuDoId.has(id)))]
  for (const r of await emFatias(semCu, (f) => sb.from('tarefas_itens').select('id, clickup_task_id').in('id', f))) if (r.clickup_task_id) cuDoId.set(r.id, String(r.clickup_task_id))

  // pares com envio em aberto
  const { data: fila } = await sb.from('tarefas_outbox').select('payload')
    .in('operacao', ['relacionar', 'desrelacionar']).in('status', ['pendente', 'processando', 'erro'])
  const protegidos = new Set((fila || []).filter((o) => o.payload?.tarefa_id && o.payload?.relacionada_id).map((o) => par(o.payload.tarefa_id, o.payload.relacionada_id)))

  // o que o ClickUp diz, só entre tarefas que existem aqui
  const querDep = new Map() // 'A>B' → { de, para } (ids daqui)
  const querLink = new Map() // par → { de, para }
  for (const { rels } of lidasAqui) {
    for (const r of rels) {
      const de = idDoCu.get(r.de), para = idDoCu.get(r.para)
      if (!de || !para || de === para) continue
      if (r.tipo === 'bloqueia') querDep.set(`${de}>${para}`, { de, para })
      else if (!querLink.has(par(de, para))) querLink.set(par(de, para), { de, para })
    }
  }
  const lidasSet = new Set(idsLidas)
  const temDep = new Set()
  const temLink = new Set()
  const apagar = []
  for (const r of locais) {
    // só compara relação com as duas pontas no ClickUp (a outra pode estar só aqui, ex.: lista sem ClickUp)
    if (!cuDoId.has(r.tarefa_id) || !cuDoId.has(r.relacionada_id)) continue
    const k = par(r.tarefa_id, r.relacionada_id)
    if (r.tipo === 'bloqueia') {
      temDep.add(`${r.tarefa_id}>${r.relacionada_id}`)
      if (!querDep.has(`${r.tarefa_id}>${r.relacionada_id}`)) apagar.push(r)
    } else {
      temLink.add(k)
      if (!querLink.has(k)) apagar.push(r)
    }
  }
  const criar = [
    ...[...querDep].filter(([k]) => !temDep.has(k)).map(([, v]) => ({ tarefa_id: v.de, relacionada_id: v.para, tipo: 'bloqueia' })),
    ...[...querLink].filter(([k]) => !temLink.has(k)).map(([, v]) => ({ tarefa_id: v.de, relacionada_id: v.para, tipo: 'relacionada' })),
  ].filter((r) => lidasSet.has(r.tarefa_id) || lidasSet.has(r.relacionada_id))

  const linhasLog = []
  const cuTxt = (id) => cuDoId.get(id) || null
  const okApagar = apagar.filter((r) => { const p = protegidos.has(par(r.tarefa_id, r.relacionada_id)); if (p) resumo.protegidas++; return !p })
  const okCriar = criar.filter((r) => { const p = protegidos.has(par(r.tarefa_id, r.relacionada_id)); if (p) resumo.protegidas++; return !p })
  if (okApagar.length) {
    const { error } = await sb.from('tarefas_relacoes').delete().in('id', okApagar.map((r) => r.id))
    if (error) throw new Error(`apagar relações: ${error.message}`)
    resumo.removidas = okApagar.length
    for (const r of okApagar) linhasLog.push({ origem: 'clickup', acao: 'relacao_removida', tarefa_id: r.tarefa_id, clickup_task_id: cuTxt(r.tarefa_id), detalhe: { tipo: r.tipo, relacionada_id: r.relacionada_id } })
  }
  if (okCriar.length) {
    const { data, error } = await sb.from('tarefas_relacoes')
      .upsert(okCriar, { onConflict: 'tarefa_id,relacionada_id,tipo', ignoreDuplicates: true }).select('id, tarefa_id, relacionada_id, tipo')
    if (error) throw new Error(`criar relações: ${error.message}`)
    resumo.criadas = (data || []).length
    for (const r of data || []) linhasLog.push({ origem: 'clickup', acao: 'relacao_criada', tarefa_id: r.tarefa_id, clickup_task_id: cuTxt(r.tarefa_id), detalhe: { tipo: r.tipo, relacionada_id: r.relacionada_id } })
  }
  if (linhasLog.length) await registrarSyncLog(sb, linhasLog)
  if (resumo.criadas || resumo.removidas) log(`relações: ${resumo.criadas} criadas, ${resumo.removidas} removidas`)
  return resumo
}
