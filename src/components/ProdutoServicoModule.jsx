import { useState, useCallback } from 'react'
import { Plus, X, Package, ShoppingBag, Briefcase, CheckCircle2, Sparkles, Loader2, AlertTriangle, Copy, CheckCheck, FileText } from 'lucide-react'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import ReactMarkdown from 'react-markdown'

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
const QUESTIONS = [
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
  const [produtos, setProdutos] = useState(() => {
    return project.produtos?.length ? project.produtos : [newProduto('Produto 1')]
  })
  const [activeIdx, setActiveIdx] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [summary, setSummary] = useState(null)
  const [genError, setGenError] = useState(null)
  const [copied, setCopied] = useState(false)

  const produto = produtos[activeIdx]

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
    const next = newProduto(`Produto ${produtos.length + 1}`)
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
      setGenError('Preencha pelo menos 5 perguntas antes de gerar o resumo.')
      return
    }
    setGenerating(true)
    setGenError(null)
    setSummary(null)

    const answersText = QUESTIONS
      .filter((q) => produto.answers[q.id]?.trim())
      .map((q) => `**${q.emoji} ${q.label}**\n${produto.answers[q.id].trim()}`)
      .join('\n\n')

    const instruction = `Produto / Serviço: ${produto.nome || 'Sem nome'}
Tipo: ${produto.tipo === 'servico' ? 'Serviço' : 'Produto Físico'}

${answersText}

Gere o documento de briefing completo baseado nessas informações.`

    try {
      await streamClaude({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: SUMMARY_SYSTEM,
        messages: [{ role: 'user', content: instruction }],
        onChunk: (text) => setSummary(text),
      })
    } catch (err) {
      setGenError(err.message || 'Erro ao gerar resumo. Tente novamente.')
    } finally {
      setGenerating(false)
    }
  }, [produto])

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
            Produto / Serviço
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            Documente os detalhes do produto ou serviço para embasar anúncios e estratégias
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
              ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</>
              : <><Sparkles className="w-4 h-4 text-rl-gold" />Gerar Resumo</>
            }
          </button>
          <button onClick={addProduto} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Novo Produto
          </button>
        </div>
      </div>

      {/* Tabs */}
      {produtos.length > 1 && (
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
                {p.nome || `Produto ${i + 1}`}
              </button>
              {produtos.length > 1 && (
                <button
                  onClick={() => removeProduto(i)}
                  className="p-1 rounded text-rl-muted/50 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Product form */}
      <div className="space-y-4">

        {/* Name + Type */}
        <div className="glass-card p-5 space-y-4">
          <div>
            <label className="label-field">Nome do Produto / Serviço</label>
            <input
              type="text"
              value={produto.nome}
              onChange={(e) => updateProduto({ nome: e.target.value })}
              placeholder="Ex: Curso Online de Marketing Digital..."
              className="input-field"
            />
          </div>

          {/* Type toggle */}
          <div>
            <label className="label-field mb-2">Tipo</label>
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
                Produto Físico
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
                Serviço
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
          <span className="text-xs text-rl-muted shrink-0">{filledCount}/{QUESTIONS.length} perguntas</span>
        </div>

        {/* Questions */}
        {QUESTIONS.map((q, idx) => (
          <div key={q.id} className="glass-card p-5 space-y-2">
            <p className="text-sm font-medium text-rl-text leading-snug">
              <span className="text-rl-muted text-xs mr-2 font-mono">{String(idx + 1).padStart(2, '0')}</span>
              <span className="mr-1.5">{q.emoji}</span>
              {q.label}
            </p>
            <textarea
              value={produto.answers[q.id] || ''}
              onChange={(e) => updateAnswer(q.id, e.target.value)}
              placeholder="Digite sua resposta..."
              rows={3}
              className="input-field resize-none text-sm leading-relaxed"
            />
          </div>
        ))}
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
              <h3 className="text-sm font-semibold text-rl-text">Briefing do Produto / Serviço</h3>
              {generating && <Loader2 className="w-3.5 h-3.5 animate-spin text-rl-muted" />}
            </div>
            {summary && !generating && (
              <button
                onClick={copySummary}
                className="flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-text transition-colors"
              >
                {copied
                  ? <><CheckCheck className="w-3.5 h-3.5 text-rl-green" />Copiado!</>
                  : <><Copy className="w-3.5 h-3.5" />Copiar</>
                }
              </button>
            )}
          </div>

          <div className="prose prose-sm prose-invert max-w-none text-rl-text leading-relaxed
            [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-rl-text [&_h2]:mt-6 [&_h2]:mb-2
            [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-rl-text
            [&_strong]:text-rl-text [&_hr]:border-rl-border [&_hr]:my-4
            [&_p]:text-sm [&_p]:text-rl-text/90
            [&_ul]:space-y-1 [&_li]:text-sm [&_li]:text-rl-text/90">
            <ReactMarkdown>{summary || ''}</ReactMarkdown>
          </div>
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
            Salvar Produtos / Serviços
          </button>
        </div>
      )}
    </div>
  )
}
