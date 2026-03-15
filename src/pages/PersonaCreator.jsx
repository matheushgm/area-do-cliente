import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import {
  Plus, Trash2, Loader2, User, Sparkles,
  AlertTriangle, CheckCircle2, UserPlus, X, FileDown,
} from 'lucide-react'
import { exportPersonasPDF } from '../utils/exportPDF'
import { streamClaude } from '../lib/claude'

// ─── Questions ────────────────────────────────────────────────────────────────
const QUESTIONS = [
  { id: 'resultado', emoji: '🎯', label: 'Qual é o resultado percebido após usar o produto ou serviço?' },
  { id: 'acoes',     emoji: '⚡', label: 'O que ele PRECISA FAZER para alcançar o resultado?' },
  { id: 'tempo',     emoji: '⏱️', label: 'Em quanto tempo o cliente consegue alcançar o resultado?' },
  { id: 'objecoes',  emoji: '🚧', label: 'Quais são as objeções que eles usam como justificativa para não fazer o que é necessário?' },
  { id: 'sonhos',    emoji: '✨', label: 'Quais são OS SONHOS do seu cliente que o seu trabalho pode realizar?' },
  { id: 'erros',     emoji: '❌', label: 'Quais são ERROS que seu cliente comete e que afasta ele do resultado sonhado?' },
  { id: 'medos',     emoji: '😰', label: 'Quais são OS MEDOS do seu cliente que podem se tornar realidade?' },
  { id: 'sinais',    emoji: '🔍', label: 'Seu cliente VÊ SINAIS DO PROBLEMA. Quais sinais são esse?' },
  { id: 'valores',   emoji: '💡', label: 'Quais são seus pensamentos, valores e ideias que vão contra o senso comum do seu mercado?' },
  { id: 'habitos',   emoji: '🔄', label: 'Hábitos do seu cliente' },
]

// ─── AI System Prompt (based on criador-de-persona skill) ────────────────────
const SYSTEM_PROMPT = `Você é um analista de marketing de classe mundial com atenção meticulosa aos detalhes. Crie perfis completos e profundos de buyer personas.

Ao receber os dados, gere um perfil usando EXATAMENTE esta estrutura em markdown:

### 👤 PERFIL GERAL
Nome fictício real, idade, profissão, dados demográficos e psicográficos, principais desafios, valores e motivações.

### 😰 MEDOS PROFUNDOS
Liste 5 medos profundos. Não respostas de superfície — os medos mais sombrios que a persona não admitiria em voz alta, os que a mantêm acordada à noite.

### 💬 FRASES QUE MACHUCAM SEM QUERER
Frases específicas que pessoas próximas (cônjuge, filhos, colegas, amigos) diriam tentando ajudar, mas que acabam ferindo a persona. Pelo menos 3 frases de cada pessoa próxima.

### ✨ CENÁRIO DOS SONHOS
Como seria a vida ideal após resolver seu problema? Sentimentos, atividades, relacionamentos. Liste 15 resultados emocionais específicos — inclusive desejos que ela teria vergonha de admitir.

### 📋 RESUMO ABRANGENTE
Resumo completo conectando todos os aspectos da persona para uso em estratégias de marketing.

Seja vívido, emocional e específico. Evite respostas genéricas. Use linguagem que conecta emocionalmente.`

// ─── Helpers ──────────────────────────────────────────────────────────────────
function newPersona(label = '') {
  return {
    id: Date.now(),
    name: label,
    answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, ['']])),
    generatedProfile: null,
  }
}

// ─── Multi-answer input ───────────────────────────────────────────────────────
function MultiAnswerInput({ answers, onChange }) {
  const add    = () => answers.length < 10 && onChange([...answers, ''])
  const remove = (i) => onChange(answers.filter((_, idx) => idx !== i))
  const update = (i, val) => { const n = [...answers]; n[i] = val; onChange(n) }

  return (
    <div className="space-y-2">
      {answers.map((ans, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] text-rl-muted w-4 text-right shrink-0">{i + 1}.</span>
          <input
            type="text"
            value={ans}
            onChange={(e) => update(i, e.target.value)}
            placeholder="Digite uma resposta..."
            className="input-field flex-1 py-2 text-sm"
          />
          {answers.length > 1 && (
            <button
              onClick={() => remove(i)}
              className="p-1.5 rounded-lg text-rl-muted hover:text-rl-red hover:bg-rl-red/10 transition-all shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      {answers.length < 10 && (
        <button
          onClick={add}
          className="flex items-center gap-1.5 text-xs text-rl-purple hover:text-rl-purple/80 transition-colors mt-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar resposta {answers.length > 0 && <span className="text-rl-muted">({answers.length}/10)</span>}
        </button>
      )}
    </div>
  )
}

// ─── Markdown renderer (simple) ───────────────────────────────────────────────
function PersonaResult({ text }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return (
          <p key={i} className="text-sm font-bold text-rl-text mt-4 mb-1">{line.replace('### ', '')}</p>
        )
        if (line.startsWith('## ')) return (
          <p key={i} className="text-base font-bold text-rl-purple mt-4 mb-1">{line.replace('## ', '')}</p>
        )
        if (line.startsWith('**') && line.endsWith('**')) return (
          <p key={i} className="text-xs font-semibold text-rl-subtle mt-2">{line.replace(/\*\*/g, '')}</p>
        )
        if (line.trim() === '') return <div key={i} className="h-1" />
        return <p key={i} className="text-xs text-rl-muted leading-relaxed">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PersonaCreator({ project, onSave }) {
  const { updateProject } = useApp()
  const [personas, setPersonas] = useState(() => {
    return project.personas?.length ? project.personas : [newPersona('Persona 1')]
  })
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading]     = useState(false)
  const [streaming, setStreaming] = useState('')
  const [error, setError]         = useState(null)

  const persona = personas[activeIdx]

  const updatePersona = useCallback((patch) => {
    setPersonas((prev) => prev.map((p, i) => i === activeIdx ? { ...p, ...patch } : p))
  }, [activeIdx])

  const updateAnswers = useCallback((qId, answers) => {
    setPersonas((prev) => prev.map((p, i) =>
      i === activeIdx ? { ...p, answers: { ...p.answers, [qId]: answers } } : p
    ))
  }, [activeIdx])

  const addPersona = () => {
    const next = newPersona(`Persona ${personas.length + 1}`)
    setPersonas((prev) => [...prev, next])
    setActiveIdx(personas.length)
    setError(null)
  }

  const removePersona = (idx) => {
    if (personas.length === 1) return
    setPersonas((prev) => prev.filter((_, i) => i !== idx))
    setActiveIdx((prev) => Math.min(prev, personas.length - 2))
  }

  const buildPrompt = () => {
    const sections = QUESTIONS.map((q) => {
      const answers = (persona.answers[q.id] || []).filter((a) => a.trim())
      if (!answers.length) return null
      return `**${q.emoji} ${q.label}**\n${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
    }).filter(Boolean)

    return `Crie a persona de buyer para o cliente **${project.companyName}** (${project.businessType || 'empresa'}).

Persona: **${persona.name || 'Persona Principal'}**

Dados preenchidos pelo gestor de marketing:

${sections.join('\n\n')}`
  }

  const generate = async () => {
    setLoading(true)
    setStreaming('')
    setError(null)
    try {
      const profile = await streamClaude({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildPrompt() }],
        onChunk: (text) => setStreaming(text),
      })
      const updatedPersonas = personas.map((p, i) => i === activeIdx ? { ...p, generatedProfile: profile } : p)
      setPersonas(updatedPersonas)
      setStreaming('')
      updateProject(project.id, { personas: updatedPersonas })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const hasAnswers = QUESTIONS.some((q) => (persona.answers[q.id] || []).some((a) => a.trim()))
  const currentProfile = streaming || persona.generatedProfile

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <User className="w-5 h-5 text-rl-purple" />
            Criador de Persona
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            Defina o cliente ideal e gere um perfil psicológico profundo com IA
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => exportPersonasPDF(personas, project)}
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Exportar PDF"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
          <button onClick={addPersona} className="btn-secondary flex items-center gap-2 text-sm">
            <UserPlus className="w-4 h-4" />
            Nova Persona
          </button>
        </div>
      </div>

      {/* Persona tabs */}
      {personas.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {personas.map((p, i) => (
            <div key={p.id} className="flex items-center gap-1">
              <button
                onClick={() => setActiveIdx(i)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeIdx === i
                    ? 'bg-gradient-rl text-white shadow-glow'
                    : 'bg-rl-surface text-rl-muted hover:text-rl-text'
                }`}
              >
                {p.name || `Persona ${i + 1}`}
              </button>
              <button
                onClick={() => removePersona(i)}
                className="p-1 rounded text-rl-muted/50 hover:text-rl-red transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Formulário ─────────────────────── */}
        <div className="space-y-4">

          {/* Name */}
          <div className="glass-card p-5">
            <label className="label-field">Nome da Persona</label>
            <input
              type="text"
              value={persona.name}
              onChange={(e) => updatePersona({ name: e.target.value })}
              placeholder="Ex: Ana, empreendedora 35-45 anos..."
              className="input-field"
            />
          </div>

          {/* Questions */}
          {QUESTIONS.map((q) => (
            <div key={q.id} className="glass-card p-5 space-y-3">
              <p className="text-sm font-medium text-rl-text leading-snug">
                <span className="mr-1.5">{q.emoji}</span>
                {q.label}
              </p>
              <MultiAnswerInput
                answers={persona.answers[q.id] || ['']}
                onChange={(answers) => updateAnswers(q.id, answers)}
              />
            </div>
          ))}
        </div>

        {/* ── Resultado / IA ────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">

          {/* Generate panel */}
          <div className="glass-card p-5 border border-rl-purple/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-rl-purple" />
              <p className="text-sm font-semibold text-rl-text">Gerar com IA</p>
            </div>
            <p className="text-xs text-rl-muted mb-4">
              Preencha as perguntas e clique em gerar para criar o perfil psicológico completo da persona.
            </p>
            <button
              onClick={generate}
              disabled={!hasAnswers || loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Gerando persona...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Gerar Persona com IA</>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="glass-card p-4 border border-rl-red/30 bg-rl-red/5">
              <div className="flex items-start gap-2 text-rl-red">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Generated profile */}
          {currentProfile && (
            <div className="glass-card p-5 border border-rl-green/20">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-rl-green" />
                <p className="text-sm font-semibold text-rl-text">
                  {persona.name || 'Persona'} — Perfil Gerado
                </p>
              </div>
              <PersonaResult text={currentProfile} />
            </div>
          )}

          {/* Empty state */}
          {!currentProfile && !error && (
            <div className="glass-card p-8 text-center">
              <User className="w-8 h-8 text-rl-muted/30 mx-auto mb-3" />
              <p className="text-rl-muted text-sm">
                Preencha as perguntas e clique em "Gerar Persona com IA" para criar o perfil detalhado.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Concluir */}
      {onSave && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => onSave(personas)}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Concluir Criação de Personas
          </button>
        </div>
      )}
    </div>
  )
}
