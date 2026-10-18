// Núcleo da sincronização ClickUp → VertaTask (tabelas tarefas_*). Sem HTTP
// nem env: recebe o cliente Supabase (chave de serviço), o token do ClickUp e
// as opções, e devolve o resumo. Usado por api/tarefas-sync.js (cron/botão,
// orçamento de 50 s) e por scripts/sincronizar_clickup.mjs (rodada completa
// local, sem limite de tempo). Mão única: nunca escreve no ClickUp.
//
// O que cobre, por space (padrão: Clientes, Operações e PROMPTS):
//  * pastas e listas: cria as novas e atualiza nome, ordem, arquivada, datas
//    da lista, statuses e o vínculo pasta→projeto (quando ainda não tem);
//  * tarefas (com subtarefas e fechadas) alteradas desde `desde`, ou TODAS em
//    `completo`; pais que faltam são buscados um a um, em rodadas, até a
//    hierarquia fechar; a gravação vai por profundidade (pais antes dos filhos,
//    inclusive entre lotes) para o FK de parent_id nunca estourar; filho cujo
//    pai não pôde ser gravado fica sem pai e vira aviso;
//  * `reconciliar`: compara as tarefas abertas aqui com as abertas no ClickUp;
//    o que sumiu de lá é rebuscado uma a uma: fechada/movida → atualiza,
//    apagada (404) → arquivada aqui com clickup_removida_at;
//  * comentários das tarefas abertas que mudaram (até `maxComentarios`).
//
// Conflito: tarefa editada na Área depois da última sincronização
// (updated_at > clickup_sync_at) só é sobrescrita se o ClickUp for mais novo.
import { STATUSES_PADRAO, mapStatuses, mapTarefa, mapComentario, mapLista, mapPasta, fazPerfilDe, projetoDaPasta } from './_tarefas_clickup_map.js'

const CLICKUP_BASE = 'https://api.clickup.com/api/v2'
export const SPACES_PADRAO = ['90090377342', '90090377343', '90130165565'] // Clientes, Operações, PROMPTS

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// jsonb reordena as chaves: compara numa forma canônica.
export function canon(v) {
  return JSON.stringify(v, (k, val) => (val && typeof val === 'object' && !Array.isArray(val)) ? Object.fromEntries(Object.keys(val).sort().map((x) => [x, val[x]])) : val)
}

/** Cliente da API v2 do ClickUp com espera no 429 (100 req/min no token pessoal). */
export function fazClickup(token) {
  return async function clickup(path) {
    for (let tent = 0; tent < 8; tent++) {
      const res = await fetch(`${CLICKUP_BASE}${path}`, { headers: { Authorization: token } })
      if (res.status === 429) {
        const ra = Number(res.headers.get('retry-after')) || 0
        await sleep(Math.max(ra * 1000, 5000 * (tent + 1)))
        continue
      }
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const err = new Error(json?.err || `ClickUp ${path}: ${res.status}`)
        err.status = res.status
        err.ecode = json?.ECODE
        throw err
      }
      return json
    }
    throw new Error(`ClickUp ${path}: limite de requisições`)
  }
}

// Datas: o Postgres devolve "+00:00" e a API manda "...Z" — compara pelo instante.
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
const mesmo = (a, b) => {
  if (typeof a === 'string' && typeof b === 'string' && ISO.test(a) && ISO.test(b)) return new Date(a).getTime() === new Date(b).getTime()
  return canon(a) === canon(b)
}
const diffCampos = (atual, novo, campos) => Object.fromEntries(campos.filter((k) => !mesmo(atual?.[k] ?? null, novo[k] ?? null)).map((k) => [k, novo[k]]))

export async function sincronizar({
  sb, token, team, spaces = SPACES_PADRAO, desde,
  completo = false, reconciliar = false, comentarios = true,
  maxComentarios = 40, maxPaginas = 30, orcamentoMs = 50_000, log = () => {},
}) {
  const clickup = fazClickup(token)
  const inicio = Date.now()
  const estourou = () => Date.now() - inicio > orcamentoMs
  const agora = new Date().toISOString()
  const resumo = {
    desde: completo ? null : desde?.toISOString?.() ?? null, completo, reconciliar, spaces,
    pastas_novas: 0, pastas_atualizadas: 0, listas_novas: 0, listas_atualizadas: 0,
    tarefas_recebidas: 0, pais_buscados: 0, criadas: 0, atualizadas: 0, puladas_conflito: 0, sem_pai: 0,
    reconciliadas: 0, removidas: 0, comentarios: 0, avisos: [],
  }
  const aviso = (m) => { if (resumo.avisos.length < 200) resumo.avisos.push(m); log('aviso: ' + m) }

  // ── Estado atual ─────────────────────────────────────────────────────────
  const [{ data: perfis }, { data: projetos }, { data: pastas }, { data: listas }] = await Promise.all([
    sb.from('profiles').select('id, name, clickup_user_id, disabled'),
    sb.from('projects_v2').select('id, company_name, clickup_folder_id'),
    sb.from('tarefas_pastas').select('id, clickup_folder_id, nome, posicao, arquivada, project_id, clickup_space_id, espaco'),
    sb.from('tarefas_listas').select('id, clickup_list_id, pasta_id, nome, descricao, statuses, posicao, arquivada, data_inicio, data_vencimento, clickup_space_id'),
  ])
  const perfilDe = fazPerfilDe(perfis || [])
  const pastaPorCu = new Map((pastas || []).filter((p) => p.clickup_folder_id).map((p) => [String(p.clickup_folder_id), p]))
  const listaPorCu = new Map((listas || []).filter((l) => l.clickup_list_id).map((l) => [String(l.clickup_list_id), l]))

  // ── Spaces ───────────────────────────────────────────────────────────────
  const todosSpaces = (await clickup(`/team/${team}/space?archived=false`))?.spaces || []
  const nomeSpace = new Map(todosSpaces.map((s) => [String(s.id), s.name]))
  for (const sid of spaces) if (!nomeSpace.has(String(sid))) aviso(`space ${sid} não encontrado no time (privado ou arquivado?)`)
  const spacesOk = spaces.map(String).filter((sid) => nomeSpace.has(sid))

  // ── Estrutura: pastas e listas ───────────────────────────────────────────
  const CAMPOS_PASTA = ['nome', 'posicao', 'arquivada', 'clickup_space_id', 'espaco']
  const CAMPOS_LISTA = ['pasta_id', 'nome', 'descricao', 'posicao', 'arquivada', 'data_inicio', 'data_vencimento', 'clickup_space_id']
  for (const sid of spacesOk) {
    const espaco = nomeSpace.get(sid)
    const [ativas, arquivadas, soltas, soltasArq] = await Promise.all([
      clickup(`/space/${sid}/folder?archived=false`).then((r) => r?.folders || []),
      clickup(`/space/${sid}/folder?archived=true`).then((r) => r?.folders || []).catch(() => []),
      clickup(`/space/${sid}/list?archived=false`).then((r) => r?.lists || []),
      clickup(`/space/${sid}/list?archived=true`).then((r) => r?.lists || []).catch(() => []),
    ])
    const folders = [...ativas, ...arquivadas.map((f) => ({ ...f, archived: true }))]
    for (const f of folders) {
      const row = mapPasta(f, { spaceId: sid, espaco })
      const ex = pastaPorCu.get(String(f.id))
      if (!ex) {
        const proj = projetoDaPasta(f, projetos || [])
        const { data, error } = await sb.from('tarefas_pastas').insert({ ...row, project_id: proj?.id || null }).select().single()
        if (error) { aviso(`pasta ${f.name}: ${error.message}`); continue }
        pastaPorCu.set(String(f.id), data)
        resumo.pastas_novas++
      } else {
        const patch = diffCampos(ex, row, CAMPOS_PASTA)
        if (!ex.project_id) { const proj = projetoDaPasta(f, projetos || []); if (proj) patch.project_id = proj.id }
        if (Object.keys(patch).length) {
          const { error } = await sb.from('tarefas_pastas').update(patch).eq('id', ex.id)
          if (error) aviso(`pasta ${f.name}: ${error.message}`)
          else { Object.assign(ex, patch); resumo.pastas_atualizadas++ }
        }
      }
    }
    // Listas arquivadas dentro de pasta só vêm por /folder/{id}/list?archived=true:
    // uma chamada por pasta, então só na rodada completa.
    const listasDePasta = folders.flatMap((f) => (f.lists || []).map((l) => ({ ...l, _folder: String(f.id), archived: !!(l.archived || f.archived) })))
    if (completo) {
      for (const f of ativas) {
        if (estourou()) { aviso('tempo esgotado nas listas arquivadas'); break }
        const arq = await clickup(`/folder/${f.id}/list?archived=true`).then((r) => r?.lists || []).catch(() => [])
        for (const l of arq) if (!listasDePasta.some((x) => x.id === l.id)) listasDePasta.push({ ...l, _folder: String(f.id), archived: true })
      }
    }
    const todasListas = [...soltas.map((l) => ({ ...l, _folder: null })), ...soltasArq.map((l) => ({ ...l, _folder: null, archived: true })), ...listasDePasta]
    for (const l of todasListas) {
      const pasta = l._folder ? pastaPorCu.get(l._folder) : null
      const row = mapLista(l, { pastaId: pasta?.id || null, spaceId: sid })
      const statuses = mapStatuses(l.statuses)
      const ex = listaPorCu.get(String(l.id))
      if (!ex) {
        const { data, error } = await sb.from('tarefas_listas').insert({ ...row, statuses: statuses.length ? statuses : STATUSES_PADRAO }).select().single()
        if (error) { aviso(`lista ${l.name}: ${error.message}`); continue }
        listaPorCu.set(String(l.id), data)
        resumo.listas_novas++
      } else {
        const patch = diffCampos(ex, row, CAMPOS_LISTA)
        if (statuses.length && !mesmo(statuses, ex.statuses)) patch.statuses = statuses
        if (Object.keys(patch).length) {
          const { error } = await sb.from('tarefas_listas').update(patch).eq('id', ex.id)
          if (error) aviso(`lista ${l.name}: ${error.message}`)
          else { Object.assign(ex, patch); resumo.listas_atualizadas++ }
        }
      }
    }
    log(`space ${espaco}: ${folders.length} pastas, ${todasListas.length} listas`)
  }

  // ── Tarefas ──────────────────────────────────────────────────────────────
  const recebidas = new Map() // clickup id → tarefa
  const paginar = async (sid, { abertasApenas = false } = {}) => {
    const ids = new Set()
    for (let page = 0; page < (completo ? 10_000 : maxPaginas); page++) {
      const qs = new URLSearchParams({
        'space_ids[]': sid, subtasks: 'true', include_markdown_description: 'true',
        order_by: 'updated', page: String(page),
      })
      if (!abertasApenas) qs.set('include_closed', 'true')
      if (!completo && !abertasApenas && desde) qs.set('date_updated_gt', String(desde.getTime()))
      const r = await clickup(`/team/${team}/task?${qs}`)
      const batch = r?.tasks || []
      for (const t of batch) { ids.add(t.id); if (!abertasApenas) recebidas.set(t.id, t) }
      if (page % 10 === 9) log(`  ${nomeSpace.get(sid)}: página ${page + 1}, ${ids.size} tarefas`)
      if (r?.last_page === true || batch.length < 100) break
      if (!completo && page === maxPaginas - 1) aviso('mais de 3.000 tarefas alteradas: rode de novo para continuar')
      if (estourou()) { aviso('tempo esgotado ao paginar; rode de novo'); break }
    }
    return ids
  }
  for (const sid of spacesOk) {
    if (estourou()) break
    await paginar(sid)
  }
  resumo.tarefas_recebidas = recebidas.size
  log(`${recebidas.size} tarefas recebidas`)

  // Linhas existentes das recebidas e dos pais delas
  const existentes = new Map()
  const carregarExistentes = async (ids) => {
    const arr = [...ids].filter((id) => !existentes.has(id))
    for (let i = 0; i < arr.length; i += 200) {
      const { data } = await sb.from('tarefas_itens').select('id, clickup_task_id, parent_id, lista_id, updated_at, clickup_sync_at, clickup_updated_at, status_tipo, arquivada').in('clickup_task_id', arr.slice(i, i + 200))
      for (const r of data || []) existentes.set(r.clickup_task_id, r)
    }
  }
  await carregarExistentes([...recebidas.keys(), ...[...recebidas.values()].filter((t) => t.parent).map((t) => t.parent)])

  // Pais que não estão no banco nem no lote: busca no ClickUp, em rodadas
  // (um pai pode ser subtarefa de outro que também falta).
  for (let rodada = 0; rodada < 5; rodada++) {
    const faltam = [...new Set([...recebidas.values()].filter((t) => t.parent && !existentes.has(t.parent) && !recebidas.has(t.parent)).map((t) => t.parent))]
    if (!faltam.length) break
    let buscados = 0
    for (const pid of faltam) {
      if (estourou()) { aviso(`tempo esgotado ao buscar pais (${faltam.length - buscados} ficaram sem pai)`); break }
      try {
        const pai = await clickup(`/task/${pid}?include_markdown_description=true`)
        if (pai?.id) { recebidas.set(pai.id, pai); resumo.pais_buscados++ }
      } catch (e) { aviso(`pai ${pid}: ${e.message}`) }
      buscados++
    }
    await carregarExistentes([...recebidas.values()].filter((t) => t.parent).map((t) => t.parent))
    if (estourou()) break
  }

  const { randomUUID } = await import('node:crypto')
  const idDe = new Map()
  for (const t of recebidas.values()) idDe.set(t.id, existentes.get(t.id)?.id || randomUUID())

  // Monta as linhas (regras de conflito) e marca quem vai estar presente no banco.
  const linhas = new Map() // clickup id → linha
  for (const t of recebidas.values()) {
    const lista = listaPorCu.get(String(t.list?.id))
    if (!lista) { aviso(`tarefa ${t.id} numa lista desconhecida (${t.list?.id} · ${t.list?.name || '?'})`); continue }
    const ex = existentes.get(t.id)
    const row = mapTarefa(t, perfilDe)
    if (ex) {
      const editadaNaArea = ex.clickup_sync_at && new Date(ex.updated_at).getTime() > new Date(ex.clickup_sync_at).getTime() + 1000
      if (editadaNaArea && new Date(row.clickup_updated_at).getTime() <= new Date(ex.updated_at).getTime()) { resumo.puladas_conflito++; continue }
      // nada novo? (em `completo` ainda confere se lista/pai mudaram ou se estava marcada como removida)
      const mesmaVersao = ex.clickup_updated_at && new Date(row.clickup_updated_at).getTime() <= new Date(ex.clickup_updated_at).getTime()
      const paiEsperado = t.parent ? (existentes.get(t.parent)?.id || idDe.get(t.parent) || null) : null
      const estruturaIgual = ex.lista_id === lista.id && (ex.parent_id || null) === paiEsperado
      if (mesmaVersao && estruturaIgual && !(ex.arquivada && !row.arquivada) && !completo) continue
      if (mesmaVersao && estruturaIgual && !(ex.arquivada && !row.arquivada) && completo && ex.status_tipo === row.status_tipo) continue
      resumo.atualizadas++
    } else {
      resumo.criadas++
    }
    linhas.set(t.id, { ...row, id: idDe.get(t.id), lista_id: lista.id, _parentCu: t.parent || null, _aberta: row.status_tipo !== 'closed', _novo: !ex })
  }
  const presente = (cu) => existentes.has(cu) || linhas.has(cu)
  // profundidade só sobre o que vai ser gravado agora (pai já no banco = 0)
  const prof = new Map()
  const profDe = (cu, visitados = new Set()) => {
    if (prof.has(cu)) return prof.get(cu)
    const l = linhas.get(cu)
    if (!l || !l._parentCu || !linhas.has(l._parentCu) || visitados.has(cu)) { prof.set(cu, 0); return 0 }
    visitados.add(cu)
    const d = 1 + profDe(l._parentCu, visitados)
    prof.set(cu, d)
    return d
  }
  const ordenadas = [...linhas.values()].map((l) => {
    let parent_id = null
    if (l._parentCu) {
      if (presente(l._parentCu)) parent_id = existentes.get(l._parentCu)?.id || idDe.get(l._parentCu)
      else { resumo.sem_pai++; aviso(`tarefa ${l.clickup_task_id}: pai ${l._parentCu} não pôde ser gravado; ficou sem pai`) }
    }
    return { ...l, parent_id, _prof: profDe(l.clickup_task_id) }
  }).sort((a, b) => a._prof - b._prof)
  // grava por nível de profundidade, para o pai existir antes do filho mesmo entre lotes
  const niveis = new Map()
  for (const l of ordenadas) { if (!niveis.has(l._prof)) niveis.set(l._prof, []); niveis.get(l._prof).push(l) }
  for (const nivel of [...niveis.keys()].sort((a, b) => a - b)) {
    const ls = niveis.get(nivel)
    for (let i = 0; i < ls.length; i += 200) {
      // updated_at = clickup_sync_at também aqui (além do trigger), para linha nova nunca parecer editada na Área
      const lote = ls.slice(i, i + 200).map((r) => { const c = { ...r, clickup_sync_at: agora, updated_at: agora }; delete c._aberta; delete c._novo; delete c._parentCu; delete c._prof; return c })
      const { error } = await sb.from('tarefas_itens').upsert(lote, { onConflict: 'clickup_task_id' })
      if (error) throw new Error(`upsert tarefas (nível ${nivel}): ${error.message}`)
    }
  }
  log(`${resumo.criadas} criadas, ${resumo.atualizadas} atualizadas, ${resumo.puladas_conflito} puladas por conflito, ${resumo.sem_pai} sem pai`)

  // ── Reconciliação: o que está aberto aqui mas sumiu do ClickUp ───────────
  if (reconciliar && !estourou()) {
    const abertasCu = new Set()
    for (const sid of spacesOk) { if (estourou()) break; for (const id of await paginar(sid, { abertasApenas: true })) abertasCu.add(id) }
    const listasDosSpaces = new Set([...listaPorCu.values()].filter((l) => spacesOk.includes(String(l.clickup_space_id))).map((l) => l.id))
    const abertasAqui = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('tarefas_itens').select('id, clickup_task_id, lista_id').not('clickup_task_id', 'is', null).neq('status_tipo', 'closed').eq('arquivada', false).range(from, from + 999)
      if (error) { aviso(`reconciliar: ${error.message}`); break }
      abertasAqui.push(...(data || []).filter((r) => listasDosSpaces.has(r.lista_id)))
      if (!data || data.length < 1000) break
    }
    const sumidas = abertasAqui.filter((r) => !abertasCu.has(r.clickup_task_id) && !recebidas.has(r.clickup_task_id))
    log(`reconciliar: ${abertasAqui.length} abertas aqui, ${abertasCu.size} abertas no ClickUp, ${sumidas.length} para conferir`)
    for (const r of sumidas) {
      if (estourou()) { aviso(`tempo esgotado na reconciliação (${sumidas.length - resumo.reconciliadas - resumo.removidas} ficaram para a próxima)`); break }
      try {
        const t = await clickup(`/task/${r.clickup_task_id}?include_markdown_description=true`)
        const lista = listaPorCu.get(String(t.list?.id))
        if (!lista) { aviso(`reconciliar ${t.id}: lista desconhecida (${t.list?.id})`); continue }
        const paiEx = t.parent ? (await sb.from('tarefas_itens').select('id').eq('clickup_task_id', t.parent).maybeSingle()).data : null
        const row = { ...mapTarefa(t, perfilDe), id: r.id, lista_id: lista.id, parent_id: paiEx?.id || null, clickup_sync_at: agora, updated_at: agora }
        const { error } = await sb.from('tarefas_itens').upsert(row, { onConflict: 'clickup_task_id' })
        if (error) aviso(`reconciliar ${t.id}: ${error.message}`); else resumo.reconciliadas++
      } catch (e) {
        if (e.status === 404 || e.status === 401 || /not found|não encontrad|not authorized/i.test(e.message)) {
          const { error } = await sb.from('tarefas_itens').update({ arquivada: true, clickup_removida_at: agora, clickup_sync_at: agora }).eq('id', r.id)
          if (error) aviso(`remover ${r.clickup_task_id}: ${error.message}`); else resumo.removidas++
        } else aviso(`reconciliar ${r.clickup_task_id}: ${e.message}`)
      }
    }
  }

  // ── Comentários das tarefas abertas que mudaram ──────────────────────────
  if (comentarios) {
    const candidatas = ordenadas.filter((l) => l._aberta).slice(0, maxComentarios)
    for (const l of candidatas) {
      if (estourou()) { aviso('tempo esgotado nos comentários; o resto vem na próxima rodada'); break }
      try {
        const r = await clickup(`/task/${l.clickup_task_id}/comment`)
        const cs = (r?.comments || []).map((c) => mapComentario(c, l.id, perfilDe)).filter(Boolean)
        if (!cs.length) continue
        const { data: jaTem } = await sb.from('tarefas_comentarios').select('clickup_comment_id').in('clickup_comment_id', cs.map((c) => c.clickup_comment_id))
        const novos = cs.filter((c) => !(jaTem || []).some((j) => j.clickup_comment_id === c.clickup_comment_id))
        if (novos.length) {
          const { error } = await sb.from('tarefas_comentarios').upsert(novos, { onConflict: 'clickup_comment_id' })
          if (!error) resumo.comentarios += novos.length
        }
      } catch (e) { aviso(`comentários ${l.clickup_task_id}: ${e.message}`) }
    }
  }

  resumo.duracao_s = Math.round((Date.now() - inicio) / 100) / 10
  return resumo
}
