import { jsonCors, preflight, sb, serviceKey, NO_STORE } from './_http.js'
// Edge Function pública — link de visualização de um "Banco de dados" para o
// cliente: GET /api/banco-dados-public?t=<share_token>.
// Somente leitura. Devolve o nome do banco, a empresa, os campos visíveis
// (campos menos share_ocultos) e os registros com APENAS essas chaves — o
// payload cru extra, origem e status do CRM nunca saem daqui.
export const config = { runtime: 'edge' }

const PAGE = 1000
const MAX_REGISTROS = 10000

const json = (body, status = 200) => jsonCors(body, status, NO_STORE)

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'GET') return json({ error: 'Método não permitido.' }, 405)
  if (!process.env.SUPABASE_URL || !serviceKey()) return json({ error: 'Servidor não configurado.' }, 500)

  const token = new URL(req.url).searchParams.get('t') || ''
  if (!/^[a-f0-9]{24,64}$/i.test(token)) return json({ error: 'Link inválido.' }, 400)

  const { data: bancos, status } = await sb(
    `/bancos_dados?share_token=eq.${encodeURIComponent(token)}&select=id,nome,campos,share_ocultos,project_id`
  )
  if (status !== 200 || !Array.isArray(bancos) || !bancos.length) {
    return json({ error: 'Este link não existe mais. Peça um novo para o time.' }, 404)
  }
  const banco = bancos[0]

  const ocultos = new Set(banco.share_ocultos || [])
  const campos = (Array.isArray(banco.campos) ? banco.campos : [])
    .filter((c) => c?.key && !ocultos.has(c.key))
    .map((c) => ({ key: c.key, label: c.label || c.key, type: c.type || 'text' }))

  let empresa = ''
  if (banco.project_id) {
    const { data: p } = await sb(`/projects_v2?id=eq.${banco.project_id}&select=company_name`)
    empresa = Array.isArray(p) ? p[0]?.company_name || '' : ''
  }

  const registros = []
  for (let from = 0; from < MAX_REGISTROS; from += PAGE) {
    const { data, ok } = await sb(
      `/bancos_dados_registros?banco_id=eq.${banco.id}&select=id,dados,created_at&order=created_at.desc,id.desc`,
      { range: `${from}-${from + PAGE - 1}`, prefer: '' }
    )
    if (!ok || !Array.isArray(data)) return json({ error: 'Erro ao carregar os leads.' }, 500)
    for (const r of data) {
      const dados = {}
      for (const c of campos) {
        const v = r.dados?.[c.key]
        if (v !== undefined && v !== null && v !== '') dados[c.key] = typeof v === 'object' ? JSON.stringify(v) : String(v)
      }
      registros.push({ id: r.id, created_at: r.created_at, dados })
    }
    if (data.length < PAGE) break
  }

  return json({ nome: banco.nome, empresa, campos, registros, atualizadoEm: new Date().toISOString() })
}
