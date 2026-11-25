import { sb } from './_http.js'
// Helpers dos testes A/B, usados por /api/ab e /api/lead-capture.

// Teste pelo slug, com as variantes ativas (não arquivadas) em ordem.
export async function carregarTeste(slug) {
  const sel = 'id,slug,status,tipo,conversao,vencedor_id,ab_variantes!ab_variantes_experimento_id_fkey(id,nome,peso,original,conteudo,url,ordem,arquivada)'
  const { data, ok } = await sb(`/ab_experimentos?slug=eq.${encodeURIComponent(slug)}&select=${sel}`)
  if (!ok || !Array.isArray(data) || !data.length) return null
  const t = data[0]
  const variantes = (t.ab_variantes || [])
    .filter((v) => !v.arquivada)
    .sort((a, b) => (b.original - a.original) || (a.ordem - b.ordem))
  return { ...t, variantes }
}

// O teste conta este tipo de conversão? ('todas' conta lead e clique)
export function conversaoAceita(teste, origem) {
  return teste.conversao === 'todas' || teste.conversao === origem
}

// Grava a conversão. Uma por visitante por teste (índice único parcial): a
// segunda chega como 409 e não infla. Se a primeira veio sem o lead (o kit
// viu o evento Lead do GTM antes) e esta traz o registro, liga o registro nela.
export async function registrarConversao(teste, linha) {
  const r = await sb('/ab_eventos', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({ ...linha, tipo: 'conversao' }),
  })
  if (r.ok) return { ok: true }
  if (r.status !== 409) return { ok: false }
  if (linha.registro_id) {
    const filtro = `experimento_id=eq.${teste.id}&visitante=eq.${encodeURIComponent(linha.visitante)}&tipo=eq.conversao&registro_id=is.null`
    await sb(`/ab_eventos?${filtro}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ registro_id: linha.registro_id, origem: 'lead' }),
    })
  }
  return { ok: true, repetida: true }
}

// Lead-capture: o kit põe `_ab` no corpo do formulário ([{ e, v, vis }] ou a
// mesma lista em texto, no caso de <form> nativo). Liga cada teste ao lead.
export async function conversoesDoLead(abRaw, registroId, pagina) {
  let lista = abRaw
  if (typeof lista === 'string') { try { lista = JSON.parse(lista) } catch { return } }
  if (!Array.isArray(lista)) lista = lista ? [lista] : []
  for (const item of lista.slice(0, 5)) {
    const { e, v, vis, d, u = {} } = item || {}
    if (!e || !v || !vis) continue
    const teste = await carregarTeste(String(e))
    if (!teste || teste.status !== 'rodando') continue
    if (!teste.variantes.some((x) => x.id === v)) continue
    if (!conversaoAceita(teste, 'lead')) continue
    await registrarConversao(teste, {
      experimento_id: teste.id,
      variante_id: v,
      visitante: String(vis).slice(0, 64),
      origem: 'lead',
      registro_id: registroId || null,
      pagina: pagina ? String(pagina).slice(0, 500) : null,
      dispositivo: d === 'mobile' ? 'mobile' : d === 'desktop' ? 'desktop' : null,
      utm_source: u.utm_source ? String(u.utm_source).slice(0, 200) : null,
      utm_medium: u.utm_medium ? String(u.utm_medium).slice(0, 200) : null,
      utm_campaign: u.utm_campaign ? String(u.utm_campaign).slice(0, 300) : null,
      utm_content: u.utm_content ? String(u.utm_content).slice(0, 300) : null,
    })
  }
}
