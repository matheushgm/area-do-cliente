import { useState, useCallback } from 'react'
import { Plus, X, Package, ShoppingBag, Briefcase, CheckCircle2 } from 'lucide-react'

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
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
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
  const [produtos, setProdutos] = useState(() => {
    return project.produtos?.length ? project.produtos : [newProduto('Produto 1')]
  })
  const [activeIdx, setActiveIdx] = useState(0)

  const produto = produtos[activeIdx]

  const updateProduto = useCallback((patch) => {
    setProdutos((prev) => prev.map((p, i) => i === activeIdx ? { ...p, ...patch } : p))
  }, [activeIdx])

  const updateAnswer = useCallback((qId, value) => {
    setProdutos((prev) => prev.map((p, i) =>
      i === activeIdx ? { ...p, answers: { ...p.answers, [qId]: value } } : p
    ))
  }, [activeIdx])

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
        <button onClick={addProduto} className="btn-secondary flex items-center gap-2 text-sm shrink-0">
          <Plus className="w-4 h-4" />
          Novo Produto
        </button>
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
