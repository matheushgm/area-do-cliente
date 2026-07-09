// Edge Function pública pra ferramenta de Precificação preenchível pelo cliente.
// Validação SÓ pelo client_share_token (sem JWT). GET (carregar) + PATCH (salvar).
// Lê/escreve o campo JSONB `precificacao` de projects_v2 — a mesma coluna usada
// pela ferramenta interna, então o que o cliente preenche aparece direto na
// Área do Cliente do time (via realtime em projects_v2).
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         opts.prefer || 'return=representation',
      ...opts.extraHeaders,
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { data, status: res.status }
}

// ── Sanitização ────────────────────────────────────────────────────────────
// Só aceita os campos esperados por cada modo, coage numéricos e limita tamanhos.
// Impede que o link público injete lixo ou payloads gigantes no JSONB.
function num(v) {
  if (v === '' || v == null) return ''
  const x = Number(v)
  return Number.isFinite(x) ? x : ''
}
function str(v, max = 200) {
  return String(v == null ? '' : v).slice(0, max)
}

const COLAB_FIELDS   = ['salarioMensal', 'encargosPct', 'cargaHorariaMensal', 'horasDedicadas']
const PRODUTO_FIELDS = ['custoProduto', 'custosAdicionais', 'impostoPct', 'margemPct']

function baseItem(raw) {
  return {
    id:        str(raw?.id || crypto.randomUUID(), 60),
    nome:      str(raw?.nome, 200),
    createdAt: str(raw?.createdAt, 40) || null,
    updatedAt: str(raw?.updatedAt, 40) || null,
  }
}

function sanitizeColaborador(raw) {
  const c = {
    id:   str(raw?.id || crypto.randomUUID(), 60),
    nome: str(raw?.nome, 200),
  }
  for (const f of COLAB_FIELDS) c[f] = num(raw?.[f])
  return c
}

// Serviço = N colaboradores (custeados à parte) + custos fixos/imposto/margem.
// Migra o formato antigo (campos flat de 1 colaborador) pra lista de 1.
function sanitizeServico(raw) {
  const item = baseItem(raw)
  let lista = Array.isArray(raw?.colaboradores) ? raw.colaboradores : null
  if (!lista || !lista.length) {
    lista = [{
      nome:               '',
      salarioMensal:      raw?.salarioMensal,
      encargosPct:        raw?.encargosPct,
      cargaHorariaMensal: raw?.cargaHorariaMensal,
      horasDedicadas:     raw?.horasDedicadas,
    }]
  }
  item.colaboradores = lista.slice(0, 50).map(sanitizeColaborador)
  item.custosFixos   = num(raw?.custosFixos)
  item.impostoPct    = num(raw?.impostoPct)
  item.margemPct     = num(raw?.margemPct)
  return item
}

function sanitizeProduto(raw) {
  const item = baseItem(raw)
  for (const f of PRODUTO_FIELDS) item[f] = num(raw?.[f])
  return item
}

// SaaS = implantação (opcional) + recorrência (por usuário/ilimitado) + ciclo de vida.
const SAAS_NUM_FIELDS = [
  'custoHoraHomem', 'horasImplantacao', 'margemImplantacaoPct',
  'numUsuarios', 'custoMensalConta', 'custoMensalUsuario',
  'tempoMedioAtivoMeses', 'impostoPct', 'margemPct',
]
function sanitizeSaas(raw) {
  const item = baseItem(raw)
  item.temImplantacao = !!raw?.temImplantacao
  item.modeloCobranca = raw?.modeloCobranca === 'ilimitado' ? 'ilimitado' : 'por_usuario'
  for (const f of SAAS_NUM_FIELDS) item[f] = num(raw?.[f])
  return item
}

function sanitizePrecificacao(raw) {
  const servicos = Array.isArray(raw?.servicos) ? raw.servicos.slice(0, 200) : []
  const produtos = Array.isArray(raw?.produtos) ? raw.produtos.slice(0, 200) : []
  const saas     = Array.isArray(raw?.saas)     ? raw.saas.slice(0, 200)     : []
  return {
    servicos: servicos.map(sanitizeServico),
    produtos: produtos.map(sanitizeProduto),
    saas:     saas.map(sanitizeSaas),
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Servidor não configurado.' }, 500)
  }

  // ── GET — carrega a precificação pelo token ───────────────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ error: 'Token inválido.' }, 400)

    const { data: projects, status } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=company_name,precificacao`
    )
    if (status !== 200 || !Array.isArray(projects) || !projects.length) {
      return json({ error: 'Link inválido ou expirado.' }, 404)
    }
    return json({
      companyName:  projects[0].company_name || '',
      precificacao: sanitizePrecificacao(projects[0].precificacao || {}),
    })
  }

  // ── PATCH — salva a precificação ──────────────────────────────────────────
  if (req.method === 'PATCH') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

    const { token, precificacao } = body
    if (!token || !precificacao) return json({ error: 'Dados incompletos.' }, 400)

    const { data: projects } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id`
    )
    if (!Array.isArray(projects) || !projects.length) {
      return json({ error: 'Token inválido.' }, 404)
    }
    const pid = projects[0].id

    const clean = sanitizePrecificacao(precificacao)

    const { status, data } = await sb(
      `/projects_v2?id=eq.${encodeURIComponent(pid)}`,
      { method: 'PATCH', body: JSON.stringify({ precificacao: clean }) }
    )
    if (status >= 400) return json({ error: 'Erro ao salvar.', detail: data }, 500)

    return json({ success: true })
  }

  return json({ error: 'Método não permitido.' }, 405)
}
