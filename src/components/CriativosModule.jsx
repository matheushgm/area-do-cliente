import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import { buildCachedPayload } from '../lib/buildContext'
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
} from 'lucide-react'
import { replaceAdInContent } from './Criativos/ResultBlock'
import CreativeResultBlock from './Criativos/CreativeResultBlock'
import ContextPreview from './Criativos/ContextPreview'
import CreativeHistory from './Criativos/CreativeHistory'
import VideoGuide from './VideoGuide'
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

const VIDEO_SYSTEM_PARTS = {
  metodologia: `Você é um especialista em roteiros de vídeos de anúncios online de alta conversão, usando a estrutura do Laboratório de Anúncios (Revenue Lab).

Os vídeos têm duração entre 30 e 60 segundos e são criados para Meta Ads e YouTube Ads.

Use as informações de público-alvo, personas e oferta já fornecidas no contexto do cliente para personalizar cada roteiro. Não gere análise de público — vá direto aos roteiros.`,

  estrutura: `
Crie cada roteiro seguindo a ESTRUTURA DO LABORATÓRIO DE ANÚNCIOS (4 etapas):

## ROTEIRO [N]: Gancho: [Tipo] | [Etapa do Funil]

**GANCHO (0s – 3s):** 
[frase exata: disruptiva, contra-intuitiva, que para o scroll]

**MENSAGEM (3s – 45s):** 
[narração mostrando transformação do Ponto A → Ponto B, com quebra de objeção integrada naturalmente]

**CTA FINAL (45s – 60s)**
[reforça promessa + gatilho de escassez/urgência + ação clara]

**📝 LEGENDA DO POST:** [legenda com emojis]

---`,

  diretrizes: `Regras críticas:
- O GANCHO deve quebrar o padrão nos PRIMEIROS 3 SEGUNDOS. Seja contra-intuitivo
- A quebra de objeções deve estar INTEGRADA à mensagem (nunca separada)
- CTA com gatilho de escassez ou urgência específico
- Português brasileiro conversacional e energético
- Não use travessões (—) em nenhuma parte do output
- Não inclua sugestões de cena ou visual em nenhuma parte do roteiro
- Não use emojis no roteiro — use emojis apenas na LEGENDA DO POST
- Gere EXATAMENTE a quantidade indicada por tipo, na ordem listada
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

  estrutura: `ESTRUTURA OBRIGATÓRIA — um bloco por combinação dor + tipo:

# DOR: [texto exato da dor] | [Emoji] [Nome do Tipo]

## Headlines:
- [Headline 1 — ideal 7 máx. 12 palavras]
- [Headline 2 — ideal 7 máx. 12 palavras]
(tantas quantas solicitadas para este bloco)

## Subheadlines:
- [Subheadline 1 — complementa a headline 1, máx. 20 palavras]
- [Subheadline 2 — complementa a headline 2, máx. 20 palavras]
(uma subheadline por headline)

---`,

  diretrizes: `Diretrizes:
- Gere EXATAMENTE um bloco separado por combinação dor + tipo — nunca agrupe tipos dentro de um mesmo bloco
- Português brasileiro coloquial e persuasivo — evite palavras que a IA usa mas que humanos não usam
- Use "você" diretamente
- Seja específico ao negócio, nunca genérico
- Não use travessões (—)`,

  diretrizLocked: `- Separe cada bloco com "---"`,
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CriativosModule({ project }) {
  const { updateProject } = useApp()

  const [view, setView] = useState('select') // 'select' | 'estaticos' | 'video'
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

  const isVideo = view === 'video'

  // ── Video: ad type config ──────────────────────────────────────────────────
  const selectedList = AD_TYPES.filter((t) => (adTypeConfig[t.id] || 0) > 0)
  const totalQuantity = selectedList.reduce((s, t) => s + adTypeConfig[t.id], 0)

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

  const updateQty = useCallback((id, delta) => {
    setAdTypeConfig((prev) => ({
      ...prev,
      [id]: Math.max(1, Math.min(10, (prev[id] || 1) + delta)),
    }))
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
    const parsed = parseDores(project.personas || []).map((d) => ({
      ...d,
      text: dorTextOverrides[d.id] ?? d.text,
    }))
    return [...parsed, ...customDores]
  }, [project.personas, dorTextOverrides, customDores])
  const selectedDores = allDores.filter((d) => !!dorConfig[d.id])
  const staticTotalQty = selectedDores.reduce((s, d) => {
    const typeQtys = dorConfig[d.id]?.typeQtys || {}
    return s + Object.values(typeQtys).reduce((sum, qty) => sum + qty, 0)
  }, 0)
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

  const updateDorTypeQty = useCallback((dorId, typeId, delta) => {
    setDorConfig((prev) => {
      const dor = prev[dorId]
      return {
        ...prev,
        [dorId]: {
          ...dor,
          typeQtys: {
            ...dor.typeQtys,
            [typeId]: Math.max(1, Math.min(10, (dor.typeQtys[typeId] || 1) + delta)),
          },
        },
      }
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
    if (isVideo) {
      const typesStr = selectedList
        .map((t) => {
          const q = adTypeConfig[t.id]
          return `${t.emoji} ${t.label} (${q} ${q === 1 ? 'variação' : 'variações'}): ${t.desc}`
        })
        .join('\n')
      return `---

## SOLICITAÇÃO

Tipos de gancho a gerar:
${typesStr}`
    }

    const sections = selectedDores
      .map((d) => {
        const cfg = dorConfig[d.id]
        const typeQtys = cfg?.typeQtys || {}
        const typeKeys = Object.keys(typeQtys)
        const typeLines = typeKeys
          .map((tid) => {
            const type = AD_TYPES.find((t) => t.id === tid)
            const qty = typeQtys[tid]
            return `- ${type.emoji} ${type.label}: ${qty} headline${qty !== 1 ? 's' : ''} + ${qty} subheadline${qty !== 1 ? 's' : ''} — ângulo: ${type.desc}`
          })
          .join('\n')
        return `### DOR: "${d.text}"
${typeLines}`
      })
      .join('\n\n')

    return `---

## SOLICITAÇÃO

${sections}`
  }, [adTypeConfig, dorConfig, isVideo, selectedDores, selectedList, totalQuantity])

  // ── Generate ────────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (isVideo && !selectedList.length) return
    if (!isVideo && !selectedDores.length) return
    const now = new Date().toISOString()
    setGeneratedAt(now)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const parts = isVideo ? VIDEO_SYSTEM_PARTS : DORES_SYSTEM_PARTS
      const systemPrompt = [
        metodologiaOverride ?? parts.metodologia,
        parts.estrutura,
        (diretrizesOverride ?? parts.diretrizes) + '\n' + parts.diretrizLocked,
      ].join('\n\n')
      const { system, messages } = buildCachedPayload({
        systemPrompt,
        project,
        instruction: instructionOverride ?? autoInstruction,
      })
      const fullText = await streamClaude({
        model: 'claude-sonnet-4-5',
        max_tokens: 16000,
        system,
        messages,
        onChunk: (text) => setResult(text.replace(/—/g, '-')),
      })

      const cleanText = fullText.replace(/—/g, '-')
      const newId = crypto.randomUUID()
      const adTypeLabels = isVideo
        ? selectedList.map((t) => `${t.label} ×${adTypeConfig[t.id]}`)
        : selectedDores.map((d) => d.text.substring(0, 50))
      const autoName = [
        isVideo ? 'Vídeo' : 'Estático',
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
        content: cleanText,
        rating: null,
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
    selectedDores,
    selectedList,
    staticTotalQty,
    metodologiaOverride,
    totalQuantity,
    updateProject,
  ])

  // ── Refine a single chunk ──────────────────────────────────────────────────
  const makeRefineHandler = useCallback(
    (creativeType) => async (_chunkIndex, chunkContent, userNote, onChunk) => {
      const isVid = creativeType === 'video'
      const parts = isVid ? VIDEO_SYSTEM_PARTS : DORES_SYSTEM_PARTS
      const systemPrompt = [
        parts.estrutura,
        parts.diretrizes + '\n' + parts.diretrizLocked,
      ].join('\n\n')
      const { system, messages } = buildCachedPayload({
        systemPrompt,
        project,
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
    [project]
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

        <div>
          <h2 className="text-xl font-bold text-rl-text mb-1">Gerador de Criativos com IA</h2>
          <p className="text-sm text-rl-muted">
            Selecione o formato para gerar criativos usando os dados do cliente.
          </p>
        </div>

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

        <ContextPreview project={project} />

        {/* History visible in home view */}
        <CreativeHistory
          project={project}
          updateProject={updateProject}
          onOpen={(c) => setHistoryCreativeId(c.id)}
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
      ? selectedList.map((t) => `${t.label} ×${adTypeConfig[t.id]}`)
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
              const qty = adTypeConfig[type.id] || 1
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
                      <div
                        className="flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => updateQty(type.id, -1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-rl-purple hover:bg-rl-purple/20 text-sm font-bold leading-none"
                        >
                          −
                        </button>
                        <span className="text-xs font-bold text-rl-purple min-w-[1.25rem] text-center">
                          {qty}
                        </span>
                        <button
                          onClick={() => updateQty(type.id, +1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-rl-purple hover:bg-rl-purple/20 text-sm font-bold leading-none"
                        >
                          +
                        </button>
                      </div>
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
                  {staticTotalQty} variação{staticTotalQty !== 1 ? 'ões' : ''}
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
                      {Object.entries(cfg.typeQtys || {}).map(([typeId, qty]) => {
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
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={() => updateDorTypeQty(dor.id, typeId, -1)}
                                className="w-5 h-5 rounded flex items-center justify-center text-rl-purple hover:bg-rl-purple/20 text-sm font-bold leading-none"
                              >
                                −
                              </button>
                              <span className="text-xs font-bold text-rl-purple min-w-[1.25rem] text-center">
                                {qty}
                              </span>
                              <button
                                onClick={() => updateDorTypeQty(dor.id, typeId, +1)}
                                className="w-5 h-5 rounded flex items-center justify-center text-rl-purple hover:bg-rl-purple/20 text-sm font-bold leading-none"
                              >
                                +
                              </button>
                            </div>
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
                    {parts.estrutura}
                  </pre>
                </div>
              </div>
            )
          })()}
      </div>

      {/* Context preview */}
      <ContextPreview project={project} collapsed />

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Generate */}
      {!result && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={generate}
            disabled={
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
                <Sparkles className="w-4 h-4" /> Gerar Headlines para {selectedDores.length} Dor
                {selectedDores.length !== 1 ? 'es' : ''}
              </>
            )}
          </button>
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
              {instructionOverride ? ' · com direção personalizada' : ''}
            </p>
          )}
          {!isVideo && selectedDores.length > 0 && !loading && (
            <p className="text-xs text-rl-muted">
              {selectedDores.length} dor{selectedDores.length > 1 ? 'es' : ''} · {staticTotalQty}{' '}
              variação{staticTotalQty !== 1 ? 'ões' : ''}
              {instructionOverride ? ' · com direção personalizada' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
