// ─────────────────────────────────────────────────────────────────────────────
// Camada compartilhada do Wizard de Oferta Matadora (metodologia $100M Offers).
// Schema, constantes, metadados dos passos, prompts da IA (final + assist).
// Sem React — importado pelos steps, pela shell e pelos assistentes de IA.
// ─────────────────────────────────────────────────────────────────────────────
import { streamClaude } from '../../lib/claude'

// ─── ID curto p/ itens de listas dinâmicas ──────────────────────────────────
export const uid = () =>
  (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`)

// ─── Schema do ofertaData (backward-compatible) ─────────────────────────────
export function newOferta() {
  return {
    // Passo 0
    diagnostico: null,        // { answers, totalScore, verdict }
    tipoCliente: '',          // 'b2b' | 'b2c'
    // Passo 1
    dorAtual: '',
    resultadoSonho: '',
    statusGanho: '',
    // Passo 2
    problemas: [],            // [{ id, texto, driver }]
    // Passo 3
    solucoes: [],             // [{ id, problemaId, comoResolve }]
    // Passo 4
    entrega: { atencao: '', esforcoModelo: '', meio: [] },
    // Passo 5
    nucleo: '',
    itensStack: [],           // [{ id, nome, tipo, valor, resolveProblemaId }]
    preco: '',
    velocidade: '',
    esforcoMinimo: '',
    // Passo 6
    escassezTipo: '',
    escassez: '',
    urgenciaTipo: '',
    urgencia: '',
    // Passo 7
    bonus: [''],
    // Passo 8
    garantiaTipo: '',
    garantia: '',
    // Passo 9
    nomeBlocks: { magnet: '', avatar: '', goal: '', interval: '', container: '' },
    nome: '',
    // Output
    generatedOffer: null,
  }
}

// Mescla ofertaData salvo com defaults novos (evita undefined em ofertas antigas)
export function hydrateOferta(saved) {
  const base = newOferta()
  if (!saved) return base
  return {
    ...base,
    ...saved,
    entrega: { ...base.entrega, ...(saved.entrega || {}) },
    nomeBlocks: { ...base.nomeBlocks, ...(saved.nomeBlocks || {}) },
    bonus: Array.isArray(saved.bonus) && saved.bonus.length ? saved.bonus : [''],
    problemas: saved.problemas || [],
    solucoes: saved.solucoes || [],
    itensStack: saved.itensStack || [],
  }
}

// ─── Os 4 drivers da Equação de Valor ───────────────────────────────────────
export const DRIVERS = [
  { id: 'valor',         label: 'Não vale a pena',        hint: 'É caro / não compensa',            color: '#EAB308' },
  { id: 'probabilidade', label: 'Não vai funcionar',      hint: 'Pra mim não / não vou manter',     color: '#8B5CF6' },
  { id: 'esforco',       label: 'É difícil demais',       hint: 'Trabalhoso, confuso, chato',       color: '#EF4444' },
  { id: 'tempo',         label: 'Vai demorar',            hint: 'Sem tempo / não é conveniente',    color: '#06B6D4' },
]
export const DRIVER_BY_ID = Object.fromEntries(DRIVERS.map((d) => [d.id, d]))

// ─── Opções dos passos guiados ──────────────────────────────────────────────
export const ATENCAO_OPTS = [
  { value: '1a1',    label: '1 a 1',            hint: 'Atenção individual — maior valor, menor escala' },
  { value: 'grupo',  label: 'Pequeno grupo',    hint: 'Turmas — equilíbrio valor/escala' },
  { value: 'muitos', label: 'Um-para-muitos',   hint: 'Curso/app — máxima escala e margem' },
]
export const ESFORCO_OPTS = [
  { value: 'dfy', label: 'Faço por ele (DFY)',  hint: 'Menor esforço do cliente = maior valor' },
  { value: 'dwy', label: 'Faço com ele (DWY)',  hint: 'Acompanho de perto' },
  { value: 'diy', label: 'Ele faz sozinho (DIY)', hint: 'Só entrego o método' },
]
export const MEIO_OPTS = ['Presencial', 'Vídeo', 'Áudio', 'Texto', 'Zoom', 'Dashboard/App', 'WhatsApp']

export const ESCASSEZ_TIPOS = [
  { value: 'vagas',       label: 'Vagas totais',    tpl: 'Atendemos apenas [X] clientes no total.' },
  { value: 'crescimento', label: 'Vagas por semana', tpl: 'Aceitamos só [X] novos clientes por semana.' },
  { value: 'cohort',      label: 'Por turma',        tpl: 'Abrimos [X] vagas por turma — abre e fecha.' },
  { value: 'honesta',     label: 'Capacidade real',  tpl: 'Estamos a [X]% da capacidade deste mês.' },
  { value: 'nenhuma',     label: 'Sem escassez',     tpl: '' },
]
export const URGENCIA_TIPOS = [
  { value: 'cohort',       label: 'Turma começa',   tpl: 'A próxima turma começa dia [X] — depois só na próxima.' },
  { value: 'sazonal',      label: 'Sazonal',        tpl: 'Condição da [promo/estação] vai só até [data].' },
  { value: 'preco',        label: 'Preço/bônus',    tpl: 'Fechando agora você garante [condição] que muda em ~[X] semanas.' },
  { value: 'oportunidade', label: 'Janela',         tpl: 'Essa oportunidade decai com o tempo: quanto antes, melhor.' },
  { value: 'nenhuma',      label: 'Sem urgência',   tpl: '' },
]
export const GARANTIA_TIPOS = [
  { value: 'incondicional', label: 'Incondicional', dica: 'Dinheiro de volta sem perguntas. Ideal p/ B2C / ticket baixo.',
    tplB2c: 'Se em [Y] você não [X], devolvemos 100% do seu dinheiro, sem perguntas.',
    tplB2b: 'Teste por [Y]; se não [X], devolvemos 100%.' },
  { value: 'condicional', label: 'Condicional', dica: 'Se fez as ações e não teve resultado. Ideal p/ B2B / high-ticket.',
    tplB2c: 'Se você fizer [ações] e não [X] em [Y], devolvemos + [bônus].',
    tplB2b: 'Se você fizer [ações] e não atingir [X] em [Y], devolvemos seu dinheiro + o que gastou em [custo].' },
  { value: 'anti', label: 'Anti-garantia', dica: 'Todas as vendas finais. Para produto copiável/consumível.',
    tplB2c: 'Todas as vendas são finais, porque [motivo forte de exposição].',
    tplB2b: 'Todas as vendas finais — expomos [processo proprietário], por isso não há reembolso.' },
  { value: 'implicita', label: 'Performance', dica: 'Só cobro se der resultado (revshare). Quando dá pra medir.',
    tplB2c: 'Você só paga [valor] quando [resultado] acontecer.',
    tplB2b: 'Modelo por performance: você só paga [%/valor] sobre o [resultado] que gerarmos.' },
]

// ─── Metadados dos passos (ordem da linha de produção) ──────────────────────
export const STEP_META = [
  { id: 'diagnostico', title: 'Cabe uma oferta matadora?', subtitle: 'Diagnóstico de viabilidade', optional: false },
  { id: 'sonho',       title: 'O Sonho do cliente',        subtitle: 'Dream Outcome + status',       optional: false },
  { id: 'problemas',   title: 'Problemas e objeções',      subtitle: 'Os 4 drivers de valor',        optional: false },
  { id: 'solucoes',    title: 'Soluções',                  subtitle: 'Vire cada problema em "Como..."', optional: true },
  { id: 'entrega',     title: 'Como você entrega',         subtitle: 'Delivery Cube',                optional: true },
  { id: 'nucleo',      title: 'Núcleo, stack e preço',     subtitle: 'Trim & Stack + valor 10x',     optional: false },
  { id: 'escassez',    title: 'Escassez e urgência',       subtitle: 'Por que agir agora',           optional: true },
  { id: 'bonus',       title: 'Bônus',                     subtitle: '1 bônus por objeção',          optional: true },
  { id: 'garantia',    title: 'Garantia',                  subtitle: 'Reverta o risco',              optional: true },
  { id: 'nome',        title: 'Nome da oferta',            subtitle: 'Fórmula M-A-G-I-C',            optional: false },
  { id: 'final',       title: 'Gerar oferta',              subtitle: 'A IA monta as 3 versões',      optional: false },
]

// ─── Prompt do sistema (geração final das 3 GOMs) ───────────────────────────
export const GOM_SYSTEM_PROMPT = `# Criador de Grande Oferta Matadora (GOM): Metodologia Alex Hormozi ($100M Offers)

Você é um especialista em ofertas irresistíveis com domínio da metodologia $100M Offers. O usuário já passou por um wizard estruturado (sonho, problemas por driver, soluções, entrega, stack com valores, escassez, urgência, bônus, garantia e nome). Seu trabalho é REFINAR esse material e torná-lo irresistível — NÃO inventar dados que contradigam o que foi preenchido. Preencha lacunas com o mínimo de suposição; sinalize suposições entre [colchetes].

Gere exatamente 3 GOMs, cada uma com um ângulo distinto:
- GOM 1: foco em garantia agressiva
- GOM 2: foco em bônus empilhados
- GOM 3: modelo performance/exclusividade high-ticket

### TEMPLATE DE CADA GOM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GOM #[N]: [Abordagem principal]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📛 NOME
[Nome M-A-G-I-C]

🎯 RESULTADO PROMETIDO
[Resultado específico com número + prazo + impacto no STATUS]

📦 O QUE ESTÁ INCLUÍDO
• [Item principal] .................. R$ X.XXX
• [Bônus 1] ......................... R$ X.XXX
• [Bônus 2] ......................... R$ X.XXX
  ─────────────────────────────────
  Valor total: R$ XX.XXX
  Preço: R$ X.XXX (cliente paga X% do valor)

🛡️ GARANTIA
[Tipo + condição "se não X em Y, então Z"]

⚡ ESCASSEZ / URGÊNCIA
[Por que agir agora]

💬 PITCH (fale assim para o cliente)
"[Pitch direto, 3 a 5 linhas]"

### DIRETRIZES
- Especificidade vende: números e prazos sempre.
- Status é tudo: como o cliente será visto pelos outros.
- Cada bônus resolve uma objeção; valor dos bônus > produto principal.
- Nunca dê desconto — adicione bônus.
- Mantenha valores/prazos coerentes com o que foi informado.

Responda em português do Brasil, direto e orientado a resultado. Sem introduções, só o output. Não use travessões (—).`

// ─── Builder do prompt final (envia todo o raciocínio do wizard) ────────────
export function buildFinalPrompt(project, o) {
  const byDriver = (id) =>
    (o.problemas || []).filter((p) => p.driver === id).map((p) => `  - ${p.texto}`).join('\n') || '  - (nenhum)'
  const solucoes = (o.solucoes || [])
    .filter((s) => s.comoResolve?.trim())
    .map((s) => {
      const prob = (o.problemas || []).find((p) => p.id === s.problemaId)
      return `  - ${prob ? prob.texto + ' → ' : ''}${s.comoResolve}`
    }).join('\n') || '  - (não informado)'
  const stack = (o.itensStack || [])
    .map((i, idx) => `  - Entrega ${idx + 1}: ${i.nome} (R$ ${i.valor || '?'})`)
    .join('\n') || '  - (não informado)'
  const bonus = (o.bonus || []).filter((b) => b.trim()).map((b, i) => `  ${i + 1}. ${b}`).join('\n') || '  - (não informado)'
  const valorTotal = (o.itensStack || []).reduce((s, i) => s + (Number(i.valor) || 0), 0)

  return `EMPRESA: ${project.companyName}
NICHO: ${project.businessType || project.segmento || 'não informado'}
TIPO DE CLIENTE: ${o.tipoCliente === 'b2b' ? 'B2B (empresa)' : o.tipoCliente === 'b2c' ? 'B2C (consumidor)' : 'não informado'}

SONHO:
  Hoje (dor): ${o.dorAtual || 'não informado'}
  Sonho: ${o.resultadoSonho || 'não informado'}
  Status ganho: ${o.statusGanho || 'não informado'}

PROBLEMAS POR DRIVER:
  Não vale a pena (valor):
${byDriver('valor')}
  Não vai funcionar (probabilidade):
${byDriver('probabilidade')}
  É difícil (esforço):
${byDriver('esforco')}
  Vai demorar (tempo):
${byDriver('tempo')}

SOLUÇÕES:
${solucoes}

ENTREGA:
  Atenção: ${o.entrega?.atencao || '?'} · Esforço: ${o.entrega?.esforcoModelo || '?'} · Meio: ${(o.entrega?.meio || []).join(', ') || '?'}
  1ª vitória (velocidade): ${o.velocidade || 'não informado'}
  Esforço mínimo do cliente: ${o.esforcoMinimo || 'não informado'}

STACK (núcleo: ${o.nucleo || 'não informado'}):
${stack}
  Valor total somado: R$ ${valorTotal} · Preço final: R$ ${o.preco || 'não informado'}

ESCASSEZ (${o.escassezTipo || '-'}): ${o.escassez || 'não informado'}
URGÊNCIA (${o.urgenciaTipo || '-'}): ${o.urgencia || 'não informado'}
BÔNUS:
${bonus}
GARANTIA (${o.garantiaTipo || '-'}): ${o.garantia || 'não informado'}
NOME base: ${o.nome || 'não informado'}

Gere as 3 GOMs refinando este material.`
}

// ─── Assistentes de IA por passo (retornam dados estruturados) ──────────────
// Extrai JSON de uma resposta possivelmente cercada por ```.
function extractJson(text) {
  if (!text) return null
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const start = t.search(/[[{]/)
  if (start > 0) t = t.slice(start)
  try { return JSON.parse(t) } catch { /* tenta cortar sobras */ }
  const lastArr = t.lastIndexOf(']'), lastObj = t.lastIndexOf('}')
  const end = Math.max(lastArr, lastObj)
  if (end > 0) { try { return JSON.parse(t.slice(0, end + 1)) } catch { return null } }
  return null
}

const ctx = (project, o) =>
  `Empresa: ${project.companyName}. Nicho: ${project.businessType || project.segmento || '?'}. ` +
  `Cliente: ${o.tipoCliente || '?'}. Dor de hoje: ${o.dorAtual || '?'}. Sonho: ${o.resultadoSonho || '?'}.`

// kind ∈ 'sonho' | 'problemas' | 'solucoes' | 'stack' | 'bonus' | 'garantia' | 'nomes'
export async function aiAssist({ kind, project, oferta: o }) {
  let system = 'Você é especialista em ofertas ($100M Offers, Hormozi). Responda SOMENTE com JSON válido, sem texto fora do JSON, sem travessões.'
  let user = ''

  if (kind === 'sonho') {
    user = `${ctx(project, o)}
Refine em JSON {"dorAtual","resultadoSonho","statusGanho"}. dorAtual=estado atual doloroso; resultadoSonho=resultado específico com número/prazo; statusGanho=como será visto pelos outros. Seja específico.`
  } else if (kind === 'problemas') {
    user = `${ctx(project, o)}
Liste de 8 a 12 objeções/problemas REAIS do público (antes, durante e depois da compra), classificados por driver.
Retorne JSON array [{"texto","driver"}]. driver ∈ "valor" (não vale a pena), "probabilidade" (não vai funcionar pra mim), "esforco" (difícil/trabalhoso), "tempo" (demora/inconveniente).`
  } else if (kind === 'solucoes') {
    const probs = (o.problemas || []).map((p) => ({ id: p.id, texto: p.texto }))
    user = `${ctx(project, o)}
Para cada problema abaixo, escreva a solução começando com "Como...". Retorne JSON array [{"id","comoResolve"}] usando os mesmos ids.
Problemas: ${JSON.stringify(probs)}`
  } else if (kind === 'stack') {
    const sol = (o.solucoes || []).map((s) => s.comoResolve).filter(Boolean)
    user = `${ctx(project, o)}
Monte a lista de ENTREGAS (componentes) da oferta a partir destas soluções: ${JSON.stringify(sol)}.
Retorne JSON array [{"nome","valor"}]. nome=nome sedutor da entrega com benefício. valor=número em reais (só o número). Não inclua bônus (são um passo à parte).`
  } else if (kind === 'bonus') {
    const sol = (o.solucoes || []).map((s) => s.comoResolve).filter(Boolean)
    const entregas = (o.itensStack || []).map((i) => i.nome).filter(Boolean)
    user = `${ctx(project, o)}
Sugira de 3 a 6 BÔNUS que ataquem objeções não cobertas pelas entregas atuais.
Entregas já na oferta: ${JSON.stringify(entregas)}. Soluções mapeadas: ${JSON.stringify(sol)}.
Prefira ferramentas, checklists e templates (baixo esforço, alto valor). Retorne JSON array [{"nome","valor"}]. valor=número em reais.`
  } else if (kind === 'garantia') {
    const tipo = o.garantiaTipo || 'condicional'
    user = `${ctx(project, o)}
Escreva UMA garantia do tipo "${tipo}" no formato "Se você não [X] em [Y], então [Z]". Use o sonho/prazo do contexto. Retorne JSON {"garantia"}.`
  } else if (kind === 'nomes') {
    user = `${ctx(project, o)}
Gere 5 nomes de oferta usando a fórmula M-A-G-I-C (Magnet, Avatar, Goal, Interval, Container). Curtos e punchy. Retorne JSON array de strings.`
  } else {
    throw new Error('assist kind inválido')
  }

  const text = await streamClaude({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: [{ type: 'text', text: system }],
    messages: [{ role: 'user', content: user }],
    onChunk: () => {},
  })
  const parsed = extractJson(text)
  if (parsed == null) throw new Error('A IA não retornou um formato válido. Tente de novo.')
  return parsed
}
