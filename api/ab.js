import { jsonCors, preflight, sb } from './_http.js'
import { carregarTeste, registrarConversao, conversaoAceita } from './_ab.js'
// Endpoint público dos testes A/B das landing pages (chamado pelo kit /ab.js).
//
// GET  /api/ab?e=<slug>  → configuração do teste: status, tipo e variantes com
//                          peso e conteúdo. Vai para a CDN por 30 s: mudar o peso
//                          ou pausar chega às LPs em até ~1 min.
// POST /api/ab           → evento { e, v, vis, t: 'impressao'|'conversao', o, p, u, d }
//                          (aceita text/plain, que é o que o sendBeacon manda).
//
// O navegador nunca escreve direto nas tabelas ab_*: tudo passa por aqui, com a
// chave de serviço, e só para teste com status 'rodando'.

export const config = { runtime: 'edge' }

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|monitor|curl|wget|python|axios|node-fetch/i
const corta = (s, n = 300) => (s == null ? null : String(s).slice(0, n))

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method === 'GET') return config_(req)
  if (req.method === 'POST') return evento(req)
  return jsonCors({ error: 'Método não permitido.' }, 405)
}

async function config_(req) {
  const slug = new URL(req.url).searchParams.get('e')
  if (!slug) return jsonCors({ error: 'Parâmetro e ausente.' }, 400)
  const teste = await carregarTeste(slug)
  if (!teste) return jsonCors({ error: 'Teste não encontrado.' }, 404, { 'Cache-Control': 'public, s-maxage=30' })

  // O conteúdo das variantes não é segredo (vai aparecer na página), então a
  // resposta é a mesma para todo mundo e pode ficar na CDN.
  return jsonCors({
    e: teste.slug,
    status: teste.status,
    tipo: teste.tipo,
    conversao: teste.conversao,
    vencedor: teste.vencedor_id || null,
    variantes: teste.variantes.map((v) => ({
      id: v.id, nome: v.nome, codigo: v.codigo, peso: v.peso, original: v.original,
      conteudo: v.conteudo || {}, url: v.url || null,
    })),
  }, 200, { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' })
}

async function evento(req) {
  const ua = req.headers.get('user-agent') || ''
  if (BOT.test(ua)) return jsonCors({ ok: true, ignorado: 'bot' })

  let b
  try { b = JSON.parse(await req.text()) } catch { return jsonCors({ error: 'Corpo inválido.' }, 400) }
  const { e, v, vis, t } = b || {}
  if (!e || !v || !vis || !['impressao', 'conversao'].includes(t)) {
    return jsonCors({ error: 'Campos obrigatórios: e, v, vis, t.' }, 400)
  }

  const teste = await carregarTeste(e)
  if (!teste) return jsonCors({ error: 'Teste não encontrado.' }, 404)
  if (teste.status !== 'rodando') return jsonCors({ ok: true, ignorado: 'teste não está rodando' })
  if (!teste.variantes.some((x) => x.id === v)) return jsonCors({ ok: true, ignorado: 'variante desconhecida' })

  const u = b.u || {}
  const linha = {
    experimento_id: teste.id,
    variante_id: v,
    visitante: corta(vis, 64),
    pagina: corta(b.p, 500),
    utm_source: corta(u.utm_source, 200),
    utm_medium: corta(u.utm_medium, 200),
    utm_campaign: corta(u.utm_campaign, 300),
    utm_content: corta(u.utm_content, 300),
    dispositivo: b.d === 'mobile' ? 'mobile' : 'desktop',
  }

  if (t === 'impressao') {
    const r = await sb('/ab_eventos', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ ...linha, tipo: 'impressao' }) })
    if (!r.ok) return jsonCors({ error: 'Erro ao gravar.' }, 500)
    return jsonCors({ ok: true })
  }

  const origem = b.o === 'clique' ? 'clique' : 'lead'
  if (!conversaoAceita(teste, origem)) return jsonCors({ ok: true, ignorado: `teste não conta ${origem}` })
  const r = await registrarConversao(teste, { ...linha, origem })
  if (!r.ok) return jsonCors({ error: 'Erro ao gravar.' }, 500)
  return jsonCors({ ok: true, repetida: r.repetida || false })
}
