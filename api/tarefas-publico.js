import { NO_STORE, jsonCors, preflight, sb, serviceKey, msg } from './_http.js'

// Link público de uma lista (ou da pasta inteira de um cliente) do VertaTask, sem login:
// a página /lista/:token (src/pages/ListaPublica.jsx) chama
//   GET ?token=UUID → { alvo, cliente, listas[], pessoas{}, abertas[], concluidas[], concluidasTotal }
// O token vem de tarefas_links_publicos (migration 138), criado pelo botão "Compartilhar" do
// cabeçalho do VertaTask. Desativado ou inexistente = 404. Só sai o que a página mostra: título,
// status, prioridade, datas, responsáveis (nome e foto) e subtarefas; descrição, checklists e anexos
// só no detalhe de uma tarefa (pedido do Matheus em 24/11/2026). Comentários e campos internos
// (tipo, dificuldade, estimativa, etiquetas, ClickUp) não saem.

export const config = { runtime: 'edge' }

const json = (body, status = 200) => jsonCors(body, status, NO_STORE)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CAMPOS = 'id,parent_id,lista_id,titulo,status,status_tipo,prioridade,data_inicio,data_vencimento,data_conclusao,responsaveis,responsaveis_extra,posicao,created_at'
const LIMITE_CONCLUIDAS = 500
const LIMITE_ABERTAS = 3000

// páginas de 1000 (limite do PostgREST) até `max`
async function lerTudo(path, max) {
  const out = []
  for (let de = 0; de < max; de += 1000) {
    const { data, ok } = await sb(path, { range: `${de}-${Math.min(de + 999, max - 1)}`, prefer: null })
    if (!ok || !Array.isArray(data)) throw new Error('falha ao ler as tarefas')
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const limpar = (t) => ({
  id: t.id, pai: t.parent_id, lista: t.lista_id, titulo: t.titulo, status: t.status, tipo: t.status_tipo,
  prioridade: t.prioridade, inicio: t.data_inicio, vencimento: t.data_vencimento, conclusao: t.data_conclusao,
  responsaveis: t.responsaveis || [],
  extras: (t.responsaveis_extra || []).map((e) => ({ id: `cu:${e.clickup_id}`, nome: e.nome, foto: e.foto || null })),
  posicao: t.posicao, criada: t.created_at,
})

const BUCKET_ANEXOS = 'task-attachments'
async function urlAssinada(path) {
  const caminho = String(path).split('/').map(encodeURIComponent).join('/')
  const key = serviceKey()
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/sign/${BUCKET_ANEXOS}/${caminho}`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }),
    })
    const data = await res.json().catch(() => null)
    return res.ok && data?.signedURL ? `${process.env.SUPABASE_URL}/storage/v1${data.signedURL}` : null
  } catch { return null }
}

// Detalhe de uma tarefa do link: descrição, checklists e anexos (o resto a página já tem)
async function detalhe(req, tarefaId, listaIds) {
  if (!UUID_RE.test(tarefaId)) return { error: msg(req, { pt: 'tarefa inválida', en: 'invalid task' }) }
  const { data } = await sb(`/tarefas_itens?id=eq.${tarefaId}&arquivada=eq.false&select=id,lista_id,descricao,checklists,anexos`, { prefer: null })
  const t = Array.isArray(data) ? data[0] : null
  if (!t || !listaIds.includes(t.lista_id)) return { error: msg(req, { pt: 'Esta tarefa não faz parte do link.', en: 'This task is not part of the link.' }) }
  const anexos = await Promise.all((t.anexos || []).map(async (a) => ({
    nome: a.name || a.title || (a.path ? String(a.path).split('/').pop().replace(/^\d+-/, '') : 'arquivo'),
    type: a.type || a.mimetype || null,
    size: a.size || null,
    source: a.source || null,
    url: a.path ? await urlAssinada(a.path) : (a.url || null),
    thumbnail: a.thumbnail || null,
  })))
  return {
    tarefa: {
      id: t.id,
      descricao: t.descricao || '',
      checklists: (t.checklists || []).map((c) => ({ nome: c.nome || '', itens: (c.itens || []).map((i) => ({ nome: i.nome || '', feito: !!i.feito })) })),
      anexos: anexos.filter((a) => a.url),
    },
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'GET') return json({ error: msg(req, { pt: 'método não suportado', en: 'method not supported' }) }, 405)
  const token = new URL(req.url).searchParams.get('token') || ''
  if (!UUID_RE.test(token)) return json({ error: msg(req, { pt: 'link inválido', en: 'invalid link' }) }, 404)

  const { data: links } = await sb(`/tarefas_links_publicos?token=eq.${token}&ativo=eq.true&select=lista_id,pasta_id`, { prefer: null })
  const link = Array.isArray(links) ? links[0] : null
  if (!link) return json({ error: msg(req, { pt: 'Este link não existe ou foi desativado.', en: 'This link does not exist or was turned off.' }) }, 404)

  try {
    let listas = []
    let pastaId = link.pasta_id
    if (link.lista_id) {
      const { data } = await sb(`/tarefas_listas?id=eq.${link.lista_id}&select=id,nome,statuses,pasta_id,posicao,arquivada`, { prefer: null })
      listas = Array.isArray(data) ? data : []
      pastaId = listas[0]?.pasta_id || null
    } else {
      const { data } = await sb(`/tarefas_listas?pasta_id=eq.${link.pasta_id}&arquivada=eq.false&select=id,nome,statuses,pasta_id,posicao,arquivada&order=posicao.asc.nullslast,nome.asc`, { prefer: null })
      listas = Array.isArray(data) ? data : []
    }
    if (!listas.length) return json({ error: msg(req, { pt: 'Esta lista não existe mais.', en: 'This list no longer exists.' }) }, 404)

    const tarefaId = new URL(req.url).searchParams.get('tarefa')
    if (tarefaId) return json(await detalhe(req, tarefaId, listas.map((l) => l.id)))

    let cliente = null
    if (pastaId) {
      const { data } = await sb(`/tarefas_pastas?id=eq.${pastaId}&select=nome,project_id`, { prefer: null })
      const pasta = Array.isArray(data) ? data[0] : null
      cliente = pasta?.nome || null
      if (pasta?.project_id) {
        const { data: p } = await sb(`/projects_v2?id=eq.${pasta.project_id}&select=company_name`, { prefer: null })
        if (Array.isArray(p) && p[0]?.company_name) cliente = p[0].company_name
      }
    }

    const ids = listas.map((l) => l.id).join(',')
    const base = `/tarefas_itens?lista_id=in.(${ids})&arquivada=eq.false&select=${CAMPOS}`
    const [abertas, concluidas] = await Promise.all([
      lerTudo(`${base}&status_tipo=neq.closed&order=posicao.asc.nullslast,created_at.asc`, LIMITE_ABERTAS),
      lerTudo(`${base}&status_tipo=eq.closed&order=data_conclusao.desc.nullslast`, LIMITE_CONCLUIDAS),
    ])

    // responsáveis com perfil: nome e foto (o resto do perfil não sai)
    const uids = [...new Set([...abertas, ...concluidas].flatMap((t) => t.responsaveis || []))]
    const pessoas = {}
    if (uids.length) {
      const { data } = await sb(`/profiles?id=in.(${uids.join(',')})&select=id,name,avatar,foto_url`, { prefer: null })
      for (const p of Array.isArray(data) ? data : []) pessoas[p.id] = { id: p.id, nome: p.name, iniciais: p.avatar || null, foto: p.foto_url || null }
    }

    sb('/rpc/tarefas_link_publico_acesso', { method: 'POST', body: JSON.stringify({ p_token: token }), prefer: null }).catch(() => {})

    return json({
      alvo: link.lista_id ? 'lista' : 'pasta',
      cliente,
      listas: listas.map((l) => ({ id: l.id, nome: l.nome, statuses: (l.statuses || []).map((s) => ({ key: s.key, label: s.label, cor: s.cor, tipo: s.tipo, ordem: s.ordem })) })),
      pessoas,
      abertas: abertas.map(limpar),
      concluidas: concluidas.map(limpar),
      limiteConcluidas: LIMITE_CONCLUIDAS,
      atualizadoEm: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[tarefas-publico]', e)
    return json({ error: msg(req, { pt: 'Não consegui carregar as tarefas. Tente de novo.', en: 'Couldn\'t load the tasks. Please try again.' }) }, 500)
  }
}
