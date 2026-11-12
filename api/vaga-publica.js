import { NO_STORE, jsonCors, preflight, sb } from './_http.js'
import { calcularTriagem, limparRespostas, telefoneE164, triagemDoCargo, validarRespostas } from '../src/lib/triagemVaga.js'
// Edge Function pública: FORMULÁRIO DA VAGA (/vaga/:cargo), primeira etapa da Contratação.
// Sem login. A regra (perguntas, pontos, cortes) mora em src/lib/triagemVaga.js; aqui só
// valida de novo, calcula a triagem e grava no candidato com a chave de serviço.
//   GET  ?cargo=gestor-trafego[&ref=<candidato_id>] → { vaga, nome?, respondido? }
//   POST { cargo, ref?, respostas, site? }          → { success: true }
// Quem é o candidato: o ref do link do WhatsApp; senão o mesmo e-mail ou o mesmo celular
// (8 últimos dígitos) no cargo; senão um candidato novo com status 'inscrito'.
// A pessoa nunca vê a própria pontuação. Limite: 40 respostas por hora no cargo.
export const config = { runtime: 'edge' }

const json = (body, status) => jsonCors(body, status, NO_STORE)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CAMPOS = 'id,nome,email,telefone,cidade,linkedin,pretensao_salarial,status,triagem'

async function candidatoPorRef(cargo, ref) {
  if (!UUID_RE.test(ref || '')) return null
  const { data } = await sb(`/contratacao_candidatos?id=eq.${ref}&cargo=eq.${encodeURIComponent(cargo)}&select=${CAMPOS}`)
  return Array.isArray(data) && data[0] ? data[0] : null
}

async function candidatoPorContato(cargo, email, telefone) {
  const c = encodeURIComponent(cargo)
  if (email) {
    const { data } = await sb(`/contratacao_candidatos?cargo=eq.${c}&email=ilike.${encodeURIComponent(email.replace(/[\\%_]/g, '\\$&'))}&select=${CAMPOS}&order=created_at.asc&limit=1`)
    if (Array.isArray(data) && data[0]) return data[0]
  }
  const fim = (telefone || '').replace(/\D/g, '').slice(-8)
  if (fim.length === 8) {
    const { data } = await sb(`/contratacao_candidatos?cargo=eq.${c}&telefone=like.*${fim}&select=${CAMPOS}&order=created_at.asc&limit=1`)
    if (Array.isArray(data) && data[0]) return data[0]
  }
  return null
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight()
  if (!process.env.SUPABASE_URL) return json({ error: 'Servidor não configurado.' }, 500)

  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams
    const triagem = triagemDoCargo(q.get('cargo'))
    if (!triagem) return json({ error: 'Esta vaga não existe ou já foi encerrada.' }, 404)
    const cand = await candidatoPorRef(triagem.cargo, q.get('ref'))
    return json({
      vaga: triagem.vaga,
      nome: cand?.nome || '',
      respondido: !!cand?.triagem?.respondido_em,
    }, 200)
  }

  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }
    const triagem = triagemDoCargo(body?.cargo)
    if (!triagem) return json({ error: 'Esta vaga não existe ou já foi encerrada.' }, 404)
    // Campo escondido: robô preenche, gente não vê. Finge que deu certo.
    if (body?.site) return json({ success: true }, 200)

    const r = limparRespostas(triagem, body?.respostas)
    const erros = validarRespostas(triagem, r)
    if (Object.keys(erros).length) return json({ error: 'Faltam respostas no formulário.', erros }, 400)

    const desde = new Date(Date.now() - 3600 * 1000).toISOString()
    const { data: recentes } = await sb(`/contratacao_candidatos?cargo=eq.${encodeURIComponent(triagem.cargo)}&triagem->>respondido_em=gte.${encodeURIComponent(desde)}&select=id`)
    if (Array.isArray(recentes) && recentes.length >= 40) return json({ error: 'Muitas respostas em pouco tempo. Tente de novo daqui a pouco.' }, 429)

    const res = calcularTriagem(triagem, r)
    const agora = new Date().toISOString()
    const telefone = telefoneE164(r.telefone)
    const dados = {
      versao: 1,
      respostas: r,
      pontos: res.pontos,
      resultado: res.resultado,
      eliminatorias: res.eliminatorias,
      alertas: res.alertas,
      por_pergunta: res.porPergunta,
      respondido_em: agora,
    }

    let cand = await candidatoPorRef(triagem.cargo, body?.ref)
    if (!cand) cand = await candidatoPorContato(triagem.cargo, r.email, telefone)

    if (cand) {
      // Contato que estava vazio é preenchido; o que o time já tinha não é trocado.
      const patch = { triagem: dados, updated_at: agora }
      if (!cand.email && r.email) patch.email = r.email
      if (!cand.telefone && telefone) patch.telefone = telefone
      if (!cand.cidade && r.cidade) patch.cidade = r.cidade
      if (!cand.linkedin && r.linkedin) patch.linkedin = r.linkedin
      if (!cand.pretensao_salarial && r.pretensao) patch.pretensao_salarial = r.pretensao
      // Respondeu de novo: guarda a anterior junto.
      if (cand.triagem?.respondido_em) patch.triagem = { ...dados, anteriores: [...(cand.triagem.anteriores || []), { ...cand.triagem, anteriores: undefined }].slice(-5) }
      const { ok } = await sb(`/contratacao_candidatos?id=eq.${cand.id}`, { method: 'PATCH', body: JSON.stringify(patch), prefer: 'return=minimal' })
      if (!ok) return json({ error: 'Não consegui registrar agora. Tente de novo.' }, 500)
      return json({ success: true }, 200)
    }

    const { ok } = await sb('/contratacao_candidatos', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        cargo: triagem.cargo,
        nome: r.nome,
        email: r.email || null,
        telefone,
        cidade: r.cidade || null,
        linkedin: r.linkedin || null,
        pretensao_salarial: r.pretensao || null,
        status: 'inscrito',
        triagem: dados,
        created_by: null,
      }),
    })
    if (!ok) return json({ error: 'Não consegui registrar agora. Tente de novo.' }, 500)
    return json({ success: true }, 200)
  }

  return json({ error: 'Método não permitido.' }, 405)
}
