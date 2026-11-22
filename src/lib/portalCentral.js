// Central de anúncios do portal do cliente: junta o que vem de duas aprovações numa lista só.
//   • roteiros = copies das levas (api/copy-aprovacao.js): roteiro de vídeo ou texto de arte;
//   • imagens e vídeos = peças prontas enviadas pra aprovação (api/anuncios-aprovacao.js);
//   • páginas = landing pages enviadas pra aprovação (mesma API das peças).
// Puro, sem React: a tela só desenha o que sai daqui.

export const CATEGORIAS = [
  { id: 'roteiro', label: 'Roteiros', singular: 'roteiro' },
  { id: 'imagem', label: 'Imagens', singular: 'imagem' },
  { id: 'video', label: 'Vídeos', singular: 'vídeo' },
  { id: 'lp', label: 'Landing pages', singular: 'landing page' },
]

export const STATUS = {
  pendente: { label: 'Para aprovar', cor: '#B45309', fundo: '#FEF3C7' },
  aprovado: { label: 'Aprovado', cor: '#15803D', fundo: '#D1FAE5' },
  reprovado: { label: 'Pedido de ajuste', cor: '#B91C1C', fundo: '#FEE2E2' },
}

const statusValido = (s) => (s === 'aprovado' || s === 'reprovado' ? s : 'pendente')

// Imagem ou vídeo pelo arquivo; sem arquivo, pelo tipo do cadastro (o padrão do cadastro é
// "vídeo", por isso o arquivo manda). Carrossel conta como imagem.
export function categoriaDaPeca(ad) {
  const arqs = [...(ad?.arquivos || []), ...(ad?.attachmentUrl ? [{ mediaKind: ad.mediaKind }] : [])]
  if (arqs.some((a) => a?.mediaKind === 'video')) return 'video'
  if (arqs.some((a) => a?.mediaKind === 'image')) return 'imagem'
  return ad?.tipo === 'video' ? 'video' : 'imagem'
}

const mesDe = (iso) => (/^\d{4}-\d{2}/.test(String(iso || '')) ? String(iso).slice(0, 7) : null)

export function montarCentral({ ads = [], lps = [], levas = [] } = {}) {
  const itens = []
  for (const leva of levas) {
    for (const it of leva.itens || []) {
      const st = statusValido(it.aprovacao?.status)
      itens.push({
        kind: 'copy', categoria: 'roteiro',
        id: `${leva.id}:${it.id}`, levaId: leva.id, itemId: it.id,
        titulo: it.titulo || 'Roteiro',
        // Há levas de roteiro gravadas como "estatico": o rótulo GANCHO no texto decide.
        formato: leva.tipo === 'video' || /\bgancho\b/i.test(it.conteudo || '') ? 'Roteiro de vídeo' : 'Texto de arte',
        grupo: leva.nome || null,
        conteudo: it.conteudo || '',
        status: st,
        editado: !!it.aprovacao?.editado,
        motivo: it.aprovacao?.motivo || null,
        sugestao: it.aprovacao?.sugestao || null,
        enviadoEm: leva.enviadoEm || null,
        decididoEm: it.aprovacao?.decididoEm || null,
      })
    }
  }
  for (const ad of ads) {
    const st = statusValido(ad.aprovacao?.status)
    const arquivos = (ad.arquivos || []).filter((a) => a?.url)
    if (!arquivos.length && ad.attachmentUrl) arquivos.push({ url: ad.attachmentUrl, mediaKind: ad.mediaKind, name: ad.attachmentName })
    itens.push({
      kind: 'ad', categoria: categoriaDaPeca(ad),
      id: ad.id, titulo: ad.nome || 'Anúncio',
      formato: ad.tipo === 'carrossel' ? 'Carrossel' : null,
      grupo: ad.pasta || null,
      arquivos, link: ad.url || null, observacao: ad.observacao || null, copy: ad.copy || null,
      versao: ad.version || 1, historico: ad.versionHistory || [],
      status: st,
      motivo: ad.aprovacao?.motivo || null,
      sugestao: ad.aprovacao?.sugestao || null,
      enviadoEm: ad.aprovacao?.enviadoEm || ad.createdAt || null,
      decididoEm: ad.aprovacao?.decididoEm || null,
    })
  }
  for (const lp of lps) {
    itens.push({
      kind: 'lp', categoria: 'lp',
      id: lp.id, titulo: lp.nome || 'Landing page',
      link: lp.url || null, observacao: lp.observacao || null,
      status: statusValido(lp.aprovacao?.status),
      motivo: lp.aprovacao?.motivo || null,
      sugestao: lp.aprovacao?.sugestao || null,
      enviadoEm: lp.aprovacao?.enviadoEm || lp.createdAt || null,
      decididoEm: lp.aprovacao?.decididoEm || null,
    })
  }
  // mais novo primeiro
  itens.sort((a, b) => String(b.enviadoEm || '').localeCompare(String(a.enviadoEm || '')))
  return itens.map((it) => ({ ...it, mes: mesDe(it.status === 'pendente' ? it.enviadoEm : it.decididoEm || it.enviadoEm) }))
}

// Meses com alguma coisa, do mais novo pro mais antigo (sempre com o mês atual).
export function mesesDaCentral(itens, hoje = new Date()) {
  const atual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  return [...new Set([atual, ...itens.map((i) => i.mes).filter(Boolean)])].sort().reverse()
}

export function nomeDoMes(chave, { curto = false } = {}) {
  const [a, m] = String(chave || '').split('-').map(Number)
  if (!a || !m) return 'Sem data'
  const nome = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: curto ? 'short' : 'long' }).replace('.', '')
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}${curto ? '' : ` de ${a}`}`
}

// O que a tela mostra num mês: pendente entra sempre (de qualquer mês, esperando o cliente);
// aprovado e pedido de ajuste entram no mês em que foram decididos. `mes` null = todos.
export function noMes(item, mes) {
  if (!mes || item.status === 'pendente') return true
  return item.mes === mes
}

// Contagem por categoria (e total) no mês: { roteiro: { pendente, aprovado, reprovado, total } … }
export function contarCentral(itens, mes) {
  const out = { todos: { pendente: 0, aprovado: 0, reprovado: 0, total: 0 } }
  for (const c of CATEGORIAS) out[c.id] = { pendente: 0, aprovado: 0, reprovado: 0, total: 0 }
  for (const it of itens) {
    if (!noMes(it, mes)) continue
    for (const k of [it.categoria, 'todos']) {
      out[k][it.status] += 1
      out[k].total += 1
    }
  }
  return out
}

// Data curta "12/11" (ou "12/11/2025" de outro ano).
export function dataCurta(iso) {
  const d = iso ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  const mesmoAno = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('pt-BR', mesmoAno ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' })
}
