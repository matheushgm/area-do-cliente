// Sincronização do Chat nos dois sentidos com o ClickUp Chat (API v3).
//  * puxar(): canais (cria/atualiza nome, visibilidade, arquivado, vínculo com
//    o cliente), membros dos canais novos, mensagens novas de cada canal com
//    atividade desde `desde` e as respostas das threads cuja contagem mudou.
//    Idempotente por clickup_channel_id / clickup_message_id.
//  * empurrar(): esvazia chat_outbox (mensagens e canais criados aqui, e
//    mensagens apagadas aqui) escrevendo no ClickUp. A fila é preenchida por
//    trigger só para escritas de pessoa logada; o que a própria sincronização
//    grava (chave de serviço) não entra.
// O autor no ClickUp é sempre o dono do token; quando a mensagem é de outra
// pessoa vai assinada "(Nome, via VertaTask)". Anexos vão como links.
const V3 = 'https://api.clickup.com/api/v3'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(ltda|s\.?a\.?|me|eireli)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const ALIAS = { 106097500: 118083078, 118078442: 118083078 }
const MAX_TENTATIVAS = 5

function fazClickup(token) {
  return async function cu(method, path, body) {
    for (let tent = 0; tent < 6; tent++) {
      const res = await fetch(`${V3}${path}`, { method, headers: { Authorization: token, 'Content-Type': 'application/json' }, body: body !== undefined ? JSON.stringify(body) : undefined })
      if (res.status === 429) { await sleep(Math.max((Number(res.headers.get('retry-after')) || 0) * 1000, 4000 * (tent + 1))); continue }
      const txt = await res.text()
      let json = null; try { json = JSON.parse(txt) } catch { json = null }
      if (!res.ok) { const e = new Error(json?.err || json?.message || `ClickUp ${method} ${path}: ${res.status}`); e.status = res.status; throw e }
      return json
    }
    throw new Error(`ClickUp ${method} ${path}: limite de requisições`)
  }
}

// Menções e links de tarefa do markdown do ClickUp → formato da Área
function converter(md, perfilDe, tarefas) {
  const mencionados = new Set()
  let texto = String(md || '').replace(/\[@([^\]]+)\]\(#user_mention#(\d+)\)/g, (_, nome, id) => {
    const p = perfilDe(id)
    if (p) { mencionados.add(p.id); return `@${slug(p.name)}` }
    return `@${slug(nome)}`
  })
  texto = texto.replace(/([^\n(]*?)\s*\(\[https?:\/\/app\.clickup\.com\/t\/([a-z0-9]+)\]\(https?:\/\/app\.clickup\.com\/t\/[a-z0-9]+\)\)/gi, (m, titulo, cuId) => {
    const uuid = tarefas?.get(cuId); return uuid ? `[${titulo.trim() || 'tarefa'}](/tarefas?tarefa=${uuid})` : m
  })
  texto = texto.replace(/\[(https?:\/\/app\.clickup\.com\/t\/([a-z0-9]+))\]\(\1\)/gi, (m, url, cuId) => {
    const uuid = tarefas?.get(cuId); return uuid ? `[tarefa](/tarefas?tarefa=${uuid})` : m
  })
  return { texto: texto.trim(), mencionados: [...mencionados] }
}
const slug = (nome) => String(nome || '').trim().split(/\s+/).join('_')

export function fazPerfilDe(perfis) {
  const m = new Map()
  for (const p of perfis) if (p.clickup_user_id) m.set(Number(p.clickup_user_id), p)
  return (cuId) => m.get(ALIAS[Number(cuId)] || Number(cuId)) || null
}

async function base(sb) {
  const [{ data: perfis }, { data: projetos }, { data: canais }] = await Promise.all([
    sb.from('profiles').select('id, name, clickup_user_id, disabled'),
    sb.from('projects_v2').select('id, company_name, clickup_chat_channel_id'),
    sb.from('chat_channels').select('id, name, type, visibility, archived, description, project_id, clickup_channel_id'),
  ])
  return { perfis: perfis || [], perfilDe: fazPerfilDe(perfis || []), projetos: projetos || [], canais: canais || [], canalPorCu: new Map((canais || []).filter((c) => c.clickup_channel_id).map((c) => [String(c.clickup_channel_id), c])) }
}

function projetoDoCanal(c, projetos) {
  const porId = projetos.find((p) => p.clickup_chat_channel_id && String(p.clickup_chat_channel_id) === String(c.id))
  if (porId) return porId.id
  const n = norm(c.name)
  if (!n) return null
  const exato = projetos.find((p) => norm(p.company_name) === n)
  if (exato) return exato.id
  const cand = projetos.filter((p) => { const pn = norm(p.company_name); return pn && (pn.startsWith(n) || n.startsWith(pn)) })
  return cand.length === 1 ? cand[0].id : null
}

export async function puxar({ sb, token, team, desde, completo = false, orcamentoMs = 40_000, log = () => {} }) {
  const cu = fazClickup(token)
  const inicio = Date.now()
  const estourou = () => Date.now() - inicio > orcamentoMs
  const resumo = { desde: completo ? null : desde?.toISOString?.(), canais_novos: 0, canais_atualizados: 0, membros: 0, mensagens: 0, respostas: 0, canais_lidos: 0, avisos: [] }
  const aviso = (m) => { if (resumo.avisos.length < 50) resumo.avisos.push(m); log('aviso: ' + m) }
  const b = await base(sb)
  const desdeMs = completo ? 0 : desde.getTime()

  // tarefas (para links de tarefa no texto)
  const tarefas = new Map()
  for (let de = 0; ; de += 1000) {
    const { data } = await sb.from('tarefas_itens').select('id, clickup_task_id').not('clickup_task_id', 'is', null).range(de, de + 999)
    for (const t of data || []) tarefas.set(t.clickup_task_id, t.id)
    if (!data || data.length < 1000) break
  }

  // canais
  const canaisCu = []
  let cursor = null
  do {
    const j = await cu('GET', `/workspaces/${team}/chat/channels?limit=100${cursor ? '&cursor=' + cursor : ''}`)
    canaisCu.push(...(j.data || j.channels || [])); cursor = j.next_cursor
  } while (cursor)
  for (const c of canaisCu) {
    const isDm = c.type === 'DM' || c.type === 'GROUP_DM'
    const row = {
      clickup_channel_id: String(c.id), name: isDm ? null : (c.name || null), type: isDm ? 'dm' : 'channel',
      visibility: isDm || c.visibility === 'PRIVATE' ? 'private' : 'public', description: c.description || null, archived: !!c.archived,
    }
    const ex = b.canalPorCu.get(String(c.id))
    if (!ex) {
      const { data, error } = await sb.from('chat_channels').insert({ ...row, project_id: isDm ? null : projetoDoCanal(c, b.projetos) }).select('id').single()
      if (error) { aviso(`canal ${c.name || c.id}: ${error.message}`); continue }
      b.canalPorCu.set(String(c.id), { ...row, id: data.id })
      resumo.canais_novos++
      try {
        const j = await cu('GET', `/workspaces/${team}/chat/channels/${c.id}/members?limit=100`)
        const ids = (j.data || []).map((u) => b.perfilDe(u.id)?.id).filter(Boolean)
        if (ids.length) { await sb.from('chat_channel_members').upsert(ids.map((uid) => ({ channel_id: data.id, user_id: uid })), { onConflict: 'channel_id,user_id', ignoreDuplicates: true }); resumo.membros += ids.length }
      } catch (e) { aviso(`membros ${c.name || c.id}: ${e.message}`) }
    } else {
      const patch = {}
      for (const k of ['name', 'visibility', 'description', 'archived']) if ((ex[k] ?? null) !== (row[k] ?? null)) patch[k] = row[k]
      if (!ex.project_id && !isDm) { const pid = projetoDoCanal(c, b.projetos); if (pid) patch.project_id = pid }
      if (Object.keys(patch).length) { await sb.from('chat_channels').update(patch).eq('id', ex.id); Object.assign(ex, patch); resumo.canais_atualizados++ }
    }
  }

  // mensagens dos canais com atividade desde `desde`
  const ativos = canaisCu.filter((c) => completo || Number(c.latest_comment_at || 0) >= desdeMs)
  for (const c of ativos) {
    if (estourou()) { aviso('tempo esgotado; os canais restantes ficam para a próxima rodada'); break }
    const canal = b.canalPorCu.get(String(c.id)); if (!canal) continue
    resumo.canais_lidos++
    const msgs = []
    let cur = null, parou = false, pagina = 0
    do {
      const j = await cu('GET', `/workspaces/${team}/chat/channels/${c.id}/messages?limit=100&content_format=text/md${cur ? '&cursor=' + cur : ''}`)
      for (const m of j.data || []) { if (completo || Number(m.date) >= desdeMs || pagina === 0) msgs.push(m); if (!completo && Number(m.date) < desdeMs) parou = true }
      cur = parou ? null : j.next_cursor; pagina++
    } while (cur && !estourou())
    const raizes = msgs.filter((m) => m.type === 'message')
    if (!raizes.length) continue
    const cuIds = raizes.map((m) => String(m.id))
    const existentes = new Map()
    for (let i = 0; i < cuIds.length; i += 200) {
      const { data } = await sb.from('chat_messages').select('id, clickup_message_id, replies_count, content, edited_at').in('clickup_message_id', cuIds.slice(i, i + 200))
      for (const r of data || []) existentes.set(r.clickup_message_id, r)
    }
    const linhaDe = (m, parentId) => {
      const { texto, mencionados } = converter(m.content || '', b.perfilDe, tarefas)
      if (!texto) return null
      const row = { clickup_message_id: String(m.id), channel_id: canal.id, parent_id: parentId, user_id: b.perfilDe(m.user_id)?.id || null, content: texto, mentioned_user_ids: mencionados, created_at: new Date(Number(m.date)).toISOString() }
      if (m.date_updated && Number(m.date_updated) > Number(m.date) + 1000) row.edited_at = new Date(Number(m.date_updated)).toISOString()
      return row
    }
    // novas (ou editadas) desde `desde`
    const novas = raizes.filter((m) => completo || Number(m.date) >= desdeMs || (m.date_updated && Number(m.date_updated) >= desdeMs) || !existentes.has(String(m.id)) && Number(m.date) >= desdeMs - 7 * 86400000)
      .map((m) => linhaDe(m, null)).filter(Boolean)
      .filter((l) => { const ex = existentes.get(l.clickup_message_id); return !ex || ex.content !== l.content })
    if (novas.length) {
      const { data: ins, error } = await sb.from('chat_messages').upsert(novas, { onConflict: 'clickup_message_id' }).select('id, clickup_message_id')
      if (error) { aviso(`mensagens ${c.name || c.id}: ${error.message}`); continue }
      for (const r of ins || []) existentes.set(r.clickup_message_id, { ...existentes.get(r.clickup_message_id), id: r.id, clickup_message_id: r.clickup_message_id })
      resumo.mensagens += novas.length
    }
    // threads: busca respostas quando a contagem mudou (ou raiz nova com respostas)
    for (const m of raizes) {
      if (estourou()) break
      const ex = existentes.get(String(m.id))
      const n = Number(m.replies_count || 0)
      if (!ex || n === 0 || n === Number(ex.replies_count || 0)) continue
      try {
        const j = await cu('GET', `/workspaces/${team}/chat/messages/${m.id}/replies?limit=100&content_format=text/md`)
        const resp = (j.data || []).sort((a, z) => Number(a.date) - Number(z.date)).map((r) => linhaDe(r, ex.id)).filter(Boolean)
        if (resp.length) { const { error } = await sb.from('chat_messages').upsert(resp, { onConflict: 'clickup_message_id' }); if (error) aviso(`respostas ${m.id}: ${error.message}`); else resumo.respostas += resp.length }
      } catch (e) { aviso(`respostas ${m.id}: ${e.message}`) }
    }
  }
  resumo.duracao_s = Math.round((Date.now() - inicio) / 100) / 10
  log(`chat pull: ${resumo.canais_novos} canais novos, ${resumo.mensagens} mensagens, ${resumo.respostas} respostas em ${resumo.canais_lidos} canais`)
  return resumo
}

// @Nome_Sobrenome → [@Nome Sobrenome](#user_mention#id) quando a pessoa tem ClickUp
function paraClickUp(texto, mencionados, perfis) {
  let out = String(texto || '')
  for (const uid of mencionados || []) {
    const p = perfis.find((x) => x.id === uid)
    if (!p?.clickup_user_id) continue
    out = out.split(`@${slug(p.name)}`).join(`[@${p.name}](#user_mention#${p.clickup_user_id})`)
  }
  return out
}

export async function empurrar({ sb, token, team, limite = 40, orcamentoMs = 20_000, log = () => {} }) {
  const cu = fazClickup(token)
  const inicio = Date.now()
  const estourou = () => Date.now() - inicio > orcamentoMs
  const resumo = { processadas: 0, enviadas: 0, excluidas: 0, canais_criados: 0, erros: 0, avisos: [] }
  const aviso = (m) => { if (resumo.avisos.length < 50) resumo.avisos.push(m); log('aviso: ' + m) }
  const { data: fila, error } = await sb.from('chat_outbox').select('*').eq('status', 'pendente').order('id').limit(limite)
  if (error) throw new Error(`chat_outbox: ${error.message}`)
  if (!fila?.length) return resumo
  const b = await base(sb)
  let dono = null
  try { const me = await fetch('https://api.clickup.com/api/v2/user', { headers: { Authorization: token } }).then((r) => r.json()); dono = Number(me?.user?.id) || null } catch { /* sem dono */ }
  const marcar = (id, patch) => sb.from('chat_outbox').update({ ...patch, processed_at: new Date().toISOString() }).eq('id', id)
  const canalPorId = new Map(b.canais.map((c) => [c.id, c]))

  for (const item of fila) {
    if (estourou()) { aviso('tempo esgotado; o resto fica para a próxima chamada'); break }
    resumo.processadas++
    try {
      if (item.operacao === 'canal') {
        const c = canalPorId.get(item.channel_id)
        if (!c) throw new Error('canal não existe mais')
        if (!c.clickup_channel_id) {
          const novo = await cu('POST', `/workspaces/${team}/chat/channels`, { name: c.name, description: c.description || undefined, visibility: c.visibility === 'private' ? 'PRIVATE' : 'PUBLIC' })
          const id = String(novo?.data?.id || novo?.id)
          await sb.from('chat_channels').update({ clickup_channel_id: id }).eq('id', c.id)
          c.clickup_channel_id = id; resumo.canais_criados++
        }
      } else if (item.operacao === 'excluir') {
        await cu('DELETE', `/workspaces/${team}/chat/messages/${item.clickup_message_id}`).catch((e) => { if (e.status !== 404) throw e })
        resumo.excluidas++
      } else {
        const { data: m } = await sb.from('chat_messages').select('*').eq('id', item.message_id).maybeSingle()
        if (!m) throw new Error('mensagem não existe mais')
        if (m.clickup_message_id) { await marcar(item.id, { status: 'ok' }); continue }
        const c = canalPorId.get(m.channel_id)
        if (!c?.clickup_channel_id) {
          if (c?.type === 'dm') throw new Error('DM criada no VertaTask não tem canal no ClickUp (não replicada)')
          throw new Error('canal ainda não existe no ClickUp (criação pendente); tento de novo depois')
        }
        const autor = b.perfis.find((p) => p.id === m.user_id)
        let conteudo = paraClickUp(m.content, m.mentioned_user_ids, b.perfis)
        const anexos = Array.isArray(m.attachments) ? m.attachments : []
        if (anexos.length) conteudo += (conteudo ? '\n\n' : '') + anexos.map((a) => `📎 [${a.name || 'arquivo'}](${a.url || a.signed_url || ''})`).join('\n')
        if (autor && (!autor.clickup_user_id || Number(autor.clickup_user_id) !== dono)) conteudo += `\n\n(${autor.name}, via VertaTask)`
        if (!conteudo.trim()) conteudo = '(mensagem sem texto)'
        let r
        if (m.parent_id) {
          const { data: pai } = await sb.from('chat_messages').select('clickup_message_id').eq('id', m.parent_id).maybeSingle()
          if (!pai?.clickup_message_id) throw new Error('a mensagem raiz ainda não está no ClickUp; tento de novo depois')
          r = await cu('POST', `/workspaces/${team}/chat/messages/${pai.clickup_message_id}/replies`, { type: 'message', content: conteudo, content_format: 'text/md' })
        } else {
          r = await cu('POST', `/workspaces/${team}/chat/channels/${c.clickup_channel_id}/messages`, { type: 'message', content: conteudo, content_format: 'text/md' })
        }
        const id = String(r?.data?.id || r?.id)
        if (!id || id === 'undefined') throw new Error('ClickUp não devolveu o id da mensagem')
        await sb.from('chat_messages').update({ clickup_message_id: id }).eq('id', m.id)
        resumo.enviadas++
      }
      await marcar(item.id, { status: 'ok', erro: null })
    } catch (e) {
      resumo.erros++
      const tentativas = (item.tentativas || 0) + 1
      const desiste = tentativas >= MAX_TENTATIVAS || e.status === 404 || e.status === 400 || /não replicada/.test(e.message)
      await marcar(item.id, { status: desiste ? 'erro' : 'pendente', tentativas, erro: e.message, ...(desiste ? {} : { processed_at: null }) })
      aviso(`${item.operacao} ${item.message_id || item.channel_id}: ${e.message}${desiste ? ' (desisti)' : ''}`)
    }
  }
  resumo.duracao_s = Math.round((Date.now() - inicio) / 100) / 10
  log(`chat push: ${resumo.enviadas} enviadas, ${resumo.excluidas} excluídas, ${resumo.canais_criados} canais, ${resumo.erros} erros`)
  return resumo
}

/** Rodada completa (push + pull), com estado em chat_sync. */
export async function sincronizarChat({ sb, token, team, since = null, completo = false, pull = true, push = true, orcamentoMs = 50_000, log = () => {} }) {
  const inicio = Date.now()
  const { data: estado } = await sb.from('chat_sync').select('*').eq('id', 'clickup').maybeSingle()
  let desde = since ? new Date(since) : (estado?.ultimo_inicio ? new Date(new Date(estado.ultimo_inicio).getTime() - 15 * 60_000) : new Date(Date.now() - 86400000))
  if (isNaN(desde.getTime())) desde = new Date(Date.now() - 86400000)
  const resumo = { desde: desde.toISOString() }
  try {
    if (push) resumo.push = await empurrar({ sb, token, team, orcamentoMs: Math.min(20_000, orcamentoMs / 2), log })
    if (pull) resumo.pull = await puxar({ sb, token, team, desde, completo, orcamentoMs: orcamentoMs - (Date.now() - inicio), log })
    if (pull) await sb.from('chat_sync').upsert({ id: 'clickup', ultimo_inicio: new Date(inicio).toISOString(), ultimo_fim: new Date().toISOString(), ultimo_ok: true, resumo, updated_at: new Date().toISOString() })
    return resumo
  } catch (e) {
    resumo.erro = e.message
    await sb.from('chat_sync').upsert({ id: 'clickup', ultimo_inicio: estado?.ultimo_inicio || desde.toISOString(), ultimo_fim: new Date().toISOString(), ultimo_ok: false, resumo, updated_at: new Date().toISOString() })
    throw e
  }
}
