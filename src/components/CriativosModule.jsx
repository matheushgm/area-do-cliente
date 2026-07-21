import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import { buildCachedPayload } from '../lib/buildContext'
import {
  NIVEIS_CONSCIENCIA,
  NIVEIS_BY_ID,
  nivelBlock,
  distribute,
  QTD_PRESETS,
  QTD_MAX,
} from '../lib/niveisConsciencia'
import {
  Image,
  Video,
  Sparkles,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  CheckCircle2,
  FileDown,
  Trash2,
  Pencil,
  Plus,
  X,
  Check,
  Lock,
  Share2,
  Copy,
  Link2,
  Users,
} from 'lucide-react'
import Modal from './UI/Modal'
import MarkdownBlock from './Criativos/MarkdownBlock'
import { FUNIS, FUNIS_BY_ID } from '../lib/funis'
import { replaceAdInContent } from './Criativos/ResultBlock'
import CreativeResultBlock from './Criativos/CreativeResultBlock'
import ContextPreview from './Criativos/ContextPreview'
import CreativeHistory from './Criativos/CreativeHistory'
import VideoGuide from './VideoGuide'
import CriativoVisualPanel from './Criativos/CriativoVisualPanel'
import AdWireframePanel from './Criativos/AdWireframePanel'
import RatingSelector from './RatingSelector'
import { exportCreativoSetPDF } from '../lib/creativoPDF'

// ─── Auto-resize textarea ─────────────────────────────────────────────────────
function AutoResizeTextarea({ value, onChange, className }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = ref.current.scrollHeight + 'px'
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className={className}
      style={{ overflow: 'hidden', resize: 'none' }}
    />
  )
}

// ─── Ad Types ─────────────────────────────────────────────────────────────────
const AD_TYPES = [
  {
    id: 'clickbait',
    label: 'Clickbait',
    emoji: '🎣',
    desc: 'Título altamente intrigante relacionado ao público-alvo',
  },
  {
    id: 'sensacao',
    label: 'Sensação',
    emoji: '⚡',
    desc: 'Criação de sensações fortes para envolver o público',
  },
  {
    id: 'mito',
    label: 'Mito',
    emoji: '🏛️',
    desc: 'Anúncio em torno de um mito ou história cativante',
  },
  {
    id: 'dilema',
    label: 'Dilema',
    emoji: '⚖️',
    desc: 'Destaca um dilema que ressoa com o público',
  },
  {
    id: 'prova',
    label: 'Prova',
    emoji: '✅',
    desc: 'Evidências sólidas, resultados ou testemunhos',
  },
  {
    id: 'contraste',
    label: 'Contraste',
    emoji: '🔄',
    desc: 'Situação contrastante para gerar impacto visual',
  },
  {
    id: 'visual',
    label: 'Visual',
    emoji: '👁️',
    desc: 'Orientado por elementos visuais impactantes',
  },
  {
    id: 'oportunidade',
    label: 'Oportunidade',
    emoji: '🚀',
    desc: 'A oportunidade como ponto focal da mensagem',
  },
  {
    id: 'historia',
    label: 'História',
    emoji: '📖',
    desc: 'Narrativa envolvente que conecta ao produto',
  },
  {
    id: 'certo_errado',
    label: 'Certo vs. Errado',
    emoji: '🎯',
    desc: 'Comparação entre práticas certas e erradas',
  },
  {
    id: 'demonstracao',
    label: 'Demonstração',
    emoji: '🎬',
    desc: 'Demonstração direta do produto ou serviço',
  },
  {
    id: 'ultra_segmentado',
    label: 'Ultra Segmentado',
    emoji: '🔍',
    desc: 'Altamente segmentado para um público específico',
  },
  {
    id: 'apelo_emocional',
    label: 'Apelo Emocional',
    emoji: '❤️',
    desc: 'Explora o apelo emocional do público-alvo',
  },
  {
    id: 'curiosidade',
    label: 'Curiosidade',
    emoji: '🤔',
    desc: 'Desperta a curiosidade irresistível do público',
  },
  { id: 'reflexao', label: 'Reflexão', emoji: '💭', desc: 'Provoca reflexão profunda no público' },
  {
    id: 'comparacao',
    label: 'Comparação',
    emoji: '📊',
    desc: 'Comparação relevante entre alternativas',
  },
  {
    id: 'problema_solucao',
    label: 'Problema e Solução',
    emoji: '🔧',
    desc: 'Apresenta um problema e revela a solução',
  },
  {
    id: 'explicacao',
    label: 'Explicação',
    emoji: '📋',
    desc: 'Explicação detalhada, educativa do produto/serviço',
  },
]

// ─── System Prompts ───────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
const STATIC_SYSTEM = `Você é um especialista em copywriting para anúncios estáticos (imagens) em português brasileiro, usando a metodologia Revenue Lab / Laboratório de Anúncios.

O ponto mais importante no anúncio estático é a headline. Ela é responsável pelo CTR — uma headline fraca desperdiça todo o resto. Por isso, para cada anúncio gerado você deve entregar OBRIGATORIAMENTE 3 opções de headline + subheadline para teste.

A headline deve seguir a metodologia ADIG e tentar conter:
- Anunciar o público-alvo
- Dar um objetivo / resultado
- Indicar um intervalo de tempo (quando houver)
- Garantia ou palavra forte

Se não for possível encaixar todos os elementos na headline, priorize os mais importantes e coloque os demais na subheadline.

Use as informações de público-alvo, personas e oferta já fornecidas no contexto do cliente. Não gere análise de público — vá direto aos criativos.

Cada anúncio deve também contemplar os 4 elementos da fórmula de valor de Alex Hormozi: resultado do sonho, percepção de alcance desse resultado, tempo para alcançar e esforço/sacrifício envolvido.

Estrutura obrigatória de cada anúncio:

## ANÚNCIO [N]: [Tipo] | [Etapa do Funil]

**OPÇÃO 1 DE HEADLINE:** [headline — máx. 10 palavras]
**SUBHEADLINE 1:** [complementa, máx. 15 palavras]

**OPÇÃO 2 DE HEADLINE:** [variação com angulação diferente]
**SUBHEADLINE 2:** [complementa, máx. 15 palavras]

**OPÇÃO 3 DE HEADLINE:** [variação com angulação diferente]
**SUBHEADLINE 3:** [complementa, máx. 15 palavras]

**COPY COMPLEMENTAR:** (2-3 frases: benefício central, prova, urgência — use a Opção 1 como referência)
**CALL-TO-ACTION:** (ação direta e clara)
**ELEMENTOS VISUAIS SUGERIDOS:**
- Imagem: [descrição da imagem principal]
- Paleta de cores: [2-3 cores]
- Layout: [composição sugerida]

---

Tipos de mensagem por etapa do funil:
- TOPO DE FUNIL (Inconsciente do Problema): História/Depoimento, Quebra de Paradigma, Desejo/Visão Futura, Medo
- MEIO DE FUNIL (Consciente do Problema): O segredo X para Y, Problema/Solução
- FUNDO DE FUNIL (Consciente do Problema e da Solução): Promessa, Oferta

Diretrizes obrigatórias:
- Português brasileiro coloquial e persuasivo — evite palavras que a IA usa muito e que o ser humano não usa no dia a dia
- Fale diretamente com o público (use "você")
- Seja específico ao negócio, nunca genérico
- Anúncios estáticos não podem ter muito texto — mantenha o copy complementar enxuto
- Não use travessões (—) em nenhuma parte do output
- Separe cada anúncio com "---"`

// Valor sentinela nos selects de escopo: "não enviar esse contexto à IA".
// Diferente de '' (todos) — zera o array de produtos/personas no scopedProject.
const NO_CONTEXT = '__none__'

const VIDEO_SYSTEM_PARTS = {
  metodologia: `Você é um especialista em roteiros de vídeos de anúncios online de alta conversão, usando a estrutura do Laboratório de Anúncios (Revenue Lab).

Os vídeos têm duração entre 30 e 60 segundos e são criados para Meta Ads (Reels/Feed) e YouTube Ads.

## ANTES DE ESCREVER (raciocínio interno — NÃO exiba)

A partir do contexto do cliente, levante mentalmente: 8 problemas comuns, 8 sonhos, 8 objeções, 8 situações constrangedoras e 8 perguntas que esse público-alvo se faz. Use isso para escrever, mas NUNCA exiba essas listas.

## A ESTRUTURA DO LABORATÓRIO DE ANÚNCIOS (4 etapas)

**A) Gancho.** Momento mais importante: chama atenção, quebra o padrão, é contra-intuitivo e gera curiosidade. Nos 3 PRIMEIROS SEGUNDOS a pessoa precisa se conectar. O gancho é sempre uma promessa, oferta, mudança de vida ou benefício; o tipo pedido define a FORMA de comunicá-lo.

**Estrutura invisível** — a mensagem sustenta o que o gancho prometeu:
- Gancho de promessa: dê garantia, sustente com prova e elimine o "funciona pra ele, não pra mim".
- Gancho de oferta: mostre benefícios e diferenciais, prove que outros conseguiram e derrube a barreira com garantia.

**B) Mensagem.** Transformação do Ponto A ao Ponto B relacionando 4 variáveis: sonhos e desejos; percepção de dificuldade de alcançar; tempo para alcançar; e o mínimo de sacrifício.

**C) Quebra de objeções.** Implícita e INTEGRADA à mensagem, nunca um bloco separado.

**D) Chamada para ação.** Reforça a promessa e dá um motivo específico para agir agora (escassez ou urgência).`,

  estrutura: (nivelId) => `
${nivelBlock(nivelId, 'video')}

## FORMATO OBRIGATÓRIO DE CADA ROTEIRO

## ROTEIRO [N]: Gancho: [Tipo] | Nível: ${NIVEIS_BY_ID[nivelId]?.label || ''}

**GANCHO (0s – 3s):**
[frase exata: disruptiva, contra-intuitiva, que para o scroll]

**MENSAGEM (3s – 45s):**
[narração levando do Ponto A ao Ponto B, com a quebra de objeção integrada naturalmente]

**CTA FINAL (45s – 60s)**
[reforça promessa + gatilho de escassez/urgência + ação clara]

**📝 LEGENDA DO POST:** [legenda com emojis]

---`,

  diretrizes: `Regras críticas:
- Gere EXATAMENTE a quantidade de roteiros pedida por tipo de gancho na solicitação — nem mais, nem menos
- Todos os roteiros são escritos no MESMO nível de consciência (o informado no system prompt)
- Quando houver mais de um roteiro para o mesmo tipo de gancho, cada um abre com um ângulo de entrada diferente — nunca variações da mesma frase
- Numere os roteiros sequencialmente (ROTEIRO 1, ROTEIRO 2, ...) percorrendo os tipos na ordem da solicitação
- Não exiba a análise de público-alvo — vá direto aos roteiros
- Português brasileiro conversacional e energético
- Não use travessões (—) em nenhuma parte do output
- Não inclua sugestões de cena ou visual em nenhuma parte do roteiro
- Não use emojis no roteiro — use emojis apenas na LEGENDA DO POST
- Gere APENAS os roteiros — sem tabelas, sem resumos, sem insights ao final`,

  diretrizLocked: `- Separe cada roteiro com "---"`,
}

// ─── Parse "PRINCIPAIS DORES" from generatedProfile text ─────────────────────
function parseDores(personas) {
  const result = []
  for (const persona of personas || []) {
    const text = persona.generatedProfile || ''
    if (!text) continue

    const lines = text.split('\n')
    let personaName = ''
    let inSection = false

    for (const line of lines) {
      const nameMatch = line.match(/^\s*-\s*Nome:\s*(.+)/)
      if (nameMatch) {
        personaName = nameMatch[1].trim()
        break
      }
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (/^PRINCIPAIS\s+DORES/i.test(trimmed)) {
        inSection = true
        continue
      }
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

// ─── System Prompt: Dores ──────────────────────────────────────────────────────
const DORES_SYSTEM_PARTS = {
  metodologia: `Você é um especialista em copywriting para anúncios estáticos em português brasileiro, usando a metodologia Revenue Lab / Laboratório de Anúncios.

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

Use as informações de público-alvo, personas e oferta fornecidas no contexto do cliente para personalizar ao máximo. Não gere análise de público — vá direto às headlines.`,

  estrutura: (nivelId) => `${nivelBlock(nivelId, 'estatico')}

ESTRUTURA OBRIGATÓRIA — um bloco por combinação dor + tipo, com a quantidade de headlines que a solicitação pedir para aquele bloco:

# DOR: [texto exato da dor] | [Emoji] [Nome do Tipo]

### 1
- Headline: [ideal 7, máx. 12 palavras]
- Subheadline: [complementa a headline, máx. 20 palavras]

### 2
- Headline: [...]
- Subheadline: [...]

(e assim por diante, até a quantidade pedida para este bloco)

---`,

  diretrizes: `Diretrizes:
- Gere EXATAMENTE um bloco separado por combinação dor + tipo — nunca agrupe tipos dentro de um mesmo bloco
- Dentro de cada bloco, gere exatamente a quantidade de headlines que a solicitação pedir
- Todas as headlines são escritas no MESMO nível de consciência (o informado acima); as variações mudam o ângulo, não o nível
- Português brasileiro coloquial e persuasivo — evite palavras que a IA usa mas que humanos não usam
- Use "você" diretamente
- Seja específico ao negócio, nunca genérico
- Não use travessões (—)`,

  diretrizLocked: `- Separe cada bloco com "---"`,
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CriativosModule({ project }) {
  const { updateProject } = useApp()

  // ── Compartilhar + usuários + histórico do cliente ─────────────────────────
  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState(null)
  const [shareCopied, setShareCopied] = useState(false)
  // Usuários da ferramenta (email + senha)
  const [users, setUsers] = useState([])
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '' })
  const [userBusy, setUserBusy] = useState(false)
  // Histórico dos clientes (gerações via link)
  const [clientHistory, setClientHistory] = useState(null) // null = não carregado
  const [historyBusy, setHistoryBusy] = useState(false)
  const [openHistoryItem, setOpenHistoryItem] = useState(null)

  // Chamada autenticada (JWT da sessão do time) aos endpoints /api/criativos-*.
  const authFetch = useCallback(async (url, payload) => {
    let sessionToken = null
    try {
      const { supabase } = await import('../lib/supabase.js')
      const { data } = (await supabase?.auth.getSession()) ?? {}
      sessionToken = data?.session?.access_token ?? null
    } catch { /* sem token → 401 */ }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error?.message || data?.error || `Erro ${res.status}`)
    return data
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      const data = await authFetch('/api/criativos-users', { action: 'list-users', projectId: project.id })
      setUsers(data.users || [])
    } catch (e) {
      setShareError(e.message)
    }
  }, [authFetch, project.id])

  const openShare = useCallback(async () => {
    setShareOpen(true); setShareError(null); setShareUrl(''); setNewUser({ name: '', email: '', password: '' })
    setShareBusy(true)
    try {
      const data = await authFetch('/api/criativos-share-token', { projectId: project.id })
      setShareUrl(data.url)
    } catch (e) {
      setShareError(e.message || 'Não foi possível gerar o link.')
    } finally {
      setShareBusy(false)
    }
    loadUsers()
  }, [authFetch, loadUsers, project.id])

  async function addUser() {
    const { name, email, password } = newUser
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setShareError('E-mail inválido.'); return }
    if (password.trim().length < 4) { setShareError('A senha precisa ter ao menos 4 caracteres.'); return }
    setUserBusy(true); setShareError(null)
    try {
      await authFetch('/api/criativos-users', { action: 'create-user', projectId: project.id, name: name.trim(), email: email.trim(), password: password.trim() })
      setNewUser({ name: '', email: '', password: '' })
      await loadUsers()
    } catch (e) {
      setShareError(e.message)
    } finally {
      setUserBusy(false)
    }
  }

  async function toggleUser(u) {
    try {
      await authFetch('/api/criativos-users', { action: 'update-user', projectId: project.id, id: u.id, active: !u.active })
      await loadUsers()
    } catch (e) { setShareError(e.message) }
  }

  async function deleteUser(u) {
    try {
      await authFetch('/api/criativos-users', { action: 'delete-user', projectId: project.id, id: u.id })
      await loadUsers()
    } catch (e) { setShareError(e.message) }
  }

  const loadClientHistory = useCallback(async () => {
    setHistoryBusy(true)
    try {
      const data = await authFetch('/api/criativos-users', { action: 'history', projectId: project.id })
      setClientHistory(data.history || [])
    } catch {
      setClientHistory([])
    } finally {
      setHistoryBusy(false)
    }
  }, [authFetch, project.id])

  function copyShareLink() {
    navigator.clipboard?.writeText(shareUrl || '').then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    })
  }

  // Sub-tab no topo: 'copy' (fluxo atual de geração de copy) | 'visual'
  // (gerador de criativos visuais com IA + html2canvas → JPG)
  const [topTab, setTopTab] = useState('copy')

  const [view, setView] = useState('select') // 'select' | 'estaticos' | 'video'
  // Roteiro validado usado como referência de mensagem campeã ({ adName, transcription }).
  // Setado pelo botão "Gerar variações" em Roteiros Validados; entra na SOLICITAÇÃO.
  const [variacaoRef, setVariacaoRef] = useState(null)
  const [historyCreativeId, setHistoryCreativeId] = useState(null)
  const historyCreative = historyCreativeId
    ? ((project.creatives || []).find((c) => c.id === historyCreativeId) ?? null)
    : null
  const [adTypeConfig, setAdTypeConfig] = useState({}) // video: { [adTypeId]: quantity }
  const [dorConfig, setDorConfig] = useState({}) // static: { [dorId]: { typeQtys: {[typeId]: qty}, freeQty: number } }
  const [metodologiaOverride, setMetodologiaOverride] = useState(null)
  const [diretrizesOverride, setDiretrizesOverride] = useState(null)
  const [systemOpen, setSystemOpen] = useState(false)
  const [instructionOverride, setInstructionOverride] = useState(null)
  const [instructionOpen, setInstructionOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [lastCreativeId, setLastCreativeId] = useState(null)
  const [generatedAt, setGeneratedAt] = useState(null)
  // Escopo de produto e persona:
  //   '' = todos (geral) · id = só aquele · NO_CONTEXT = não enviar esse contexto
  // NO_CONTEXT zera o array no scopedProject, removendo o bloco do prompt — útil
  // quando o criativo vai rodar em outros funis e o produto/persona atrapalha.
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedPersonaId, setSelectedPersonaId] = useState('')
  // Funil em que o anúncio vai rodar — define o objetivo/CTA (entra no prompt).
  const [selectedFunil, setSelectedFunil] = useState('')
  // Nível de consciência do público para esta oferta (obrigatório). TODAS as
  // peças da geração são escritas nesse nível — não é uma peça por nível.
  const [nivel, setNivel] = useState('')
  // Quantidade total de peças desta geração, distribuída entre os blocos.
  const [quantidade, setQuantidade] = useState(5)
  // Particularidades deste anúncio (promoção, condição...) — texto livre no prompt.
  const [extraDetails, setExtraDetails] = useState('')

  const isVideo = view === 'video'

  // Lista de produtos do projeto (com nome preenchido) pra montar o select
  const productList = useMemo(
    () => (project.produtos || []).filter((p) => (p.nome || '').trim()),
    [project.produtos]
  )

  // Lista de personas do projeto (com nome preenchido) pra montar o select
  const personaList = useMemo(
    () => (project.personas || []).filter((p) => (p.name || '').trim()),
    [project.personas]
  )

  // Produto selecionado (objeto) ou null se "Todos"
  const selectedProduct = useMemo(
    () => selectedProductId
      ? (productList.find((p) => p.id === selectedProductId) || null)
      : null,
    [selectedProductId, productList]
  )

  // Persona selecionada (objeto) ou null se "Todas"
  const selectedPersona = useMemo(
    () => selectedPersonaId
      ? (personaList.find((p) => p.id === selectedPersonaId) || null)
      : null,
    [selectedPersonaId, personaList]
  )

  // Project escopado: se um produto e/ou persona foi escolhido, mantém só ele(s)
  // nos respectivos arrays. Se NO_CONTEXT, zera o array — a IA não recebe esse
  // bloco. O resto do contexto (oferta, ROI) fica intacto.
  // buildContext.js itera sobre project.produtos e project.personas pra montar o
  // markdown — então limitar/esvaziar essas listas já restringe o que a IA vê.
  const scopedProject = useMemo(() => {
    let p = project
    if (selectedProductId === NO_CONTEXT) p = { ...p, produtos: [] }
    else if (selectedProduct) p = { ...p, produtos: [selectedProduct] }
    if (selectedPersonaId === NO_CONTEXT) p = { ...p, personas: [] }
    else if (selectedPersona) p = { ...p, personas: [selectedPersona] }
    return p
  }, [project, selectedProductId, selectedProduct, selectedPersonaId, selectedPersona])

  // ── Video: ad type config ──────────────────────────────────────────────────
  // A quantidade é escolhida pelo usuário e distribuída entre os tipos
  // selecionados; o valor guardado em adTypeConfig é só um marcador de seleção.
  const selectedList = AD_TYPES.filter((t) => (adTypeConfig[t.id] || 0) > 0)
  const totalQuantity = quantidade
  // Quantas peças cada tipo recebe: distribute(8, 3) → [3, 3, 2]
  const videoSplit = useMemo(
    () => distribute(quantidade, selectedList.length),
    [quantidade, selectedList.length]
  )

  const toggleType = useCallback((id) => {
    setAdTypeConfig((prev) => {
      if (prev[id]) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: 1 }
    })
  }, [])

  const selectAll = () => setAdTypeConfig(Object.fromEntries(AD_TYPES.map((t) => [t.id, 1])))
  const clearAll = () => setAdTypeConfig({})

  // ── Static: dores config ───────────────────────────────────────────────────
  const [customDores, setCustomDores] = useState([])
  const [dorTextOverrides, setDorTextOverrides] = useState({})
  const [editingDorId, setEditingDorId] = useState(null)
  const [editingDorText, setEditingDorText] = useState('')
  const [openTypeSelectorDorId, setOpenTypeSelectorDorId] = useState(null)

  const allDores = useMemo(() => {
    // Respeita o escopo de persona: se uma persona foi escolhida, só as dores
    // dela aparecem; senão, dores de todas as personas.
    const parsed = parseDores(scopedProject.personas || []).map((d) => ({
      ...d,
      text: dorTextOverrides[d.id] ?? d.text,
    }))
    return [...parsed, ...customDores]
  }, [scopedProject.personas, dorTextOverrides, customDores])
  const selectedDores = allDores.filter((d) => !!dorConfig[d.id])
  // Blocos = combinações dor x tipo. A quantidade escolhida é distribuída entre eles.
  const staticBlocos = selectedDores.reduce(
    (s, d) => s + Object.keys(dorConfig[d.id]?.typeQtys || {}).length,
    0
  )
  const staticTotalQty = quantidade
  // Quantas headlines cada bloco (dor x tipo) recebe, na ordem em que aparecem.
  const staticSplit = useMemo(
    () => distribute(quantidade, staticBlocos),
    [quantidade, staticBlocos]
  )
  // "dorId::typeId" → quantas headlines aquele bloco recebe. Percorre na mesma
  // ordem do staticSplit, para UI e prompt mostrarem sempre o mesmo número.
  const staticQtyByBlock = (() => {
    const map = {}
    let i = 0
    for (const d of selectedDores) {
      for (const tid of Object.keys(dorConfig[d.id]?.typeQtys || {})) {
        map[`${d.id}::${tid}`] = staticSplit[i] ?? 0
        i += 1
      }
    }
    return map
  })()

  // Blocos desta geração: tipos de gancho (vídeo) ou dor x tipo (estático).
  const blocosAtuais = isVideo ? selectedList.length : staticBlocos
  // Cada bloco precisa de pelo menos 1 peça — senão a distribuição zeraria algum.
  const qtdInsuficiente = blocosAtuais > 0 && quantidade < blocosAtuais

  const dorsPendingType = selectedDores.filter(
    (d) => Object.keys(dorConfig[d.id]?.typeQtys || {}).length === 0
  )

  const toggleDor = useCallback((id) => {
    setDorConfig((prev) => {
      if (prev[id]) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: { typeQtys: {} } }
    })
    setOpenTypeSelectorDorId((prev) => (prev === id ? null : prev))
  }, [])

  const toggleDorType = useCallback((dorId, typeId) => {
    setDorConfig((prev) => {
      const dor = prev[dorId]
      const typeQtys = { ...dor.typeQtys }
      if (typeQtys[typeId]) {
        delete typeQtys[typeId]
      } else {
        typeQtys[typeId] = 1
      }
      return { ...prev, [dorId]: { ...dor, typeQtys } }
    })
  }, [])

  function addCustomDor() {
    const id = crypto.randomUUID()
    setCustomDores((prev) => [...prev, { id, text: '', personaName: 'Personalizada' }])
    setEditingDorId(id)
    setEditingDorText('')
  }

  function confirmDorEdit() {
    const trimmed = editingDorText.trim()
    const isCustom = customDores.some((d) => d.id === editingDorId)
    if (!trimmed) {
      if (isCustom) {
        setCustomDores((prev) => prev.filter((d) => d.id !== editingDorId))
        setDorConfig((prev) => {
          const n = { ...prev }
          delete n[editingDorId]
          return n
        })
      }
    } else if (isCustom) {
      setCustomDores((prev) =>
        prev.map((d) => (d.id === editingDorId ? { ...d, text: trimmed } : d))
      )
    } else {
      setDorTextOverrides((prev) => ({ ...prev, [editingDorId]: trimmed }))
    }
    setEditingDorId(null)
    setEditingDorText('')
  }

  function cancelDorEdit() {
    const isNewEmpty = customDores.some((d) => d.id === editingDorId && !d.text)
    if (isNewEmpty) {
      setCustomDores((prev) => prev.filter((d) => d.id !== editingDorId))
    }
    setEditingDorId(null)
    setEditingDorText('')
  }

  function deleteCustomDor(id) {
    setCustomDores((prev) => prev.filter((d) => d.id !== id))
    setDorConfig((prev) => {
      const n = { ...prev }
      delete n[id]
      return n
    })
  }

  const autoInstruction = useMemo(() => {
    const funil = FUNIS_BY_ID[selectedFunil]
    const funilStr = funil
      ? `## FUNIL DESTE ANÚNCIO: ${funil.label}

Objetivo e CTA obrigatórios: ${funil.objetivo}
Todo o criativo (gancho, mensagem e principalmente o CTA) deve levar a essa ação — não a nenhuma outra.

`
      : ''
    const det = extraDetails.trim()
    const detStr = det
      ? `## PARTICULARIDADES DESTE ANÚNCIO (prioridade máxima)

Incorpore obrigatoriamente em cada peça: ${det}

`
      : ''

    const n = NIVEIS_BY_ID[nivel]
    const nivelStr = n
      ? `## NÍVEL DE CONSCIÊNCIA DESTA GERAÇÃO

Nível ${n.num} — ${n.label}. Escreva todas as peças abaixo nesse nível, sem exceção.

`
      : ''

    if (isVideo) {
      const typesStr = selectedList
        .map((t, i) => `${t.emoji} ${t.label} — ${videoSplit[i]} roteiro${videoSplit[i] !== 1 ? 's' : ''}. Ângulo: ${t.desc}`)
        .join('\n')
      const campeaoStr = variacaoRef
        ? `## ANÚNCIO CAMPEÃO (REFERÊNCIA DE MENSAGEM — prioridade máxima)

Este cliente tem um anúncio em vídeo que JÁ ESTÁ PERFORMANDO. Transcrição ("${variacaoRef.adName || 'sem nome'}"):

"""
${variacaoRef.transcription}
"""

Os roteiros desta geração são VARIAÇÕES dessa mensagem campeã:
- MANTENHA o DNA do campeão: a promessa/benefício central, o contexto do assunto e a ação final
- VARIE a forma: cada roteiro abre com gancho e ângulo de entrada diferentes do original e entre si
- PROIBIDO copiar frases da transcrição — nenhuma frase igual; parafrasear trocando uma palavra também não vale

`
        : ''
      return `---

## SOLICITAÇÃO

${nivelStr}${funilStr}${detStr}${campeaoStr}Tipos de gancho a gerar, com a quantidade exata de cada um:
${typesStr}

Total: ${totalQuantity} roteiros.`
    }

    const sections = selectedDores
      .map((d) => {
        const typeKeys = Object.keys(dorConfig[d.id]?.typeQtys || {})
        const typeLines = typeKeys
          .map((tid) => {
            const type = AD_TYPES.find((t) => t.id === tid)
            const qtd = staticQtyByBlock[`${d.id}::${tid}`] ?? 0
            return `- ${type.emoji} ${type.label} — ${qtd} headline${qtd !== 1 ? 's' : ''}. Ângulo: ${type.desc}`
          })
          .join('\n')
        return `### DOR: "${d.text}"
${typeLines}`
      })
      .join('\n\n')

    return `---

## SOLICITAÇÃO

${nivelStr}${funilStr}${detStr}Para cada dor abaixo, gere um bloco por tipo de criativo, com a quantidade de headlines indicada em cada linha.

${sections}

Total: ${staticBlocos} blocos (${staticTotalQty} headlines).`
  }, [dorConfig, isVideo, nivel, selectedDores, selectedList, selectedFunil, extraDetails, staticBlocos, staticQtyByBlock, staticTotalQty, totalQuantity, videoSplit, variacaoRef])

  // ── Generate ────────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (isVideo && !selectedList.length) return
    if (!isVideo && !selectedDores.length) return
    if (!nivel || qtdInsuficiente) return
    const now = new Date().toISOString()
    setGeneratedAt(now)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const parts = isVideo ? VIDEO_SYSTEM_PARTS : DORES_SYSTEM_PARTS
      const systemPrompt = [
        metodologiaOverride ?? parts.metodologia,
        parts.estrutura(nivel),
        (diretrizesOverride ?? parts.diretrizes) + '\n' + parts.diretrizLocked,
      ].join('\n\n')
      const { system, messages } = buildCachedPayload({
        systemPrompt,
        project: scopedProject,
        instruction: instructionOverride ?? autoInstruction,
      })
      const fullText = await streamClaude({
        model: 'claude-sonnet-4-5',
        max_tokens: 32000,
        system,
        messages,
        onChunk: (text) => setResult(text.replace(/—/g, '-')),
      })

      const cleanText = fullText.replace(/—/g, '-')
      const newId = crypto.randomUUID()
      const adTypeLabels = isVideo
        ? selectedList.map((t, i) => `${t.label} ×${videoSplit[i]}`)
        : selectedDores.map((d) => d.text.substring(0, 50))
      const autoName = [
        isVideo && variacaoRef ? `Variações (${(variacaoRef.adName || 'campeão').slice(0, 60)})` : isVideo ? 'Vídeo' : 'Estático',
        '—',
        adTypeLabels.slice(0, 2).join(', ') + (adTypeLabels.length > 2 ? '...' : ''),
      ].join(' ')
      const newCreative = {
        id: newId,
        name: autoName,
        campaignId: null,
        type: isVideo ? 'video' : 'estatico',
        mode: isVideo ? 'adTypes' : 'dores',
        adTypes: isVideo ? selectedList.map((t) => t.id) : [],
        adTypeLabels,
        adTypeConfig: isVideo ? { ...adTypeConfig } : {},
        dorConfig: isVideo ? {} : { ...dorConfig },
        quantity: isVideo ? totalQuantity : staticTotalQty,
        // Nível de consciência em que esta geração foi escrita (id + label).
        nivel,
        nivelLabel: NIVEIS_BY_ID[nivel]?.label || '',
        content: cleanText,
        rating: null,
        // Escopo usado nessa geração (null = geral; NO_CONTEXT = sem esse contexto)
        productId: selectedProductId === NO_CONTEXT ? NO_CONTEXT : selectedProductId || null,
        productName: selectedProductId === NO_CONTEXT ? 'Sem contexto de produto' : selectedProduct?.nome || null,
        personaId: selectedPersonaId === NO_CONTEXT ? NO_CONTEXT : selectedPersonaId || null,
        personaName: selectedPersonaId === NO_CONTEXT ? 'Sem contexto de persona' : selectedPersona?.name || null,
        funil: selectedFunil || null,
        funilLabel: FUNIS_BY_ID[selectedFunil]?.label || null,
        createdAt: now,
      }
      setLastCreativeId(newId)
      updateProject(project.id, {
        creatives: [...(project.creatives || []), newCreative],
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [
    adTypeConfig,
    autoInstruction,
    dorConfig,
    instructionOverride,
    isVideo,
    project,
    scopedProject,
    selectedDores,
    selectedList,
    selectedProduct,
    selectedProductId,
    selectedPersona,
    selectedPersonaId,
    selectedFunil,
    extraDetails,
    staticTotalQty,
    metodologiaOverride,
    nivel,
    qtdInsuficiente,
    totalQuantity,
    videoSplit,
    updateProject,
    variacaoRef,
  ])

  // ── Refine a single chunk ──────────────────────────────────────────────────
  const makeRefineHandler = useCallback(
    (creativeType) => async (_chunkIndex, chunkContent, userNote, onChunk) => {
      const isVid = creativeType === 'video'
      const parts = isVid ? VIDEO_SYSTEM_PARTS : DORES_SYSTEM_PARTS
      const systemPrompt = [
        parts.estrutura(nivel),
        parts.diretrizes + '\n' + parts.diretrizLocked,
      ].join('\n\n')
      const { system, messages } = buildCachedPayload({
        systemPrompt,
        project: scopedProject,
        instruction: `---\n\n## COPY ORIGINAL\n\n${chunkContent}\n\n---\n\n## SOLICITAÇÃO DE REFINAMENTO\n\n${userNote}`,
      })
      return streamClaude({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system,
        messages,
        onChunk,
      })
    },
    [scopedProject, nivel]
  )

  // ── Edit a chunk inside the fresh (just-generated) result ──────────────────
  const handleFreshChunkEdit = useCallback(
    (chunkIndex, newContent) => {
      if (!lastCreativeId) return
      const creative = (project.creatives || []).find((c) => c.id === lastCreativeId)
      if (!creative) return
      const newFullContent = replaceAdInContent(creative.content, chunkIndex, newContent)
      // Update the local streaming result so the card re-renders immediately
      setResult(newFullContent)
      // Persist to project history
      const updated = (project.creatives || []).map((c) =>
        c.id === lastCreativeId ? { ...c, content: newFullContent } : c
      )
      updateProject(project.id, { creatives: updated })
    },
    [lastCreativeId, project, updateProject]
  )

  // ── View: History detail ───────────────────────────────────────────────────
  if (historyCreative) {
    const c = historyCreative
    const companyName = project.companyName || project.company_name || 'Cliente'

    function fmtDate(iso) {
      if (!iso) return '—'
      return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    function handleRating(rating) {
      const updated = (project.creatives || []).map((x) => (x.id === c.id ? { ...x, rating } : x))
      updateProject(project.id, { creatives: updated })
    }

    function handleDelete() {
      updateProject(project.id, {
        creatives: (project.creatives || []).filter((x) => x.id !== c.id),
      })
      setHistoryCreativeId(null)
    }

    function handleExport() {
      exportCreativoSetPDF({ creative: c, companyName })
    }

    function handleChunkEdit(chunkIndex, newContent) {
      const newFullContent = replaceAdInContent(c.content, chunkIndex, newContent)
      const updated = (project.creatives || []).map((x) =>
        x.id === c.id ? { ...x, content: newFullContent } : x
      )
      updateProject(project.id, { creatives: updated })
    }

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => setHistoryCreativeId(null)}
            aria-label="Voltar ao histórico"
            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all mt-0.5 shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  c.type === 'video'
                    ? 'text-rl-purple bg-rl-purple/10 border-rl-purple/30'
                    : 'text-rl-blue bg-rl-blue/10 border-rl-blue/30'
                }`}
              >
                {c.type === 'video' ? '🎬 Vídeo' : '🖼️ Estático'}
              </span>
              <span className="text-xs text-rl-muted">{fmtDate(c.createdAt)}</span>
              <span className="text-xs font-bold text-rl-text">
                {c.quantity} criativo{c.quantity !== 1 ? 's' : ''}
              </span>
            </div>
            {(c.adTypeLabels || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {c.adTypeLabels.map((label) => (
                  <span
                    key={label}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <RatingSelector value={c.rating} onChange={handleRating} />
            <button
              onClick={handleExport}
              title="Exportar PDF"
              className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
            >
              <FileDown className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              title="Excluir"
              className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <CreativeResultBlock
          content={c.content}
          type={c.type}
          companyName={companyName}
          onChunkChange={handleChunkEdit}
          onRefine={makeRefineHandler(c.type)}
        />
      </div>
    )
  }

  // ── View: Select format ────────────────────────────────────────────────────
  if (view === 'select') {
    return (
      <div className="space-y-6">
        <VideoGuide videoId="ZinesF_j2xU" label="Como usar o módulo de Criativos com IA" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-rl-text mb-1">Gerador de Criativos com IA</h2>
            <p className="text-sm text-rl-muted">
              Selecione o formato para gerar criativos usando os dados do cliente.
            </p>
          </div>
          <button
            onClick={openShare}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-rl-purple/10 border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" /> Compartilhar & usuários
          </button>
        </div>

        {shareOpen && (
          <Modal onClose={() => setShareOpen(false)} maxWidth="lg">
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rl-purple/15 flex items-center justify-center">
                  <Link2 className="w-4.5 h-4.5 text-rl-purple" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rl-text">Link de criação de anúncios</h3>
                  <p className="text-xs text-rl-muted">O cliente entra com e-mail e senha e gera os próprios anúncios.</p>
                </div>
              </div>

              {/* Link compartilhável */}
              <div className="flex items-center gap-2 rounded-lg border border-rl-border bg-rl-surface px-3 py-2">
                {shareBusy && !shareUrl ? (
                  <span className="text-xs text-rl-muted flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando link...</span>
                ) : (
                  <>
                    <input readOnly value={shareUrl} className="flex-1 bg-transparent text-xs text-rl-text outline-none truncate" />
                    <button onClick={copyShareLink} className="shrink-0 flex items-center gap-1 text-xs font-semibold text-rl-purple hover:text-rl-text transition-all">
                      {shareCopied ? <><Check className="w-3.5 h-3.5 text-rl-green" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                    </button>
                  </>
                )}
              </div>

              {/* Usuários */}
              <div>
                <label className="text-[11px] font-bold text-rl-text block mb-2 uppercase tracking-wide">Usuários com acesso</label>
                <div className="space-y-1.5 mb-3">
                  {users.length === 0 && (
                    <p className="text-xs text-rl-muted">Nenhum usuário ainda. Cadastre abaixo pra liberar o acesso.</p>
                  )}
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 rounded-lg border border-rl-border bg-rl-surface px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-rl-text truncate">{u.name || u.email}</p>
                        <p className="text-[10px] text-rl-muted truncate">{u.email} · {u.generations || 0} anúncio{u.generations !== 1 ? 's' : ''}</p>
                      </div>
                      <button onClick={() => toggleUser(u)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${u.active ? 'text-rl-green bg-rl-green/10 border-rl-green/30' : 'text-rl-muted bg-rl-surface border-rl-border'}`}>
                        {u.active ? 'Ativo' : 'Inativo'}
                      </button>
                      <button onClick={() => deleteUser(u)} title="Remover"
                        className="p-1 rounded text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-rl-border bg-rl-surface/50 p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input value={newUser.name} onChange={(e) => setNewUser((s) => ({ ...s, name: e.target.value }))}
                      placeholder="Nome (opcional)" className="input-field w-full text-sm" />
                    <input type="email" value={newUser.email} onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))}
                      placeholder="E-mail do cliente" className="input-field w-full text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input value={newUser.password} onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && addUser()}
                      placeholder="Senha (mín. 4)" className="input-field flex-1 text-sm" />
                    <button onClick={addUser} disabled={userBusy}
                      className="btn-primary flex items-center gap-1.5 text-xs px-3 py-2 disabled:opacity-50 shrink-0">
                      {userBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Adicionar
                    </button>
                  </div>
                </div>
              </div>

              {shareError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{shareError}</p>
                </div>
              )}
            </div>
          </Modal>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              key: 'estaticos',
              Icon: Image,
              color: 'rl-blue',
              title: 'Criativos Estáticos',
              desc: 'Headlines, copies e sugestões visuais para anúncios em imagem. Metodologia ADIG para Meta Ads e Google Ads.',
              tags: ['ADIG', 'Meta Ads', 'Google Ads', 'Headlines', 'Copy'],
            },
            {
              key: 'video',
              Icon: Video,
              color: 'rl-purple',
              title: 'Criativos de Vídeo',
              desc: 'Roteiros de 30-60s com Gancho, Mensagem, Quebra de Objeção e CTA. Laboratório de Anúncios.',
              tags: ['Reels', 'YouTube', 'Gancho', 'Roteiro', 'CTA'],
            },
          ].map(({ key, Icon, color, title, desc, tags }) => (
            <button
              key={key}
              onClick={() => {
                setView(key)
                setResult(null)
                setAdTypeConfig({})
                setDorConfig({})
                setCustomDores([])
                setDorTextOverrides({})
                setEditingDorId(null)
                setMetodologiaOverride(null)
                setDiretrizesOverride(null)
                setInstructionOverride(null)
                setSelectedProductId('')
                setSelectedPersonaId('')
                setSelectedFunil('')
                setExtraDetails('')
                setError(null)
              }}
              className={`glass-card p-6 text-left hover:border-${color}/50 hover:shadow-glow transition-all duration-200 group`}
            >
              <div
                className={`w-12 h-12 rounded-2xl bg-${color}/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
              >
                <Icon className={`w-6 h-6 text-${color}`} />
              </div>
              <h3 className="text-base font-bold text-rl-text mb-1">{title}</h3>
              <p className="text-xs text-rl-muted leading-relaxed mb-4">{desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className={`text-[10px] px-2 py-0.5 rounded-full bg-${color}/10 text-${color} border border-${color}/20 font-medium`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        <ContextPreview project={scopedProject} />

        {/* History visible in home view */}
        <CreativeHistory
          project={project}
          updateProject={updateProject}
          onOpen={(c) => setHistoryCreativeId(c.id)}
        />

        {/* Histórico dos clientes (gerado via link compartilhável) */}
        <ClientHistoryPanel
          history={clientHistory}
          busy={historyBusy}
          onLoad={loadClientHistory}
          openItem={openHistoryItem}
          setOpenItem={setOpenHistoryItem}
        />
      </div>
    )
  }

  // ── View: Result ────────────────────────────────────────────────────────────
  if (result) {
    const companyName = project.companyName || project.company_name || 'Cliente'
    const freshCreative = lastCreativeId
      ? ((project.creatives || []).find((c) => c.id === lastCreativeId) ?? null)
      : null
    const qty = isVideo ? totalQuantity : staticTotalQty
    const adTypeLabels = isVideo
      ? selectedList.map((t, i) => `${t.label} ×${videoSplit[i]}`)
      : selectedDores.map((d) => d.text.substring(0, 50))

    function fmtDate(iso) {
      if (!iso) return ''
      return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <button
            onClick={() => {
              setView('select')
              setResult(null)
            }}
            aria-label="Voltar ao histórico"
            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all mt-0.5 shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isVideo
                    ? 'text-rl-purple bg-rl-purple/10 border-rl-purple/30'
                    : 'text-rl-blue bg-rl-blue/10 border-rl-blue/30'
                }`}
              >
                {isVideo ? '🎬 Vídeo' : '🖼️ Estático'}
              </span>
              <span className="text-xs text-rl-muted">{fmtDate(generatedAt)}</span>
              <span className="text-xs font-bold text-rl-text">
                {qty} criativo{qty !== 1 ? 's' : ''}
              </span>
            </div>
            {adTypeLabels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {adTypeLabels.map((label) => (
                  <span
                    key={label}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!loading && freshCreative && (
              <>
                <RatingSelector
                  value={freshCreative.rating}
                  onChange={(rating) => {
                    const updated = (project.creatives || []).map((x) =>
                      x.id === lastCreativeId ? { ...x, rating } : x
                    )
                    updateProject(project.id, { creatives: updated })
                  }}
                />
                <button
                  onClick={() => exportCreativoSetPDF({ creative: freshCreative, companyName })}
                  title="Exportar PDF"
                  className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                >
                  <FileDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    updateProject(project.id, {
                      creatives: (project.creatives || []).filter((x) => x.id !== lastCreativeId),
                    })
                    setResult(null)
                    setLastCreativeId(null)
                  }}
                  title="Excluir"
                  className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => {
                setResult(null)
                generate()
              }}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Regerar
            </button>
          </div>
        </div>

        <CreativeResultBlock
          content={result}
          type={isVideo ? 'video' : 'estatico'}
          companyName={companyName}
          onChunkChange={!loading ? handleFreshChunkEdit : undefined}
          onRefine={!loading ? makeRefineHandler(isVideo ? 'video' : 'estatico') : undefined}
        />
      </div>
    )
  }

  // ── View: Generator ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Sub-tabs: Copy (fluxo atual) | Visual com IA (novo) */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-rl-surface border border-rl-border w-fit">
        <button
          type="button"
          onClick={() => setTopTab('copy')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            topTab === 'copy'
              ? 'bg-rl-purple text-white shadow-sm'
              : 'text-rl-muted hover:text-rl-text'
          }`}
        >
          Copy
        </button>
        <button
          type="button"
          onClick={() => setTopTab('visual')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
            topTab === 'visual'
              ? 'bg-rl-purple text-white shadow-sm'
              : 'text-rl-muted hover:text-rl-text'
          }`}
        >
          ✨ Visual com IA
        </button>
        <button
          type="button"
          onClick={() => setTopTab('wireframes')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
            topTab === 'wireframes'
              ? 'bg-rl-purple text-white shadow-sm'
              : 'text-rl-muted hover:text-rl-text'
          }`}
        >
          📐 Wireframes
        </button>
        <button
          type="button"
          onClick={() => setTopTab('roteiros')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
            topTab === 'roteiros'
              ? 'bg-rl-purple text-white shadow-sm'
              : 'text-rl-muted hover:text-rl-text'
          }`}
        >
          🎬 Roteiros Validados
        </button>
      </div>

      {topTab === 'visual' && <CriativoVisualPanel project={project} />}

      {topTab === 'wireframes' && <AdWireframePanel project={project} />}

      {topTab === 'roteiros' && (
        <RoteirosValidadosPanel
          project={project}
          onGerarVariacoes={(item) => {
            setVariacaoRef({ adName: item.ad_name || '', transcription: item.transcription || '' })
            setResult(null)
            setError(null)
            setView('video')
            setTopTab('copy')
          }}
        />
      )}

      {topTab === 'copy' && (<>
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => {
            setView('select')
            setResult(null)
            setAdTypeConfig({})
            setDorConfig({})
            setCustomDores([])
            setDorTextOverrides({})
            setEditingDorId(null)
            setMetodologiaOverride(null)
            setDiretrizesOverride(null)
            setInstructionOverride(null)
            setSelectedFunil('')
            setExtraDetails('')
            setVariacaoRef(null)
            setError(null)
          }}
          aria-label="Voltar à seleção de formato"
          className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all mt-0.5"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            {isVideo ? (
              <Video className="w-5 h-5 text-rl-purple" />
            ) : (
              <Image className="w-5 h-5 text-rl-blue" />
            )}
            <h2 className="text-xl font-bold text-rl-text">
              {isVideo ? 'Criativos de Vídeo' : 'Criativos Estáticos'}
            </h2>
          </div>
          <p className="text-sm text-rl-muted mt-0.5 ml-7">
            {isVideo
              ? 'Selecione tipos e quantidade por gancho'
              : 'Selecione as dores da persona para gerar headlines'}
          </p>
        </div>
      </div>

      {/* ── Referência: anúncio campeão (variações de roteiro validado) ─────── */}
      {isVideo && variacaoRef && (
        <div className="rounded-xl border border-rl-purple/30 bg-rl-purple/5 p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-rl-purple shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-rl-text">
                Variações do anúncio campeão: <span className="text-rl-purple">{variacaoRef.adName || 'sem nome'}</span>
              </p>
              <p className="text-[11px] text-rl-muted mt-0.5">
                A transcrição entra na solicitação como referência: a IA mantém o DNA da mensagem (promessa, contexto, CTA) e varia gancho, ângulo e estrutura — sem copiar frases. Escolha o funil e os tipos de gancho normalmente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVariacaoRef(null)}
              title="Remover referência"
              className="p-1 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Escopo de produto + persona (opcional) ─────────────────────────── */}
      {(productList.length > 0 || personaList.length > 0) && (
        <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🎯</span>
            <label className="label-field !mb-0">
              Foco deste anúncio
            </label>
            {(selectedProduct || selectedPersona ||
              selectedProductId === NO_CONTEXT || selectedPersonaId === NO_CONTEXT) && (
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rl-purple/15 text-rl-purple border border-rl-purple/30">
                escopo ativo
              </span>
            )}
          </div>
          <p className="text-[11px] text-rl-muted leading-snug">
            Escolha um produto e/ou uma persona específicos pra IA focar só neles.
            Deixe em &ldquo;Todos&rdquo;/&ldquo;Todas&rdquo; pra considerar o cliente inteiro,
            ou &ldquo;Não usar…&rdquo; pra a IA ignorar esse contexto (bom quando o criativo
            vai rodar em outros funis).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {productList.length > 0 && (
              <div>
                <label className="text-[11px] font-bold text-rl-text block mb-1">📦 Produto/serviço</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="input-field w-full text-sm"
                >
                  <option value="">Todos os produtos</option>
                  <option value={NO_CONTEXT}>🚫 Não usar contexto de produto</option>
                  {productList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}{p.tipo === 'servico' ? ' · Serviço' : p.tipo === 'produto' ? ' · Produto' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {personaList.length > 0 && (
              <div>
                <label className="text-[11px] font-bold text-rl-text block mb-1">👤 Persona / público</label>
                <select
                  value={selectedPersonaId}
                  onChange={(e) => setSelectedPersonaId(e.target.value)}
                  className="input-field w-full text-sm"
                >
                  <option value="">Todas as personas</option>
                  <option value={NO_CONTEXT}>🚫 Não usar contexto de persona</option>
                  {personaList.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {!isVideo && selectedPersona && (
            <p className="text-[11px] text-rl-blue leading-snug">
              As dores abaixo são só da persona <strong>{selectedPersona.name}</strong>.
            </p>
          )}
        </div>
      )}

      {/* ── Funil (obrigatório) — define objetivo e CTA do anúncio ──────────── */}
      <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">🎯</span>
          <label className="label-field !mb-0">Funil deste anúncio</label>
          {selectedFunil && (
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rl-blue/15 text-rl-blue border border-rl-blue/30">
              {FUNIS_BY_ID[selectedFunil]?.meta}
            </span>
          )}
        </div>
        <p className="text-[11px] text-rl-muted leading-snug">
          Define o objetivo e o CTA (assistir aula, agendar reunião, baixar material, comprar...). Obrigatório.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {FUNIS.map((f) => {
            const on = selectedFunil === f.id
            return (
              <button key={f.id} onClick={() => setSelectedFunil(on ? '' : f.id)}
                className={`flex items-start gap-2 rounded-lg p-2.5 text-left border transition-all ${on ? 'bg-rl-blue/10 border-rl-blue/50' : 'bg-rl-surface border-rl-border hover:border-rl-blue/30'}`}>
                <span className="text-base leading-none mt-0.5">{f.icon}</span>
                <span className="min-w-0">
                  <span className={`block text-xs font-bold leading-tight ${on ? 'text-rl-blue' : 'text-rl-text'}`}>{f.label}</span>
                  <span className="block text-[10px] text-rl-muted leading-tight mt-0.5">{f.meta}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Nível de consciência (obrigatório) ──────────────────────────────── */}
      <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">🧠</span>
          <label className="label-field !mb-0">Nível de consciência do público</label>
          {nivel && (
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rl-purple/15 text-rl-purple border border-rl-purple/30">
              Nível {NIVEIS_BY_ID[nivel]?.num}
            </span>
          )}
        </div>
        <p className="text-[11px] text-rl-muted leading-snug">
          Em que ponto está quem vai ver este anúncio, em relação a esta oferta? Todas as peças
          desta geração são escritas nesse nível — é o que define a dor a atacar e o quanto
          precisa explicar. Obrigatório.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {NIVEIS_CONSCIENCIA.map((n) => {
            const on = nivel === n.id
            return (
              <button key={n.id} onClick={() => setNivel(on ? '' : n.id)}
                className={`flex items-start gap-2 rounded-lg p-2.5 text-left border transition-all ${on ? 'bg-rl-purple/10 border-rl-purple/50' : 'bg-rl-surface border-rl-border hover:border-rl-purple/30'}`}>
                <span className={`text-[10px] font-bold leading-none mt-0.5 w-4 h-4 shrink-0 rounded-full flex items-center justify-center ${on ? 'bg-rl-purple text-white' : 'bg-rl-border/60 text-rl-muted'}`}>
                  {n.num}
                </span>
                <span className="min-w-0">
                  <span className={`block text-xs font-bold leading-tight ${on ? 'text-rl-purple' : 'text-rl-text'}`}>{n.label}</span>
                  <span className="block text-[10px] text-rl-muted leading-tight mt-0.5">{n.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Quantidade de criativos ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔢</span>
          <label className="label-field !mb-0">
            Quantos {isVideo ? 'roteiros' : 'headlines'} gerar
          </label>
          {blocosAtuais > 0 && (
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rl-blue/15 text-rl-blue border border-rl-blue/30">
              {quantidade} em {blocosAtuais} bloco{blocosAtuais !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-[11px] text-rl-muted leading-snug">
          Total desta geração, distribuído entre{' '}
          {isVideo ? 'os tipos de gancho selecionados abaixo' : 'as combinações de dor x tipo abaixo'}.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {QTD_PRESETS.map((q) => (
            <button
              key={q}
              onClick={() => setQuantidade(q)}
              className={`w-10 h-8 rounded-lg text-xs font-bold border transition-all ${
                quantidade === q
                  ? 'bg-rl-blue/10 border-rl-blue/50 text-rl-blue'
                  : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-blue/30 hover:text-rl-text'
              }`}
            >
              {q}
            </button>
          ))}
          <span className="text-[10px] text-rl-muted px-1">ou</span>
          <input
            type="number"
            min={1}
            max={QTD_MAX}
            value={quantidade}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              setQuantidade(Number.isNaN(v) ? 1 : Math.min(Math.max(v, 1), QTD_MAX))
            }}
            className="input-field w-20 text-sm"
          />
        </div>
        {qtdInsuficiente && (
          <p className="text-[11px] text-red-400 leading-snug">
            {quantidade} {isVideo ? 'roteiros' : 'headlines'} para {blocosAtuais} blocos deixaria
            bloco sem peça. Aumente para pelo menos {blocosAtuais} ou selecione menos{' '}
            {isVideo ? 'tipos' : 'combinações'}.
          </p>
        )}
      </div>

      {/* ── Video: ad type + per-type quantity ─────────────────────────────── */}
      {isVideo && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="label-field">
              Tipos de gancho
              {selectedList.length > 0 && (
                <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-purple/20 text-rl-purple border border-rl-purple/30">
                  {selectedList.length} tipo{selectedList.length !== 1 ? 's' : ''} · {totalQuantity}{' '}
                  roteiro{totalQuantity !== 1 ? 's' : ''}
                </span>
              )}
            </label>
            <div className="flex gap-2 text-xs text-rl-muted">
              <button onClick={selectAll} className="hover:text-rl-purple transition-colors">
                Selecionar todos
              </button>
              <span>·</span>
              <button onClick={clearAll} className="hover:text-rl-purple transition-colors">
                Limpar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {AD_TYPES.map((type) => {
              const selected = (adTypeConfig[type.id] || 0) > 0
              const qtdTipo = selected ? videoSplit[selectedList.findIndex((t) => t.id === type.id)] : 0
              return (
                <button
                  key={type.id}
                  onClick={() => toggleType(type.id)}
                  className={`rounded-xl p-3 text-left transition-all border ${
                    selected
                      ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                      : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30 hover:text-rl-text'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{type.emoji}</span>
                    <span
                      className={`text-xs font-bold flex-1 ${selected ? 'text-rl-purple' : 'text-rl-text'}`}
                    >
                      {type.label}
                    </span>
                    {selected && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rl-purple/20 text-rl-purple border border-rl-purple/30 shrink-0">
                        {qtdTipo} roteiro{qtdTipo !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-rl-muted leading-snug line-clamp-2">{type.desc}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Static: dores da persona ─────────────────────────────────────── */}
      {!isVideo && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="label-field">
              Dores
              {selectedDores.length > 0 && (
                <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-purple/20 text-rl-purple border border-rl-purple/30">
                  {selectedDores.length} selecionada{selectedDores.length !== 1 ? 's' : ''} ·{' '}
                  {staticTotalQty} headline{staticTotalQty !== 1 ? 's' : ''}
                </span>
              )}
            </label>
          </div>

          <div className="space-y-2">
            {allDores.length === 0 && (
              <div className="rounded-xl border border-dashed border-rl-border py-8 text-center space-y-1">
                <p className="text-sm text-rl-muted">Nenhuma dor encontrada nas personas.</p>
                <p className="text-xs text-rl-muted">
                  Crie personas ou adicione dores personalizadas abaixo.
                </p>
              </div>
            )}

            {allDores.map((dor) => {
              const isEditing = editingDorId === dor.id
              const selected = !!dorConfig[dor.id]
              const cfg = dorConfig[dor.id]
              const isCustom = !!dor.isCustom

              if (isEditing) {
                return (
                  <div
                    key={dor.id}
                    className="rounded-xl p-3 border bg-rl-surface border-rl-purple/40"
                  >
                    <textarea
                      autoFocus
                      value={editingDorText}
                      onChange={(e) => setEditingDorText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          confirmDorEdit()
                        }
                        if (e.key === 'Escape') cancelDorEdit()
                      }}
                      rows={2}
                      placeholder="Descreva a dor do cliente..."
                      className="input-field w-full text-sm resize-none"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={confirmDorEdit}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-rl-green/10 border border-rl-green/30 text-rl-green hover:bg-rl-green/20 transition-all"
                      >
                        <Check className="w-3 h-3" /> Confirmar
                      </button>
                      <button
                        onClick={cancelDorEdit}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
                      >
                        <X className="w-3 h-3" /> Cancelar
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={dor.id}
                  className={`w-full rounded-xl p-3 text-left transition-all border ${
                    selected
                      ? 'bg-rl-purple/10 border-rl-purple/50'
                      : 'bg-rl-surface border-rl-border hover:border-rl-purple/30'
                  }`}
                >
                  <div
                    className="flex items-start gap-2.5 cursor-pointer"
                    onClick={() => toggleDor(dor.id)}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
                        selected ? 'bg-rl-purple border-rl-purple' : 'border-rl-border'
                      }`}
                    >
                      {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug ${selected ? 'text-rl-purple font-medium' : 'text-rl-text'}`}
                      >
                        {dor.text || <span className="italic text-rl-muted">Dor sem texto</span>}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {dor.personaName && (
                          <p className="text-[10px] text-rl-muted">{dor.personaName}</p>
                        )}
                        {isCustom && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rl-blue/10 border border-rl-blue/20 text-rl-blue font-medium">
                            Personalizada
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Edit / delete actions */}
                    <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingDorId(dor.id)
                          setEditingDorText(dor.text)
                        }}
                        title="Editar"
                        className="p-1 rounded hover:bg-rl-surface transition-all text-rl-muted hover:text-rl-text"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      {isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteCustomDor(dor.id)
                          }}
                          title="Remover"
                          className="p-1 rounded hover:bg-red-400/10 transition-all text-rl-muted hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tipos — fora do header clicável */}
                  {selected && (
                    <div className="mt-3 space-y-2">
                      {Object.keys(cfg.typeQtys || {}).map((typeId) => {
                        const type = AD_TYPES.find((t) => t.id === typeId)
                        if (!type) return null
                        return (
                          <div
                            key={typeId}
                            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-rl-purple/10 border border-rl-purple/30"
                          >
                            <span className="text-sm shrink-0">{type.emoji}</span>
                            <span className="text-xs font-medium text-rl-purple flex-1 leading-tight">
                              {type.label}
                            </span>
                            <span className="text-[10px] font-bold text-rl-purple/80 shrink-0">
                              {staticQtyByBlock[`${dor.id}::${typeId}`] ?? 0} headlines
                            </span>
                            <button
                              onClick={() => toggleDorType(dor.id, typeId)}
                              className="p-0.5 rounded text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
                              title="Remover"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}

                      {AD_TYPES.filter((t) => !cfg.typeQtys?.[t.id]).length > 0 && (
                        <div className="relative">
                          <button
                            onClick={() =>
                              setOpenTypeSelectorDorId((prev) => (prev === dor.id ? null : dor.id))
                            }
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-rl-border text-rl-muted hover:border-rl-blue/40 hover:text-rl-blue transition-all"
                          >
                            <Plus className="w-3 h-3" /> Incluir tipo
                          </button>

                          {openTypeSelectorDorId === dor.id && (
                            <div className="absolute left-0 top-full mt-1 z-20 w-52 rounded-xl border border-rl-border bg-rl-bg shadow-lg overflow-hidden">
                              {AD_TYPES.filter((t) => !cfg.typeQtys?.[t.id]).map((type) => (
                                <button
                                  key={type.id}
                                  onClick={() => {
                                    toggleDorType(dor.id, type.id)
                                    setOpenTypeSelectorDorId(null)
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs text-rl-text hover:bg-rl-surface transition-colors"
                                >
                                  <span>{type.emoji}</span>
                                  <span>{type.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {Object.keys(cfg.typeQtys || {}).length === 0 &&
                        openTypeSelectorDorId !== dor.id && (
                          <p className="text-[10px] text-red-400">
                            Selecione pelo menos um tipo para esta dor
                          </p>
                        )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add custom dor */}
            <button
              onClick={addCustomDor}
              className="w-full rounded-xl p-2.5 border border-dashed border-rl-border text-rl-muted hover:border-rl-blue/40 hover:text-rl-blue transition-all flex items-center justify-center gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar dor personalizada
            </button>
          </div>
        </div>
      )}

      {/* Solicitação — accordion */}
      <div className="rounded-xl border border-rl-border overflow-hidden">
        <button
          onClick={() => setInstructionOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-4 py-3 bg-rl-surface/60 hover:bg-rl-surface transition-colors text-left"
        >
          <span className="text-xs font-semibold text-rl-muted flex-1">Solicitação</span>
          {instructionOverride !== null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rl-blue/10 border border-rl-blue/20 text-rl-blue font-medium">
              editado
            </span>
          )}
          {instructionOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-rl-muted shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-rl-muted shrink-0" />
          )}
        </button>
        {instructionOpen && (
          <div className="px-4 py-3 border-t border-rl-border space-y-2">
            <AutoResizeTextarea
              value={instructionOverride ?? autoInstruction}
              onChange={(e) => setInstructionOverride(e.target.value)}
              className="input-field w-full text-xs font-mono"
            />
            {instructionOverride !== null && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-rl-blue flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Editado manualmente
                </p>
                <button
                  onClick={() => setInstructionOverride(null)}
                  className="flex items-center gap-1 text-[10px] text-rl-muted hover:text-rl-blue transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Restaurar automático
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* System Prompt — accordion */}
      <div className="rounded-xl border border-rl-border overflow-hidden">
        <button
          onClick={() => setSystemOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-4 py-3 bg-rl-surface/60 hover:bg-rl-surface transition-colors text-left"
        >
          <span className="text-xs font-semibold text-rl-muted flex-1">System Prompt</span>
          {(metodologiaOverride !== null || diretrizesOverride !== null) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rl-blue/10 border border-rl-blue/20 text-rl-blue font-medium">
              editado
            </span>
          )}
          {systemOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-rl-muted shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-rl-muted shrink-0" />
          )}
        </button>
        {systemOpen &&
          (() => {
            const parts = isVideo ? VIDEO_SYSTEM_PARTS : DORES_SYSTEM_PARTS
            return (
              <div className="border-t border-rl-border divide-y divide-rl-border/60">
                {/* Metodologia — editável */}
                <div className="px-4 py-3 space-y-2">
                  <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wide">
                    Metodologia
                  </p>
                  <AutoResizeTextarea
                    value={metodologiaOverride ?? parts.metodologia}
                    onChange={(e) => setMetodologiaOverride(e.target.value)}
                    className="input-field w-full text-xs font-mono"
                  />
                  {metodologiaOverride !== null && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-rl-blue flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Editado manualmente
                      </p>
                      <button
                        onClick={() => setMetodologiaOverride(null)}
                        className="flex items-center gap-1 text-[10px] text-rl-muted hover:text-rl-blue transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Restaurar padrão
                      </button>
                    </div>
                  )}
                </div>
                {/* Diretrizes — editável + linha bloqueada */}
                <div className="px-4 py-3 space-y-2">
                  <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wide">
                    Diretrizes
                  </p>
                  <AutoResizeTextarea
                    value={diretrizesOverride ?? parts.diretrizes}
                    onChange={(e) => setDiretrizesOverride(e.target.value)}
                    className="input-field w-full text-xs font-mono"
                  />
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rl-surface/60 border border-rl-border/40">
                    <Lock className="w-3 h-3 text-rl-muted shrink-0" />
                    <span className="text-xs text-rl-muted font-mono">{parts.diretrizLocked}</span>
                  </div>
                  {diretrizesOverride !== null && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-rl-blue flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Editado manualmente
                      </p>
                      <button
                        onClick={() => setDiretrizesOverride(null)}
                        className="flex items-center gap-1 text-[10px] text-rl-muted hover:text-rl-blue transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Restaurar padrão
                      </button>
                    </div>
                  )}
                </div>
                {/* Estrutura — somente leitura */}
                <div className="px-4 py-3 space-y-2">
                  <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wide">
                    Estrutura
                  </p>
                  <pre className="text-xs text-rl-muted font-mono leading-relaxed whitespace-pre-wrap bg-rl-surface/60 rounded-lg px-3 py-2.5 border border-rl-border/40">
                    {parts.estrutura(nivel)}
                  </pre>
                </div>
              </div>
            )
          })()}
      </div>

      {/* Context preview */}
      <ContextPreview project={scopedProject} collapsed />

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Detalhes específicos deste anúncio (opcional) */}
      {!result && (
        <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-3 space-y-1.5">
          <label className="label-field !mb-0">
            Detalhes deste anúncio <span className="text-rl-muted font-normal">(opcional)</span>
          </label>
          <p className="text-[11px] text-rl-muted leading-snug">
            Promoção, condição, prazo, produto específico, ângulo desejado... A IA incorpora em cada peça.
          </p>
          <AutoResizeTextarea
            value={extraDetails}
            onChange={(e) => setExtraDetails(e.target.value.slice(0, 1200))}
            className="input-field w-full text-sm min-h-[64px]"
          />
        </div>
      )}

      {/* Generate */}
      {!result && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={generate}
            disabled={
              !selectedFunil ||
              !nivel ||
              qtdInsuficiente ||
              (isVideo
                ? selectedList.length === 0
                : selectedDores.length === 0 || dorsPendingType.length > 0) || loading
            }
            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Gerando...
              </>
            ) : isVideo ? (
              <>
                <Sparkles className="w-4 h-4" /> Gerar {totalQuantity} Roteiro
                {totalQuantity !== 1 ? 's' : ''}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Gerar {staticTotalQty} Headline
                {staticTotalQty !== 1 ? 's' : ''}
              </>
            )}
          </button>
          {!selectedFunil && (
            <p className="text-xs text-rl-blue">Escolha o funil deste anúncio acima</p>
          )}
          {selectedFunil && !nivel && (
            <p className="text-xs text-rl-purple">
              Escolha o nível de consciência do público acima
            </p>
          )}
          {isVideo && selectedList.length === 0 && (
            <p className="text-xs text-rl-muted">Selecione pelo menos um tipo de gancho</p>
          )}
          {!isVideo && selectedDores.length === 0 && (
            <p className="text-xs text-rl-muted">Selecione pelo menos uma dor</p>
          )}
          {!isVideo && selectedDores.length > 0 && dorsPendingType.length > 0 && (
            <p className="text-xs text-red-400">
              {dorsPendingType.length} dor{dorsPendingType.length !== 1 ? 'es' : ''} sem tipo
              selecionado
            </p>
          )}
          {isVideo && selectedList.length > 0 && !loading && (
            <p className="text-xs text-rl-muted">
              {selectedList.length} tipo{selectedList.length > 1 ? 's' : ''} · {totalQuantity}{' '}
              roteiro{totalQuantity !== 1 ? 's' : ''}
              {nivel ? ` · nível ${NIVEIS_BY_ID[nivel].num} (${NIVEIS_BY_ID[nivel].label})` : ''}
              {instructionOverride ? ' · com direção personalizada' : ''}
            </p>
          )}
          {!isVideo && selectedDores.length > 0 && !loading && (
            <p className="text-xs text-rl-muted">
              {selectedDores.length} dor{selectedDores.length > 1 ? 'es' : ''} · {staticTotalQty}{' '}
              headline{staticTotalQty !== 1 ? 's' : ''}
              {nivel ? ` · nível ${NIVEIS_BY_ID[nivel].num} (${NIVEIS_BY_ID[nivel].label})` : ''}
              {instructionOverride ? ' · com direção personalizada' : ''}
            </p>
          )}
        </div>
      )}
      </>)}
    </div>
  )
}

// ─── Painel: histórico dos anúncios criados pelos clientes (via link) ──────────
function ClientHistoryPanel({ history, busy, onLoad, openItem, setOpenItem }) {
  function fmt(iso) {
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  // Agrupa por usuário (email).
  const groups = {}
  for (const h of history || []) {
    const key = h.user_email || 'sem-usuario'
    if (!groups[key]) groups[key] = { name: h.user_name, email: h.user_email, items: [] }
    groups[key].items.push(h)
  }
  const groupList = Object.values(groups)

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-rl-purple" />
          <h3 className="text-sm font-bold text-rl-text">Anúncios dos clientes</h3>
        </div>
        <button onClick={onLoad} disabled={busy}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          {history === null ? 'Carregar' : 'Atualizar'}
        </button>
      </div>
      <p className="text-xs text-rl-muted mb-3">Gerados pelos usuários no link compartilhável, separados por usuário.</p>

      {history === null ? (
        <p className="text-xs text-rl-muted">Clique em “Carregar” para ver os anúncios criados pelos clientes.</p>
      ) : groupList.length === 0 ? (
        <p className="text-xs text-rl-muted">Nenhum anúncio criado pelos clientes ainda.</p>
      ) : (
        <div className="space-y-4">
          {groupList.map((g) => (
            <div key={g.email}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-rl-text">{g.name || g.email}</span>
                <span className="text-[10px] text-rl-muted">{g.email} · {g.items.length} anúncio{g.items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-1.5">
                {g.items.map((h) => {
                  const open = openItem === h.id
                  return (
                    <div key={h.id} className="rounded-lg border border-rl-border bg-rl-surface overflow-hidden">
                      <button onClick={() => setOpenItem(open ? null : h.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-rl-surface/70 transition-all">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${h.mode === 'video' ? 'text-rl-purple bg-rl-purple/10 border-rl-purple/30' : 'text-rl-blue bg-rl-blue/10 border-rl-blue/30'}`}>
                          {h.mode === 'video' ? '🎬' : '🖼️'}
                        </span>
                        {h.funil_label && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted truncate max-w-[40%]">{h.funil_label}</span>}
                        <span className="text-[10px] text-rl-muted ml-auto shrink-0">{fmt(h.created_at)}</span>
                        {open ? <ChevronUp className="w-3.5 h-3.5 text-rl-muted shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-rl-muted shrink-0" />}
                      </button>
                      {open && (
                        <div className="px-3 pb-3 pt-1 border-t border-rl-border">
                          {h.detalhes && <p className="text-[11px] text-rl-muted italic mb-2">Detalhes: {h.detalhes}</p>}
                          <MarkdownBlock content={h.content || ''} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Painel: Roteiros Validados (transcrições de anúncios em vídeo) ────────────
// Material de aprendizado por cliente — as transcrições salvas pelo viewer do
// dashboard (botão "Transcrever vídeo"). Lê/edita/exclui via api/roteiros-validados.
// "Gerar variações" (onGerarVariacoes): leva a transcrição pro fluxo padrão de
// roteiros de vídeo da aba Copy, como referência de mensagem campeã.
function RoteirosValidadosPanel({ project, onGerarVariacoes }) {
  const [items, setItems] = useState(null) // null = não carregado
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const authFetch = useCallback(async (payload) => {
    let token = null
    try {
      const { supabase } = await import('../lib/supabase.js')
      const { data } = (await supabase?.auth.getSession()) ?? {}
      token = data?.session?.access_token ?? null
    } catch { /* sem token → 401 */ }
    const res = await fetch('/api/roteiros-validados', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...payload, projectId: project.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error?.message || data?.error || `Erro ${res.status}`)
    return data
  }, [project.id])

  const load = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const data = await authFetch({ action: 'list' })
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e) { setError(e.message); setItems([]) }
    finally { setBusy(false) }
  }, [authFetch])

  useEffect(() => { load() }, [load])

  const remove = async (id) => {
    if (!window.confirm('Excluir este roteiro validado?')) return
    try {
      await authFetch({ action: 'delete', id })
      setItems((prev) => (prev || []).filter((x) => x.id !== id))
    } catch (e) { setError(e.message) }
  }

  const copy = async (item) => {
    try {
      await navigator.clipboard.writeText(item.transcription || '')
      setCopiedId(item.id); setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1800)
    } catch { /* clipboard bloqueado */ }
  }

  const fmt = (iso) => {
    try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return '' }
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-rl-purple/15 flex items-center justify-center">
            <Video className="w-4.5 h-4.5 text-rl-purple" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rl-text">Roteiros Validados</h3>
            <p className="text-xs text-rl-muted">Transcrições dos anúncios em vídeo que performaram — vire aprendizado para novas copies.</p>
          </div>
        </div>
        <button type="button" onClick={load} disabled={busy}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rl-muted hover:text-rl-text border border-rl-border">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Atualizar
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {items && items.length === 0 && !busy && (
        <div className="text-center py-10 px-4">
          <Video className="w-8 h-8 text-rl-muted/50 mx-auto mb-3" />
          <p className="text-sm text-rl-text font-semibold mb-1">Nenhum roteiro validado ainda</p>
          <p className="text-xs text-rl-muted max-w-sm mx-auto">No dashboard, abra a prévia de um anúncio em vídeo e clique em <span className="font-semibold">“📝 Transcrever vídeo”</span> → <span className="font-semibold">“Salvar em Roteiros Validados”</span>.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-2">
          {items.map((it) => {
            const open = openId === it.id
            return (
              <div key={it.id} className="rounded-lg border border-rl-border bg-rl-surface/50 overflow-hidden">
                <button type="button" onClick={() => setOpenId(open ? null : it.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-rl-surface">
                  <Video className="w-4 h-4 text-rl-purple shrink-0" />
                  <span className="text-xs font-semibold text-rl-text truncate flex-1">{it.ad_name || 'Anúncio sem nome'}</span>
                  <span className="text-[10px] text-rl-muted shrink-0">{fmt(it.created_at)}</span>
                  {open ? <ChevronUp className="w-3.5 h-3.5 text-rl-muted shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-rl-muted shrink-0" />}
                </button>
                {open && (
                  <div className="px-3 pb-3 pt-1 border-t border-rl-border">
                    {(it.account || it.user_name) && (
                      <p className="text-[11px] text-rl-muted italic mb-2">
                        {it.account ? `Conta: ${it.account}` : ''}{it.account && it.user_name ? ' · ' : ''}{it.user_name ? `Salvo por ${it.user_name}` : ''}
                      </p>
                    )}
                    <p className="text-[13px] leading-relaxed text-rl-text whitespace-pre-wrap">{it.transcription}</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <button type="button" onClick={() => onGerarVariacoes(it)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-rl-purple hover:bg-rl-purple/90">
                        <Sparkles className="w-3.5 h-3.5" /> Gerar variações
                      </button>
                      <button type="button" onClick={() => copy(it)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-rl-muted hover:text-rl-text border border-rl-border">
                        {copiedId === it.id ? <Check className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />} {copiedId === it.id ? 'Copiado' : 'Copiar'}
                      </button>
                      <button type="button" onClick={() => remove(it.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 hover:text-red-300 border border-red-400/30">
                        <Trash2 className="w-3.5 h-3.5" /> Excluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
