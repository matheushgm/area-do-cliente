import { useState, useCallback, useEffect } from 'react'
import { Plus, X, Package, ShoppingBag, Briefcase, CheckCircle2, Sparkles, Loader2, AlertTriangle, Copy, CheckCheck, FileText, HelpCircle, ChevronDown } from 'lucide-react'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import { useApp } from '../context/AppContext'
import { streamClaude, instrucaoDeIdioma } from '../lib/claude'
import { supabase } from '../lib/supabase'
import MarkdownView from './Editor/MarkdownView'
import TextoEditavelIA from './Editor/TextoEditavelIA'
import VideoGuide from './VideoGuide'
import { t as tSolto, useI18n } from '../i18n'
import TEXTOS_PT from '../i18n/locales/pt/produto.js'

// ─── System Prompt ─────────────────────────────────────────────────────────────
const SUMMARY_SYSTEM = `Você é um especialista em marketing e estratégia de produto. Sua função é transformar respostas brutas sobre um produto ou serviço em um documento de briefing claro, completo e altamente persuasivo.

O documento gerado deve educar qualquer pessoa envolvida no projeto — gestores de tráfego, designers, copywriters e estrategistas — sobre tudo o que precisam saber para trabalhar com este produto ou serviço.

Gere o documento seguindo EXATAMENTE esta estrutura:

## 📦 O Produto / Serviço

[Descrição clara e objetiva do que é e o que resolve — 2 a 3 parágrafos]

---

## 🎯 Para Quem é Este Produto

[Perfil detalhado do cliente ideal: quando precisa, em que momento da vida, qual dor resolve]

---

## ✨ Transformação: Antes e Depois

**Antes:** [Como é a vida do cliente sem o produto — seja específico e emocional]

**Depois:** [Como é a vida do cliente após usar — resultados concretos e mensuráveis]

---

## 🏆 Por Que Este e Não o do Concorrente

[Diferenciais competitivos claros e específicos — o que ninguém mais faz ou consegue copiar]

---

## 🚧 Objeções e Como Quebrá-las

[Liste as principais objeções com resposta direta para cada uma — formato: **Objeção:** → **Resposta:**]

---

## 📊 Provas e Resultados

[Cases, números, depoimentos, tempo de resultado — tudo que gera credibilidade]

---

## 🔥 Urgência e Escassez

[Por que agora? O que acontece se o cliente esperar? Janelas de oportunidade]

---

## 🛡️ Garantias e Segurança

[Garantias oferecidas e como lidar se der errado]

---

## 💡 Pontos de Atenção para a Equipe

[Insights estratégicos importantes para gestores, designers e copywriters — o que NÃO fazer, tons a evitar, palavras que convertem, etc.]

---

Diretrizes obrigatórias:
- Português brasileiro claro, direto e profissional
- Seja extremamente específico — zero generalidades
- Use os dados fornecidos literalmente sempre que possível
- Não use travessões (—) em nenhuma parte do output
- O documento deve ser acionável: qualquer pessoa que ler deve saber exatamente como comunicar este produto`

// ─── Questions ────────────────────────────────────────────────────────────────
// Enunciado, orientação e exemplo moram em src/i18n/locales/{pt,en}/produto.js
// (`perguntas.qN`). `label` é getter: traduz no idioma de agora a cada leitura, e o portal
// (que importa QUESTIONS) continua lendo `q.label`. O prompt da IA usa sempre o pt.
export const QUESTIONS = [
  { id: 'q1',  emoji: '🎯' },
  { id: 'q2',  emoji: '⏰' },
  { id: 'q3',  emoji: '✨' },
  { id: 'q4',  emoji: '🏆' },
  { id: 'q5',  emoji: '🔥' },
  { id: 'q6',  emoji: '😔' },
  { id: 'q7',  emoji: '🚧' },
  { id: 'q8',  emoji: '🔄' },
  { id: 'q9',  emoji: '🤔' },
  { id: 'q10', emoji: '📊' },
  { id: 'q11', emoji: '⏱️' },
  { id: 'q12', emoji: '💬' },
  { id: 'q13', emoji: '💡' },
  { id: 'q14', emoji: '⚠️' },
  { id: 'q15', emoji: '📅' },
  { id: 'q16', emoji: '🛡️' },
  { id: 'q17', emoji: '🤝' },
]

for (const q of QUESTIONS) {
  Object.defineProperty(q, 'label', {
    enumerable: true, configurable: true, get: () => tSolto(`produto.perguntas.${q.id}.label`),
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return crypto.randomUUID()
}

function newProduto(label = '') {
  return {
    id: uid(),
    nome: label,
    tipo: 'produto',
    answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, ''])),
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ProdutoServicoModule({ project, onSave }) {
  const { updateProject } = useApp()
  const { t } = useI18n()
  // O nome padrão é só o ponto de partida (a pessoa edita); nasce no idioma da tela.
  const [produtos, setProdutos] = useState(() => {
    return project.produtos?.length ? project.produtos : [newProduto(t('produto.nomePadrao', { n: 1 }))]
  })
  const [activeIdx, setActiveIdx] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [summary, setSummary] = useState(null)
  const [genError, setGenError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [openHelp, setOpenHelp] = useState(null)

  const produto = produtos[activeIdx]

  // Sync summary display when switching between products
  useEffect(() => {
    setSummary(produto.summary || null)
    setGenError(null)
  }, [activeIdx, produto.id])

  const updateProduto = useCallback((patch) => {
    const next = produtos.map((p, i) => i === activeIdx ? { ...p, ...patch } : p)
    setProdutos(next)
    updateProject(project.id, { produtos: next })
  }, [activeIdx, produtos, project.id, updateProject])

  const updateAnswer = useCallback((qId, value) => {
    const next = produtos.map((p, i) =>
      i === activeIdx ? { ...p, answers: { ...p.answers, [qId]: value } } : p
    )
    setProdutos(next)
    updateProject(project.id, { produtos: next })
  }, [activeIdx, produtos, project.id, updateProject])

  const addProduto = () => {
    const next = newProduto(t('produto.nomePadrao', { n: produtos.length + 1 }))
    setProdutos((prev) => [...prev, next])
    setActiveIdx(produtos.length)
  }

  const removeProduto = (idx) => {
    if (produtos.length === 1) return
    setProdutos((prev) => prev.filter((_, i) => i !== idx))
    setActiveIdx((prev) => Math.min(prev, produtos.length - 2))
  }

  const filledCount = QUESTIONS.filter((q) => produto.answers[q.id]?.trim()).length

  const generateSummary = useCallback(async () => {
    const answered = QUESTIONS.filter((q) => produto.answers[q.id]?.trim())
    if (answered.length < 5) {
      setGenError(t('produto.minimoPerguntas'))
      return
    }
    setGenerating(true)
    setGenError(null)
    setSummary(null)

    const answersText = QUESTIONS
      .filter((q) => produto.answers[q.id]?.trim())
      .map((q) => `**${q.emoji} ${TEXTOS_PT.perguntas[q.id].label}**\n${produto.answers[q.id].trim()}`)
      .join('\n\n')

    const instruction = `Produto / Serviço: ${produto.nome || 'Sem nome'}
Tipo: ${produto.tipo === 'servico' ? 'Serviço' : 'Produto Físico'}

${answersText}

Gere o documento de briefing completo baseado nessas informações.`

    try {
      const fullText = await streamClaude({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        // O briefing só é exibido (markdown, PDF, portal e contexto da IA, sem leitura por
        // rótulo): o idioma vale também para os títulos.
        system: SUMMARY_SYSTEM + instrucaoDeIdioma({ rotulos: true }),
        messages: [{ role: 'user', content: instruction }],
        onChunk: (text) => setSummary(text),
      })

      // 1. Update local state + queue debounced Supabase write (normal flow)
      updateProduto({ summary: fullText })

      // 2. Immediate Supabase write — garante que o resumo sobrevive a um refresh
      //    antes do debounce de 1s disparar (delete+insert, mesmo padrão do AppContext)
      if (supabase) {
        const nextProdutos = produtos.map((p, i) =>
          i === activeIdx ? { ...p, summary: fullText } : p
        )
        await supabase.from('produtos').delete().eq('project_id', project.id)
        if (nextProdutos.length > 0) {
          const { error } = await supabase.from('produtos').insert(
            nextProdutos.map((p) => ({
              id:         crypto.randomUUID(),
              project_id: project.id,
              nome:       p.nome    || '',
              tipo:       p.tipo    || 'produto',
              answers:    p.answers || {},
              summary:    p.summary || null,
            }))
          )
          if (error) console.error('[Supabase] generateSummary save:', error.message)
        }
      }
    } catch (err) {
      setGenError(err.message || t('produto.erroGerar'))
    } finally {
      setGenerating(false)
    }
  }, [produto, updateProduto, produtos, activeIdx, project.id, t])

  const copySummary = () => {
    if (!summary) return
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <Package className="w-5 h-5 text-rl-gold" />
            {t('produto.titulo')}
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            {t('produto.subtitulo')}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <AutoSaveIndicator />
          <button
            onClick={generateSummary}
            disabled={generating}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" />{t('produto.gerando')}</>
              : <><Sparkles className="w-4 h-4 text-rl-gold" />{t('produto.gerarResumo')}</>
            }
          </button>
        </div>
      </div>

      {/* Vídeo guia */}
      <VideoGuide videoId="awwUFJhqHOE" label={t('produto.video')} />

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {produtos.map((p, i) => (
          <div key={p.id} className="flex items-center gap-1">
            <button
              onClick={() => setActiveIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeIdx === i
                  ? 'bg-gradient-rl text-white shadow-glow'
                  : 'bg-rl-surface text-rl-muted hover:text-rl-text'
              }`}
            >
              {p.nome || t('produto.nomePadrao', { n: i + 1 })}
            </button>
            {produtos.length > 1 && (
              <button
                onClick={() => removeProduto(i)}
                aria-label={t('produto.remover')}
                className="p-1 rounded text-rl-muted/50 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addProduto}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-rl-muted hover:text-rl-text border border-dashed border-rl-border hover:border-rl-gold/40 transition-all"
        >
          <Plus className="w-3 h-3" /> {t('produto.novoProduto')}
        </button>
      </div>

      {/* Product form */}
      <div className="space-y-4">

        {/* Name + Type */}
        <div className="glass-card p-5 space-y-4">
          <div>
            <label className="label-field">{t('produto.nome')}</label>
            <input
              type="text"
              value={produto.nome}
              onChange={(e) => updateProduto({ nome: e.target.value })}
              placeholder={t('produto.nomePlaceholder')}
              className="input-field"
            />
          </div>

          {/* Type toggle */}
          <div>
            <label className="label-field mb-2">{t('produto.tipo')}</label>
            <div className="flex gap-3">
              <button
                onClick={() => updateProduto({ tipo: 'produto' })}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  produto.tipo === 'produto'
                    ? 'bg-rl-gold/10 border-rl-gold/40 text-rl-gold'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                {t('produto.produtoFisico')}
              </button>
              <button
                onClick={() => updateProduto({ tipo: 'servico' })}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  produto.tipo === 'servico'
                    ? 'bg-rl-blue/10 border-rl-blue/40 text-rl-blue'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                {t('produto.servico')}
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-rl-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-rl rounded-full transition-all duration-300"
              style={{ width: `${(filledCount / QUESTIONS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-rl-muted shrink-0">{t('produto.progresso', { n: filledCount, total: QUESTIONS.length })}</span>
        </div>

        {/* Questions */}
        {QUESTIONS.map((q, idx) => {
          const help = { text: t(`produto.perguntas.${q.id}.ajuda`), example: t(`produto.perguntas.${q.id}.exemplo`) }
          const isOpen = openHelp === q.id
          return (
            <div key={q.id} className="glass-card p-5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-rl-text leading-snug">
                  <span className="text-rl-muted text-xs mr-2 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="mr-1.5">{q.emoji}</span>
                  {q.label}
                </p>
                {help && (
                  <button
                    onClick={() => setOpenHelp(isOpen ? null : q.id)}
                    className={`shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all ${
                      isOpen
                        ? 'bg-rl-blue/10 border-rl-blue/30 text-rl-blue'
                        : 'border-rl-border text-rl-muted hover:text-rl-blue hover:border-rl-blue/30'
                    }`}
                    title={t('produto.verOrientacao')}
                  >
                    <HelpCircle className="w-3 h-3" />
                    <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {isOpen && help && (
                <div className="bg-rl-blue/5 border border-rl-blue/15 rounded-xl p-4 space-y-2 text-xs text-rl-text/80 leading-relaxed">
                  <p>{help.text}</p>
                  <p className="text-rl-muted italic border-l-2 border-rl-blue/30 pl-3">
                    <span className="font-semibold text-rl-blue not-italic">{t('produto.exemplo')}</span>
                    {help.example}
                  </p>
                </div>
              )}

              <textarea
                value={produto.answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                placeholder={t('produto.respostaPlaceholder')}
                rows={3}
                className="input-field resize-none text-sm leading-relaxed"
              />
            </div>
          )
        })}
      </div>

      {/* Error */}
      {genError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm">{genError}</p>
        </div>
      )}

      {/* Generated Summary */}
      {(summary || generating) && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-rl-gold" />
              <h3 className="text-sm font-semibold text-rl-text">{t('produto.briefing')}</h3>
              {generating && <Loader2 className="w-3.5 h-3.5 animate-spin text-rl-muted" />}
            </div>
            {summary && !generating && (
              <button
                onClick={copySummary}
                className="flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-text transition-colors"
              >
                {copied
                  ? <><CheckCheck className="w-3.5 h-3.5 text-rl-green" />{t('produto.copiado')}</>
                  : <><Copy className="w-3.5 h-3.5" />{t('produto.copiar')}</>
                }
              </button>
            )}
          </div>

          {generating ? (
            <MarkdownView content={summary || ''} />
          ) : (
            // Editável e refinável com IA; a edição segue o mesmo caminho de
            // gravação do briefing gerado (updateProduto → produtos.summary).
            <TextoEditavelIA
              valor={summary}
              onSalvar={(md) => { setSummary(md); updateProduto({ summary: md }) }}
              project={project}
            />
          )}
        </div>
      )}

      {/* Save */}
      {onSave && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => onSave(produtos)}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('produto.salvar')}
          </button>
        </div>
      )}
    </div>
  )
}
