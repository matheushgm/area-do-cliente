import { NO_STORE, jsonCors, preflight, sb } from './_http.js'
import { registrarIntake } from './_intake.js'
import { CAMPOS_FINAIS, TIPOS_PEDIDO, TIPOS_PEDIDO_MAP, camposVisiveis, lerLinkDrive, montarPedido, validarPedido } from '../src/lib/pedidoTipos.js'
// Edge Function pública — PEDIDO DO CLIENTE para a fila de Intake do VertaTask.
// Sem login: o link /pedido/:token usa o client_share_token do projeto (o mesmo das
// outras páginas públicas). Os tipos e campos vêm de src/lib/pedidoTipos.js.
//   GET  ?token=UUID                       → { empresa, prazos: { tipo: dias úteis } }
//   GET  ?token=UUID&drive=URL             → { publico, existe, nome, natureza } (link do Drive aberto?)
//   POST { token, tipo, respostas }        → confere de novo os links do Drive e cria o pedido pendente
// Limite: 8 pedidos por hora por cliente, para o link aberto não virar spam.
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
    if (c.tipo === 'aviso') continue
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
    const project = await findProject(str(q.get('token'), 60))
    if (!project) return json({ error: 'Link inválido ou expirado.' }, 404)
    const drive = q.get('drive')
    if (drive != null) {
      const res = await conferirDrive(str(drive, 1000))
      if (!res) return json({ error: 'Esse não é um link do Google Drive.' }, 400)
      return json(res, 200)
    }
    return json({ empresa: project.company_name || '', prazos: await prazosDosTemplates().catch(() => ({})) }, 200)
  }

  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }
    const project = await findProject(str(body?.token, 60))
    if (!project) return json({ error: 'Link inválido ou expirado.' }, 404)

    const desde = new Date(Date.now() - 3600 * 1000).toISOString()
    const { data: recentes } = await sb(`/tarefas_intake?project_id=eq.${project.id}&origem=eq.${encodeURIComponent('Cliente (link)')}&created_at=gte.${encodeURIComponent(desde)}&select=id`)
    if (Array.isArray(recentes) && recentes.length >= 8) return json({ error: 'Muitos pedidos em pouco tempo. Tente de novo mais tarde.' }, 429)
    const origem_ref = `link:${project.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`

    // Formato antigo (página aberta antes da troca): resumo + detalhes + contato.
    if (!body?.tipo) {
      const titulo = str(body?.titulo, 200)
      if (titulo.length < 4) return json({ error: 'Descreva o pedido em poucas palavras.' }, 400)
      const ok = await registrarIntake({ project_id: project.id, titulo, descricao: str(body?.descricao, 3000), contato: str(body?.contato, 160), origem: 'Cliente (link)', origem_ref })
      return ok ? json({ success: true, titulo }, 200) : json({ error: 'Não consegui registrar agora. Tente de novo.' }, 500)
    }

    const tipo = TIPOS_PEDIDO_MAP[body.tipo]
    if (!tipo) return json({ error: 'Tipo de pedido inválido.' }, 400)
    const r = limparRespostas(tipo, body.respostas)

    // Confere de novo cada link do Drive: o cliente pode ter fechado depois de colar.
    const drive = {}
    for (const c of camposVisiveis(tipo, r).filter((x) => x.tipo === 'drive' && r[x.k] && lerLinkDrive(r[x.k]))) {
      drive[c.k] = await conferirDrive(r[c.k])
    }
    const erros = validarPedido(tipo, r, { drive })
    if (Object.keys(erros).length) return json({ error: 'Faltam informações no pedido.', erros }, 400)

    const pedido = montarPedido(tipo, r, { drive })
    const ok = await registrarIntake({
      project_id: project.id, titulo: pedido.titulo, descricao: pedido.descricao, contato: pedido.contato,
      prioridade: r.urgente ? 'high' : 'normal',
      origem: 'Cliente (link)', origem_ref,
      payload: { versao: 2, tipo: tipo.id, tipo_nome: tipo.nome, template: tipo.template || null, prazo: r.prazo || null, respostas: r, itens: pedido.itens },
    })
    if (!ok) return json({ error: 'Não consegui registrar agora. Tente de novo.' }, 500)
    return json({ success: true, titulo: pedido.titulo }, 200)
  }

  return json({ error: 'Método não permitido.' }, 405)
}
