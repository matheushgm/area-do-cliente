import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircle2, Loader2, AlertTriangle, Plus, X,
  Package, Users, HelpCircle, ChevronDown, Edit2,
} from 'lucide-react'
import VideoGuide from '../components/VideoGuide'

// ─── Perguntas de cada módulo ─────────────────────────────────────────────────
const PRODUTO_QUESTIONS = [
  { id: 'q1',  emoji: '🎯', label: 'O que seu produto resolve?' },
  { id: 'q2',  emoji: '⏰', label: 'Por que e em que momento o seu cliente precisa do seu produto/serviço?' },
  { id: 'q3',  emoji: '✨', label: 'Como é a vida dele depois de usar seu produto/serviço?' },
  { id: 'q4',  emoji: '🏆', label: 'Por que vou usar seu produto/serviço e não o do concorrente?' },
  { id: 'q5',  emoji: '🔥', label: 'Por que eu preciso comprar agora?' },
  { id: 'q6',  emoji: '😔', label: 'Como é a vida sem o seu produto/serviço?' },
  { id: 'q7',  emoji: '🚧', label: 'Quais são as principais desculpas que os clientes dão para não comprar?' },
  { id: 'q8',  emoji: '🔄', label: 'Já tentou resolver esse problema de outra forma antes? O que não funcionou?' },
  { id: 'q9',  emoji: '🤔', label: 'O que faz o cliente desconfiar de produtos como o seu?' },
  { id: 'q10', emoji: '📊', label: 'Tem cases de clientes com resultado mensurável?' },
  { id: 'q11', emoji: '⏱️', label: 'Quanto tempo leva para o cliente sentir o primeiro resultado?' },
  { id: 'q12', emoji: '💬', label: 'O que seus clientes mais elogiam espontaneamente?' },
  { id: 'q13', emoji: '💡', label: 'O que você faz que nenhum concorrente faz ou consegue copiar facilmente?' },
  { id: 'q14', emoji: '⚠️', label: 'O que acontece se o cliente esperar mais 3 meses para resolver isso?' },
  { id: 'q15', emoji: '📅', label: 'Existe alguma sazonalidade ou janela de oportunidade no seu mercado?' },
  { id: 'q16', emoji: '🛡️', label: 'Você oferece alguma garantia hoje? Se não, o que te impede?' },
  { id: 'q17', emoji: '🤝', label: 'Se der errado, o que você faz pelo cliente?' },
]

const PERSONA_QUESTIONS = [
  { key: 'resultado', emoji: '🎯', label: 'Qual é o resultado que seu cliente percebe após usar seu produto ou serviço?',      hint: 'Descreva como é a vida do seu cliente depois que ele usa de fato seu produto / serviço.' },
  { key: 'acoes',     emoji: '⚡', label: 'O que seu cliente precisa FAZER para alcançar esse resultado?',                    hint: 'Descreva as ações, comportamentos e responsabilidades do cliente no processo.' },
  { key: 'tempo',     emoji: '⏱️', label: 'Em quanto tempo o cliente consegue alcançar o resultado?',                         hint: 'Tempo para o primeiro resultado visível e para a transformação real.' },
  { key: 'objecoes',  emoji: '🚧', label: 'Quais são as principais objeções que seu cliente usa para não comprar?',            hint: 'As justificativas e desculpas mais comuns que ele dá.' },
  { key: 'sonhos',    emoji: '✨', label: 'Quais são os sonhos do seu cliente que sua empresa consegue realizar?',             hint: 'O resultado emocional e de vida que ele deseja.' },
  { key: 'erros',     emoji: '❌', label: 'Quais erros seu cliente comete que o afastam do resultado desejado?',              hint: 'Erros cometidos antes ou durante o uso do seu produto.' },
  { key: 'medos',     emoji: '😰', label: 'Quais são os maiores medos do seu cliente?',                                       hint: 'Medos pessoais e profissionais que podem se tornar realidade.' },
  { key: 'sinais',    emoji: '🔍', label: 'Quais sinais o cliente percebe que indicam que ele tem um problema a resolver?',   hint: 'O que faz com que ele comece a buscar uma solução.' },
  { key: 'habitos',   emoji: '🔄', label: 'Quais são os hábitos do seu cliente ideal?',                                       hint: 'Hábitos de consumo, comportamento, rotina — dentro e fora do trabalho.' },
]

// ─── Questions Help ───────────────────────────────────────────────────────────
const QUESTIONS_HELP = {
  q1:  { text: 'Descreva o problema principal que o seu produto ou serviço elimina da vida do cliente. Seja objetivo: qual é a dor, a dificuldade ou o incômodo que existia antes e que o seu produto veio resolver? Evite falar sobre funcionalidades ou características técnicas aqui. Foque no problema real que a pessoa tinha.', example: '"Meu produto resolve a dificuldade de pequenos empresários em controlar o estoque sem perder tempo com planilhas manuais."' },
  q2:  { text: 'Pense no contexto de vida ou de trabalho do seu cliente. Qual é a situação específica que faz ele perceber que precisa do que você oferece? Existe um gatilho, uma data, uma fase ou um evento que antecede a compra? Quanto mais preciso você for aqui, mais certeiros serão os anúncios.', example: '"Ele percebe que precisa quando começa a perder vendas por falta de controle ou quando vai abrir uma segunda unidade."' },
  q3:  { text: 'Descreva a transformação. Como o dia a dia do seu cliente muda depois que ele começa a usar o que você vende? O que ele consegue fazer que antes não conseguia? Como ele se sente? Pense na vida ideal que ele conquista, não nas funções do produto.', example: '"Ele consegue ver o estoque em tempo real pelo celular, para de perder vendas e dorme mais tranquilo sabendo que tudo está sob controle."' },
  q4:  { text: 'Quais são os diferenciais reais que separam você da concorrência? Pense em atendimento, metodologia, resultado, prazo, garantia, exclusividade, experiência ou qualquer fator que faz um cliente que pesquisou as opções escolher você. Seja honesto e específico.', example: '"Somos os únicos que oferecem implementação em 48h com suporte por WhatsApp incluso no plano básico."' },
  q5:  { text: 'O que cria urgência real na decisão do seu cliente? Pode ser uma janela de oportunidade, um custo crescente de não resolver o problema, uma limitação de vagas ou estoque, uma promoção com prazo ou simplesmente o prejuízo acumulado de adiar. Liste o que você usa ou poderia usar para justificar a compra imediata.', example: '"Cada mês sem controle de estoque significa perda média de R$3.000 em mercadoria não rastreada."' },
  q6:  { text: 'Descreva a realidade do cliente antes da sua solução. Quais são as frustrações do dia a dia, os riscos que ele corre, as perdas que ele tem? Seja específico sobre as consequências de não resolver esse problema. Essa resposta é muito importante para criar empatia nos anúncios.', example: '"Ele perde tempo recontando estoque manualmente, descobre rupturas tarde demais e perde vendas sem saber exatamente onde está o erro."' },
  q7:  { text: 'Liste as objeções mais comuns que você ouve no momento da venda: preço, tempo, "vou pensar", "não é o momento certo", "já tentei algo assim antes". Cada objeção que você listar vira uma resposta nos nossos anúncios e nas páginas de vendas.', example: '"É caro", "Minha equipe não vai adotar", "Agora não é o momento".' },
  q8:  { text: 'Antes de chegar até você, o seu cliente provavelmente tentou outras soluções: planilhas, concorrentes, soluções caseiras, consultores. O que não deu certo? Por quê? Essa informação ajuda a mostrar que você entende a jornada do cliente e que sua solução é diferente do que ele já experimentou.', example: '"Já usou planilha no Excel, mas ninguém atualizava. Já contratou um sistema mais barato, mas o suporte era ruim."' },
  q9:  { text: 'Existe algum histórico negativo no seu mercado? Promessas que não foram cumpridas por outros players? Mitos, medos ou preconceitos que fazem o cliente hesitar? Conhecendo essa desconfiança, criamos anúncios que antecipam e quebram essas barreiras antes mesmo do primeiro contato.', example: '"Clientes desconfiam porque já viram sistemas que prometem muito e na hora de usar são complicados demais."' },
  q10: { text: 'Relate resultados reais de clientes, com números sempre que possível. Quanto economizaram? Quanto cresceram? Em quanto tempo? Se tiver depoimentos ou prints de resultados, melhor ainda. Essa é a prova social mais poderosa que existe em anúncios.', example: '"A empresa X reduziu em 40% as perdas de estoque em 3 meses. A empresa Y cresceu 25% nas vendas no primeiro trimestre."' },
  q11: { text: 'Qual é o "tempo até o primeiro ganho"? Pode ser em horas, dias ou semanas. Esse dado é fundamental para reduzir o medo de comprar, porque ninguém quer esperar meses para ver se valeu a pena. Se tiver marcos intermediários de resultado, descreva-os.', example: '"Em até 48h após a implementação, o gestor já consegue ver o estoque completo em tempo real pelo app."' },
  q12: { text: 'Pense nos comentários que você mais ouve no pós-venda, nas avaliações, nas mensagens de WhatsApp. O que os clientes falam quando recomendam você para alguém? Essas palavras são ouro para os nossos anúncios porque são a voz real do seu público.', example: '"Facilidade de uso", "Suporte muito rápido", "Finalmente consegui ter controle de verdade".' },
  q13: { text: 'Aqui buscamos seu diferencial mais profundo: pode ser uma metodologia proprietária, uma combinação única de serviços, uma tecnologia exclusiva, um processo, um time especializado ou até uma posição de mercado difícil de replicar. Seja específico e honesto.', example: '"Somos os únicos com integração nativa ao sistema fiscal do cliente, sem necessidade de customização."' },
  q14: { text: 'Qual é o custo real da inação? Descreva as consequências concretas de postergar a decisão: prejuízos financeiros, problemas que se agravam, oportunidades perdidas, riscos que aumentam. Essa resposta ajuda a criar urgência verdadeira, sem precisar de pressão falsa.', example: '"Em 3 meses ele terá perdido em média R$9.000 em rupturas não rastreadas e processado mais uma safra com dado errado."' },
  q15: { text: 'Há épocas do ano em que a demanda pelo seu produto aumenta ou diminui? Existe alguma data, período ou evento que cria uma janela de oportunidade para comprar? Isso influencia diretamente o calendário das campanhas e as mensagens de urgência que usamos.', example: '"O pico de procura é em março, antes do início do segundo semestre. Quem não contrata até fevereiro geralmente espera mais um ano."' },
  q16: { text: 'Descreva qualquer garantia formal ou informal que você já pratica: devolução do dinheiro, garantia de resultado, período de teste, retrabalho sem custo. Se não oferece nenhuma, explique o que te impede, pois isso pode ser um ponto importante a trabalhar para aumentar a conversão.', example: '"Oferecemos 15 dias de teste gratuito sem cartão de crédito e reembolso total em até 30 dias sem questionamentos."' },
  q17: { text: 'Descreva seu protocolo real quando algo não sai como esperado. O que você faz concretamente para corrigir, compensar ou resolver a situação? Essa resposta mostra responsabilidade e reduz o medo de comprar, especialmente em clientes que já tiveram experiências ruins no passado.', example: '"Se o resultado não for alcançado no prazo prometido, refazemos a implementação sem custo adicional e acompanhamos até funcionar."' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return crypto.randomUUID() }

function newProduto(n) {
  return {
    id: uid(),
    nome: n || 'Produto 1',
    tipo: 'produto',
    answers: Object.fromEntries(PRODUTO_QUESTIONS.map((q) => [q.id, ''])),
  }
}

function newPersona(n) {
  return {
    id: uid(),
    name: n || 'Persona 1',
    answers: Object.fromEntries(PERSONA_QUESTIONS.map((q) => [q.key, []])),
  }
}

// Convert array ↔ textarea string
const arrToText = (arr) => (Array.isArray(arr) ? arr.join('\n') : arr || '')
const textToArr = (text) =>
  text.split('\n').map((s) => s.trim()).filter(Boolean)

// ─── Analytics / Form tracking ────────────────────────────────────────────────

function trackFormSubmit(formName, extra = {}) {
  // 1. GTM dataLayer — funciona com trigger de Evento Personalizado
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event: 'form_submit', form_name: formName, ...extra })

  // 2. Elemento <form> real + evento submit nativo
  //    Necessário para o trigger built-in "Form Submission" do GTM
  const form = document.createElement('form')
  form.id = `rl-form-${formName}`
  form.setAttribute('data-form-name', formName)
  Object.entries(extra).forEach(([k, v]) => {
    const inp = document.createElement('input')
    inp.type = 'hidden'; inp.name = k; inp.value = v ?? ''
    form.appendChild(inp)
  })
  document.body.appendChild(form)
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  document.body.removeChild(form)
}

// ─── PDF generators (client-facing) ──────────────────────────────────────────

const PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 32px 40px; max-width: 900px; margin: 0 auto; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #164496; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #164496; }
  .doc-title { font-size: 22px; font-weight: 800; color: #0F172A; margin-bottom: 2px; }
  .doc-subtitle { font-size: 13px; color: #64748B; }
  .doc-date { font-size: 11px; color: #94A3B8; text-align: right; margin-top: 4px; }
  .block { border: 1px solid #D8E0F0; border-radius: 10px; padding: 16px; margin-bottom: 20px; page-break-inside: avoid; }
  .block-title { font-size: 15px; font-weight: 700; color: #164496; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #D8E0F0; }
  .qa-item { margin-bottom: 10px; }
  .qa-label { font-size: 10px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .qa-value { font-size: 12px; color: #334155; line-height: 1.6; white-space: pre-wrap; }
  .info-box { background: #F0F7FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px; color: #1e40af; }
  .print-btn { position: fixed; bottom: 24px; right: 24px; background: #164496; color: white; border: none; border-radius: 10px; padding: 12px 24px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(22,68,150,0.35); }
  .print-btn:hover { background: #0F3380; }
  @media print { .print-btn { display: none !important; } body { padding: 20px 24px; } .block { page-break-inside: avoid; } }
`

function escPDF(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function openPDF(htmlBody, docTitle) {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const header = `<div class="header"><div><div class="logo">Revenue Lab</div><div class="doc-title">${escPDF(docTitle)}</div></div><div class="doc-date">Gerado em ${today}</div></div>`
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escPDF(docTitle)}</title><style>${PDF_CSS}</style></head><body>${header}${htmlBody}<button class="print-btn" onclick="window.print()">🖨️ Salvar como PDF</button></body></html>`
  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) { alert('Permita pop-ups para gerar o PDF.'); return }
  win.document.write(html)
  win.document.close()
}

function generateProdutoPDF(companyName, produtosArr) {
  const infoBox = `<div class="info-box">📋 Este PDF é uma cópia de segurança das suas respostas. As informações também foram salvas automaticamente no sistema.</div>`
  const blocksHTML = produtosArr.map((p) => {
    const tipo = p.tipo === 'servico' ? 'Serviço' : 'Produto Físico'
    const qaHTML = PRODUTO_QUESTIONS.map((q) => {
      const ans = (p.answers[q.id] || '').trim()
      if (!ans) return ''
      return `<div class="qa-item"><div class="qa-label">${escPDF(q.emoji)} ${escPDF(q.label)}</div><div class="qa-value">${escPDF(ans)}</div></div>`
    }).join('')
    return `<div class="block"><div class="block-title">${escPDF(p.nome || 'Produto')} <span style="font-size:11px;font-weight:400;color:#94A3B8;">(${tipo})</span></div>${qaHTML || '<div class="qa-value" style="color:#94A3B8">Nenhuma pergunta respondida.</div>'}</div>`
  }).join('')
  openPDF(infoBox + blocksHTML, `Produto / Serviço — ${companyName}`)
}

function generatePersonaPDF(companyName, personasArr) {
  const infoBox = `<div class="info-box">📋 Este PDF é uma cópia de segurança das suas respostas. As informações também foram salvas automaticamente no sistema.</div>`
  const blocksHTML = personasArr.map((p) => {
    const qaHTML = PERSONA_QUESTIONS.map((q) => {
      const val = arrToText(p.answers[q.key]).trim()
      if (!val) return ''
      return `<div class="qa-item"><div class="qa-label">${escPDF(q.emoji)} ${escPDF(q.label)}</div><div class="qa-value">${escPDF(val)}</div></div>`
    }).join('')
    return `<div class="block"><div class="block-title">${escPDF(p.name || 'Persona')}</div>${qaHTML || '<div class="qa-value" style="color:#94A3B8">Nenhuma pergunta respondida.</div>'}</div>`
  }).join('')
  openPDF(infoBox + blocksHTML, `Personas — ${companyName}`)
}

// ─── Save status indicator ────────────────────────────────────────────────────
function SaveBadge({ status }) {
  if (status === 'saving') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-muted">
      <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
    </span>
  )
  if (status === 'saved') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-green">
      <CheckCircle2 className="w-3 h-3" /> Salvo
    </span>
  )
  return null
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientForm() {
  const { token } = useParams()

  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [companyName, setCompanyName] = useState('')

  // Section state
  const [activeTab, setActiveTab] = useState('produto')

  // Produto state
  const [produtos, setProdutos]   = useState([newProduto()])
  const [activeProdIdx, setActiveProdIdx] = useState(0)
  // One-question-at-a-time state
  const [currentProdutoQ, setCurrentProdutoQ] = useState(0)
  const [currentPersonaQ, setCurrentPersonaQ] = useState(0)
  const [helpOpen, setHelpOpen]     = useState(false)
  const [questionError, setQuestionError] = useState(null)

  // Persona state
  const [personas, setPersonas]   = useState([newPersona()])
  const [activePerIdx, setActivePerIdx] = useState(0)

  // Save status per module
  const [saveStatus, setSaveStatus] = useState({ produto: 'idle', persona: 'idle' })

  const debounceRefs = useRef({})

  // ── Load data on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/client-form?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar formulário.')

        setCompanyName(data.companyName || '')

        if (data.produtos?.length) {
          const mapped = data.produtos.map((p) => ({
            ...p,
            answers: { ...Object.fromEntries(PRODUTO_QUESTIONS.map((q) => [q.id, ''])), ...p.answers },
          }))
          setProdutos(mapped)
          const first = mapped[0]
          const firstUnanswered = PRODUTO_QUESTIONS.findIndex(q => !first.answers[q.id]?.trim())
          setCurrentProdutoQ(firstUnanswered === -1 ? PRODUTO_QUESTIONS.length : firstUnanswered)
        }

        if (data.personas?.length) {
          const mapped = data.personas.map((p) => ({
            ...p,
            answers: { ...Object.fromEntries(PERSONA_QUESTIONS.map((q) => [q.key, []])), ...p.answers },
          }))
          setPersonas(mapped)
          const firstP = mapped[0]
          const firstUnansweredP = PERSONA_QUESTIONS.findIndex(q => !arrToText(firstP.answers[q.key]).trim())
          setCurrentPersonaQ(firstUnansweredP === -1 ? PERSONA_QUESTIONS.length : firstUnansweredP)
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  // ── Debounced save ─────────────────────────────────────────────────────────
  const scheduleSave = useCallback((mod, payload) => {
    clearTimeout(debounceRefs.current[mod])
    setSaveStatus((s) => ({ ...s, [mod]: 'saving' }))
    debounceRefs.current[mod] = setTimeout(async () => {
      try {
        const res = await fetch('/api/client-form', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token, module: mod, data: payload }),
        })
        if (!res.ok) throw new Error()
        setSaveStatus((s) => ({ ...s, [mod]: 'saved' }))
        setTimeout(() => setSaveStatus((s) => ({ ...s, [mod]: 'idle' })), 2500)
      } catch {
        setSaveStatus((s) => ({ ...s, [mod]: 'idle' }))
      }
    }, 1500)
  }, [token])

  // ── Produto handlers ───────────────────────────────────────────────────────
  const updateProdutoAnswer = (qId, value) => {
    const next = produtos.map((p, i) =>
      i === activeProdIdx ? { ...p, answers: { ...p.answers, [qId]: value } } : p
    )
    setProdutos(next)
    scheduleSave('produtos', { produtos: next })
  }

  const updateProdutoField = (field, value) => {
    const next = produtos.map((p, i) =>
      i === activeProdIdx ? { ...p, [field]: value } : p
    )
    setProdutos(next)
    scheduleSave('produtos', { produtos: next })
  }

  const addProduto = () => {
    const next = [...produtos, newProduto(`Produto ${produtos.length + 1}`)]
    setProdutos(next)
    setActiveProdIdx(next.length - 1)
    scheduleSave('produtos', { produtos: next })
  }

  const removeProduto = (idx) => {
    if (produtos.length === 1) return
    const next = produtos.filter((_, i) => i !== idx)
    setProdutos(next)
    setActiveProdIdx(Math.min(activeProdIdx, next.length - 1))
    scheduleSave('produtos', { produtos: next })
  }

  // ── Persona handlers ───────────────────────────────────────────────────────
  const updatePersonaAnswer = (key, value) => {
    const next = personas.map((p, i) =>
      i === activePerIdx ? { ...p, answers: { ...p.answers, [key]: textToArr(value) } } : p
    )
    setPersonas(next)
    scheduleSave('personas', { personas: next })
  }

  const updatePersonaName = (value) => {
    const next = personas.map((p, i) =>
      i === activePerIdx ? { ...p, name: value } : p
    )
    setPersonas(next)
    scheduleSave('personas', { personas: next })
  }

  const addPersona = () => {
    const next = [...personas, newPersona(`Persona ${personas.length + 1}`)]
    setPersonas(next)
    setActivePerIdx(next.length - 1)
    scheduleSave('personas', { personas: next })
  }

  const removePersona = (idx) => {
    if (personas.length === 1) return
    const next = personas.filter((_, i) => i !== idx)
    setPersonas(next)
    setActivePerIdx(Math.min(activePerIdx, next.length - 1))
    scheduleSave('personas', { personas: next })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-rl-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-rl-purple animate-spin" />
          <p className="text-rl-muted text-sm">Carregando formulário...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-rl-dark flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-rl-text">Link inválido</h2>
          <p className="text-sm text-rl-muted">{error}</p>
        </div>
      </div>
    )
  }

  const TABS = [
    { id: 'produto', label: 'Produto / Serviço', icon: Package, color: 'text-rl-gold' },
    { id: 'persona', label: 'Personas',           icon: Users,   color: 'text-rl-blue' },
  ]

  const produto = produtos[activeProdIdx]
  const persona = personas[activePerIdx]

  return (
    <div className="min-h-screen bg-rl-dark">
      {/* Header */}
      <div className="border-b border-rl-border bg-rl-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-rl-muted font-medium uppercase tracking-wider">Formulário de Briefing</p>
            <h1 className="text-lg font-bold text-rl-text">{companyName}</h1>
          </div>
          <SaveBadge status={saveStatus[activeTab === 'produto' ? 'produtos' : 'personas']} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Instrução */}
        <div className="glass-card p-5 border-l-4 border-rl-purple">
          <p className="text-sm text-rl-text font-medium mb-1">Como preencher</p>
          <p className="text-sm text-rl-muted leading-relaxed">
            Preencha as informações abaixo com o máximo de detalhes possível. Quanto mais completas forem as respostas, melhores serão as estratégias desenvolvidas para o seu negócio. As informações são salvas automaticamente conforme você digita.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setQuestionError(null)
                setHelpOpen(false)
                setActiveTab(t.id)
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                activeTab === t.id
                  ? 'bg-gradient-rl text-white border-transparent shadow-glow'
                  : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
              }`}
            >
              <t.icon className={`w-4 h-4 ${activeTab === t.id ? 'text-white' : t.color}`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── PRODUTO / SERVIÇO ──────────────────────────────────────────────── */}
        {activeTab === 'produto' && (
          <div className="space-y-4">

            <VideoGuide videoId="awwUFJhqHOE" label="Como preencher o módulo de Produto / Serviço" />

            {/* Sub-tabs de produto */}
            <div className="flex gap-2 flex-wrap">
              {produtos.map((p, i) => (
                <div key={p.id} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setActiveProdIdx(i)
                      const p = produtos[i]
                      const firstUnanswered = PRODUTO_QUESTIONS.findIndex(q => !p.answers[q.id]?.trim())
                      setCurrentProdutoQ(firstUnanswered === -1 ? PRODUTO_QUESTIONS.length : firstUnanswered)
                      setHelpOpen(false)
                      setQuestionError(null)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activeProdIdx === i
                        ? 'bg-rl-gold/20 text-rl-gold border border-rl-gold/40'
                        : 'bg-rl-surface text-rl-muted border border-rl-border hover:text-rl-text'
                    }`}
                  >
                    {p.nome || `Produto ${i + 1}`}
                  </button>
                  {produtos.length > 1 && (
                    <button onClick={() => removeProduto(i)} className="p-1 text-rl-muted/50 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addProduto} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-rl-muted hover:text-rl-text border border-dashed border-rl-border hover:border-rl-gold/40 transition-all">
                <Plus className="w-3 h-3" /> Novo Produto
              </button>
            </div>

            {/* Nome + Tipo */}
            <div className="glass-card p-5 space-y-4">
              <div>
                <label className="label-field">Nome do Produto / Serviço</label>
                <input
                  value={produto.nome}
                  onChange={(e) => updateProdutoField('nome', e.target.value)}
                  placeholder="Ex: Curso Online de Marketing Digital..."
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field mb-2">Tipo</label>
                <div className="flex gap-3">
                  {[
                    { value: 'produto', label: 'Produto Físico' },
                    { value: 'servico', label: 'Serviço' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateProdutoField('tipo', opt.value)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                        produto.tipo === opt.value
                          ? 'bg-rl-gold/10 border-rl-gold/40 text-rl-gold'
                          : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Respondidas — exibidas acima */}
            {PRODUTO_QUESTIONS.slice(0, currentProdutoQ).map((q, idx) => (
              <div key={q.id} className="glass-card p-4 border border-rl-green/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-rl-green shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-rl-muted mb-0.5">
                      <span className="mr-1">{q.emoji}</span>{q.label}
                    </p>
                    <p className="text-sm text-rl-text mt-0.5 whitespace-pre-wrap break-words leading-snug">
                      {produto.answers[q.id]}
                    </p>
                  </div>
                  <button
                    onClick={() => { setCurrentProdutoQ(idx); setHelpOpen(false); setQuestionError(null) }}
                    className="shrink-0 p-1.5 text-rl-muted hover:text-rl-text hover:bg-rl-surface/60 rounded-lg transition-all"
                    title="Editar resposta"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {/* Pergunta ativa — surge abaixo */}
            {currentProdutoQ < PRODUTO_QUESTIONS.length && (() => {
              const q      = PRODUTO_QUESTIONS[currentProdutoQ]
              const help   = QUESTIONS_HELP[q.id]
              const ans    = produto.answers[q.id] || ''
              const isLast = currentProdutoQ === PRODUTO_QUESTIONS.length - 1
              const pct    = Math.round((currentProdutoQ / PRODUTO_QUESTIONS.length) * 100)
              return (
                <div className="glass-card p-5 space-y-3 border border-rl-purple/40">
                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-rl-muted mb-2">
                      <span>Pergunta {currentProdutoQ + 1} de {PRODUTO_QUESTIONS.length}</span>
                      <span>{pct}% concluído</span>
                    </div>
                    <div className="w-full bg-rl-border/30 rounded-full h-1">
                      <div className="bg-gradient-rl h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-rl-text leading-snug">
                      <span className="mr-1.5">{q.emoji}</span>{q.label}
                    </p>
                    {help && (
                      <button
                        onClick={() => setHelpOpen(v => !v)}
                        className={`shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all ${
                          helpOpen ? 'bg-rl-blue/10 border-rl-blue/30 text-rl-blue' : 'border-rl-border text-rl-muted hover:text-rl-blue hover:border-rl-blue/30'
                        }`}
                      >
                        <HelpCircle className="w-3 h-3" />
                        <ChevronDown className={`w-3 h-3 transition-transform ${helpOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  {/* Help */}
                  {helpOpen && help && (
                    <div className="bg-rl-blue/5 border border-rl-blue/15 rounded-xl p-4 space-y-2 text-xs text-rl-text/80 leading-relaxed">
                      <p>{help.text}</p>
                      <p className="text-rl-muted italic border-l-2 border-rl-blue/30 pl-3">
                        <span className="font-semibold text-rl-blue not-italic">Exemplo: </span>
                        {help.example}
                      </p>
                    </div>
                  )}
                  {/* Textarea */}
                  <textarea
                    autoFocus
                    value={ans}
                    onChange={(e) => { updateProdutoAnswer(q.id, e.target.value); setQuestionError(null) }}
                    placeholder="Digite sua resposta..."
                    rows={4}
                    className="input-field resize-none text-sm leading-relaxed"
                  />
                  {/* Error */}
                  {questionError && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {questionError}
                    </p>
                  )}
                  {/* Avançar */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (!ans.trim()) { setQuestionError('Responda esta pergunta para avançar.'); return }
                        setQuestionError(null); setHelpOpen(false)
                        const nextProdutos = produtos.map((p, i) =>
                          i === activeProdIdx ? { ...p, answers: { ...p.answers, [q.id]: ans } } : p
                        )
                        setCurrentProdutoQ(n => n + 1)
                        if (isLast) {
                          generateProdutoPDF(companyName, nextProdutos)
                          trackFormSubmit('produto_servico', { company: companyName, token })
                          if (currentPersonaQ >= PERSONA_QUESTIONS.length) {
                            trackFormSubmit('briefing_completo', { company: companyName, token })
                          }
                        }
                      }}
                      className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl font-semibold bg-gradient-rl text-white hover:opacity-90 transition-all"
                    >
                      {isLast ? <><CheckCircle2 className="w-4 h-4" /> Concluir Produto / Serviço</> : <>Avançar →</>}
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Concluído */}
            {currentProdutoQ >= PRODUTO_QUESTIONS.length && (
              <div className="glass-card p-6 text-center border border-rl-green/30 bg-rl-green/5">
                <CheckCircle2 className="w-10 h-10 text-rl-green mx-auto mb-3" />
                <p className="text-sm font-semibold text-rl-text">Produto / Serviço concluído!</p>
                <p className="text-xs text-rl-muted mt-1">Você pode editar qualquer resposta clicando no ícone de lápis acima.</p>
              </div>
            )}

          </div>
        )}

        {/* ── PERSONAS ──────────────────────────────────────────────────────── */}
        {activeTab === 'persona' && (
          <div className="space-y-4">

            <VideoGuide videoId="hpMy2Th9YrA" label="Como preencher o módulo de Personas" />

            {/* Sub-tabs de persona */}
            <div className="flex gap-2 flex-wrap">
              {personas.map((p, i) => (
                <div key={p.id} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setActivePerIdx(i)
                      const p = personas[i]
                      const firstUnanswered = PERSONA_QUESTIONS.findIndex(q => !arrToText(p.answers[q.key]).trim())
                      setCurrentPersonaQ(firstUnanswered === -1 ? PERSONA_QUESTIONS.length : firstUnanswered)
                      setHelpOpen(false); setQuestionError(null)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activePerIdx === i
                        ? 'bg-rl-blue/20 text-rl-blue border border-rl-blue/40'
                        : 'bg-rl-surface text-rl-muted border border-rl-border hover:text-rl-text'
                    }`}
                  >
                    {p.name || `Persona ${i + 1}`}
                  </button>
                  {personas.length > 1 && (
                    <button onClick={() => removePersona(i)} className="p-1 text-rl-muted/50 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addPersona}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-rl-muted hover:text-rl-text border border-dashed border-rl-border hover:border-rl-blue/40 transition-all"
              >
                <Plus className="w-3 h-3" /> Nova Persona
              </button>
            </div>

            {/* Nome da persona */}
            <div className="glass-card p-5">
              <label className="label-field">Nome desta Persona</label>
              <input
                value={persona.name}
                onChange={(e) => updatePersonaName(e.target.value)}
                placeholder="Ex: Empreendedor Digital, Gerente de Marketing..."
                className="input-field"
              />
            </div>

            {/* Respondidas — exibidas acima */}
            {PERSONA_QUESTIONS.slice(0, currentPersonaQ).map((q, idx) => {
              const val = arrToText(persona.answers[q.key])
              return (
                <div key={q.key} className="glass-card p-4 border border-rl-green/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-rl-green shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-rl-muted mb-0.5">
                        <span className="mr-1">{q.emoji}</span>{q.label}
                      </p>
                      <p className="text-sm text-rl-text mt-0.5 whitespace-pre-wrap break-words leading-snug">{val}</p>
                    </div>
                    <button
                      onClick={() => { setCurrentPersonaQ(idx); setHelpOpen(false); setQuestionError(null) }}
                      className="shrink-0 p-1.5 text-rl-muted hover:text-rl-text hover:bg-rl-surface/60 rounded-lg transition-all"
                      title="Editar resposta"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Pergunta ativa — surge abaixo */}
            {currentPersonaQ < PERSONA_QUESTIONS.length && (() => {
              const q      = PERSONA_QUESTIONS[currentPersonaQ]
              const val    = arrToText(persona.answers[q.key])
              const isLast = currentPersonaQ === PERSONA_QUESTIONS.length - 1
              const pct    = Math.round((currentPersonaQ / PERSONA_QUESTIONS.length) * 100)
              return (
                <div className="glass-card p-5 space-y-3 border border-rl-blue/40">
                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-rl-muted mb-2">
                      <span>Pergunta {currentPersonaQ + 1} de {PERSONA_QUESTIONS.length}</span>
                      <span>{pct}% concluído</span>
                    </div>
                    <div className="w-full bg-rl-border/30 rounded-full h-1">
                      <div className="bg-gradient-rl h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-rl-text">
                    <span className="mr-1.5">{q.emoji}</span>{q.label}
                  </p>
                  {q.hint && <p className="text-xs text-rl-muted">{q.hint}</p>}
                  <textarea
                    autoFocus
                    value={val}
                    onChange={(e) => { updatePersonaAnswer(q.key, e.target.value); setQuestionError(null) }}
                    placeholder="Digite sua resposta (uma por linha para múltiplas)..."
                    rows={4}
                    className="input-field resize-none text-sm leading-relaxed"
                  />
                  {questionError && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {questionError}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (!val.trim()) { setQuestionError('Responda esta pergunta para avançar.'); return }
                        setQuestionError(null); setHelpOpen(false)
                        const nextPersonas = personas.map((p, i) =>
                          i === activePerIdx ? { ...p, answers: { ...p.answers, [q.key]: textToArr(val) } } : p
                        )
                        setCurrentPersonaQ(n => n + 1)
                        if (isLast) {
                          generatePersonaPDF(companyName, nextPersonas)
                          trackFormSubmit('personas', { company: companyName, token })
                          if (currentProdutoQ >= PRODUTO_QUESTIONS.length) {
                            trackFormSubmit('briefing_completo', { company: companyName, token })
                          }
                        }
                      }}
                      className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl font-semibold bg-gradient-rl text-white hover:opacity-90 transition-all"
                    >
                      {isLast ? <><CheckCircle2 className="w-4 h-4" /> Concluir Personas</> : <>Avançar →</>}
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Concluído */}
            {currentPersonaQ >= PERSONA_QUESTIONS.length && (
              <div className="glass-card p-6 text-center border border-rl-green/30 bg-rl-green/5">
                <CheckCircle2 className="w-10 h-10 text-rl-green mx-auto mb-3" />
                <p className="text-sm font-semibold text-rl-text">Personas concluídas!</p>
                <p className="text-xs text-rl-muted mt-1">Você pode editar qualquer resposta clicando no ícone de lápis acima.</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 pb-8 text-center">
          <p className="text-xs text-rl-muted">
            As informações são salvas automaticamente conforme você preenche.
          </p>
          <p className="text-xs text-rl-muted/50 mt-1">Revenue Lab © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}
