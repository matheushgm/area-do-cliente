import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import {
  Plus, Trash2, Loader2, User, Sparkles,
  AlertTriangle, CheckCircle2, UserPlus, X, FileDown,
} from 'lucide-react'
import { exportPersonasPDF } from '../utils/exportPDF'
import { streamClaude } from '../lib/claude'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import VideoGuide from '../components/VideoGuide'
import { t as tSolto, useI18n } from '../i18n'
import TEXTOS_PT from '../i18n/locales/pt/personas.js'

// ─── Questions ────────────────────────────────────────────────────────────────
// Enunciado e ajuda moram em src/i18n/locales/{pt,en}/personas.js (`perguntas.<id>`).
// `label` e `hint` são getters (traduzem no idioma de agora a cada leitura); o portal,
// que importa QUESTIONS, continua lendo `q.label`. O prompt da IA usa sempre o pt.
export const QUESTIONS = [
  { id: 'sonhos', emoji: '✨' },
  { id: 'resultado', emoji: '🎯' },
  { id: 'acoes', emoji: '⚡' },
  { id: 'tempo', emoji: '⏱️' },
  { id: 'objecoes', emoji: '🚧' },
  { id: 'erros', emoji: '❌' },
  { id: 'medos', emoji: '😰' },
  { id: 'sinais', emoji: '🔍' },
  { id: 'habitos', emoji: '🔄' },
]

for (const q of QUESTIONS) {
  const tx = TEXTOS_PT.perguntas[q.id] || {}
  for (const campo of ['label', 'hint']) {
    Object.defineProperty(q, campo, {
      enumerable: true, configurable: true,
      get: () => (tx[campo] != null ? tSolto(`personas.perguntas.${q.id}.${campo}`) : null),
    })
  }
}

// ─── AI System Prompt (criador-de-persona-v2) ────────────────────────────────
const SYSTEM_PROMPT = `Você é um estrategista de marketing especializado em construção de personas de comprador para o mercado brasileiro.

Com base nas informações fornecidas pelo usuário sobre o produto/serviço e o público, crie uma persona de comprador ideal completa, direta e acionável.

REGRAS:
- Responda em texto simples, usando apenas títulos em CAIXA ALTA e marcadores com "-"
- Sem asteriscos, sem hashtags, sem negrito, sem markdown
- Não use travessões (—) em nenhuma parte do output
- Seja específico e concreto. Nunca seja genérico
- Use linguagem brasileira natural
- Dê um nome real brasileiro à persona
- Gere tudo em uma única resposta, sem perguntar etapas

---

PERFIL GERAL
- Nome: [Nome real brasileiro]
- Idade: [Faixa etária]
- Profissão/Cargo: [Cargo típico]
- Renda mensal: [Estimativa]
- Escolaridade: [Nível]
- Estado civil: [Contexto familiar resumido]
- Rotina: [2 frases sobre o dia a dia real dessa pessoa]

---

PERFIL PSICOGRÁFICO
- Personalidade: [3 traços marcantes]
- Valores: [O que guia as decisões dela]
- Postura diante de novidades: [Como ela reage a mudanças, tecnologia, etc.]

---

PRINCIPAIS DORES
Liste exatamente 10 dores reais, específicas e contextualizadas. Para cada uma:
- Dor: [Descrição direta]
  - Por que isso trava ela: [1 frase explicando o impacto real]

---

MEDOS PROFUNDOS
Liste exatamente 10 medos que ela não admitiria em voz alta, aqueles que a mantêm acordada à noite:
- [Medo 1: seja específico e emocional]
- [Medo 2]
- [Medo 3]
- [Medo 4]
- [Medo 5]
- [Medo 6]
- [Medo 7]
- [Medo 8]
- [Medo 9]
- [Medo 10]

---

SONHOS E DESEJOS
Liste exatamente 10 resultados concretos que ela realmente quer alcançar:
- [Sonho 1: concreto, não abstrato]
- [Sonho 2]
- [Sonho 3]
- [Sonho 4]
- [Sonho 5]
- [Sonho 6]
- [Sonho 7]
- [Sonho 8]
- [Sonho 9]
- [Sonho 10]

---

FRASES QUE ELA DIZ (crenças e senso comum)
Liste exatamente 10 frases reais que ela diria — crenças, senso comum e frases do dia a dia que revelam como ela pensa sobre o problema, o mercado ou a solução:
- "[Frase 1]"
- "[Frase 2]"
- "[Frase 3]"
- "[Frase 4]"
- "[Frase 5]"
- "[Frase 6]"
- "[Frase 7]"
- "[Frase 8]"
- "[Frase 9]"
- "[Frase 10]"

---

O QUE ELA JÁ TENTOU (E NÃO FUNCIONOU)
Liste exatamente 10 tentativas anteriores com o motivo do fracasso:
- [Solução tentada 1] → Por que falhou: [1 frase direta]
- [Solução tentada 2] → Por que falhou: [1 frase direta]
- [Solução tentada 3] → Por que falhou: [1 frase direta]
- [Solução tentada 4] → Por que falhou: [1 frase direta]
- [Solução tentada 5] → Por que falhou: [1 frase direta]
- [Solução tentada 6] → Por que falhou: [1 frase direta]
- [Solução tentada 7] → Por que falhou: [1 frase direta]
- [Solução tentada 8] → Por que falhou: [1 frase direta]
- [Solução tentada 9] → Por que falhou: [1 frase direta]
- [Solução tentada 10] → Por que falhou: [1 frase direta]

---

GATILHOS DE COMPRA
Liste exatamente 10 gatilhos que fazem ela tomar a decisão de comprar:
- [Gatilho 1]
- [Gatilho 2]
- [Gatilho 3]
- [Gatilho 4]
- [Gatilho 5]
- [Gatilho 6]
- [Gatilho 7]
- [Gatilho 8]
- [Gatilho 9]
- [Gatilho 10]

---

PRINCIPAIS OBJEÇÕES
Liste exatamente 10 objeções que travam ela antes de comprar:
- [Objeção 1]
- [Objeção 2]
- [Objeção 3]
- [Objeção 4]
- [Objeção 5]
- [Objeção 6]
- [Objeção 7]
- [Objeção 8]
- [Objeção 9]
- [Objeção 10]

---

INSIGHT ESTRATÉGICO
[1 parágrafo direto com o que o marketing precisa entender para se comunicar bem com essa persona. O que não é óbvio sobre ela?]`

// ─── Helpers ──────────────────────────────────────────────────────────────────
function newPersona(label = '') {
  return {
    id: crypto.randomUUID(),
    name: label,
    answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, ['']])),
    generatedProfile: null,
  }
}

// ─── Multi-answer input ───────────────────────────────────────────────────────
function MultiAnswerInput({ answers, onChange }) {
  const { t } = useI18n()
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
            placeholder={t('personas.respostaPlaceholder')}
            className="input-field flex-1 py-2 text-sm"
          />
          {answers.length > 1 && (
            <button
              onClick={() => remove(i)}
              aria-label={t('personas.removerResposta')}
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
          {t('personas.adicionarResposta')} {answers.length > 0 && <span className="text-rl-muted">({answers.length}/10)</span>}
        </button>
      )}
    </div>
  )
}

// ─── Plain-text renderer (criador-de-persona-v2 format) ──────────────────────
// Format: ALL CAPS section headers, "---" dividers, "- " bullet points
function isSectionHeader(line) {
  const t = line.trim()
  if (!t || t === '---') return false
  // A section header is a non-empty line that is fully uppercase (ignoring spaces,
  // parentheses, accented letters and punctuation)
  return t === t.toUpperCase() && /[A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇ]/.test(t)
}

function PersonaResult({ text }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const trimmed = line.trim()

        if (trimmed === '---') return (
          <div key={i} className="border-t border-rl-border/40 my-3" />
        )

        if (trimmed === '') return <div key={i} className="h-1" />

        if (isSectionHeader(trimmed)) return (
          <p key={i} className="text-xs font-bold text-rl-purple uppercase tracking-wider mt-3 mb-1">
            {trimmed}
          </p>
        )

        if (trimmed.startsWith('- ')) return (
          <div key={i} className="flex gap-2 ml-2">
            <span className="text-rl-purple/60 text-xs mt-0.5 shrink-0">•</span>
            <p className="text-xs text-rl-text leading-relaxed">{trimmed.slice(2)}</p>
          </div>
        )

        // Indented sub-bullet (2 spaces + "- ")
        if (line.startsWith('  - ')) return (
          <div key={i} className="flex gap-2 ml-6">
            <span className="text-rl-muted text-xs mt-0.5 shrink-0">–</span>
            <p className="text-xs text-rl-muted leading-relaxed">{line.slice(4)}</p>
          </div>
        )

        return <p key={i} className="text-xs text-rl-muted leading-relaxed ml-2">{trimmed}</p>
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PersonaCreator({ project, onSave }) {
  const { updateProject } = useApp()
  const { t } = useI18n()
  // O nome padrão é só o ponto de partida (a pessoa edita); nasce no idioma da tela.
  const [personas, setPersonas] = useState(() => {
    return project.personas?.length ? project.personas : [newPersona(t('personas.nomePadrao', { n: 1 }))]
  })
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading]     = useState(false)
  const [streaming, setStreaming] = useState('')
  const [error, setError]         = useState(null)

  const persona = personas[activeIdx]

  const updatePersona = useCallback((patch) => {
    const next = personas.map((p, i) => i === activeIdx ? { ...p, ...patch } : p)
    setPersonas(next)
    updateProject(project.id, { personas: next })
  }, [activeIdx, personas, project.id, updateProject])

  const updateAnswers = useCallback((qId, answers) => {
    const next = personas.map((p, i) =>
      i === activeIdx ? { ...p, answers: { ...p.answers, [qId]: answers } } : p
    )
    setPersonas(next)
    updateProject(project.id, { personas: next })
  }, [activeIdx, personas, project.id, updateProject])

  const addPersona = () => {
    const next = newPersona(t('personas.nomePadrao', { n: personas.length + 1 }))
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
      return `**${q.emoji} ${TEXTOS_PT.perguntas[q.id].label}**\n${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
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
        max_tokens: 16000,
        // Sem instrucaoDeIdioma(): o perfil é lido por regex em rótulos em português
        // ("PRINCIPAIS DORES", "- Dor:", "- Nome:") pelo Criativos com IA e por
        // api/criativos-public.js, e alimenta copy que vai para aprovação do cliente.
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
            {t('personas.titulo')}
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            {t('personas.subtitulo')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AutoSaveIndicator />
          <button
            onClick={() => exportPersonasPDF(personas, project)}
            className="btn-secondary flex items-center gap-2 text-sm"
            title={t('personas.exportarPdf')}
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
          <button onClick={addPersona} className="btn-secondary flex items-center gap-2 text-sm">
            <UserPlus className="w-4 h-4" />
            {t('personas.nova')}
          </button>
        </div>
      </div>

      {/* Vídeo guia */}
      <VideoGuide videoId="hpMy2Th9YrA" label={t('personas.video')} />

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
                {p.name || t('personas.nomePadrao', { n: i + 1 })}
              </button>
              <button
                onClick={() => removePersona(i)}
                aria-label={t('personas.remover')}
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
            <label className="label-field">{t('personas.nome')}</label>
            <input
              type="text"
              value={persona.name}
              onChange={(e) => updatePersona({ name: e.target.value })}
              placeholder={t('personas.nomePlaceholder')}
              className="input-field"
            />
          </div>

          {/* Questions */}
          {QUESTIONS.map((q) => (
            <div key={q.id} className="glass-card p-5 space-y-3">
              <div>
                <p className="text-sm font-medium text-rl-text leading-snug">
                  <span className="mr-1.5">{q.emoji}</span>
                  {q.label}
                </p>
                {q.hint && (
                  <p className="text-xs text-rl-muted mt-2 leading-relaxed pl-5 border-l-2 border-rl-purple/20">
                    {q.hint}
                  </p>
                )}
              </div>
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
              <p className="text-sm font-semibold text-rl-text">{t('personas.gerarComIa')}</p>
            </div>
            <p className="text-xs text-rl-muted mb-4">
              {t('personas.gerarDescricao')}
            </p>
            <button
              onClick={generate}
              disabled={!hasAnswers || loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t('personas.gerando')}</>
              ) : (
                <><Sparkles className="w-4 h-4" /> {t('personas.gerar')}</>
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
                  {t('personas.perfilGerado', { nome: persona.name || t('personas.persona') })}
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
                {t('personas.vazio')}
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
            {t('personas.concluir')}
          </button>
        </div>
      )}
    </div>
  )
}
