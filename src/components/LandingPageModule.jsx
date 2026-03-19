import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import { buildCachedPayload } from '../lib/buildContext'
import RatingSelector from './RatingSelector'
import ContextPreview from './Criativos/ContextPreview'
import {
  Globe, Sparkles, Loader2, AlertTriangle, Copy, CheckCheck,
  ChevronDown, ChevronUp, RotateCcw, Trash2, Plus, CheckCircle2,
} from 'lucide-react'

// ─── System Prompt (baseado na skill criador-de-landing-page) ─────────────────
const LANDING_SYSTEM = `Você é um especialista em planejamento e criação de copy de alta taxa de conversão para landing pages, usando a metodologia Revenue Lab.

Suas copies são agressivas, altamente persuasivas e focadas nas dores e sonhos do público-alvo, com o objetivo de maximizar a taxa de conversão.

Crie uma copy COMPLETA para landing page com 6 dobras seguindo EXATAMENTE esta estrutura:

## 🥇 PRIMEIRA DOBRA — Oferta & Promessa Principal

**TÍTULO PRINCIPAL:**
(Oferta Matadora no estilo Alex Hormozi — específica, irrecusável, com resultado claro e prazo)

**SUBTÍTULO:**
(Reforça com o mecanismo único — o que diferencia a empresa de TODOS os concorrentes no mercado)

**CTA PRIMÁRIO:**
(Ação clara, direta e urgente — ex: "Quero Meu Diagnóstico Gratuito →")

---

## 🩹 SEGUNDA DOBRA — Identificação de Dores & Soluções

**HEADLINE DA DOBRA:**
(Frase que demonstra que você entende profundamente as dores do lead)

[Identifique 5 problemas específicos e reais que o público vive no dia a dia]
[Para cada problema, apresente imediatamente a solução específica da empresa]
[Use bullets e tom empático — mostre que entende antes de oferecer a solução]

---

## 🏆 TERCEIRA DOBRA — Autoridade & Prova Social

**HEADLINE:**
(Posicionamento como referência máxima no mercado)

[Descreva quem são, expertise e diferenciais competitivos de forma específica]
[Inclua 3-5 casos de sucesso com resultados reais ou estimativas concretas]
[Números, datas, nomes de clientes (fictícios se necessário) — quanto mais específico, mais confiável]

---

## ⚙️ QUARTA DOBRA — Mecanismo Único

**HEADLINE:**
(O que torna a empresa absolutamente incomparável — impossível de comparar com concorrentes)

[Explique o processo/metodologia exclusivo da empresa em 3-5 passos numerados]
[Dê um nome memorável ao mecanismo único — ex: "Método ACE", "Sistema 3R", etc.]
[Mostre como cada passo entrega a transformação: do Ponto A (dor) → Ponto B (sonho)]

---

## 🛡️ QUINTA DOBRA — Quebra de Objeções, Garantia & Ancoragem de Valor

**HEADLINE:**
(Título de segurança e confiança)

[Quebre 4-5 objeções principais com respostas diretas e específicas]
[Apresente a garantia de forma clara e irrecusável]
[Ancoragem de valor: liste TUDO que o cliente recebe × o investimento real — mostre que é um negócio óbvio]

---

## ❓ SEXTA DOBRA — FAQ Estratégico

**HEADLINE:** Perguntas Frequentes

[Crie 4 perguntas que inconscientemente fazem o lead avançar para o formulário/conversão]
[Cada pergunta deve responder uma objeção ou reforçar um benefício-chave]
Formato: **Pergunta?** → Resposta persuasiva e objetiva (2-4 linhas)

---

## 🎯 CTA FINAL

[Reforço final da promessa principal com emoção]
[Gatilho de urgência ou escassez específico ao negócio]
[Ação final direta, clara e convincente]

---

Diretrizes obrigatórias:
- Português brasileiro persuasivo, direto e profissional
- Seja EXTREMAMENTE específico ao negócio — nunca use frases genéricas
- Use todos os dados de personas, oferta matadora e onboarding para personalizar cada dobra
- Cada dobra deve fluir naturalmente para a próxima
- Fale diretamente com o lead (use "você")
- Inclua prova social, urgência ou escassez sempre que possível`

// ─── Copy Card ────────────────────────────────────────────────────────────────
function CopyCard({ lp, index, onDelete, onRegenerate, onRatingChange }) {
  const [expanded, setExpanded] = useState(index === 0)
  const [copied, setCopied]     = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(lp.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dateStr = lp.createdAt
    ? new Date(lp.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : ''

  // Render markdown-like content line by line
  const lines    = lp.content.split('\n')
  const rendered = lines.map((line, i) => {
    if (/^##\s/.test(line))  return <h3 key={i} className="text-sm font-bold text-rl-text mt-6 mb-2 first:mt-0">{line.replace(/^##\s/, '')}</h3>
    if (/^###\s/.test(line)) return <h4 key={i} className="text-xs font-bold text-rl-green mt-3 mb-1">{line.replace(/^###\s/, '')}</h4>
    if (/^\*\*.*\*\*/.test(line)) {
      const label = line.match(/^\*\*(.*?)\*\*/)?.[1] || ''
      const rest  = line.replace(/^\*\*(.*?)\*\*:?\s*/, '')
      return (
        <div key={i} className="mt-3">
          <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">{label}</span>
          {rest && <p className="text-sm text-rl-text mt-0.5 leading-relaxed">{rest}</p>}
        </div>
      )
    }
    if (/^---+$/.test(line.trim())) return <hr key={i} className="border-rl-border/40 my-4" />
    if (/^\[/.test(line))           return <p key={i} className="text-sm text-rl-muted leading-relaxed italic mt-1">{line}</p>
    if (/^[-•]\s/.test(line))       return <li key={i} className="text-sm text-rl-text ml-4 mt-0.5 leading-relaxed list-disc">{line.replace(/^[-•]\s/, '')}</li>
    if (line.trim() === '')         return <div key={i} className="h-1" />
    return <p key={i} className="text-sm text-rl-text leading-relaxed mt-1">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
  })

  return (
    <div className="glass-card border border-rl-border/60 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
        {/* Left: icon + name + date */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-rl-green/10 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4 text-rl-green" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-rl-text truncate">{lp.name}</p>
            {dateStr && <p className="text-[10px] text-rl-muted mt-0.5">{dateStr}</p>}
          </div>
        </div>

        {/* Right: rating + actions */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* Rating selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">Resultado:</span>
            <RatingSelector value={lp.rating} onChange={onRatingChange} />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple transition-all"
              title="Copiar copy completa"
            >
              {copied ? <CheckCheck className="w-3 h-3 text-rl-green" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <button
              onClick={onRegenerate}
              className="p-1.5 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-blue transition-all"
              title="Regerar esta copy"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg bg-rl-surface text-rl-muted hover:text-red-400 transition-all"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-text transition-all"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="border-t border-rl-border/40 px-5 py-4">
          {lp.customNote && (
            <div className="mb-5 rounded-xl bg-rl-purple/5 border border-rl-purple/20 px-4 py-3">
              <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-1">Direção criativa aplicada</p>
              <p className="text-xs text-rl-text italic">"{lp.customNote}"</p>
            </div>
          )}
          <div className="space-y-0">{rendered}</div>
        </div>
      )}
    </div>
  )
}

// ─── New / Regenerate Copy Form ───────────────────────────────────────────────
function CopyForm({ project, copyCount, onSave, onCancel, isRegen, existingName, defaultCustomNote }) {
  const [name,            setName]            = useState(isRegen ? existingName : `Copy Landing Page ${copyCount + 1}`)
  const [customNote,      setCustomNote]      = useState(defaultCustomNote || '')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState(null)
  const [streamPreview,   setStreamPreview]   = useState('')

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setStreamPreview('')
    try {
      const customSection = customNote.trim()
        ? `\n## PERSONALIZAÇÃO / DIREÇÃO CRIATIVA\n${customNote.trim()}\n(Esta direção deve orientar e influenciar toda a copy.)\n`
        : ''

      const instruction = `${customSection}
---

## SOLICITAÇÃO

Com base em todas as informações do cliente acima, crie uma copy COMPLETA de landing page com as 6 dobras. Use os dados de persona, oferta matadora e onboarding para personalizar ao máximo cada dobra. Seja extremamente específico — nunca use frases genéricas ou templates vazios.`

      const { system, messages } = buildCachedPayload({
        systemPrompt: LANDING_SYSTEM,
        project,
        instruction,
      })

      const fullText = await streamClaude({
        model:      'claude-sonnet-4-5',
        max_tokens: 16000,
        system,
        messages,
        onChunk:    (text) => setStreamPreview(text),
      })

      onSave({
        id:         Date.now(),
        name:       name.trim() || (isRegen ? existingName : `Copy Landing Page ${copyCount + 1}`),
        content:    fullText,
        customNote: customNote.trim(),
        rating:     null,
        createdAt:  new Date().toISOString(),
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [copyCount, customNote, existingName, isRegen, name, onSave, project])


  return (
    <div className="glass-card border border-rl-green/30 p-5 space-y-4">
      {/* Form header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-rl-green/10 flex items-center justify-center">
          <Globe className="w-4 h-4 text-rl-green" />
        </div>
        <h3 className="text-sm font-bold text-rl-text">
          {isRegen ? `Regerar: ${existingName}` : 'Nova Copy de Landing Page'}
        </h3>
      </div>

      {/* Name field — only shown for new copies */}
      {!isRegen && (
        <div>
          <label className="label-field mb-2">
            Nome da copy
            <span className="ml-2 text-[10px] text-rl-muted font-normal normal-case">(para identificação)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field w-full text-sm"
            placeholder="Ex: Copy Principal, Variação A, Landing de Captação..."
          />
        </div>
      )}

      {/* Custom note */}
      <div>
        <label className="label-field mb-2">
          Personalização / Direção criativa
          <span className="ml-2 text-[10px] text-rl-muted font-normal normal-case">(opcional — influencia toda a copy)</span>
        </label>
        <textarea
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder='Ex: "Foco em leads que já tentaram outras soluções e falharam. Tom mais empático. Destacar suporte pós-venda. Enfatizar a velocidade de resultados nas primeiras 2 semanas..."'
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
      <ContextPreview project={project} />

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={generate}
          disabled={loading}
          className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando copy completa...</>
            : <><Sparkles className="w-4 h-4" /> {isRegen ? 'Regerar Copy' : 'Gerar Copy com IA'}</>
          }
        </button>
        <button onClick={onCancel} disabled={loading} className="btn-secondary text-sm">
          Cancelar
        </button>
      </div>

      {/* Streaming preview */}
      {loading && streamPreview && (
        <div className="rounded-xl bg-rl-surface border border-rl-border/60 p-4 max-h-56 overflow-y-auto">
          <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin text-rl-green" /> Gerando — aparecerá aqui ao finalizar
          </p>
          <pre className="text-xs text-rl-text/70 whitespace-pre-wrap font-sans leading-relaxed">{streamPreview}</pre>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LandingPageModule({ project }) {
  const { updateProject } = useApp()

  const [showForm,    setShowForm]    = useState(false)
  const [regenTarget, setRegenTarget] = useState(null) // { id, name, customNote } | null

  const landingPages = project.landingPages || []

  function handleSave(newLp) {
    let updated
    if (regenTarget) {
      // Replace the regenerated entry, keeping its original position
      updated = landingPages.map((lp) =>
        lp.id === regenTarget.id ? { ...newLp, id: lp.id } : lp
      )
    } else {
      updated = [...landingPages, newLp]
    }
    updateProject(project.id, { landingPages: updated })
    setShowForm(false)
    setRegenTarget(null)
  }

  function handleDelete(id) {
    updateProject(project.id, { landingPages: landingPages.filter((lp) => lp.id !== id) })
  }

  function handleRegenerate(lp) {
    setRegenTarget({ id: lp.id, name: lp.name, customNote: lp.customNote || '' })
    setShowForm(true)
  }

  function handleCancel() {
    setShowForm(false)
    setRegenTarget(null)
  }

  function handleRatingChange(id, rating) {
    const updated = landingPages.map((lp) =>
      lp.id === id ? { ...lp, rating } : lp
    )
    updateProject(project.id, { landingPages: updated })
  }

  function handleNewCopy() {
    setRegenTarget(null)
    setShowForm(true)
  }

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-rl-text">Copy de Landing Page com IA</h2>
          <p className="text-sm text-rl-muted mt-1">
            Gere copies persuasivas com 6 dobras usando os dados do cliente. Salve e compare múltiplas versões.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={handleNewCopy}
            className="btn-primary flex items-center gap-2 shrink-0 text-sm"
          >
            <Plus className="w-4 h-4" /> Nova Copy
          </button>
        )}
      </div>

      {/* ── Empty state (no copies yet) ─────────────────────────────────────── */}
      {!showForm && landingPages.length === 0 && (
        <div className="glass-card border border-rl-border/60 p-6">
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-4">🏗️ Estrutura da copy gerada</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            {[
              { emoji: '🥇', title: '1ª Dobra', desc: 'Título Oferta Matadora + CTA Principal' },
              { emoji: '🩹', title: '2ª Dobra', desc: 'Dores identificadas + Soluções específicas' },
              { emoji: '🏆', title: '3ª Dobra', desc: 'Autoridade, casos de sucesso e provas' },
              { emoji: '⚙️', title: '4ª Dobra', desc: 'Mecanismo único e metodologia exclusiva' },
              { emoji: '🛡️', title: '5ª Dobra', desc: 'Quebra de objeções, garantia e ancoragem de valor' },
              { emoji: '❓', title: '6ª Dobra', desc: 'FAQ estratégico que converte' },
            ].map(({ emoji, title, desc }) => (
              <div key={title} className="rounded-xl bg-rl-surface/50 border border-rl-border/40 p-3">
                <p className="text-sm mb-1">{emoji} <span className="font-bold text-rl-text text-xs">{title}</span></p>
                <p className="text-[10px] text-rl-muted leading-snug">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <button onClick={handleNewCopy} className="btn-primary flex items-center gap-2 mx-auto">
              <Sparkles className="w-4 h-4" /> Gerar primeira copy
            </button>
          </div>
        </div>
      )}

      {/* ── Form (new or regen) ─────────────────────────────────────────────── */}
      {showForm && (
        <CopyForm
          project={project}
          copyCount={landingPages.length}
          onSave={handleSave}
          onCancel={handleCancel}
          isRegen={!!regenTarget}
          existingName={regenTarget?.name || ''}
          defaultCustomNote={regenTarget?.customNote || ''}
        />
      )}

      {/* ── Saved copies list ───────────────────────────────────────────────── */}
      {landingPages.length > 0 && (
        <div className="space-y-3">
          {!showForm && (
            <p className="text-xs text-rl-muted">
              {landingPages.length} copy{landingPages.length !== 1 ? 's' : ''} salva{landingPages.length !== 1 ? 's' : ''}
              {' '}· clique para expandir
            </p>
          )}
          {landingPages.map((lp, i) => (
            <CopyCard
              key={lp.id}
              lp={lp}
              index={i}
              onDelete={() => handleDelete(lp.id)}
              onRegenerate={() => handleRegenerate(lp)}
              onRatingChange={(rating) => handleRatingChange(lp.id, rating)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
