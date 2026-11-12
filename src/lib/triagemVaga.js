// Formulário público da vaga (/vaga/:cargo) e a primeira triagem automática.
//
// Lido pela página pública (src/pages/VagaPublica.jsx), pelo servidor (api/vaga-publica.js,
// que valida e calcula de novo) e pelas telas internas da Contratação. Sem React, sem i18n:
// a API importa este arquivo.
//
// A triagem soma pontos por resposta e normaliza para 0 a 100:
//   Avança ≥ 60 · Talvez 35 a 59 · Não avança < 35.
// Pergunta com `elimina` tira a pessoa do processo seja qual for a pontuação
// (ex.: não pode trabalhar presencial). Mudar régua = mudar só este arquivo.

export const RESULTADOS_TRIAGEM = [
  { id: 'avanca', rotulo: 'Avança', cor: 'green' },
  { id: 'talvez', rotulo: 'Talvez', cor: 'gold' },
  { id: 'nao_avanca', rotulo: 'Não avança', cor: 'red' },
]
export const CORTE_AVANCA = 60
export const CORTE_TALVEZ = 35

// Dados de contato: viram colunas do candidato (nome, email, telefone, cidade, linkedin).
export const CAMPOS_CONTATO = [
  { k: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true, max: 120 },
  { k: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, max: 160 },
  { k: 'telefone', rotulo: 'WhatsApp', tipo: 'telefone', obrigatorio: true },
  { k: 'cidade', rotulo: 'Cidade onde mora', tipo: 'texto', obrigatorio: true, max: 80 },
  { k: 'linkedin', rotulo: 'LinkedIn ou portfólio', tipo: 'texto', max: 300, ajuda: 'Opcional' },
]

const GESTOR_TRAFEGO = {
  cargo: 'gestor-trafego',
  vaga: 'Gestor de Tráfego',
  titulo: 'Vaga de Gestor(a) de Tráfego Pago',
  local: 'Goiânia, presencial',
  intro: 'Leva uns 5 minutos. As respostas vão direto para quem está contratando, então responda do jeito que é hoje, sem enfeitar. Quem passar desta etapa é chamado para uma conversa.',
  perguntas: [
    {
      k: 'presencial', rotulo: 'A vaga é 100% presencial em Goiânia. Você consegue trabalhar assim?', tipo: 'opcao', obrigatorio: true,
      opcoes: [
        { v: 'sim', r: 'Sim', pontos: 0 },
        { v: 'nao', r: 'Não', pontos: 0, elimina: 'Não pode trabalhar presencial em Goiânia' },
      ],
    },
    {
      k: 'experiencia', rotulo: 'Há quanto tempo você gerencia tráfego pago com verba de cliente?', tipo: 'opcao', obrigatorio: true,
      opcoes: [
        { v: 'menos6', r: 'Menos de 6 meses', pontos: 0, alerta: 'Menos de 6 meses de experiência' },
        { v: '6a12', r: '6 meses a 1 ano', pontos: 6 },
        { v: '1a2', r: '1 a 2 anos', pontos: 12 },
        { v: '2a4', r: '2 a 4 anos', pontos: 18 },
        { v: 'mais4', r: 'Mais de 4 anos', pontos: 20 },
      ],
    },
    {
      k: 'canais', rotulo: 'Em quais plataformas você já rodou campanha com verba real?', tipo: 'multi', obrigatorio: true, max: 20,
      opcoes: [
        { v: 'meta', r: 'Meta Ads', pontos: 8 },
        { v: 'google', r: 'Google Ads', pontos: 8 },
        { v: 'tiktok', r: 'TikTok Ads', pontos: 2 },
        { v: 'linkedin', r: 'LinkedIn Ads', pontos: 2 },
        { v: 'outra', r: 'Outra', pontos: 0 },
      ],
      regra: (vals) => (vals.includes('meta') || vals.includes('google') ? null : { elimina: 'Nunca rodou Meta Ads nem Google Ads' }),
    },
    {
      k: 'contas', rotulo: 'Quantas contas você cuida hoje, ao mesmo tempo?', tipo: 'opcao', obrigatorio: true,
      opcoes: [
        { v: '0', r: 'Nenhuma no momento', pontos: 0 },
        { v: '1a3', r: '1 a 3', pontos: 4 },
        { v: '4a7', r: '4 a 7', pontos: 8 },
        { v: '8a11', r: '8 a 11', pontos: 12 },
        { v: '12mais', r: '12 ou mais', pontos: 14 },
      ],
    },
    {
      k: 'verba', rotulo: 'Qual a maior verba mensal que você já gerenciou numa única conta?', tipo: 'opcao', obrigatorio: true,
      opcoes: [
        { v: 'ate5k', r: 'Até R$ 5 mil', pontos: 2 },
        { v: '5a20k', r: 'R$ 5 mil a R$ 20 mil', pontos: 6 },
        { v: '20a50k', r: 'R$ 20 mil a R$ 50 mil', pontos: 10 },
        { v: 'mais50k', r: 'Mais de R$ 50 mil', pontos: 12 },
      ],
    },
    {
      k: 'rastreamento', rotulo: 'Pixel, API de conversões e GTM: como você se vira com isso?', tipo: 'opcao', obrigatorio: true,
      opcoes: [
        { v: 'nunca', r: 'Nunca configurei', pontos: 0 },
        { v: 'ajuda', r: 'Configuro seguindo tutorial ou com ajuda', pontos: 4 },
        { v: 'sozinho', r: 'Configuro e conserto sozinho', pontos: 8 },
      ],
    },
    {
      k: 'crm', rotulo: 'Depois que o lead chega, como você sabe se ele virou venda?', tipo: 'opcao', obrigatorio: true,
      opcoes: [
        { v: 'plataforma', r: 'Olho só o que a plataforma mostra', pontos: 0 },
        { v: 'comercial', r: 'Pergunto para o comercial do cliente', pontos: 4 },
        { v: 'crm', r: 'Acompanho no CRM e uso isso para mexer na campanha', pontos: 8 },
      ],
    },
    {
      k: 'resultado', rotulo: 'Conte um resultado que você gerou numa conta: o nicho, o que você mudou e qual número melhorou.',
      tipo: 'textarea', obrigatorio: true, min: 40, max: 2000,
      ajuda: 'Ex.: clínica odontológica, troquei os criativos e o público, o custo por lead caiu de R$ 48 para R$ 22 em 30 dias.',
      pontuar: (txt) => (/\d/.test(txt || '') ? { pontos: 6 } : { pontos: 0, alerta: 'Não citou nenhum número no resultado' }),
      maxPontos: 6,
    },
    {
      k: 'situacao', rotulo: 'Como você trabalha hoje?', tipo: 'opcao', obrigatorio: true,
      opcoes: [
        { v: 'clt', r: 'CLT' }, { v: 'pj', r: 'PJ' }, { v: 'freela', r: 'Freelancer' }, { v: 'sem', r: 'Sem trabalho no momento' },
      ],
    },
    {
      k: 'disponibilidade', rotulo: 'Se for chamado, quando consegue começar?', tipo: 'opcao', obrigatorio: true,
      opcoes: [
        { v: 'imediata', r: 'Imediatamente' }, { v: '15', r: 'Em até 15 dias' }, { v: '30', r: 'Em até 30 dias' }, { v: 'combinar', r: 'A combinar' },
      ],
    },
    {
      k: 'pretensao', rotulo: 'Pretensão salarial mensal (R$)', tipo: 'dinheiro', obrigatorio: true,
      pontuar: (v) => (Number(v) > 4000 ? { pontos: 0, alerta: 'Pretensão acima da faixa de Sênior (R$ 4 mil)' } : { pontos: 0 }),
    },
  ],
}

export const TRIAGENS = { [GESTOR_TRAFEGO.cargo]: GESTOR_TRAFEGO }
export const triagemDoCargo = (cargoId) => TRIAGENS[cargoId] || null

const soDigitos = (s) => String(s || '').replace(/\D/g, '')

/** Telefone em E.164 do Brasil (+55DDDNÚMERO), ou null se não tiver DDD + número. */
export function telefoneE164(s) {
  let d = soDigitos(s)
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  if (d.length < 10 || d.length > 11) return null
  return `+55${d}`
}

const maxPontosDe = (p) => {
  if (p.maxPontos != null) return p.maxPontos
  if (!p.opcoes) return 0
  if (p.tipo === 'multi') return p.max ?? p.opcoes.reduce((s, o) => s + (o.pontos || 0), 0)
  return Math.max(0, ...p.opcoes.map((o) => o.pontos || 0))
}

/** Limpa o que veio do navegador: só chaves conhecidas, cada uma no formato esperado. */
export function limparRespostas(triagem, bruto) {
  const src = bruto && typeof bruto === 'object' ? bruto : {}
  const r = {}
  for (const c of CAMPOS_CONTATO) {
    const v = String(src[c.k] ?? '').trim().slice(0, c.max || 60)
    if (v) r[c.k] = c.k === 'email' ? v.toLowerCase() : v
  }
  for (const p of triagem.perguntas) {
    const v = src[p.k]
    if (p.tipo === 'multi') {
      const ok = new Set(p.opcoes.map((o) => o.v))
      r[p.k] = Array.isArray(v) ? [...new Set(v.map(String))].filter((x) => ok.has(x)) : []
    } else if (p.tipo === 'opcao') {
      if (p.opcoes.some((o) => o.v === v)) r[p.k] = v
    } else if (p.tipo === 'dinheiro') {
      const n = Number(soDigitos(v))
      if (n > 0) r[p.k] = Math.min(n, 1_000_000)
    } else if (v != null) {
      const t = String(v).trim().slice(0, p.max || 400)
      if (t) r[p.k] = t
    }
  }
  return r
}

/** { campo: mensagem } com o que falta ou está errado. Vazio = pode enviar. */
export function validarRespostas(triagem, r) {
  const erros = {}
  for (const c of CAMPOS_CONTATO) {
    if (c.obrigatorio && !r[c.k]) erros[c.k] = 'Preencha este campo.'
  }
  if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) erros.email = 'E-mail inválido.'
  if (r.telefone && !telefoneE164(r.telefone)) erros.telefone = 'Informe o WhatsApp com DDD.'
  if (r.nome && r.nome.trim().split(/\s+/).length < 2) erros.nome = 'Informe nome e sobrenome.'
  for (const p of triagem.perguntas) {
    const v = r[p.k]
    const vazio = v == null || v === '' || (Array.isArray(v) && !v.length)
    if (p.obrigatorio && vazio) { erros[p.k] = p.tipo === 'multi' ? 'Escolha pelo menos uma.' : 'Responda esta pergunta.'; continue }
    if (p.min && typeof v === 'string' && v.length < p.min) erros[p.k] = `Escreva um pouco mais (mínimo de ${p.min} caracteres).`
  }
  return erros
}

/**
 * Pontua as respostas. Devolve { pontos (0-100), bruto, max, resultado, eliminatorias[], alertas[], porPergunta }.
 * eliminatorias = motivos que tiram do processo; alertas = pontos de atenção que não eliminam.
 */
export function calcularTriagem(triagem, r) {
  let bruto = 0
  let max = 0
  const eliminatorias = []
  const alertas = []
  const porPergunta = {}
  for (const p of triagem.perguntas) {
    const v = r[p.k]
    const mx = maxPontosDe(p)
    max += mx
    let pts = 0
    if (p.tipo === 'multi' && Array.isArray(v)) {
      for (const o of p.opcoes) if (v.includes(o.v)) pts += o.pontos || 0
      pts = Math.min(pts, mx)
      const extra = p.regra?.(v)
      if (extra?.elimina) eliminatorias.push(extra.elimina)
    } else if (p.tipo === 'opcao') {
      const o = p.opcoes.find((x) => x.v === v)
      pts = o?.pontos || 0
      if (o?.elimina) eliminatorias.push(o.elimina)
      if (o?.alerta) alertas.push(o.alerta)
    }
    if (p.pontuar && v != null) {
      const res = p.pontuar(v) || {}
      pts += res.pontos || 0
      if (res.alerta) alertas.push(res.alerta)
      if (res.elimina) eliminatorias.push(res.elimina)
    }
    bruto += pts
    if (mx) porPergunta[p.k] = { pontos: pts, max: mx }
  }
  const pontos = max ? Math.round((bruto / max) * 100) : 0
  const resultado = eliminatorias.length ? 'nao_avanca' : pontos >= CORTE_AVANCA ? 'avanca' : pontos >= CORTE_TALVEZ ? 'talvez' : 'nao_avanca'
  return { pontos, bruto, max, resultado, eliminatorias, alertas, porPergunta }
}

/** Texto legível de uma resposta (rótulo da opção, lista, moeda). */
export function respostaTexto(p, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '-'
  if (p.tipo === 'multi') return v.map((x) => p.opcoes.find((o) => o.v === x)?.r || x).join(', ')
  if (p.tipo === 'opcao') return p.opcoes.find((o) => o.v === v)?.r || String(v)
  if (p.tipo === 'dinheiro') return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  return String(v)
}

// ─── Convite pelo WhatsApp ──────────────────────────────────────────────────

export const MENSAGEM_CONVITE = `Oi, {nome}, aqui é o Matheus da Verta.
Vi que você se candidatou na nossa vaga de {vaga}. A primeira etapa do nosso processo seletivo é o preenchimento de um formulário, o link está aqui:
{link}

Assim que responder, pode me chamar aqui.`

export const primeiroNome = (nome) => {
  const p = String(nome || '').trim().split(/\s+/)[0] || ''
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''
}

/** Link do formulário. Com o candidato, a resposta cai direto no perfil dele. */
export function linkFormulario(origin, cargoId, candidatoId) {
  return `${origin}/vaga/${cargoId}${candidatoId ? `?ref=${candidatoId}` : ''}`
}

export function mensagemConvite({ nome, vaga, link }) {
  const n = primeiroNome(nome)
  return MENSAGEM_CONVITE
    .replace('Oi, {nome},', n ? `Oi, ${n},` : 'Oi,')
    .replace('{vaga}', vaga)
    .replace('{link}', link)
}

/** wa.me com o número do candidato e, se houver, o texto pronto. */
export function linkWhatsApp(telefone, texto) {
  const e164 = telefoneE164(telefone)
  if (!e164) return null
  return `https://wa.me/${e164.slice(1)}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}
