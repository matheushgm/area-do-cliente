import { getUser } from './_http.js'
// ADS Roadmap: lê a página "Roadmap Ads" do Playbook Operacional no ClickUp e
// devolve as tabelas por faixa de verba em JSON.
//
// GET /api/ads-roadmap            (Authorization: Bearer <JWT do usuário>)
// GET /api/ads-roadmap?refresh=1  ignora o cache de 5 min
//
// A página no ClickUp é a fonte única do texto das tabelas; os desenhos das
// estruturas continuam em src/lib/adsRoadmap.js (o doc só tem PNG deles).
//
// Formato da página (markdown do ClickUp):
//   # Orçamento até R$1.000        ← uma seção por faixa; o número vira o id ("1k")
//   <parágrafo opcional = resumo>
//   | Parâmetro | B2C | B2B |      ← tabela de 3 colunas; <br> vira quebra de linha
//   ![](imagem)                    ← ignorada
//
// Env: CLICKUP_API_TOKEN, CLICKUP_TEAM_ID (default 9009170774),
//      ADS_ROADMAP_DOC_ID / ADS_ROADMAP_PAGE_ID (defaults abaixo).

const DEFAULT_TEAM = '9009170774'
const DEFAULT_DOC = '8cfu2ap-40333'
const DEFAULT_PAGE = '8cfu2ap-33313'
const CACHE_MS = 5 * 60 * 1000

let cache = { at: 0, data: null }

function envClean(name) {
  return String(process.env[name] || '').replace(/\\n/g, '').trim()
}

async function validarJwt(req) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return { error: 'Servidor não configurado.', status: 500 }
  const auth = await getUser(req)
  return auth.ok ? { ok: true, user: auth.user } : { error: auth.message, status: 401 }
}

// ─── Parser do markdown ──────────────────────────────────────────────────────

// "# **Orçamento até R$1.000**" → { verbaMensal: 1000, ate: true }
function lerHeading(linha) {
  const texto = linha.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
  if (!/or[çc]amento/i.test(texto)) return null
  const m = texto.match(/R\$\s*([\d.\s]+)/i)
  if (!m) return null
  const n = parseInt(m[1].replace(/[.\s]/g, ''), 10)
  if (!n) return null
  return { titulo: texto, verbaMensal: n, ate: /(^|\s)at[ée](\s|$)/i.test(texto) }
}

function limparCelula(s) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\([[\]*_`])/g, '$1')
    .replace(/\*\*/g, '')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim()
}

// Divide uma linha "| a | b | c |" em células (sem tratar pipe escapado: o doc não usa).
function celulas(linha) {
  const t = linha.trim().replace(/^\|/, '').replace(/\|$/, '')
  return t.split('|').map(limparCelula)
}

export function parseRoadmap(md) {
  const linhas = md.split('\n')
  const faixas = []
  let atual = null
  let emTabela = false
  let cabecalhoVisto = false

  for (const raw of linhas) {
    const l = raw.trimEnd()
    if (/^#+\s*$/.test(l)) continue // heading vazio (placeholder deixado na página)
    if (/^#/.test(l)) {
      const h = lerHeading(l)
      atual = null
      emTabela = false
      cabecalhoVisto = false
      if (!h) continue
      atual = { id: `${h.verbaMensal / 1000}k`, verbaMensal: h.verbaMensal, ate: h.ate, titulo: h.titulo, resumo: '', rows: [] }
      faixas.push(atual)
      continue
    }
    if (!atual) continue
    if (l.trim().startsWith('|')) {
      if (!emTabela) { emTabela = true; cabecalhoVisto = false }
      if (/^\|\s*-{2,}/.test(l.trim()) || /^\|\s*:?-+/.test(l.trim())) continue // separador
      const cel = celulas(l)
      if (!cabecalhoVisto) { cabecalhoVisto = true; continue } // "| Parâmetro | B2C | B2B |"
      if (cel.length < 2) continue
      atual.rows.push([cel[0] || '', cel[1] || '', cel[2] || ''])
      continue
    }
    emTabela = false
    const txt = l.trim()
    if (!txt || txt.startsWith('![')) continue
    if (atual.rows.length === 0) atual.resumo = (atual.resumo ? atual.resumo + ' ' : '') + txt
  }

  // Sem duplicar faixa (se a página tiver duas seções com o mesmo valor, a última vence).
  const porId = new Map()
  for (const f of faixas) if (f.rows.length) porId.set(f.id, f)
  return [...porId.values()].sort((a, b) => a.verbaMensal - b.verbaMensal).map((f) => ({
    ...f,
    label: f.ate ? `Até R$ ${f.verbaMensal.toLocaleString('pt-BR')}` : `R$ ${f.verbaMensal.toLocaleString('pt-BR')}`,
    verbaDia: Math.floor(f.verbaMensal / 30),
  }))
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: { message: 'Method not allowed' } })
  const auth = await validarJwt(req)
  if (auth.error) return res.status(auth.status).json({ error: { message: auth.error } })

  const refresh = String(req.query?.refresh || '') === '1'
  if (!refresh && cache.data && Date.now() - cache.at < CACHE_MS) {
    return res.status(200).json({ ...cache.data, cached: true })
  }

  const token = envClean('CLICKUP_API_TOKEN')
  if (!token) return res.status(500).json({ error: { message: 'CLICKUP_API_TOKEN não configurado.' } })
  const team = envClean('CLICKUP_TEAM_ID') || DEFAULT_TEAM
  const doc = envClean('ADS_ROADMAP_DOC_ID') || DEFAULT_DOC
  const page = envClean('ADS_ROADMAP_PAGE_ID') || DEFAULT_PAGE

  try {
    const r = await fetch(
      `https://api.clickup.com/api/v3/workspaces/${team}/docs/${doc}/pages/${page}?content_format=text%2Fmd`,
      { headers: { Authorization: token } },
    )
    const json = await r.json().catch(() => null)
    if (!r.ok) {
      const msg = json?.err || `ClickUp respondeu ${r.status}`
      return res.status(502).json({ error: { message: msg } })
    }
    const faixas = parseRoadmap(String(json?.content || ''))
    const data = {
      faixas,
      pageName: json?.name || 'Roadmap Ads',
      updatedAt: json?.date_updated ? new Date(Number(json.date_updated)).toISOString() : null,
      url: `https://app.clickup.com/${team}/docs/${doc}/${page}`,
    }
    cache = { at: Date.now(), data }
    return res.status(200).json({ ...data, cached: false })
  } catch (e) {
    return res.status(502).json({ error: { message: e?.message || 'Erro ao ler o ClickUp' } })
  }
}
