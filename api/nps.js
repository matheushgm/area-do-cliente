import { jsonCors, preflight, sb, msg } from './_http.js'
// Public Edge Function — NPS por marco, validado por client_share_token
//
// Os marcos deixaram de ser uma lista fixa no código (marco1/marco2/marco3) e
// passaram a ser linhas em nps_marcos, criadas por cliente conforme a
// necessidade (migration 080). A validação do PATCH, por isso, não é mais
// "está na lista?" e sim "este marco pertence ao projeto deste token?".
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const json = jsonCors

async function projectByToken(token, select = 'id,company_name') {
  const { data, status } = await sb(
    `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=${select}`
  )
  if (status !== 200 || !Array.isArray(data) || !data.length) return null
  return data[0]
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight()

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: msg(req, { pt: 'Servidor não configurado.', en: 'Server not configured.' }) }, 500)
  }

  // ── GET — marcos do projeto pelo token ───────────────────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ error: msg(req, { pt: 'Token inválido.', en: 'Invalid token.' }) }, 400)

    const project = await projectByToken(token)
    if (!project) return json({ error: msg(req, { pt: 'Link inválido ou expirado.', en: 'This link is invalid or has expired.' }) }, 404)

    const { data: marcos } = await sb(
      `/nps_marcos?project_id=eq.${project.id}` +
      `&select=id,label,descricao,ordem,due_at,origem&order=ordem.asc`
    )
    const lista = Array.isArray(marcos) ? marcos : []

    // Só a contagem por marco — o cliente não deve ver o que os outros
    // respondentes escreveram.
    let contagem = {}
    if (lista.length) {
      const ids = lista.map(m => m.id).join(',')
      const { data: respostas } = await sb(
        `/nps_respostas?marco_id=in.(${ids})&select=marco_id`
      )
      if (Array.isArray(respostas)) {
        contagem = respostas.reduce((acc, r) => {
          acc[r.marco_id] = (acc[r.marco_id] || 0) + 1
          return acc
        }, {})
      }
    }

    const hoje = new Date().toISOString().slice(0, 10)

    return json({
      companyName: project.company_name,
      marcos: lista.map(m => ({
        id:        m.id,
        label:     m.label,
        descricao: m.descricao,
        ordem:     m.ordem,
        dueAt:     m.due_at,
        respostas: contagem[m.id] || 0,
        // Sem data prevista, o marco não se abre sozinho — só via link direto
        // (/nps/<token>?marco=<id>). Evita que um cliente de 3 meses veja o
        // formulário de 12.
        elegivel:  !!m.due_at && m.due_at <= hoje,
      })),
    })
  }

  // ── PATCH — registra a resposta de um respondente ────────────────────────
  if (req.method === 'PATCH') {
    let body
    try { body = await req.json() } catch { return json({ error: msg(req, { pt: 'JSON inválido.', en: 'Invalid JSON.' }) }, 400) }

    const { token, marcoId, data } = body
    if (!token || !marcoId || !data) return json({ error: msg(req, { pt: 'Dados incompletos.', en: 'Incomplete data.' }) }, 400)

    const score = Number(data.score)
    if (!Number.isInteger(score) || score < 0 || score > 10) {
      return json({ error: msg(req, { pt: 'Nota inválida.', en: 'Invalid score.' }) }, 400)
    }

    const project = await projectByToken(token, 'id')
    if (!project) return json({ error: msg(req, { pt: 'Token inválido.', en: 'Invalid token.' }) }, 404)

    // O marco tem que ser deste projeto — é o que substitui a antiga lista fixa
    const { data: marcos } = await sb(
      `/nps_marcos?id=eq.${encodeURIComponent(marcoId)}` +
      `&project_id=eq.${project.id}&select=id`
    )
    if (!Array.isArray(marcos) || !marcos.length) {
      return json({ error: msg(req, { pt: 'Marco inválido.', en: 'Invalid milestone.' }) }, 400)
    }

    // INSERT, não read-modify-write do JSONB inteiro: dois respondentes
    // enviando ao mesmo tempo não se sobrescrevem mais.
    const { status, data: res } = await sb('/nps_respostas', {
      method: 'POST',
      prefer: 'return=minimal',
      body:   JSON.stringify({
        marco_id:     marcoId,
        score,
        nome:         data.name     || null,
        email:        data.email    || null,
        telefone:     data.phone    || null,
        q2: data.q2 || null, q3: data.q3 || null, q4: data.q4 || null,
        q5: data.q5 || null, q6: data.q6 || null,
        submitted_at: data.submittedAt || new Date().toISOString(),
      }),
    })
    if (status >= 400) return json({ error: msg(req, { pt: 'Erro ao salvar.', en: 'Could not save.' }), detail: res }, 500)

    return json({ success: true })
  }

  return json({ error: msg(req, { pt: 'Método não permitido.', en: 'Method not allowed.' }) }, 405)
}
