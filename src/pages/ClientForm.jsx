import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircle2, Loader2, AlertTriangle, Plus, X,
  Package, Users, Zap, Save,
} from 'lucide-react'

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

const OFERTA_FIELDS = [
  { key: 'nome',             emoji: '🏷️', label: 'Nome da Oferta',            type: 'text',     hint: 'Crie um nome claro e atraente para a sua oferta.' },
  { key: 'resultadoSonho',   emoji: '✨', label: 'Resultado do Sonho',         type: 'textarea', hint: 'O que o cliente conquista? Seja específico e conecte ao status que ele deseja.' },
  { key: 'porqueVaiFuncionar',emoji: '💡',label: 'Por que vai funcionar',       type: 'textarea', hint: 'Mecanismo único, provas sociais, cases de sucesso e diferenciais.' },
  { key: 'velocidade',       emoji: '⚡', label: 'Velocidade do Resultado',    type: 'text',     hint: 'Em quanto tempo o cliente vê o primeiro resultado?' },
  { key: 'esforcoMinimo',    emoji: '🤝', label: 'Esforço Mínimo do Cliente',  type: 'textarea', hint: 'O que o cliente precisa fazer para alcançar o resultado?' },
  { key: 'garantia',         emoji: '🛡️', label: 'Garantia',                   type: 'textarea', hint: 'Que garantia você oferece? Quanto mais forte, melhor.' },
  { key: 'escassez',         emoji: '🔥', label: 'Escassez / Urgência',        type: 'text',     hint: 'Por que o cliente precisa decidir agora?' },
]

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

function emptyOferta() {
  return Object.fromEntries([...OFERTA_FIELDS.map((f) => [f.key, '']), ['bonus', []]])
}

// Convert array ↔ textarea string
const arrToText = (arr) => (Array.isArray(arr) ? arr.join('\n') : arr || '')
const textToArr = (text) =>
  text.split('\n').map((s) => s.trim()).filter(Boolean)

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

  // Persona state
  const [personas, setPersonas]   = useState([newPersona()])
  const [activePerIdx, setActivePerIdx] = useState(0)

  // Oferta state
  const [oferta, setOferta]       = useState(emptyOferta())

  // Save status per module
  const [saveStatus, setSaveStatus] = useState({ produto: 'idle', persona: 'idle', oferta: 'idle' })

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
          setProdutos(data.produtos.map((p) => ({
            ...p,
            answers: { ...Object.fromEntries(PRODUTO_QUESTIONS.map((q) => [q.id, ''])), ...p.answers },
          })))
        }

        if (data.personas?.length) {
          setPersonas(data.personas.map((p) => ({
            ...p,
            answers: { ...Object.fromEntries(PERSONA_QUESTIONS.map((q) => [q.key, []])), ...p.answers },
          })))
        }

        if (data.ofertaData) {
          setOferta({ ...emptyOferta(), ...data.ofertaData })
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

  // ── Oferta handlers ────────────────────────────────────────────────────────
  const updateOfertaField = (key, value) => {
    const next = { ...oferta, [key]: value }
    setOferta(next)
    scheduleSave('oferta', { ofertaData: next })
  }

  const addBonus = () => {
    const next = { ...oferta, bonus: [...(oferta.bonus || []), ''] }
    setOferta(next)
    scheduleSave('oferta', { ofertaData: next })
  }

  const updateBonus = (idx, value) => {
    const bonus = [...(oferta.bonus || [])]
    bonus[idx] = value
    const next = { ...oferta, bonus }
    setOferta(next)
    scheduleSave('oferta', { ofertaData: next })
  }

  const removeBonus = (idx) => {
    const bonus = (oferta.bonus || []).filter((_, i) => i !== idx)
    const next = { ...oferta, bonus }
    setOferta(next)
    scheduleSave('oferta', { ofertaData: next })
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
    { id: 'oferta',  label: 'Oferta Matadora',    icon: Zap,     color: 'text-rl-purple' },
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
          <SaveBadge status={saveStatus[activeTab === 'produto' ? 'produtos' : activeTab === 'persona' ? 'personas' : 'oferta']} />
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
              onClick={() => setActiveTab(t.id)}
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

            {/* Sub-tabs de produto */}
            {produtos.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {produtos.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-1">
                    <button
                      onClick={() => setActiveProdIdx(i)}
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
                <button onClick={addProduto} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-rl-muted hover:text-rl-text border border-dashed border-rl-border hover:border-rl-purple/40 transition-all">
                  <Plus className="w-3 h-3" /> Novo Produto
                </button>
              </div>
            )}

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

            {/* Perguntas */}
            {PRODUTO_QUESTIONS.map((q, idx) => (
              <div key={q.id} className="glass-card p-5 space-y-2">
                <p className="text-sm font-medium text-rl-text">
                  <span className="text-rl-muted text-xs mr-2 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="mr-1.5">{q.emoji}</span>
                  {q.label}
                </p>
                <textarea
                  value={produto.answers[q.id] || ''}
                  onChange={(e) => updateProdutoAnswer(q.id, e.target.value)}
                  placeholder="Digite sua resposta..."
                  rows={3}
                  className="input-field resize-none text-sm leading-relaxed"
                />
              </div>
            ))}

            {/* Adicionar produto (quando só tem 1) */}
            {produtos.length === 1 && (
              <button
                onClick={addProduto}
                className="w-full py-3 rounded-xl border border-dashed border-rl-border text-sm text-rl-muted hover:text-rl-text hover:border-rl-purple/40 flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" /> Adicionar outro Produto / Serviço
              </button>
            )}
          </div>
        )}

        {/* ── PERSONAS ──────────────────────────────────────────────────────── */}
        {activeTab === 'persona' && (
          <div className="space-y-4">

            {/* Sub-tabs de persona */}
            <div className="flex gap-2 flex-wrap">
              {personas.map((p, i) => (
                <div key={p.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setActivePerIdx(i)}
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

            {/* Instrução */}
            <div className="px-1">
              <p className="text-xs text-rl-muted">
                Pense no seu cliente ideal ao responder. Você pode escrever várias respostas, uma por linha.
              </p>
            </div>

            {/* Perguntas */}
            {PERSONA_QUESTIONS.map((q, idx) => (
              <div key={q.key} className="glass-card p-5 space-y-2">
                <p className="text-sm font-medium text-rl-text">
                  <span className="text-rl-muted text-xs mr-2 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="mr-1.5">{q.emoji}</span>
                  {q.label}
                </p>
                {q.hint && <p className="text-xs text-rl-muted">{q.hint}</p>}
                <textarea
                  value={arrToText(persona.answers[q.key])}
                  onChange={(e) => updatePersonaAnswer(q.key, e.target.value)}
                  placeholder="Digite sua resposta (uma por linha para múltiplas)..."
                  rows={3}
                  className="input-field resize-none text-sm leading-relaxed"
                />
              </div>
            ))}
          </div>
        )}

        {/* ── OFERTA MATADORA ───────────────────────────────────────────────── */}
        {activeTab === 'oferta' && (
          <div className="space-y-4">

            <div className="glass-card p-5 border-l-4 border-rl-purple/40">
              <p className="text-sm text-rl-muted leading-relaxed">
                A Oferta Matadora é a proposta de valor irresistível do seu produto ou serviço. Preencha cada campo com o máximo de clareza e especificidade.
              </p>
            </div>

            {/* Campos principais */}
            {OFERTA_FIELDS.map((f, idx) => (
              <div key={f.key} className="glass-card p-5 space-y-2">
                <p className="text-sm font-medium text-rl-text">
                  <span className="text-rl-muted text-xs mr-2 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="mr-1.5">{f.emoji}</span>
                  {f.label}
                </p>
                {f.hint && <p className="text-xs text-rl-muted">{f.hint}</p>}
                {f.type === 'textarea' ? (
                  <textarea
                    value={oferta[f.key] || ''}
                    onChange={(e) => updateOfertaField(f.key, e.target.value)}
                    placeholder="Digite sua resposta..."
                    rows={3}
                    className="input-field resize-none text-sm leading-relaxed"
                  />
                ) : (
                  <input
                    value={oferta[f.key] || ''}
                    onChange={(e) => updateOfertaField(f.key, e.target.value)}
                    placeholder="Digite sua resposta..."
                    className="input-field text-sm"
                  />
                )}
              </div>
            ))}

            {/* Bônus */}
            <div className="glass-card p-5 space-y-3">
              <p className="text-sm font-medium text-rl-text">
                <span className="text-rl-muted text-xs mr-2 font-mono">08</span>
                <span className="mr-1.5">🎁</span>
                O que está incluso de bônus?
              </p>
              <p className="text-xs text-rl-muted">Liste os bônus incluídos na oferta. Ex: "Planilha de Diagnóstico — R$ 497"</p>

              <div className="space-y-2">
                {(oferta.bonus || []).map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={b}
                      onChange={(e) => updateBonus(i, e.target.value)}
                      placeholder={`Bônus ${i + 1}...`}
                      className="input-field text-sm flex-1"
                    />
                    <button onClick={() => removeBonus(i)} className="p-2 text-rl-muted hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addBonus}
                  className="flex items-center gap-2 text-sm text-rl-muted hover:text-rl-text transition-colors"
                >
                  <Plus className="w-4 h-4" /> Adicionar bônus
                </button>
              </div>
            </div>
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
