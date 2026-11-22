import { NO_STORE, jsonCors, preflight, sb } from './_http.js'
import { registrarIntake } from './_intake.js'
import { hasPortalBearer, readPortalSession } from './_portal_auth.js'
import { serviceKey } from './_http.js'
import { CAMPOS_FINAIS, TIPOS_PEDIDO, TIPOS_PEDIDO_MAP, camposVisiveis, lerLinkDrive, montarPedido, validarPedido } from '../src/lib/pedidoTipos.js'
// Edge Function pública — PEDIDO DO CLIENTE para a fila de Intake do VertaTask.
// Sem login: o link /pedido/:token usa o client_share_token do projeto (o mesmo das
// outras páginas públicas). Os tipos e campos vêm de src/lib/pedidoTipos.js.
//   GET  ?token=UUID                       → { empresa, prazos: { tipo: dias úteis } }
//   GET  ?token=UUID&drive=URL             → { publico, existe, nome, natureza } (link do Drive aberto?)
//   POST { token, tipo, respostas }        → confere de novo os links do Drive e cria o pedido pendente
// Limite: 8 pedidos por hora por cliente, para o link aberto não virar spam.
//
// PORTAL DO CLIENTE (/portal/:projectId, módulo Solicitações): em vez do token, `projectId` +
// header Authorization com a sessão do portal. `view` acompanha, `edit` também pede.
//   GET  ?projectId=UUID                   → { empresa, prazos, pedidos: [...] } (os pedidos do cliente e onde estão)
//   GET  ?projectId=UUID&drive=URL         → igual ao link
//   POST { projectId, acao: 'upload', nome, tamanho, mime } → URL assinada para subir UM arquivo (bucket attachments)
//   POST { projectId, tipo, respostas }    → cria o pedido (origem "Portal do cliente"); aceita `respostas.arquivos`
// Os arquivos ficam em attachments/<projectId>/pedidos/…: o time do squad abre pelo Intake.
export const config = { runtime: 'edge' }

const json = (body, status) => jsonCors(body, status, NO_STORE)
const str = (v, max = 400) => String(v == null ? '' : v).trim().slice(0, max)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function findProject(token) {
  if (!UUID_RE.test(token || '')) return null
  const { data, status } = await sb(`/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id,company_name`)
  if (status !== 200 || !Array.isArray(data) || !data.length) return null
  return data[0]
}

// Dias úteis até a entrega ir ao ar, lidos do template de cada tipo: o vencimento da
// subtarefa de publicar (ou o maior vencimento, se o template não tiver uma).
const ORIGEM_PORTAL = 'Portal do cliente'
// Origens que nasceram do cliente (link, portal ou uma reprovação dele): o que o portal lista.
const ORIGENS_DO_CLIENTE = ['Cliente (link)', ORIGEM_PORTAL, 'Aprovação de anúncios', 'Aprovação de LP', 'Aprovação de copy']
const LIMITE_ARQUIVO = 50 * 1024 * 1024
const MAX_ARQUIVOS = 20

// Projeto pelo token do link OU pela sessão do portal (módulo Solicitações).
// Devolve { project, portal: bool } ou { error, status }.
async function resolverProjeto(req, token, projectId, precisaPedir) {
  if (hasPortalBearer(req) && projectId) {
    if (!UUID_RE.test(projectId)) return { error: 'projectId inválido.', status: 400 }
    const sess = await readPortalSession(req, projectId)
    if (!sess.ok) return { error: sess.message, status: sess.status }
    const nivel = sess.permissions.solicitacoes
    if (!nivel || (precisaPedir && nivel !== 'edit')) return { error: 'Sem acesso a este módulo.', status: 403 }
    const { data } = await sb(`/projects_v2?id=eq.${encodeURIComponent(projectId)}&select=id,company_name`)
    const project = Array.isArray(data) ? data[0] : null
    return project ? { project, portal: true, nivel } : { error: 'Projeto não encontrado.', status: 404 }
  }
  const project = await findProject(token)
  return project ? { project, portal: false } : { error: 'Link inválido ou expirado.', status: 404 }
}

const nomeSeguro = (n) => String(n || 'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-90) || 'arquivo'

// URL assinada de upload (vale 2 h) num caminho que só o servidor escolhe.
async function urlDeUpload(projectId, nome) {
  const mes = new Date().toISOString().slice(0, 7)
  const path = `${projectId}/pedidos/${mes}/${crypto.randomUUID().slice(0, 8)}-${nomeSeguro(nome)}`
  const key = serviceKey()
  const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/upload/sign/attachments/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: '{}',
  })
  const j = await r.json().catch(() => null)
  if (!r.ok || !j?.url) return null
  return { path, url: `${process.env.SUPABASE_URL}/storage/v1${j.url}` }
}

// Arquivos enviados pelo portal: só os do próprio projeto, na pasta de pedidos.
function limparArquivos(projectId, lista) {
  if (!Array.isArray(lista)) return []
  return lista.slice(0, MAX_ARQUIVOS)
    .filter((a) => a && typeof a.path === 'string' && a.path.startsWith(`${projectId}/pedidos/`) && !a.path.includes('..'))
    .map((a) => ({ path: str(a.path, 300), name: str(a.name, 160) || 'arquivo', size: Number(a.size) || null, mime: str(a.mime, 80) || null }))
}

// Onde está cada pedido: na fila, recusado ou virou tarefa (status da tarefa e das subtarefas).
async function pedidosDoProjeto(projectId) {
  const origens = ORIGENS_DO_CLIENTE.map((o) => `"${o}"`).join(',')
  const { data } = await sb(`/tarefas_intake?project_id=eq.${projectId}&origem=in.(${encodeURIComponent(origens)})&select=id,titulo,origem,status,tarefa_id,motivo_recusa,payload,created_at,decidido_em,prioridade,adiado_ate&order=created_at.desc&limit=100`)
  const lista = Array.isArray(data) ? data : []
  const ids = [...new Set(lista.map((p) => p.tarefa_id).filter(Boolean))]
  const tarefas = {}
  if (ids.length) {
    const { data: ts } = await sb(`/tarefas_itens?or=(id.in.(${ids.join(',')}),parent_id.in.(${ids.join(',')}))&select=id,parent_id,titulo,status,status_tipo,data_vencimento,data_conclusao,arquivada`)
    for (const t of (Array.isArray(ts) ? ts : [])) {
      if (t.arquivada) continue
      const raiz = t.parent_id && ids.includes(t.parent_id) ? t.parent_id : t.id
      const alvo = (tarefas[raiz] ||= { status: null, concluida: false, vencimento: null, total: 0, feitas: 0 })
      if (t.id === raiz) {
        alvo.status = t.status
        alvo.concluida = t.status_tipo === 'closed'
        alvo.vencimento = t.data_vencimento ? String(t.data_vencimento).slice(0, 10) : null
        alvo.concluidaEm = t.data_conclusao || null
      } else {
        alvo.total += 1
        if (t.status_tipo === 'closed') alvo.feitas += 1
      }
    }
  }
  return lista.map((p) => {
    const t = p.tarefa_id ? tarefas[p.tarefa_id] : null
    const etapa = p.status === 'recusado' ? 'recusado'
      : !t ? (p.status === 'aceito' ? 'producao' : 'recebido')
        : t.concluida ? 'concluido' : 'producao'
    const pl = p.payload && typeof p.payload === 'object' ? p.payload : {}
    // Reprovação na aprovação: o título foi escrito para o time ("… reprovada pelo cliente").
    const titulo = String(p.titulo || '')
      .replace(/^Copy reprovada pelo cliente:\s*/i, 'Ajuste no texto: ')
      .replace(/^Anúncio reprovado pelo cliente:?\s*/i, 'Ajuste no anúncio: ')
      .replace(/^Landing page reprovada pelo cliente:?\s*/i, 'Ajuste na landing page: ')
      .replace(/: $/, '')
    return {
      id: p.id, titulo, origem: p.origem, etapa, criadoEm: p.created_at, decididoEm: p.decidido_em,
      // Urgente é o que o cliente marcou no pedido; a prioridade das reprovações é do time.
      urgente: !!pl.tipo && (p.prioridade === 'high' || p.prioridade === 'urgent'),
      tipo: pl.tipo || null, tipoNome: pl.tipo_nome || null, prazo: pl.prazo || null,
      itens: Array.isArray(pl.itens) ? pl.itens.slice(0, 40) : [],
      arquivos: Array.isArray(pl.arquivos) ? pl.arquivos.map((a) => ({ name: a.name, size: a.size })) : [],
      motivoRecusa: p.status === 'recusado' ? p.motivo_recusa || null : null,
      tarefa: t ? { status: t.status, vencimento: t.vencimento, concluidaEm: t.concluidaEm, subtarefas: t.total, feitas: t.feitas } : null,
    }
  })
}

async function prazosDosTemplates() {
  const nomes = TIPOS_PEDIDO.filter((t) => t.template).map((t) => t.template)
  const { data, status } = await sb(`/tarefas_modelos?nome=in.(${nomes.map((n) => `"${n}"`).join(',')})&select=nome,itens`)
  if (status !== 200 || !Array.isArray(data)) return {}
  const prazos = {}
  for (const tipo of TIPOS_PEDIDO) {
    const m = data.find((x) => x.nome === tipo.template)
    if (!m) continue
    const todos = (m.itens || []).flatMap((r) => [r, ...(r.subtarefas || [])])
    const publicar = todos.find((i) => /publicar|subir a p[áa]gina para a campanha/i.test(i.titulo || ''))
    const dias = Number(publicar?.vencimento_dia ?? Math.max(0, ...todos.map((i) => Number(i.vencimento_dia) || 0)))
    if (dias > 0) prazos[tipo.id] = dias + 1 // D+0 é o próprio dia de início
  }
  return prazos
}

// Abre o link sem login: pasta ou arquivo aberto devolve a página do Drive (200); fechado
// cai na tela de login do Google (ou 401/403); apagado ou errado dá 404/400.
// publico = null quando o Google não respondeu como esperado (não trava o envio).
async function conferirDrive(url) {
  const info = lerLinkDrive(url)
  if (!info) return null
  const alvo = info.natureza === 'pasta' ? `https://drive.google.com/drive/folders/${info.id}`
    : info.natureza === 'arquivo' ? `https://drive.google.com/file/d/${info.id}/view`
      : String(url).trim()
  try {
    const r = await fetch(alvo, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'accept-language': 'pt-BR,pt;q=0.9' },
      signal: AbortSignal.timeout(8000),
    })
    const host = (() => { try { return new URL(r.url).hostname } catch { return '' } })()
    const base = { natureza: info.natureza, conferido_em: new Date().toISOString() }
    if (host === 'accounts.google.com' || r.status === 401 || r.status === 403) return { ...base, publico: false, existe: true }
    if (r.status === 404 || r.status === 400) return { ...base, publico: false, existe: false }
    if (r.status !== 200) return { ...base, publico: null }
    const html = await r.text()
    if (/ServiceLogin|accounts\.google\.com\/v3\/signin/.test(html.slice(0, 4000)) && !/<title>[^<]*- Google (Drive|Docs|Sheets|Slides|Planilhas|Documentos|Apresentações)/.test(html)) {
      return { ...base, publico: false, existe: true }
    }
    const titulo = /<title>([^<]*)<\/title>/.exec(html)?.[1] || ''
    const nome = titulo.replace(/\s+-\s+Google (Drive|Docs|Sheets|Slides|Planilhas|Documentos|Apresentações)\s*$/i, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim().slice(0, 160)
    return { ...base, publico: true, existe: true, nome: nome && nome !== 'Google Drive' ? nome : '' }
  } catch {
    return { natureza: info.natureza, publico: null }
  }
}

// Só os campos que existem no tipo, cada um no formato esperado (texto cortado, listas de texto).
function limparRespostas(tipo, bruto) {
  const r = {}
  const src = bruto && typeof bruto === 'object' ? bruto : {}
  for (const c of [...tipo.campos, ...CAMPOS_FINAIS]) {
    if (c.tipo === 'aviso' || c.tipo === 'arquivos') continue // arquivos: limparArquivos, só no portal
    const v = src[c.k]
    if (c.tipo === 'multi') r[c.k] = Array.isArray(v) ? v.map((x) => str(x, 40)).slice(0, 10) : []
    else if (c.tipo === 'check') r[c.k] = v === true
    else if (v != null) r[c.k] = str(v, c.tipo === 'textarea' ? 3000 : c.max || 400)
    if (c.tipo === 'dinheiro') r[`${c.k}_periodo`] = src[`${c.k}_periodo`] === 'dia' ? 'dia' : 'mes'
  }
  return r
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight()
  if (!process.env.SUPABASE_URL) return json({ error: 'Servidor não configurado.' }, 500)

  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams
    const r0 = await resolverProjeto(req, str(q.get('token'), 60), str(q.get('projectId'), 60), false)
    if (r0.error) return json({ error: r0.error }, r0.status)
    const project = r0.project
    const drive = q.get('drive')
    if (drive != null) {
      const res = await conferirDrive(str(drive, 1000))
      if (!res) return json({ error: 'Esse não é um link do Google Drive.' }, 400)
      return json(res, 200)
    }
    const [prazos, pedidos] = await Promise.all([
      prazosDosTemplates().catch(() => ({})),
      r0.portal ? pedidosDoProjeto(project.id).catch(() => []) : Promise.resolve(undefined),
    ])
    return json({ empresa: project.company_name || '', prazos, ...(r0.portal ? { pedidos, podePedir: r0.nivel === 'edit' } : {}) }, 200)
  }

  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }
    const r0 = await resolverProjeto(req, str(body?.token, 60), str(body?.projectId, 60), true)
    if (r0.error) return json({ error: r0.error }, r0.status)
    const project = r0.project
    const origem = r0.portal ? ORIGEM_PORTAL : 'Cliente (link)'

    // Upload de arquivo (só pelo portal): devolve a URL assinada; o pedido leva o `path`.
    if (body?.acao === 'upload') {
      if (!r0.portal) return json({ error: 'Envio de arquivos só pelo portal.' }, 403)
      const tamanho = Number(body?.tamanho) || 0
      if (tamanho > LIMITE_ARQUIVO) return json({ error: 'Arquivo acima de 50 MB. Mande pelo link do Google Drive.' }, 413)
      const up = await urlDeUpload(project.id, str(body?.nome, 200))
      return up ? json(up, 200) : json({ error: 'Não consegui preparar o envio. Tente de novo.' }, 500)
    }

    const desde = new Date(Date.now() - 3600 * 1000).toISOString()
    const { data: recentes } = await sb(`/tarefas_intake?project_id=eq.${project.id}&origem=eq.${encodeURIComponent(origem)}&created_at=gte.${encodeURIComponent(desde)}&select=id`)
    if (Array.isArray(recentes) && recentes.length >= (r0.portal ? 20 : 8)) return json({ error: 'Muitos pedidos em pouco tempo. Tente de novo mais tarde.' }, 429)
    const origem_ref = `link:${project.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`

    // Formato antigo (página aberta antes da troca): resumo + detalhes + contato.
    if (!body?.tipo) {
      const titulo = str(body?.titulo, 200)
      if (titulo.length < 4) return json({ error: 'Descreva o pedido em poucas palavras.' }, 400)
      const ok = await registrarIntake({ project_id: project.id, titulo, descricao: str(body?.descricao, 3000), contato: str(body?.contato, 160), origem, origem_ref })
      return ok ? json({ success: true, titulo }, 200) : json({ error: 'Não consegui registrar agora. Tente de novo.' }, 500)
    }

    const tipo = TIPOS_PEDIDO_MAP[body.tipo]
    if (!tipo) return json({ error: 'Tipo de pedido inválido.' }, 400)
    const r = limparRespostas(tipo, body.respostas)
    // Arquivos só valem pelo portal (o link aberto não tem como subir nada).
    const arquivos = r0.portal ? limparArquivos(project.id, body?.respostas?.arquivos) : []
    r.arquivos = arquivos

    // Confere de novo cada link do Drive: o cliente pode ter fechado depois de colar.
    const drive = {}
    for (const c of camposVisiveis(tipo, r).filter((x) => x.tipo === 'drive' && r[x.k] && lerLinkDrive(r[x.k]))) {
      drive[c.k] = await conferirDrive(r[c.k])
    }
    const erros = validarPedido(tipo, r, { drive, comUpload: r0.portal })
    if (Object.keys(erros).length) return json({ error: 'Faltam informações no pedido.', erros }, 400)

    const pedido = montarPedido(tipo, r, { drive, via: r0.portal ? 'portal' : 'link' })
    const ok = await registrarIntake({
      project_id: project.id, titulo: pedido.titulo, descricao: pedido.descricao, contato: pedido.contato,
      prioridade: r.urgente ? 'high' : 'normal',
      origem, origem_ref,
      payload: { versao: 2, tipo: tipo.id, tipo_nome: tipo.nome, template: tipo.template || null, prazo: r.prazo || null, respostas: r, itens: pedido.itens, arquivos },
    })
    if (!ok) return json({ error: 'Não consegui registrar agora. Tente de novo.' }, 500)
    return json({ success: true, titulo: pedido.titulo }, 200)
  }

  return json({ error: 'Método não permitido.' }, 405)
}
