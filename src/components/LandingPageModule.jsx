import { useState, useCallback, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import { buildLandingContext, buildLandingCachedPayload } from '../lib/buildContext'
import { elementToPngBlob, downloadBlob, slugify } from '../lib/htmlToJpg'
import { elementToHtmlBlob } from '../lib/wireframeHtml'
import RatingSelector from './RatingSelector'
import {
  Globe, Sparkles, Loader2, AlertTriangle, Copy, CheckCheck,
  ChevronDown, ChevronUp, RotateCcw, Trash2, Plus, CheckCircle2,
  Check, X, Zap, LayoutTemplate, FileText, Lock, Pencil, Download,
  FileCode2,
} from 'lucide-react'
import { WIREFRAME_TYPES, getWireframe } from './Wireframes'
import { setByPath } from './Wireframes/wireframePrimitives'

// ─── System Prompt (baseado na skill criador-de-landing-page) ─────────────────
const LANDING_SYSTEM = `Você é um especialista em planejamento e criação de copy de alta taxa de conversão para landing pages, usando a metodologia Revenue Lab.

Suas copies são agressivas, altamente persuasivas e focadas nas dores e sonhos do público-alvo, com o objetivo de maximizar a taxa de conversão.

Crie uma copy COMPLETA para landing page com 6 dobras seguindo EXATAMENTE esta estrutura:

## 🥇 PRIMEIRA DOBRA: Oferta & Promessa Principal

**TÍTULO PRINCIPAL:**
(Oferta Matadora no estilo Alex Hormozi: específica, irrecusável, com resultado claro e prazo)

**SUBTÍTULO:**
(Reforça com o mecanismo único: o que diferencia a empresa de TODOS os concorrentes no mercado)

**CTA PRIMÁRIO:**
(Ação clara, direta e urgente. Ex: "Quero Meu Diagnóstico Gratuito →")

---

## 🩹 SEGUNDA DOBRA: Identificação de Dores & Soluções

**HEADLINE DA DOBRA:**
(Frase que demonstra que você entende profundamente as dores do lead)

[Identifique 5 problemas específicos e reais que o público vive no dia a dia]
[Para cada problema, apresente imediatamente a solução específica da empresa]
[Use bullets e tom empático. Mostre que entende antes de oferecer a solução]

---

## 🏆 TERCEIRA DOBRA: Autoridade & Prova Social

**HEADLINE:**
(Posicionamento como referência máxima no mercado)

[Descreva quem são, expertise e diferenciais competitivos de forma específica]
[Inclua 3-5 casos de sucesso com resultados reais ou estimativas concretas]
[Números, datas, nomes de clientes (fictícios se necessário), quanto mais específico, mais confiável]

---

## ⚙️ QUARTA DOBRA: Mecanismo Único

**HEADLINE:**
(O que torna a empresa absolutamente incomparável, impossível de comparar com concorrentes)

[Explique o processo/metodologia exclusivo da empresa em 3-5 passos numerados]
[Dê um nome memorável ao mecanismo único, ex: "Método ACE", "Sistema 3R", etc.]
[Mostre como cada passo entrega a transformação: do Ponto A (dor) → Ponto B (sonho)]

---

## 🛡️ QUINTA DOBRA: Quebra de Objeções, Garantia & Ancoragem de Valor

**HEADLINE:**
(Título de segurança e confiança)

[Quebre 4-5 objeções principais com respostas diretas e específicas]
[Apresente a garantia de forma clara e irrecusável]
[Ancoragem de valor: liste TUDO que o cliente recebe × o investimento real, mostre que é um negócio óbvio]

---

## ❓ SEXTA DOBRA: FAQ Estratégico

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
- Use APENAS os dados fornecidos no contexto (quando informados: a oferta matadora, o produto/serviço, a persona) e a direção criativa. NÃO invente dados de empresa, produtos, personas ou números que não estejam no contexto
- Quando uma oferta matadora for fornecida, ela é a BASE da copy: a 1ª dobra e a ancoragem de valor devem refletir diretamente essa oferta. Quando não houver oferta, conduza a copy pela direção criativa e pelos demais dados disponíveis
- Cada dobra deve fluir naturalmente para a próxima
- Fale diretamente com o lead (use "você")
- Inclua prova social, urgência ou escassez sempre que possível
- Não use travessões (—) em nenhuma parte do output`

// ─── Parser das GOMs (Ofertas Matadoras) ──────────────────────────────────────
// O módulo "Oferta Matadora" gera 3 GOMs num único texto (ofertaData.generatedOffer),
// cada uma iniciada por um cabeçalho "GOM #N: ...". Esta função separa esse texto
// em blocos individuais para o usuário escolher qual será a base da landing page.
function parseGOMs(generatedOffer) {
  const text = String(generatedOffer || '')
  if (!text.trim()) return []

  const re = /\**\s*GOM\s*#?\s*(\d+)\s*:?\s*([^\n]*)/gi
  const heads = []
  let m
  while ((m = re.exec(text)) !== null) {
    const label = (m[2] || '').replace(/[*━─\s]+$/, '').replace(/^[*\s]+/, '').trim()
    heads.push({ index: m.index, num: m[1], label })
  }
  if (!heads.length) return []

  return heads.map((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length
    // Recorta o bloco e remove marcadores markdown/separadores (** ━ ─) das pontas
    const content = text.slice(h.index, end).replace(/[\s━─]+$/g, '').replace(/^\**\s*/, '').trim()
    return { num: h.num, label: h.label, content }
  })
}

// Monta o contexto escopado de uma copy salva (regen/refino), reconstruindo o
// produto/persona escolhidos e a GOM usada a partir do próprio registro da LP.
function scopedContextForLp(project, lp) {
  const prod = lp.productId ? (project.produtos || []).find((p) => p.id === lp.productId) : null
  const pers = lp.personaId ? (project.personas || []).find((p) => p.id === lp.personaId) : null
  return buildLandingContext({
    produtos:   prod ? [prod] : [],
    personas:   pers ? [pers] : [],
    ofertaText: lp.ofertaText || '',
  })
}

// ─── Markdown render + dobra helpers ──────────────────────────────────────────

// Render markdown-like content line by line (compartilhado entre o card e
// cada DobraBlock). `keyPrefix` evita colisão de keys quando renderizado
// em múltiplos blocos na mesma árvore.
function renderMarkdownLines(content, keyPrefix = '') {
  return String(content || '').split('\n').map((line, i) => {
    const k = `${keyPrefix}${i}`
    if (/^##\s/.test(line))  return <h3 key={k} className="text-sm font-bold text-rl-text mt-6 mb-2 first:mt-0">{line.replace(/^##\s/, '')}</h3>
    if (/^###\s/.test(line)) return <h4 key={k} className="text-xs font-bold text-rl-green mt-3 mb-1">{line.replace(/^###\s/, '')}</h4>
    if (/^\*\*.*\*\*/.test(line)) {
      const label = line.match(/^\*\*(.*?)\*\*/)?.[1] || ''
      const rest  = line.replace(/^\*\*(.*?)\*\*:?\s*/, '')
      return (
        <div key={k} className="mt-3">
          <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">{label}</span>
          {rest && <p className="text-sm text-rl-text mt-0.5 leading-relaxed">{rest}</p>}
        </div>
      )
    }
    if (/^---+$/.test(line.trim())) return <hr key={k} className="border-rl-border/40 my-4" />
    if (/^\[/.test(line))           return <p key={k} className="text-sm text-rl-muted leading-relaxed italic mt-1">{line}</p>
    if (/^[-•]\s/.test(line))       return <li key={k} className="text-sm text-rl-text ml-4 mt-0.5 leading-relaxed list-disc">{line.replace(/^[-•]\s/, '')}</li>
    if (line.trim() === '')         return <div key={k} className="h-1" />
    return <p key={k} className="text-sm text-rl-text leading-relaxed mt-1">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
  })
}

// Divide a copy completa em "dobras" — cada chunk começa com um cabeçalho `## `.
// Inclui as 6 dobras + o "## 🎯 CTA FINAL" gerado pelo prompt.
function splitDobras(content) {
  const parts = String(content || '').split(/(?=^##\s)/m)
  return parts.map((p) => p.trim()).filter(Boolean)
}

// Extrai o título legível de uma dobra (a primeira linha `## ...`).
function dobraTitle(chunk) {
  const first = String(chunk || '').split('\n')[0].trim()
  return first.replace(/^##\s*/, '')
}

// Substitui a dobra no índice indicado e remonta a copy completa.
function replaceDobra(content, index, newDobra) {
  const dobras = splitDobras(content)
  if (index < 0 || index >= dobras.length) return content
  dobras[index] = String(newDobra || '').trim()
  return dobras.join('\n\n')
}

// ─── Dobra Block — render + refinamento individual ────────────────────────────
function DobraBlock({ dobra, index, onRefine, onApprove }) {
  const [refineOpen,     setRefineOpen]     = useState(false)
  const [refineNote,     setRefineNote]     = useState('')
  const [isRefining,     setIsRefining]     = useState(false)
  const [streamingBody,  setStreamingBody]  = useState('')
  const [refinedContent, setRefinedContent] = useState(null)

  const title = dobraTitle(dobra)

  function toggleRefine() {
    setRefineOpen((v) => !v)
    setRefineNote('')
    setRefinedContent(null)
    setStreamingBody('')
  }

  async function submitRefine() {
    if (!refineNote.trim() || !onRefine || isRefining) return
    setIsRefining(true)
    setStreamingBody('')
    setRefinedContent(null)
    try {
      const refined = await onRefine(index, dobra, refineNote, (text) => setStreamingBody(text))
      setRefinedContent(refined)
    } catch (e) {
      console.error('Refinar dobra falhou:', e)
    } finally {
      setIsRefining(false)
      setStreamingBody('')
    }
  }

  function approveRefine() {
    if (onApprove && refinedContent) onApprove(index, refinedContent)
    setRefinedContent(null)
    setRefineOpen(false)
    setRefineNote('')
  }

  function rejectRefine() {
    setRefinedContent(null)
  }

  return (
    <div className="rounded-xl border border-rl-border/50 overflow-hidden">
      {/* Header da dobra */}
      <div className="px-4 py-2.5 bg-rl-surface/40 border-b border-rl-border/40 flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-rl-text leading-snug truncate">{title || `Dobra ${index + 1}`}</p>
        {onRefine && (
          <button
            onClick={toggleRefine}
            className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border transition-all shrink-0 ${
              refineOpen
                ? 'bg-rl-purple/20 border-rl-purple/40 text-rl-purple'
                : 'bg-rl-purple/10 border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20'
            }`}
          >
            <Sparkles className="w-3 h-3" /> Refinar
          </button>
        )}
      </div>

      {/* Conteúdo da dobra */}
      <div className="px-4 py-3">
        <div className="space-y-0">{renderMarkdownLines(dobra, `d${index}-`)}</div>
      </div>

      {/* Painel de refinamento */}
      {refineOpen && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-rl-purple/20 bg-rl-purple/5">
          {/* Fase 1: input */}
          {!refinedContent && !isRefining && (
            <>
              <p className="text-[10px] font-semibold text-rl-purple uppercase tracking-wide pt-3">
                O que deseja melhorar nesta dobra?
              </p>
              <textarea
                value={refineNote}
                onChange={(e) => setRefineNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitRefine() }}
                placeholder="Ex: deixe a headline mais forte, adicione um número concreto, encurte o texto, foque mais na dor..."
                rows={3}
                className="w-full bg-rl-surface/60 border border-rl-purple/30 rounded-xl p-3 text-xs text-rl-text leading-relaxed resize-none focus:outline-none focus:border-rl-purple/60 transition-colors placeholder:text-rl-muted/60"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={submitRefine}
                  disabled={!refineNote.trim()}
                  className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-rl-purple/10 border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" /> Refinar dobra
                </button>
                <button
                  onClick={() => { setRefineOpen(false); setRefineNote('') }}
                  className="text-[10px] px-2.5 py-1 text-rl-muted hover:text-rl-text transition-all"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}

          {/* Fase 2: streaming */}
          {isRefining && (
            <>
              <p className="text-[10px] font-semibold text-rl-purple uppercase tracking-wide pt-3 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Refinando...
              </p>
              {streamingBody && (
                <div className="bg-rl-surface/60 border border-rl-purple/20 rounded-xl p-3">
                  <div className="space-y-0">{renderMarkdownLines(streamingBody, `s${index}-`)}</div>
                </div>
              )}
            </>
          )}

          {/* Fase 3: aprovação */}
          {refinedContent && !isRefining && (
            <>
              <p className="text-[10px] font-semibold text-rl-purple uppercase tracking-wide pt-3">
                Versão refinada
              </p>
              <div className="bg-rl-purple/5 border border-rl-purple/30 rounded-xl p-3">
                <div className="space-y-0">{renderMarkdownLines(refinedContent, `r${index}-`)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={approveRefine}
                  className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-all"
                >
                  <Check className="w-3 h-3" /> Aprovar
                </button>
                <button
                  onClick={rejectRefine}
                  className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-rl-surface text-rl-muted hover:text-red-400 transition-all"
                >
                  <X className="w-3 h-3" /> Recusar e tentar novamente
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Copy Card ────────────────────────────────────────────────────────────────
function CopyCard({ lp, index, onDelete, onRegenerate, onRatingChange, onRefineDobra, onContentChange, onWireframeEdit }) {
  const [expanded, setExpanded] = useState(index === 0)
  const [copied, setCopied]     = useState(false)
  const [view, setView]         = useState('wireframe') // 'wireframe' | 'texto'
  const [editing, setEditing]   = useState(false)
  const [downloading, setDownloading] = useState(false)
  const wireframeRef = useRef(null)

  const wf = lp.wireframeType ? getWireframe(lp.wireframeType) : null
  const isWireframe = !!(wf && lp.wireframeContent)

  // Baixa o wireframe renderizado como PNG (tamanho natural, alta resolução).
  async function handleDownloadWireframe() {
    if (!wireframeRef.current || downloading) return
    setDownloading(true)
    const wasEditing = editing
    try {
      // Sai do modo edição para não capturar contornos de campo editável.
      if (wasEditing) setEditing(false)
      await new Promise((r) => requestAnimationFrame(() => r()))
      const blob = await elementToPngBlob(wireframeRef.current, { scale: 2 })
      if (blob) {
        downloadBlob(blob, `wireframe-${slugify(lp.name) || 'landing-page'}.png`)
      }
    } catch (e) {
      console.error('Baixar wireframe falhou:', e)
    } finally {
      setDownloading(false)
    }
  }

  // Baixa o wireframe como HTML standalone (estilos computados inline).
  async function handleDownloadHtml() {
    if (!wireframeRef.current || downloading) return
    setDownloading(true)
    const wasEditing = editing
    try {
      // Sai do modo edição para não capturar contornos de campo editável.
      if (wasEditing) setEditing(false)
      await new Promise((r) => requestAnimationFrame(() => r()))
      const blob = elementToHtmlBlob(wireframeRef.current, { title: lp.name })
      downloadBlob(blob, `wireframe-${slugify(lp.name) || 'landing-page'}.html`)
    } catch (e) {
      console.error('Baixar wireframe HTML falhou:', e)
    } finally {
      setDownloading(false)
    }
  }

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

  const dobras = splitDobras(lp.content)

  // Aprovar refinamento de uma dobra → remonta a copy e persiste
  function handleApproveDobra(dobraIndex, refined) {
    if (!onContentChange) return
    onContentChange(replaceDobra(lp.content, dobraIndex, refined))
  }

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
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-rl-text truncate">{lp.name}</p>
              {wf && (
                <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rl-green/15 text-rl-green border border-rl-green/30">
                  <LayoutTemplate className="w-2.5 h-2.5" /> {wf.name}
                </span>
              )}
            </div>
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

          {isWireframe ? (
            <>
              {/* Toggle Wireframe / Texto + Editar */}
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-rl-surface/60 border border-rl-border/40 w-fit">
                  <button
                    onClick={() => { setView('wireframe') }}
                    className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
                      view === 'wireframe' ? 'bg-rl-green/15 text-rl-green' : 'text-rl-muted hover:text-rl-text'
                    }`}
                  >
                    <LayoutTemplate className="w-3.5 h-3.5" /> Wireframe
                  </button>
                  <button
                    onClick={() => { setView('texto'); setEditing(false) }}
                    className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
                      view === 'texto' ? 'bg-rl-green/15 text-rl-green' : 'text-rl-muted hover:text-rl-text'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" /> Texto
                  </button>
                </div>
                {view === 'wireframe' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadWireframe}
                      disabled={downloading}
                      title="Baixar o wireframe como imagem PNG"
                      className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border bg-rl-surface border-rl-border/40 text-rl-muted hover:text-rl-blue transition-all disabled:opacity-50"
                    >
                      {downloading
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
                        : <><Download className="w-3.5 h-3.5" /> Baixar PNG</>}
                    </button>
                    <button
                      onClick={handleDownloadHtml}
                      disabled={downloading}
                      title="Baixar o wireframe como página HTML (abre em qualquer navegador)"
                      className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border bg-rl-surface border-rl-border/40 text-rl-muted hover:text-rl-blue transition-all disabled:opacity-50"
                    >
                      <FileCode2 className="w-3.5 h-3.5" /> Baixar HTML
                    </button>
                    {onWireframeEdit && (
                      <button
                        onClick={() => setEditing((v) => !v)}
                        className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                          editing
                            ? 'bg-rl-green/15 border-rl-green/40 text-rl-green'
                            : 'bg-rl-surface border-rl-border/40 text-rl-muted hover:text-rl-text'
                        }`}
                      >
                        {editing ? <><Check className="w-3.5 h-3.5" /> Concluir edição</> : <><Pencil className="w-3.5 h-3.5" /> Editar texto</>}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {view === 'wireframe' ? (
                <div>
                  <p className="text-[10px] text-rl-muted mb-2 leading-snug">
                    {editing
                      ? 'Modo edição: clique em qualquer texto do wireframe para editar. As mudanças salvam ao sair do campo.'
                      : 'Prévia da copy aplicada no layout. Imagens e vídeo são placeholders — referência para o designer montar a página.'}
                  </p>
                  <div ref={wireframeRef}>
                    <wf.Component
                      content={lp.wireframeContent}
                      editable={editing}
                      onEdit={(path, value) => onWireframeEdit(setByPath(lp.wireframeContent, path, value))}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-0">{renderMarkdownLines(lp.content)}</div>
              )}
            </>
          ) : dobras.length > 1 ? (
            <div className="space-y-3">
              {dobras.map((dobra, di) => (
                <DobraBlock
                  key={di}
                  dobra={dobra}
                  index={di}
                  onRefine={onRefineDobra}
                  onApprove={handleApproveDobra}
                />
              ))}
            </div>
          ) : (
            // Fallback: copy antiga sem cabeçalhos de dobra reconhecíveis
            <div className="space-y-0">{renderMarkdownLines(lp.content)}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── New / Regenerate Copy Form ───────────────────────────────────────────────
function CopyForm({
  project, copyCount, onSave, onCancel, isRegen, existingName,
  defaultCustomNote, defaultProductId, defaultPersonaId, defaultGomNum, defaultWireframeType,
}) {
  // GOMs disponíveis (separadas do texto gerado no módulo Oferta Matadora)
  const goms = useMemo(
    () => parseGOMs(project.ofertaData?.generatedOffer),
    [project.ofertaData]
  )

  const [name,            setName]            = useState(isRegen ? existingName : `Copy Landing Page ${copyCount + 1}`)
  const [wireframeType,   setWireframeType]   = useState(isRegen ? (defaultWireframeType || 'vsl') : 'vsl')
  const [customNote,      setCustomNote]      = useState(defaultCustomNote || '')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState(null)
  const [streamPreview,   setStreamPreview]   = useState('')
  // Escopo de produto + persona: '' = todos/todas (geral)
  const [selectedProductId, setSelectedProductId] = useState(isRegen ? (defaultProductId || '') : '')
  const [selectedPersonaId, setSelectedPersonaId] = useState(isRegen ? (defaultPersonaId || '') : '')
  // Oferta matadora (GOM) que serve de base — default: a primeira disponível
  const [selectedGomNum, setSelectedGomNum] = useState(() => {
    if (isRegen && defaultGomNum && goms.some((g) => g.num === defaultGomNum)) return defaultGomNum
    return goms[0]?.num ?? ''
  })

  const productList = useMemo(
    () => (project.produtos || []).filter((p) => (p.nome || '').trim()),
    [project.produtos]
  )
  const personaList = useMemo(
    () => (project.personas || []).filter((p) => (p.name || '').trim()),
    [project.personas]
  )

  const selectedGom     = useMemo(() => goms.find((g) => g.num === selectedGomNum) || null, [goms, selectedGomNum])
  const selectedProduct = useMemo(() => (selectedProductId ? productList.find((x) => x.id === selectedProductId) : null), [selectedProductId, productList])
  const selectedPersona = useMemo(() => (selectedPersonaId ? personaList.find((x) => x.id === selectedPersonaId) : null), [selectedPersonaId, personaList])

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setStreamPreview('')
    try {
      const baseItens = [
        selectedGom && 'a oferta matadora',
        selectedProduct && 'o produto/serviço',
        selectedPersona && 'a persona',
      ].filter(Boolean)
      const baseClause = baseItens.length
        ? ` Use como base ${baseItens.join(', ')} fornecido(s) acima.`
        : ' Não há oferta, produto ou persona definidos — baseie-se exclusivamente na direção criativa.'

      const contextText = buildLandingContext({
        produtos:   selectedProduct ? [selectedProduct] : [],
        personas:   selectedPersona ? [selectedPersona] : [],
        ofertaText: selectedGom?.content || '',
      })

      const baseFields = {
        name:         name.trim() || (isRegen ? existingName : `Copy Landing Page ${copyCount + 1}`),
        customNote:   customNote.trim(),
        productId:    selectedProductId || null,
        productName:  selectedProduct?.nome || null,
        personaId:    selectedPersonaId || null,
        personaName:  selectedPersona?.name || null,
        ofertaGomNum: selectedGom?.num || null,
        ofertaText:   selectedGom?.content || null,
        rating:       null,
        createdAt:    new Date().toISOString(),
      }

      const wf = getWireframe(wireframeType)

      if (wf?.system && wf?.parse) {
        // ── Geração ESTRUTURADA (copy direto nos slots do wireframe) ──────────
        const instruction = wf.buildInstruction({ customNote, baseClause })
        const { system, messages } = buildLandingCachedPayload({
          systemPrompt: wf.system,
          contextText,
          instruction,
        })
        const fullText = await streamClaude({
          model:      'claude-sonnet-4-5',
          max_tokens: 8000,
          system,
          messages,
          onChunk:    (text) => setStreamPreview(text),
        })
        const structured = wf.parse(fullText)
        if (!structured) {
          throw new Error('A IA retornou um formato inesperado. Tente gerar novamente.')
        }
        onSave({
          id:               crypto.randomUUID(),
          ...baseFields,
          wireframeType:    wf.id,
          wireframeContent: structured,
          content:          wf.toText(structured),
        })
        return
      }

      // ── Fallback: geração em 6 dobras (markdown) ───────────────────────────
      const customSection = customNote.trim()
        ? `\n## DIREÇÃO CRIATIVA\n${customNote.trim()}\n(Esta direção deve orientar e influenciar toda a copy.)\n`
        : ''
      const instruction = `${customSection}
---

## SOLICITAÇÃO

Crie uma copy COMPLETA de landing page com as 6 dobras.${baseClause} Use APENAS as informações deste contexto e a direção criativa — não invente dados de empresa, produtos, personas ou números que não estejam aqui. Seja extremamente específico; nunca use frases genéricas ou templates vazios.`
      const { system, messages } = buildLandingCachedPayload({
        systemPrompt: LANDING_SYSTEM,
        contextText,
        instruction,
      })
      const fullText = await streamClaude({
        model:      'claude-sonnet-4-5',
        max_tokens: 16000,
        system,
        messages,
        onChunk:    (text) => setStreamPreview(text),
      })
      onSave({ id: crypto.randomUUID(), ...baseFields, content: fullText })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [copyCount, customNote, existingName, isRegen, name, onSave, selectedProduct, selectedPersona, selectedGom, selectedProductId, selectedPersonaId, wireframeType])


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

      {/* Tipo de wireframe (formato da página) */}
      <div className="rounded-xl border border-rl-green/30 bg-rl-green/5 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-4 h-4 text-rl-green" />
          <label className="label-field !mb-0">Tipo de página (wireframe)</label>
        </div>
        <p className="text-[11px] text-rl-muted leading-snug">
          A copy é gerada já no formato da página escolhida — você vê o texto encaixado no wireframe.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {WIREFRAME_TYPES.map((t) => {
            const active = wireframeType === t.id
            return (
              <button
                key={t.id}
                type="button"
                disabled={!t.ready}
                onClick={() => t.ready && setWireframeType(t.id)}
                className={`relative flex items-center justify-center gap-1 text-[11px] font-semibold px-2 py-2 rounded-lg border transition-all ${
                  active
                    ? 'bg-rl-green/15 border-rl-green/50 text-rl-green'
                    : t.ready
                      ? 'bg-rl-surface/60 border-rl-border/40 text-rl-text hover:border-rl-green/30'
                      : 'bg-rl-surface/30 border-rl-border/30 text-rl-muted/60 cursor-not-allowed'
                }`}
              >
                {!t.ready && <Lock className="w-2.5 h-2.5" />}
                {t.label}
                {!t.ready && (
                  <span className="absolute -top-1.5 -right-1.5 text-[7px] font-bold uppercase tracking-wider px-1 py-0.5 rounded-full bg-rl-surface border border-rl-border/50 text-rl-muted">
                    em breve
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Oferta matadora (base da copy) */}
      <div className="rounded-xl border border-rl-gold/30 bg-rl-gold/5 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-rl-gold" />
          <label className="label-field !mb-0">Oferta matadora (base da copy)</label>
          <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
            selectedGom
              ? 'bg-rl-gold/15 text-rl-gold border-rl-gold/30'
              : 'bg-rl-surface text-rl-muted border-rl-border/50'
          }`}>
            {selectedGom ? `GOM #${selectedGom.num}` : 'sem oferta'}
          </span>
        </div>
        {goms.length > 0 ? (
          <>
            <p className="text-[11px] text-rl-muted leading-snug">
              Escolha qual das ofertas matadoras geradas vai servir de base — ou
              &ldquo;Nenhuma&rdquo; para gerar a copy sem se basear em oferta.
            </p>
            <select
              value={selectedGomNum}
              onChange={(e) => setSelectedGomNum(e.target.value)}
              className="input-field w-full text-sm"
            >
              <option value="">Nenhuma — não usar oferta matadora</option>
              {goms.map((g) => (
                <option key={g.num} value={g.num}>
                  GOM #{g.num}{g.label ? ` — ${g.label}` : ''}
                </option>
              ))}
            </select>
            {selectedGom && (
              <div className="max-h-44 overflow-y-auto rounded-lg bg-rl-surface/60 border border-rl-border/40 p-3">
                <pre className="text-[11px] text-rl-text/80 whitespace-pre-wrap font-sans leading-relaxed">{selectedGom.content}</pre>
              </div>
            )}
          </>
        ) : (
          <p className="text-[11px] text-rl-muted leading-snug">
            Nenhuma oferta matadora gerada. Você pode gerar a copy apenas com a direção criativa abaixo,
            ou gerar as ofertas no módulo &ldquo;Oferta Matadora&rdquo; para escolher uma como base.
          </p>
        )}
      </div>

      {/* Escopo de produto + persona (opcional) */}
      {(productList.length > 0 || personaList.length > 0) && (
        <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🎯</span>
            <label className="label-field !mb-0">Foco desta copy</label>
            {(selectedProductId || selectedPersonaId) && (
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rl-green/15 text-rl-green border border-rl-green/30">
                escopo ativo
              </span>
            )}
          </div>
          <p className="text-[11px] text-rl-muted leading-snug">
            Escolha um produto e/ou persona específicos pra IA focar só neles. Deixe em
            &ldquo;Todos&rdquo;/&ldquo;Todas&rdquo; pra considerar o cliente inteiro.
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
                  {personaList.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
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

      {/* Resumo do que será enviado à IA — sem contexto automático */}
      <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-3">
        <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-2">
          A IA vai usar apenas
        </p>
        <ul className="space-y-1 text-xs">
          <li className={selectedGom ? 'text-rl-text' : 'text-rl-muted'}>
            {selectedGom
              ? `✓ Oferta: GOM #${selectedGom.num}${selectedGom.label ? ` — ${selectedGom.label}` : ''}`
              : '— Nenhuma oferta matadora selecionada'}
          </li>
          <li className={selectedProduct ? 'text-rl-text' : 'text-rl-muted'}>
            {selectedProduct ? `✓ Produto: ${selectedProduct.nome}` : '— Produto: nenhum (não enviado)'}
          </li>
          <li className={selectedPersona ? 'text-rl-text' : 'text-rl-muted'}>
            {selectedPersona ? `✓ Persona: ${selectedPersona.name}` : '— Persona: nenhuma (não enviada)'}
          </li>
          <li className={customNote.trim() ? 'text-rl-text' : 'text-rl-muted'}>
            {customNote.trim() ? '✓ Direção criativa preenchida' : '— Sem direção criativa'}
          </li>
        </ul>
        <p className="text-[10px] text-rl-muted mt-2 leading-snug">
          Dados de empresa, anexos e demais módulos não são enviados automaticamente.
        </p>
      </div>

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
  const [regenTarget, setRegenTarget] = useState(null) // { id, name, customNote, productId, personaId, ofertaGomNum } | null

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
    setRegenTarget({
      id:            lp.id,
      name:          lp.name,
      customNote:    lp.customNote || '',
      productId:     lp.productId || '',
      personaId:     lp.personaId || '',
      ofertaGomNum:  lp.ofertaGomNum || '',
      wireframeType: lp.wireframeType || 'vsl',
    })
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

  // Persiste o conteúdo de uma copy específica (após aprovar refinamento de dobra)
  function handleContentChange(id, newContent) {
    const updated = landingPages.map((lp) =>
      lp.id === id ? { ...lp, content: newContent } : lp
    )
    updateProject(project.id, { landingPages: updated })
  }

  // Persiste a edição inline do wireframe: salva o wireframeContent novo e
  // regenera o texto legível (content) a partir dele.
  function handleWireframeEdit(id, newWireframeContent) {
    const lp = landingPages.find((x) => x.id === id)
    const wf = lp?.wireframeType ? getWireframe(lp.wireframeType) : null
    const content = wf?.toText ? wf.toText(newWireframeContent) : lp?.content
    const updated = landingPages.map((x) =>
      x.id === id ? { ...x, wireframeContent: newWireframeContent, content } : x
    )
    updateProject(project.id, { landingPages: updated })
  }

  // Refina uma dobra isolada via IA. Recebe a copy salva (lp) para reconstruir o
  // mesmo contexto escopado (oferta + produto/persona escolhidos) usado na geração.
  const makeRefineHandler = useCallback(
    (lp) => async (_dobraIndex, dobraContent, userNote, onChunk) => {
      const instruction = `---

## DOBRA ORIGINAL

${dobraContent}

---

## SOLICITAÇÃO DE REFINAMENTO

${userNote}

Reescreva APENAS esta dobra aplicando a melhoria solicitada. Mantenha o mesmo cabeçalho \`## \` e a mesma estrutura de campos (HEADLINE DA DOBRA, etc). Use APENAS a oferta matadora e os dados fornecidos no contexto — não invente informações. Retorne SOMENTE o markdown da dobra refinada, sem comentários, sem outras dobras, sem blocos de código.`

      const { system, messages } = buildLandingCachedPayload({
        systemPrompt: LANDING_SYSTEM,
        contextText:  scopedContextForLp(project, lp),
        instruction,
      })
      return streamClaude({
        model:      'claude-sonnet-4-5',
        max_tokens: 4000,
        system,
        messages,
        onChunk,
      })
    },
    [project]
  )

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-rl-text">Copy de Landing Page com IA</h2>
          <p className="text-sm text-rl-muted mt-1">
            Escolha o formato da página e a IA gera a copy já encaixada no wireframe — você vê o texto
            aplicado no layout, não um blocão de texto. Salve e compare múltiplas versões.
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
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-4">🧩 Escolha o formato da página</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            {WIREFRAME_TYPES.map((t) => (
              <div
                key={t.id}
                className={`rounded-xl border p-3 flex items-center gap-2 ${
                  t.ready
                    ? 'bg-rl-green/5 border-rl-green/30 text-rl-text'
                    : 'bg-rl-surface/40 border-rl-border/40 text-rl-muted'
                }`}
              >
                {t.ready ? <LayoutTemplate className="w-3.5 h-3.5 text-rl-green shrink-0" /> : <Lock className="w-3 h-3 shrink-0" />}
                <span className="text-[11px] font-semibold leading-tight">{t.label}</span>
                {!t.ready && <span className="ml-auto text-[8px] uppercase tracking-wider text-rl-muted/70">em breve</span>}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-rl-muted mb-4 leading-snug">
            A IA escreve a copy já no formato escolhido e mostra o texto encaixado no wireframe — pronto para o
            designer montar a página. Começando pelo <span className="text-rl-green font-semibold">VSL</span>.
          </p>
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
          defaultProductId={regenTarget?.productId || ''}
          defaultPersonaId={regenTarget?.personaId || ''}
          defaultGomNum={regenTarget?.ofertaGomNum || ''}
          defaultWireframeType={regenTarget?.wireframeType || 'vsl'}
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
              onRefineDobra={makeRefineHandler(lp)}
              onContentChange={(newContent) => handleContentChange(lp.id, newContent)}
              onWireframeEdit={(newWireframeContent) => handleWireframeEdit(lp.id, newWireframeContent)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
