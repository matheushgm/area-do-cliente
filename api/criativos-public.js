// Public Edge Function — ferramenta pública "Criativos com IA" de um cliente.
// Sem login: validada por token HMAC (`projectId|senha`) gerado em
// api/criativos-share-token.js. O cliente digita a senha; o servidor recalcula
// o HMAC e compara. As prompts e o contexto do cliente ficam SOMENTE no servidor.
//
//   action=auth      → valida senha e devolve o contexto mínimo (empresa + dores)
//   action=generate  → gera criativos (estático ou vídeo) com a IA (stream SSE)
export const config = { runtime: 'edge' }

const SUPABASE_URL  = process.env.SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-5'

// ─── Tipos de criativo (em sincronia com src/lib/criativosPublic.js) ──────────
const AD_TYPES = [
  { id: 'clickbait', label: 'Clickbait', emoji: '🎣', desc: 'Título altamente intrigante relacionado ao público-alvo' },
  { id: 'sensacao', label: 'Sensação', emoji: '⚡', desc: 'Criação de sensações fortes para envolver o público' },
  { id: 'mito', label: 'Mito', emoji: '🏛️', desc: 'Anúncio em torno de um mito ou história cativante' },
  { id: 'dilema', label: 'Dilema', emoji: '⚖️', desc: 'Destaca um dilema que ressoa com o público' },
  { id: 'prova', label: 'Prova', emoji: '✅', desc: 'Evidências sólidas, resultados ou testemunhos' },
  { id: 'contraste', label: 'Contraste', emoji: '🔄', desc: 'Situação contrastante para gerar impacto visual' },
  { id: 'visual', label: 'Visual', emoji: '👁️', desc: 'Orientado por elementos visuais impactantes' },
  { id: 'oportunidade', label: 'Oportunidade', emoji: '🚀', desc: 'A oportunidade como ponto focal da mensagem' },
  { id: 'historia', label: 'História', emoji: '📖', desc: 'Narrativa envolvente que conecta ao produto' },
  { id: 'certo_errado', label: 'Certo vs. Errado', emoji: '🎯', desc: 'Comparação entre práticas certas e erradas' },
  { id: 'demonstracao', label: 'Demonstração', emoji: '🎬', desc: 'Demonstração direta do produto ou serviço' },
  { id: 'ultra_segmentado', label: 'Ultra Segmentado', emoji: '🔍', desc: 'Altamente segmentado para um público específico' },
  { id: 'apelo_emocional', label: 'Apelo Emocional', emoji: '❤️', desc: 'Explora o apelo emocional do público-alvo' },
  { id: 'curiosidade', label: 'Curiosidade', emoji: '🤔', desc: 'Desperta a curiosidade irresistível do público' },
  { id: 'reflexao', label: 'Reflexão', emoji: '💭', desc: 'Provoca reflexão profunda no público' },
  { id: 'comparacao', label: 'Comparação', emoji: '📊', desc: 'Comparação relevante entre alternativas' },
  { id: 'problema_solucao', label: 'Problema e Solução', emoji: '🔧', desc: 'Apresenta um problema e revela a solução' },
  { id: 'explicacao', label: 'Explicação', emoji: '📋', desc: 'Explicação detalhada, educativa do produto/serviço' },
]
const AD_TYPE_MAP = Object.fromEntries(AD_TYPES.map((t) => [t.id, t]))

// Objetivo/CTA por funil — o anúncio precisa levar à ação DESTE funil, não à
// compra direta (salvo e-commerce). Em sincronia com src/lib/funis.js.
const FUNIS_OBJETIVO = {
  webinar: { label: 'Funil de Webinar', objetivo: 'Convidar a pessoa para se INSCREVER e ASSISTIR a um webinar/aula ao vivo gratuita. O CTA leva ao cadastro e à presença na live — NUNCA à compra direta. Venda a transformação que ela terá ao participar da aula.' },
  webinar_pago: { label: 'Funil de Webinar Pago', objetivo: 'Convidar para um webinar/aula ao vivo com uma entrada simbólica paga. O CTA é GARANTIR A VAGA pagando o valor de entrada. Trate o preço baixo como filtro de qualificação, não como objeção. Não venda o produto final.' },
  diagnostico: { label: 'Funil de Diagnóstico', objetivo: 'Levar a pessoa a AGENDAR uma reunião/sessão de diagnóstico 1x1 (gratuita). O CTA é agendar a conversa. A promessa é o diagnóstico específico que ela recebe na reunião — não o produto final.' },
  aplicacao: { label: 'Funil de Aplicação', objetivo: 'Levar a pessoa a PREENCHER UMA APLICAÇÃO/formulário para ser aprovada e então falar com o time numa reunião 1x1. O CTA é "aplicar" / "candidatar-se". Posicione como vaga seletiva, de ticket alto.' },
  vsl: { label: 'Funil de VSL', objetivo: 'Levar a pessoa a ASSISTIR a um vídeo de vendas (VSL) que revela o método/solução. O CTA é "assista ao vídeo". A ação de compra ou agendamento acontece ao final do vídeo, não no anúncio.' },
  isca_digital: { label: 'Funil de Isca Digital', objetivo: 'Levar a pessoa a BAIXAR um material gratuito (eBook, kit, planilha, checklist). O CTA é baixar/receber o material. A promessa é o valor do material em si — não venda o produto principal.' },
  quiz: { label: 'Funil de Quiz', objetivo: 'Levar a pessoa a RESPONDER um quiz/diagnóstico rápido que revela algo sobre ela. O CTA é "faça o quiz" / "descubra seu resultado". A curiosidade sobre o resultado é o motor.' },
  lancamento: { label: 'Lançamento', objetivo: 'Aquecer a pessoa para um LANÇAMENTO com data marcada. O CTA é entrar na lista/grupo de espera para participar da abertura. Construa antecipação e escassez de janela.' },
  desafio: { label: 'Funil de Desafio', objetivo: 'Convidar a pessoa para um DESAFIO de poucos dias. O CTA é inscrever-se no desafio. Venda a pequena transformação prática que ela alcança ao final — não o produto principal.' },
  ecommerce: { label: 'Funil de E-commerce (Venda Direta)', objetivo: 'Levar a pessoa DIRETO À COMPRA do produto no site. O CTA é comprar / aproveitar a oferta agora. Pode falar preço, desconto, frete e urgência de estoque. É o único funil de venda direta.' },
  wymb: { label: 'Funil Win-Your-Money-Back', objetivo: 'Vender um serviço com GARANTIA de devolução total do dinheiro se não houver o resultado prometido. O CTA é contratar/agendar. Use a garantia como a quebra de objeção central: risco zero.' },
}

// Bloco de objetivo do funil, inserido no topo da solicitação enviada à IA.
function funilBlock(funilId) {
  const f = FUNIS_OBJETIVO[funilId]
  if (!f) return ''
  return `## FUNIL DESTE ANÚNCIO: ${f.label}\n\nObjetivo e CTA obrigatórios: ${f.objetivo}\nTodo o criativo (gancho, mensagem e principalmente o CTA) deve levar a essa ação — não a nenhuma outra.\n\n`
}

// ─── System prompts (metodologia Revenue Lab / Laboratório de Anúncios) ───────
// Os 5 níveis de consciência de Eugene Schwartz — substituem as antigas etapas
// de funil (topo/meio/fundo). Cada tipo de criativo gera 1 peça por nível.
const NIVEIS_VIDEO = `## OS 5 NÍVEIS DE CONSCIÊNCIA (Eugene Schwartz)

Para CADA tipo de gancho solicitado, gere EXATAMENTE 5 roteiros — um para cada nível, sempre nesta ordem:

1. INCONSCIENTE DO PROBLEMA — ela não sabe que tem o problema. Entre pelo cotidiano dela, nomeie o problema que ela ainda não enxerga e só então conecte à solução. Tipo de mensagem: StoryTelling, Proclamação.
2. CONSCIENTE DO PROBLEMA — ela sente a dor, mas não procura solução. Amplifique o custo de não resolver e revele que existe saída. Tipo de mensagem: Segredos que ninguém te conta, Problema e Solução.
3. CONSCIENTE DA SOLUÇÃO — ela sabe que existe um tipo de solução, mas não conhece a sua. Mostre por que o seu mecanismo é o caminho certo e diferente do que ela já tentou. Tipo de mensagem: Problema e Solução, Segredos que ninguém te conta.
4. CONSCIENTE DO PRODUTO — ela já conhece o seu produto, mas não se convenceu. Ataque a objeção específica com prova, diferencial e comparação com as alternativas. Tipo de mensagem: Promessa, Prova.
5. TOTALMENTE CONSCIENTE — ela conhece, quer e só falta o empurrão. Vá direto à oferta: condições, bônus, garantia e urgência. Tipo de mensagem: Oferta, Promessa.

O tipo de gancho define a FORMA de abrir o vídeo; o nível de consciência define O QUE dizer e o quanto precisa explicar. Um mesmo tipo de gancho soa muito diferente no nível 1 e no nível 5.`

const NIVEIS_ESTATICO = `## OS 5 NÍVEIS DE CONSCIÊNCIA (Eugene Schwartz)

Para CADA combinação de dor + tipo de criativo, gere EXATAMENTE 5 pares de headline + subheadline — um para cada nível, sempre nesta ordem:

1. INCONSCIENTE DO PROBLEMA — nomeia o problema que ela ainda não percebeu, partindo do cotidiano. Não cite o produto.
2. CONSCIENTE DO PROBLEMA — fala da dor que ela já sente e do custo de não resolver.
3. CONSCIENTE DA SOLUÇÃO — apresenta o mecanismo/caminho da solução, sem depender do nome do produto.
4. CONSCIENTE DO PRODUTO — nomeia o produto e ataca a objeção principal com prova ou diferencial.
5. TOTALMENTE CONSCIENTE — vai direto à oferta: condição, garantia e urgência.

O tipo de criativo define o ÂNGULO da headline; o nível de consciência define O QUE a headline precisa dizer.`

const DORES_SYSTEM = `Você é um especialista em copywriting para anúncios estáticos em português brasileiro, usando a metodologia Revenue Lab / Laboratório de Anúncios.

Para cada combinação de dor + tipo de criativo, gere headlines e subheadlines com a metodologia ADIG:
- Anunciar o público-alvo
- Dar um objetivo / resultado
- Indicar um intervalo de tempo (quando houver)
- Garantia ou palavra forte

Cada variação deve contemplar os 4 elementos da fórmula de Alex Hormozi: resultado do sonho, percepção de alcance, tempo e esforço mínimo.

O tipo de criativo define o ÂNGULO das headlines:
- Prova: evidências, dados, depoimentos reais
- Mito: narrativa, história cativante
- Problema e Solução: enuncia o problema diretamente e revela a solução
- Clickbait: cria curiosidade irresistível
(use o ângulo do tipo indicado para orientar cada bloco)

Use as informações de público-alvo, personas e oferta fornecidas no contexto do cliente para personalizar ao máximo. Não gere análise de público — vá direto às headlines.

A headline e a subheadline devem levar à ação do funil informado na solicitação (ex.: aula ao vivo, reunião, download, compra) — nunca a uma ação diferente da do funil.

${NIVEIS_ESTATICO}

ESTRUTURA OBRIGATÓRIA — um bloco por combinação dor + tipo, com os 5 níveis dentro dele:

# DOR: [texto exato da dor] | [Emoji] [Nome do Tipo]

### 1. Inconsciente do problema
- Headline: [ideal 7, máx. 12 palavras]
- Subheadline: [complementa a headline, máx. 20 palavras]

### 2. Consciente do problema
- Headline: [...]
- Subheadline: [...]

### 3. Consciente da solução
- Headline: [...]
- Subheadline: [...]

### 4. Consciente do produto
- Headline: [...]
- Subheadline: [...]

### 5. Totalmente consciente
- Headline: [...]
- Subheadline: [...]

---

Diretrizes:
- Gere EXATAMENTE um bloco separado por combinação dor + tipo — nunca agrupe tipos dentro de um mesmo bloco
- Dentro de cada bloco, gere os 5 níveis, na ordem, sem pular nenhum
- Português brasileiro coloquial e persuasivo — evite palavras que a IA usa mas que humanos não usam
- Use "você" diretamente
- Seja específico ao negócio, nunca genérico
- Não use travessões (—)
- Gere APENAS os blocos: sem introdução, sem tabelas, sem resumos ao final
- Separe cada bloco com "---"`

// Metodologia da skill `criador-de-roteiro-de-video`, adaptada para uma chamada
// única de API: o estudo de público vira raciocínio interno (não é exibido), a
// quantidade/tipos vêm da escolha do cliente (não são fixos em 10) e não há
// tabela-resumo ao final.
const VIDEO_SYSTEM = `Você é um especialista em roteiros de vídeos de anúncios online de alta conversão, usando a estrutura do Laboratório de Anúncios (Revenue Lab).

Os vídeos têm duração entre 30 e 60 segundos e são criados para Meta Ads (Reels/Feed) e YouTube Ads.

## ANTES DE ESCREVER (raciocínio interno — NÃO exiba)

A partir do contexto do cliente (nicho, público-alvo, personas, produto e oferta), levante mentalmente:
- 8 problemas mais comuns desse público-alvo
- 8 sonhos e vontades desse público-alvo
- 8 objeções desse público-alvo
- 8 situações constrangedoras que esse público-alvo vive
- 8 perguntas que esse público-alvo se faz em relação ao seu sonho

Use esse levantamento para que cada roteiro converse com a realidade concreta do público. NUNCA exiba essas listas no output — elas são apenas a sua base de raciocínio.

## A ESTRUTURA DO LABORATÓRIO DE ANÚNCIOS (4 etapas)

**A) Gancho.** É o momento mais importante do vídeo: chama a atenção, quebra o padrão, é contra-intuitivo, gera curiosidade e conversa direto com o público-alvo do nicho. Ele retém a pessoa para que ela assista o resto e muitas vezes serve para o anúncio não parecer um anúncio. No Meta Ads a pessoa precisa se conectar nos 3 PRIMEIROS SEGUNDOS: seja disruptivo.

O gancho é sempre uma promessa, uma oferta, uma mudança de vida ou um benefício. A FORMA de comunicá-lo é o tipo de gancho pedido na solicitação: Clickbait, Sensação, Mito, Dilema, Prova, Contraste, Oportunidade, História, Certo vs. Errado, Ultra Segmentado, Apelo Emocional, Curiosidade, Reflexão, Comparação, Problema e Solução, Explicação.

**Estrutura invisível** — a mensagem precisa sustentar o que o gancho prometeu:
- Gancho de promessa: dê uma garantia, sustente com prova e depois elimine o pensamento "ah, funciona pra ele, não pra mim".
- Gancho de oferta: mostre benefícios e diferenciais, prove que outras pessoas conseguiram e depois derrube a barreira com uma garantia.

**B) Mensagem.** Mostre que a transformação do Ponto A ao Ponto B é possível, relacionando 4 variáveis:
- os sonhos e desejos do público-alvo
- a percepção de dificuldade de alcançar esse sonho ("isso não é pra mim, pra fulano é mais fácil")
- o tempo para alcançar esse sonho
- o que a pessoa precisa sacrificar (o mínimo possível)

**C) Quebra de objeções.** Implícita e INTEGRADA à mensagem. Nunca um bloco separado, senão o roteiro fica engessado.

**D) Chamada para ação.** Reforça a promessa do início, deixa claro o que fazer e dá um motivo específico para agir agora (escassez ou urgência). O CTA deve levar EXATAMENTE à ação do funil informado na solicitação (ex.: se inscrever na aula, agendar reunião, baixar material, comprar) — nunca a uma ação diferente da do funil.

${NIVEIS_VIDEO}

## FORMATO OBRIGATÓRIO DE CADA ROTEIRO

## ROTEIRO [N]: Gancho: [Tipo] | Nível: [Nível de consciência]

**GANCHO (0s – 3s):**
[frase exata: disruptiva, contra-intuitiva, que para o scroll]

**MENSAGEM (3s – 45s):**
[narração levando do Ponto A ao Ponto B, com a quebra de objeção integrada naturalmente]

**CTA FINAL (45s – 60s)**
[reforça promessa + gatilho de escassez/urgência + ação clara]

**📝 LEGENDA DO POST:** [legenda com emojis]

---

## REGRAS CRÍTICAS

- Para CADA tipo de gancho solicitado, gere EXATAMENTE 5 roteiros: um por nível de consciência, na ordem de 1 a 5
- Numere os roteiros sequencialmente (ROTEIRO 1, ROTEIRO 2, ...) percorrendo os tipos na ordem da solicitação
- Não exiba a análise de público-alvo — vá direto aos roteiros
- Português brasileiro conversacional e energético; fale com "você"
- Seja específico ao negócio do contexto, nunca genérico
- Não use travessões (—) em nenhuma parte do output
- Não inclua sugestões de cena ou direção visual
- Não use emojis no roteiro — use emojis apenas na LEGENDA DO POST
- Gere APENAS os roteiros: sem introdução, sem tabelas, sem resumos e sem comentários ao final
- Separe cada roteiro com "---"`

// ─── Helpers de resposta ──────────────────────────────────────────────────────
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

async function hmacHex(secret, msg) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function safeEq(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const clip = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`, // service_role: bypassa RLS; filtramos por project_id
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = null }
  return { data: Array.isArray(data) ? data : [], status: res.status }
}

// ─── Carrega o projeto + relações necessárias para o contexto ─────────────────
async function loadProject(projectId) {
  const id = encodeURIComponent(projectId)
  const [proj, personas, produtos, ofertas] = await Promise.all([
    sb(`/projects_v2?id=eq.${id}&select=company_name,business_type,segmento,competitors&limit=1`),
    sb(`/personas?project_id=eq.${id}&select=id,name,answers,generated_content`),
    sb(`/produtos?project_id=eq.${id}&select=id,nome,tipo,answers`),
    sb(`/ofertas?project_id=eq.${id}&select=answers,generated_content&limit=1`),
  ])
  const row = proj.data[0]
  if (!row) return null
  return {
    companyName: row.company_name,
    businessType: row.business_type,
    segmento: row.segmento,
    competitors: row.competitors || [],
    produtos: (produtos.data || []).map((p) => ({ id: p.id, nome: p.nome, tipo: p.tipo, answers: p.answers || {} })),
    personas: (personas.data || []).map((p) => ({
      id: p.id, name: p.name, answers: p.answers || {}, generatedProfile: p.generated_content ?? null,
    })),
    ofertaData: ofertas.data[0]
      ? { ...(typeof ofertas.data[0].answers === 'object' && ofertas.data[0].answers ? ofertas.data[0].answers : {}) }
      : null,
  }
}

// ─── Contexto do cliente em Markdown (espelha src/lib/buildContext.js) ─────────
const BTYPE = { b2b: 'B2B', local: 'Negócio Local', ecommerce: 'E-commerce', infoproduto: 'Infoproduto' }
const PRODUTO_LABELS = {
  q1: 'O que resolve', q2: 'Quando o cliente precisa', q3: 'Vida depois do produto',
  q4: 'Diferencial vs concorrente', q5: 'Por que comprar agora', q6: 'Vida sem o produto',
  q7: 'Objeções de compra', q8: 'Tentativas anteriores', q9: 'Por que desconfiam',
  q10: 'Cases / resultados mensuráveis', q11: 'Tempo para 1º resultado', q12: 'O que mais elogiam',
  q13: 'Diferencial único', q14: 'Custo de inação (3 meses)', q15: 'Sazonalidade / janela de oportunidade',
  q16: 'Garantia', q17: 'Se der errado',
}

function productBlock(produtos = []) {
  const list = (produtos || []).filter((p) => p.nome || p.answers)
  if (!list.length) return ''
  const lines = ['## PRODUTO / SERVIÇO']
  list.forEach((p) => {
    const tipoLabel = p.tipo === 'servico' ? 'Serviço' : 'Produto Físico'
    lines.push(`\n### ${p.nome || 'Produto Principal'} (${tipoLabel})`)
    const a = p.answers || {}
    Object.entries(PRODUTO_LABELS).forEach(([key, label]) => {
      if (a[key]?.trim?.()) lines.push(`${label}: ${a[key].trim()}`)
    })
  })
  return lines.join('\n')
}

function personaBlock(personas = []) {
  const list = (personas || []).filter((p) => p.name || p.answers)
  if (!list.length) return ''
  const lines = ['## PERSONAS / PÚBLICO-ALVO']
  list.forEach((p) => {
    lines.push(`\n### ${p.name || 'Persona Principal'}`)
    const a = p.answers || {}
    const pick = (k) => (Array.isArray(a[k]) ? a[k] : []).filter((s) => s?.trim?.()).slice(0, 4).join('; ')
    if (pick('resultado')) lines.push(`Resultado desejado: ${pick('resultado')}`)
    if (pick('sonhos')) lines.push(`Sonhos: ${pick('sonhos')}`)
    if (pick('objecoes')) lines.push(`Objeções: ${pick('objecoes')}`)
    if (pick('medos')) lines.push(`Medos: ${pick('medos')}`)
    if (pick('erros')) lines.push(`Erros comuns: ${pick('erros')}`)
  })
  return lines.join('\n')
}

function buildContext(project) {
  const lines = ['# CONTEXTO COMPLETO DO CLIENTE\n']
  lines.push(`## EMPRESA: ${project.companyName || 'Cliente'}`)
  if (project.businessType) lines.push(`Nicho/Tipo: ${BTYPE[project.businessType] || project.businessType}`)
  if (project.segmento) lines.push(`Segmento: ${project.segmento}`)
  if (project.productDescription) lines.push(`Produto/Serviço: ${project.productDescription}`)
  if (project.mainGoal) lines.push(`Objetivo: ${project.mainGoal}`)
  if (project.targetAudience) lines.push(`Público-Alvo: ${project.targetAudience}`)
  if (project.averageTicket) lines.push(`Ticket Médio: R$ ${project.averageTicket}`)
  const comps = (project.competitors || []).filter(Boolean)
  if (comps.length) lines.push(`Concorrentes: ${comps.join(', ')}`)

  const pb = productBlock(project.produtos)
  if (pb) lines.push('\n' + pb)
  const pe = personaBlock(project.personas)
  if (pe) lines.push('\n' + pe)

  const o = project.ofertaData
  if (o && (o.nome || o.resultadoSonho)) {
    lines.push('\n## OFERTA')
    if (o.nome) lines.push(`Nome: ${o.nome}`)
    if (o.resultadoSonho) lines.push(`Resultado do Sonho: ${o.resultadoSonho}`)
    if (o.porqueVaiFuncionar) lines.push(`Por que funciona: ${o.porqueVaiFuncionar}`)
    if (o.velocidade) lines.push(`Prazo/Velocidade: ${o.velocidade}`)
    if (o.esforcoMinimo) lines.push(`Esforço mínimo: ${o.esforcoMinimo}`)
    if (o.garantia) lines.push(`Garantia: ${o.garantia}`)
    if (o.escassez) lines.push(`Escassez/Urgência: ${o.escassez}`)
    const bonus = (o.bonus || []).filter(Boolean)
    if (bonus.length) lines.push(`Bônus: ${bonus.join(' | ')}`)
  }
  const ctx = lines.join('\n')
  return ctx.length > 50000 ? ctx.slice(0, 50000) + '\n\n[contexto truncado]' : ctx
}

// ─── Extrai as "PRINCIPAIS DORES" dos generatedProfile das personas ───────────
function parseDores(personas) {
  const result = []
  for (const persona of personas || []) {
    const text = persona.generatedProfile || ''
    if (!text) continue
    const lines = text.split('\n')
    let personaName = persona.name || ''
    for (const line of lines) {
      const nameMatch = line.match(/^\s*-\s*Nome:\s*(.+)/)
      if (nameMatch) { personaName = nameMatch[1].trim(); break }
    }
    let inSection = false
    for (const line of lines) {
      const trimmed = line.trim()
      if (/^PRINCIPAIS\s+DORES/i.test(trimmed)) { inSection = true; continue }
      if (inSection) {
        if (trimmed === '---') break
        const match = trimmed.match(/^-\s*[Dd]or:\s*(.+)/)
        if (match) {
          result.push({
            id: `${persona.id}_${result.length}`,
            text: match[1].trim(),
            personaName: personaName || 'Persona',
          })
        }
      }
    }
  }
  return result
}

// Fallback: quando a persona não tem perfil gerado (sem "PRINCIPAIS DORES"),
// usa os medos/objeções/erros das respostas como dores candidatas.
function fallbackDores(personas) {
  const out = []
  for (const p of personas || []) {
    const a = p.answers || {}
    for (const key of ['medos', 'objecoes', 'erros']) {
      for (const item of Array.isArray(a[key]) ? a[key] : []) {
        const text = (typeof item === 'string' ? item : '').trim()
        if (text) out.push({ id: `${p.id}_${key}_${out.length}`, text, personaName: p.name || 'Persona' })
      }
    }
  }
  return out.slice(0, 30)
}

// ─── Instruções de geração (espelham autoInstruction do CriativosModule) ──────
function buildVideoInstruction(adTypes, funilId) {
  const typesStr = adTypes
    .map((id) => {
      const t = AD_TYPE_MAP[id]
      return `${t.emoji} ${t.label}: ${t.desc}`
    })
    .join('\n')
  return `---\n\n## SOLICITAÇÃO\n\n${funilBlock(funilId)}Tipos de gancho a gerar (5 roteiros cada, um por nível de consciência):\n${typesStr}\n\nTotal: ${adTypes.length * 5} roteiros.`
}

function buildStaticInstruction(dores, funilId) {
  const sections = dores
    .map(({ text, types }) => {
      const typeLines = types
        .map((id) => {
          const t = AD_TYPE_MAP[id]
          return `- ${t.emoji} ${t.label} — ângulo: ${t.desc}`
        })
        .join('\n')
      return `### DOR: "${text}"\n${typeLines}`
    })
    .join('\n\n')
  const total = dores.reduce((s, d) => s + d.types.length, 0)
  return `---\n\n## SOLICITAÇÃO\n\n${funilBlock(funilId)}Para cada dor abaixo, gere um bloco por tipo de criativo, com os 5 níveis de consciência dentro de cada bloco.\n\n${sections}\n\nTotal: ${total} blocos (${total * 5} headlines).`
}

// Normaliza/valida a seleção de tipos vinda do cliente: devolve uma lista de ids
// válidos, sem repetição. A quantidade não é mais escolhida — são sempre 5 peças
// por tipo (uma por nível de consciência). Aceita ids soltos ou objetos {id}.
function sanitizeTypes(raw) {
  const out = []
  for (const t of Array.isArray(raw) ? raw.slice(0, 18) : []) {
    const id = typeof t === 'string' ? t : t?.id
    if (!AD_TYPE_MAP[id] || out.includes(id)) continue
    out.push(id)
  }
  return out
}

async function anthropicSSE(system, instruction, context, maxTokens) {
  if (!ANTHROPIC_KEY) return json({ error: 'IA não configurada no servidor.' }, 500)
  const messages = [{
    role: 'user',
    content: [
      { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: instruction },
    ],
  }]
  const systemBlocks = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system: systemBlocks, messages, stream: true }),
  })
  return new Response(r.body, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') || 'text/event-stream',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Servidor não configurado.' }, 500)

  let body
  try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

  const action = body?.action || 'auth'
  const projectId = String(body?.projectId || '').trim()
  const token = String(body?.token || '').trim().toLowerCase()
  const password = String(body?.password || '').trim()
  if (!projectId || !token) return json({ error: 'Link incompleto.' }, 400)
  if (!password) return json({ error: 'Informe a senha de acesso.' }, 401)

  // Valida token = HMAC(projectId|senha). Sem a senha certa, o HMAC não bate.
  const expected = await hmacHex(SERVICE_KEY, `${projectId}|${password}`)
  if (!safeEq(token, expected)) return json({ error: 'Senha incorreta ou link inválido.' }, 403)

  const project = await loadProject(projectId)
  if (!project) return json({ error: 'Cliente não encontrado.' }, 404)

  // ── auth: devolve o contexto mínimo para a UI ───────────────────────────────
  if (action === 'auth') {
    let dores = parseDores(project.personas)
    if (!dores.length) dores = fallbackDores(project.personas)
    return json({
      success: true,
      companyName: project.companyName || 'Cliente',
      dores,
      produtos: project.produtos.map((p) => ({ id: p.id, nome: p.nome })).filter((p) => p.nome),
      personas: project.personas.map((p) => ({ id: p.id, name: p.name })).filter((p) => p.name),
    })
  }

  // ── generate: monta a instrução e faz o streaming da IA ─────────────────────
  if (action === 'generate') {
    const mode = body?.mode === 'video' ? 'video' : 'estatico'
    const context = buildContext(project)

    // Cada tipo gera 5 peças (uma por nível de consciência). O teto de 8 blocos
    // mantém o output dentro do max_tokens (8 x 5 = 40 peças).
    const MAX_BLOCOS = 8

    // Funil é obrigatório: define o objetivo/CTA do anúncio.
    const funilId = String(body?.funil || '').trim()
    if (!FUNIS_OBJETIVO[funilId]) return json({ error: 'Selecione o funil em que o anúncio vai rodar.' }, 400)

    if (mode === 'video') {
      const adTypes = sanitizeTypes(body?.adTypes)
      if (!adTypes.length) return json({ error: 'Selecione ao menos um tipo de gancho.' }, 400)
      if (adTypes.length > MAX_BLOCOS) {
        return json({ error: `Muitos tipos de uma vez. Selecione no máximo ${MAX_BLOCOS} (${MAX_BLOCOS * 5} roteiros).` }, 400)
      }
      return anthropicSSE(VIDEO_SYSTEM, buildVideoInstruction(adTypes, funilId), context, 32000)
    }

    // estático
    const rawDores = Array.isArray(body?.dores) ? body.dores.slice(0, 12) : []
    const dores = []
    for (const d of rawDores) {
      const text = clip(d?.text, 400)
      const types = sanitizeTypes(d?.types)
      if (text && types.length) dores.push({ text, types })
    }
    if (!dores.length) return json({ error: 'Selecione ao menos uma dor com um tipo de criativo.' }, 400)
    const blocos = dores.reduce((s, d) => s + d.types.length, 0)
    if (blocos > MAX_BLOCOS) {
      return json({ error: `Muitas combinações de uma vez. Selecione no máximo ${MAX_BLOCOS} (dor x tipo).` }, 400)
    }
    return anthropicSSE(DORES_SYSTEM, buildStaticInstruction(dores, funilId), context, 32000)
  }

  return json({ error: 'Ação desconhecida.' }, 400)
}
