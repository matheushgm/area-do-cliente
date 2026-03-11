import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import { buildCachedPayload } from '../lib/buildContext'
import RatingSelector from './RatingSelector'
import {
  Image, Video, Sparkles, Loader2, AlertTriangle, Copy,
  CheckCheck, ChevronLeft, RotateCcw, Hash, CheckCircle2,
  History, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react'

// ─── Ad Types ─────────────────────────────────────────────────────────────────
const AD_TYPES = [
  { id: 'clickbait',        label: 'Clickbait',         emoji: '🎣', desc: 'Título altamente intrigante relacionado ao público-alvo' },
  { id: 'sensacao',         label: 'Sensação',           emoji: '⚡', desc: 'Criação de sensações fortes para envolver o público' },
  { id: 'mito',             label: 'Mito',               emoji: '🏛️', desc: 'Anúncio em torno de um mito ou história cativante' },
  { id: 'dilema',           label: 'Dilema',             emoji: '⚖️', desc: 'Destaca um dilema que ressoa com o público' },
  { id: 'prova',            label: 'Prova',              emoji: '✅', desc: 'Evidências sólidas, resultados ou testemunhos' },
  { id: 'contraste',        label: 'Contraste',          emoji: '🔄', desc: 'Situação contrastante para gerar impacto visual' },
  { id: 'visual',           label: 'Visual',             emoji: '👁️', desc: 'Orientado por elementos visuais impactantes' },
  { id: 'oportunidade',     label: 'Oportunidade',       emoji: '🚀', desc: 'A oportunidade como ponto focal da mensagem' },
  { id: 'historia',         label: 'História',           emoji: '📖', desc: 'Narrativa envolvente que conecta ao produto' },
  { id: 'certo_errado',     label: 'Certo vs. Errado',   emoji: '🎯', desc: 'Comparação entre práticas certas e erradas' },
  { id: 'demonstracao',     label: 'Demonstração',       emoji: '🎬', desc: 'Demonstração direta do produto ou serviço' },
  { id: 'ultra_segmentado', label: 'Ultra Segmentado',   emoji: '🔍', desc: 'Altamente segmentado para um público específico' },
  { id: 'apelo_emocional',  label: 'Apelo Emocional',    emoji: '❤️', desc: 'Explora o apelo emocional do público-alvo' },
  { id: 'curiosidade',      label: 'Curiosidade',        emoji: '🤔', desc: 'Desperta a curiosidade irresistível do público' },
  { id: 'reflexao',         label: 'Reflexão',           emoji: '💭', desc: 'Provoca reflexão profunda no público' },
  { id: 'comparacao',       label: 'Comparação',         emoji: '📊', desc: 'Comparação relevante entre alternativas' },
  { id: 'problema_solucao', label: 'Problema e Solução', emoji: '🔧', desc: 'Apresenta um problema e revela a solução' },
  { id: 'explicacao',       label: 'Explicação',         emoji: '📋', desc: 'Explicação detalhada, educativa do produto/serviço' },
]

const QUANTITIES = [1, 2, 3, 5, 10]

// ─── System Prompts ───────────────────────────────────────────────────────────
const STATIC_SYSTEM = `Você é um especialista em copywriting para anúncios estáticos (imagens) em português brasileiro, usando a metodologia Revenue Lab / Laboratório de Anúncios.

Sua missão é criar anúncios de alta conversão seguindo a metodologia ADIG:
- A: Anunciar o público-alvo
- D: Dar um objetivo/resultado
- I: Indicar um intervalo de tempo
- G: Garantia ou palavra de força

Antes de criar os anúncios, gere uma ANÁLISE RÁPIDA DO PÚBLICO:
**Problemas mais comuns:** [liste 5 problemas específicos]
**Sonhos e vontades:** [liste 5 desejos pós-solução]
**Principais objeções:** [liste 5 objeções à compra]
**Situações constrangedoras:** [liste 3 situações de dor do público]

Em seguida, crie cada anúncio com a seguinte estrutura obrigatória:

## ANÚNCIO [N] — [Tipo] | [Etapa do Funil]

**HEADLINE PRINCIPAL:** (headline ADIG — máx. 10 palavras — para o scroll)
**HEADLINE SECUNDÁRIA:** (complementa e desenvolve — máx. 15 palavras)
**COPY COMPLEMENTAR:** (2-3 frases — benefício central, prova, urgência)
**CALL-TO-ACTION:** (ação direta e clara)
**ELEMENTOS VISUAIS SUGERIDOS:**
- Imagem: [descrição da imagem principal]
- Paleta de cores: [2-3 cores]
- Layout: [composição sugerida]

---

Tipos de mensagem por etapa do funil:
- TOPO: História/Depoimento, Quebra de Paradigma, Desejo/Visão Futura, Medo
- MEIO: O segredo X para Y, Problema/Solução
- FUNDO: Promessa, Oferta

Diretrizes obrigatórias:
- Português brasileiro coloquial e persuasivo
- Fale diretamente com o público (use "você")
- Seja específico ao negócio, nunca genérico
- Inclua prova social, urgência ou escassez quando relevante
- Separe cada anúncio com "---"`

const VIDEO_SYSTEM = `Você é um especialista em roteiros de vídeos de anúncios online de alta conversão, usando a estrutura do Laboratório de Anúncios (Revenue Lab).

Os vídeos têm duração entre 30 e 60 segundos e são criados para Meta Ads e YouTube Ads.

Antes de criar os roteiros, gere uma ANÁLISE RÁPIDA DO PÚBLICO:
**Problemas mais comuns:** [liste 5 problemas específicos]
**Sonhos e vontades:** [liste 5 desejos pós-solução]
**Principais objeções:** [liste 5 objeções]
**Situações constrangedoras:** [liste 3 situações de dor]

Em seguida, crie cada roteiro seguindo a ESTRUTURA DO LABORATÓRIO DE ANÚNCIOS (4 etapas):

## ROTEIRO [N] — Gancho: [Tipo] | [Etapa do Funil]

**⏱ GANCHO (0s – 3s)** — [Tipo de gancho]
🎬 Visual: [o que aparece na tela]
🎙️ Fala/Texto: [frase exata — disruptiva, contra-intuitiva, que para o scroll]

**🔥 MENSAGEM (3s – 45s)** — [Tipo: StoryTelling/Proclamação/Segredos/Problema-Solução/Promessa/Oferta]
🎬 Visual: [cena]
🎙️ Fala: [narração mostrando transformação do Ponto A → Ponto B, com quebra de objeção integrada naturalmente]

**📣 CTA FINAL (45s – 60s)**
🎬 Visual: [encerramento]
🎙️ Fala: [reforça promessa + gatilho de escassez/urgência + ação clara]

**📝 LEGENDA DO POST:** [legenda com emojis]

---

Ao final de TODOS os roteiros, crie uma tabela interligando:
| Tipo de Gancho | Tipo de Mensagem | Quebra de Objeção | CTA Sugerido |
cobrindo os tipos de gancho selecionados × mensagens de funil.

Tipos de mensagem por funil:
- TOPO: StoryTelling, Proclamação
- MEIO: Segredos que ninguém te conta, Problema-Solução
- FUNDO: Promessa, Oferta

Regras críticas:
- O GANCHO deve quebrar o padrão nos PRIMEIROS 3 SEGUNDOS — seja contra-intuitivo
- A quebra de objeções deve estar INTEGRADA à mensagem (nunca separada)
- CTA com gatilho de escassez ou urgência específico
- Português brasileiro conversacional e energético
- Separe cada roteiro com "---"`

// ─── Result display ───────────────────────────────────────────────────────────
function CreativeCard({ content, index }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = content.split('\n')
  const rendered = lines.map((line, i) => {
    if (/^##\s/.test(line))  return <h3 key={i} className="text-sm font-bold text-rl-text mt-4 mb-2 first:mt-0">{line.replace(/^##\s/, '')}</h3>
    if (/^###\s/.test(line)) return <h4 key={i} className="text-xs font-bold text-rl-purple mt-3 mb-1">{line.replace(/^###\s/, '')}</h4>
    if (/^\*\*.*\*\*/.test(line)) {
      const label = line.match(/^\*\*(.*?)\*\*/)?.[1] || ''
      const rest  = line.replace(/^\*\*(.*?)\*\*:?\s*/, '')
      return (
        <div key={i} className="mt-2">
          <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">{label}</span>
          {rest && <p className="text-sm text-rl-text mt-0.5 leading-relaxed">{rest}</p>}
        </div>
      )
    }
    if (/^[🎬🎙️📝⏱🔥📣]/.test(line)) return <p key={i} className="text-sm text-rl-text mt-1 leading-relaxed">{line}</p>
    if (line.trim() === '')           return <div key={i} className="h-1" />
    return <p key={i} className="text-sm text-rl-text leading-relaxed">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
  })

  return (
    <div className="glass-card p-5 border border-rl-border/60">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">Criativo {index + 1}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple transition-all"
        >
          {copied ? <CheckCheck className="w-3 h-3 text-rl-green" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <div className="space-y-0">{rendered}</div>
    </div>
  )
}

function ResultBlock({ content }) {
  const [allCopied, setAllCopied] = useState(false)
  function copyAll() {
    navigator.clipboard.writeText(content)
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 2000)
  }

  const chunks = content.split(/\n---\n/).map((c) => c.trim()).filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={copyAll} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
          {allCopied ? <CheckCheck className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />}
          {allCopied ? 'Tudo copiado!' : 'Copiar tudo'}
        </button>
      </div>
      {chunks.map((chunk, i) => <CreativeCard key={i} content={chunk} index={i} />)}
    </div>
  )
}

// ─── Context Preview ───────────────────────────────────────────────────────────
function ContextPreview({ project, collapsed = false }) {
  const [open, setOpen] = useState(!collapsed)
  const hasPersonas    = (project.personas || []).length > 0
  const hasOferta      = !!(project.ofertaData?.nome || project.ofertaData?.resultadoSonho)
  const hasAttachments = (project.attachments || []).length > 0

  const items = [
    { label: 'Onboarding (empresa, produto, objetivo)', ok: !!project.companyName,    detail: project.businessType || 'dados básicos' },
    { label: 'Personas / ICP',                          ok: hasPersonas,              detail: hasPersonas ? `${project.personas.length} persona${project.personas.length > 1 ? 's' : ''}` : 'nenhuma criada' },
    { label: 'Oferta Matadora',                         ok: hasOferta,                detail: hasOferta ? (project.ofertaData?.nome || 'configurada') : 'não configurada' },
    { label: 'Documentos em Anexo',                     ok: hasAttachments,           detail: hasAttachments ? `${project.attachments.length} arquivo${project.attachments.length > 1 ? 's' : ''}` : 'nenhum' },
  ]

  return (
    <div className="glass-card border border-rl-border/60 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-xs font-semibold text-rl-muted uppercase tracking-wider">📋 Contexto usado na geração</span>
        <span className="text-rl-muted text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-rl-border/40 pt-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-start gap-2.5">
              <span className={`mt-0.5 text-xs font-bold ${item.ok ? 'text-rl-green' : 'text-rl-muted/40'}`}>{item.ok ? '✓' : '○'}</span>
              <span className={`text-xs ${item.ok ? 'text-rl-text' : 'text-rl-muted'}`}>
                {item.label} <span className="text-rl-muted">— {item.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Creative History Table ────────────────────────────────────────────────────
function CreativeHistory({ project, updateProject }) {
  const allCreatives = (project.creatives || []).slice().reverse() // newest first
  const [expandedId, setExpandedId] = useState(null)
  const [showAll,    setShowAll]    = useState(false)

  if (!allCreatives.length) return null

  const visible = showAll ? allCreatives : allCreatives.slice(0, 5)

  function handleRating(id, rating) {
    const updated = (project.creatives || []).map((c) =>
      c.id === id ? { ...c, rating } : c
    )
    updateProject(project.id, { creatives: updated })
  }

  function handleDelete(id) {
    const updated = (project.creatives || []).filter((c) => c.id !== id)
    updateProject(project.id, { creatives: updated })
  }

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-rl-muted" />
        <h3 className="text-sm font-semibold text-rl-text">Histórico de Criativos</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-surface text-rl-muted border border-rl-border">
          {allCreatives.length}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[120px_88px_1fr_36px_auto_56px] gap-3 px-4 py-2.5 bg-rl-surface/60 border-b border-rl-border text-[10px] font-bold text-rl-muted uppercase tracking-wider">
          <span>Data</span>
          <span>Tipo</span>
          <span>Tipos de Anúncio</span>
          <span className="text-center">Qtd</span>
          <span>Resultado</span>
          <span />
        </div>

        {/* Rows */}
        {visible.map((c) => (
          <div key={c.id}>
            {/* Row */}
            <div className="px-4 py-3 border-b border-rl-border/40 flex flex-col sm:grid sm:grid-cols-[120px_88px_1fr_36px_auto_56px] gap-2 sm:gap-3 sm:items-center">
              {/* Date */}
              <span className="text-[10px] text-rl-muted">{fmtDate(c.createdAt)}</span>

              {/* Type badge */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit ${
                c.type === 'video'
                  ? 'text-rl-purple bg-rl-purple/10 border-rl-purple/30'
                  : 'text-rl-blue bg-rl-blue/10 border-rl-blue/30'
              }`}>
                {c.type === 'video' ? '🎬 Vídeo' : '🖼️ Estático'}
              </span>

              {/* Ad type chips */}
              <div className="flex flex-wrap gap-1 min-w-0">
                {(c.adTypeLabels || []).slice(0, 4).map((label) => (
                  <span key={label} className="text-[9px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted">
                    {label}
                  </span>
                ))}
                {(c.adTypeLabels || []).length > 4 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted">
                    +{c.adTypeLabels.length - 4}
                  </span>
                )}
              </div>

              {/* Quantity */}
              <span className="text-xs font-bold text-rl-text text-center">{c.quantity}</span>

              {/* Rating */}
              <RatingSelector value={c.rating} onChange={(r) => handleRating(c.id, r)} />

              {/* Actions */}
              <div className="flex items-center gap-1 justify-end">
                <button
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
                  title="Ver conteúdo"
                >
                  {expandedId === c.id
                    ? <ChevronUp className="w-3.5 h-3.5" />
                    : <ChevronDown className="w-3.5 h-3.5" />
                  }
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {expandedId === c.id && (
              <div className="px-4 py-5 bg-rl-surface/20 border-b border-rl-border/40">
                {c.customNote && (
                  <div className="mb-4 rounded-xl bg-rl-purple/5 border border-rl-purple/20 px-4 py-3">
                    <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-1">Direção criativa aplicada</p>
                    <p className="text-xs text-rl-text italic">"{c.customNote}"</p>
                  </div>
                )}
                <ResultBlock content={c.content} />
              </div>
            )}
          </div>
        ))}

        {/* Show more / less */}
        {allCreatives.length > 5 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="w-full px-4 py-3 text-xs text-rl-muted hover:text-rl-text transition-colors text-center"
          >
            {showAll ? '▲ Mostrar menos' : `▼ Ver mais ${allCreatives.length - 5} entradas`}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CriativosModule({ project }) {
  const { anthropicKey, updateProject } = useApp()

  const [view,       setView]       = useState('select')   // 'select' | 'estaticos' | 'video'
  const [adTypes,    setAdTypes]    = useState(new Set())
  const [quantity,   setQuantity]   = useState(3)
  const [customNote, setCustomNote] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [result,     setResult]     = useState(null)

  const isVideo      = view === 'video'
  const selectedList = AD_TYPES.filter((t) => adTypes.has(t.id))

  const toggleType = useCallback((id) => {
    setAdTypes((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectAll = () => setAdTypes(new Set(AD_TYPES.map((t) => t.id)))
  const clearAll  = () => setAdTypes(new Set())

  const buildInstruction = useCallback(() => {
    const typesStr = selectedList.map((t) => `${t.emoji} ${t.label}: ${t.desc}`).join('\n')
    const qtyLabel = `${quantity} ${isVideo ? 'roteiro' : 'anúncio'}${quantity !== 1 ? 's' : ''}`

    const customSection = customNote.trim()
      ? `\n## PERSONALIZAÇÃO / DIREÇÃO CRIATIVA\n${customNote.trim()}\n(Esta direção deve orientar e influenciar TODA a geração dos criativos acima.)\n`
      : ''

    if (isVideo) {
      return `${customSection}
---

## SOLICITAÇÃO

Crie exatamente **${qtyLabel}** de vídeo (30-60 segundos cada) para Meta Ads / YouTube Ads.

**Tipos de gancho a usar (distribua entre os roteiros):**
${typesStr}

Distribua os tipos de gancho entre os roteiros de forma equilibrada. Se houver mais roteiros do que tipos, repita os tipos com variações diferentes.

Use todas as informações do cliente acima para personalizar os roteiros ao máximo. Ao final, crie a tabela do Laboratório de Anúncios interligando ganchos × mensagens.`
    } else {
      return `${customSection}
---

## SOLICITAÇÃO

Crie exatamente **${qtyLabel}** estático${quantity !== 1 ? 's' : ''} para Meta Ads / Google Ads.

**Tipos de anúncio a usar (distribua entre os criativos):**
${typesStr}

Distribua os tipos entre os anúncios de forma equilibrada, cobrindo diferentes etapas do funil quando possível. Se houver mais anúncios do que tipos, crie variações do mesmo tipo.

Use todas as informações do cliente acima para personalizar ao máximo. Comece com a análise rápida do público antes de criar os anúncios.`
    }
  }, [customNote, isVideo, quantity, selectedList])

  // ── Generate ────────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!adTypes.size) return
    if (!anthropicKey) { setError('Configure sua chave de API Anthropic nas Configurações.'); return }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { system, messages } = buildCachedPayload({
        systemPrompt: isVideo ? VIDEO_SYSTEM : STATIC_SYSTEM,
        project,
        instruction: buildInstruction(),
      })
      const fullText = await streamClaude({
        apiKey:     anthropicKey,
        model:      'claude-sonnet-4-5',
        max_tokens: Math.max(4000, quantity * (isVideo ? 2500 : 900)),
        system,
        messages,
        onChunk:    (text) => setResult(text),
      })

      // ── Save to project history ────────────────────────────────────────────
      const newCreative = {
        id:           Date.now(),
        type:         isVideo ? 'video' : 'estatico',
        adTypes:      [...adTypes],
        adTypeLabels: selectedList.map((t) => t.label),
        quantity,
        customNote:   customNote.trim(),
        content:      fullText,
        rating:       null,
        createdAt:    new Date().toISOString(),
      }
      updateProject(project.id, {
        creatives: [...(project.creatives || []), newCreative],
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [adTypes, anthropicKey, buildInstruction, customNote, isVideo, project, quantity, selectedList, updateProject])

  // ── View: Select format ────────────────────────────────────────────────────
  if (view === 'select') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-rl-text mb-1">Gerador de Criativos com IA</h2>
          <p className="text-sm text-rl-muted">Selecione o formato para gerar criativos usando os dados do cliente.</p>
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
              onClick={() => { setView(key); setResult(null); setAdTypes(new Set()); setError(null) }}
              className={`glass-card p-6 text-left hover:border-${color}/50 hover:shadow-glow transition-all duration-200 group`}
            >
              <div className={`w-12 h-12 rounded-2xl bg-${color}/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-6 h-6 text-${color}`} />
              </div>
              <h3 className="text-base font-bold text-rl-text mb-1">{title}</h3>
              <p className="text-xs text-rl-muted leading-relaxed mb-4">{desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full bg-${color}/10 text-${color} border border-${color}/20 font-medium`}>{t}</span>
                ))}
              </div>
            </button>
          ))}
        </div>

        <ContextPreview project={project} />

        {/* History visible in home view */}
        <CreativeHistory project={project} updateProject={updateProject} />
      </div>
    )
  }

  // ── View: Generator ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => { setView('select'); setResult(null); setAdTypes(new Set()); setError(null) }}
          className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all mt-0.5"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            {isVideo ? <Video className="w-5 h-5 text-rl-purple" /> : <Image className="w-5 h-5 text-rl-blue" />}
            <h2 className="text-xl font-bold text-rl-text">{isVideo ? 'Criativos de Vídeo' : 'Criativos Estáticos'}</h2>
          </div>
          <p className="text-sm text-rl-muted mt-0.5 ml-7">
            Selecione um ou mais tipos e personalize a geração
          </p>
        </div>
      </div>

      {/* Quantity */}
      <div>
        <label className="label-field mb-3">Quantidade de criativos</label>
        <div className="flex gap-2 flex-wrap">
          {QUANTITIES.map((q) => (
            <button
              key={q}
              onClick={() => setQuantity(q)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all border ${
                quantity === q
                  ? 'bg-gradient-rl text-white border-transparent shadow-glow'
                  : 'bg-rl-surface text-rl-muted border-rl-border hover:text-rl-text hover:border-rl-purple/30'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Ad Type MULTI-select */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="label-field">
            Tipos de anúncio
            {adTypes.size > 0 && (
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-purple/20 text-rl-purple border border-rl-purple/30">
                {adTypes.size} selecionado{adTypes.size !== 1 ? 's' : ''}
              </span>
            )}
          </label>
          <div className="flex gap-2 text-xs text-rl-muted">
            <button onClick={selectAll} className="hover:text-rl-purple transition-colors">Selecionar todos</button>
            <span>·</span>
            <button onClick={clearAll}  className="hover:text-rl-purple transition-colors">Limpar</button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AD_TYPES.map((type) => {
            const selected = adTypes.has(type.id)
            return (
              <button
                key={type.id}
                onClick={() => toggleType(type.id)}
                className={`rounded-xl p-3 text-left transition-all border relative ${
                  selected
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30 hover:text-rl-text'
                }`}
              >
                {selected && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-rl-purple flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{type.emoji}</span>
                  <span className={`text-xs font-bold pr-4 ${selected ? 'text-rl-purple' : 'text-rl-text'}`}>{type.label}</span>
                </div>
                <p className="text-[10px] text-rl-muted leading-snug line-clamp-2">{type.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom note */}
      <div>
        <label className="label-field mb-2">
          Personalização / Direção criativa
          <span className="ml-2 text-[10px] text-rl-muted font-normal normal-case">(opcional — influencia toda a geração)</span>
        </label>
        <textarea
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder={isVideo
            ? 'Ex: "Foco no público feminino 30-45 anos. Tom mais emocional e acolhedor. Mencionar que o produto é importado. Evitar comparações com concorrentes..."'
            : 'Ex: "Campanha de lançamento — destacar desconto de 30% apenas essa semana. Público masculino jovem. Tom mais descontraído e direto..."'}
          rows={3}
          className="input-field w-full text-sm resize-none"
        />
        {customNote.trim() && (
          <p className="text-xs text-rl-green mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Direção criativa ativa — será aplicada na geração
          </p>
        )}
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
            disabled={adTypes.size === 0 || loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
              : <><Sparkles className="w-4 h-4" /> Gerar {quantity} {isVideo ? 'Roteiro' : 'Anúncio'}{quantity !== 1 ? 's' : ''}</>
            }
          </button>
          {adTypes.size === 0 && (
            <p className="text-xs text-rl-muted">Selecione pelo menos um tipo de anúncio</p>
          )}
          {adTypes.size > 0 && !loading && (
            <p className="text-xs text-rl-muted">
              {adTypes.size} tipo{adTypes.size > 1 ? 's' : ''} · {quantity} criativo{quantity !== 1 ? 's' : ''}
              {customNote.trim() ? ' · com direção personalizada' : ''}
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-rl-green" />
              <span className="text-sm font-semibold text-rl-text">
                {quantity} {isVideo ? 'roteiro' : 'criativo'}{quantity !== 1 ? 's' : ''} · {selectedList.map((t) => t.label).join(', ')}
              </span>
            </div>
            <button
              onClick={() => { setResult(null); generate() }}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Regerar
            </button>
          </div>

          <ResultBlock content={result} />

          <button
            onClick={() => { setResult(null) }}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Alterar configurações
          </button>
        </div>
      )}
    </div>
  )
}
