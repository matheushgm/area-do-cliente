import { useMemo, useState } from 'react'
import {
  Flame, ChevronLeft, ChevronRight, Check, RotateCcw, Pencil, Sparkles,
} from 'lucide-react'
import KickoffQuestionForm from './KickoffQuestionForm'
import {
  OM_QUESTIONS, OM_PILLARS, computeOmDiagnosis, pillarJustification,
} from './KickoffOfertaMatadora'

// Painel auto-contido com 3 fases internas:
//   'cta'      → card de CTA antes de iniciar
//   'asking'   → questionário inline (1 pergunta por vez, 6 perguntas)
//   'verdict'  → veredito + breakdown por pilar
//
// O estado é todo controlado pelo pai (KickoffResultView/KickoffModule)
// via props `value` (objeto salvo) + `onSave(diagnosisObj | null)`.
export default function KickoffOfertaMatadoraPanel({ value, onSave }) {
  const persisted = value || null
  const [phase, setPhase]       = useState(persisted?.completedAt ? 'verdict' : 'cta')
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers]   = useState(persisted?.answers || {})

  const total = OM_QUESTIONS.length
  const safeStep = Math.max(0, Math.min(stepIndex, total - 1))
  const q = OM_QUESTIONS[safeStep]

  const diagnosis = useMemo(() => computeOmDiagnosis(answers), [answers])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function setAnswer(qId, v) {
    setAnswers((prev) => ({ ...prev, [qId]: v }))
  }

  function nextStep() {
    if (safeStep < total - 1) setStepIndex(safeStep + 1)
    else finish()
  }

  function prevStep() {
    if (safeStep > 0) setStepIndex(safeStep - 1)
    else setPhase('cta')
  }

  function finish() {
    const result = computeOmDiagnosis(answers)
    const merged = {
      answers,
      scores:     result.scores,
      totalScore: result.totalScore,
      verdictId:  result.verdict.id,
      verdictLabel: result.verdict.label,
      verdictColor: result.verdict.color,
      verdictEmoji: result.verdict.emoji,
      verdictDesc:  result.verdict.desc,
      completedAt:  persisted?.completedAt || new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    }
    onSave(merged)
    setPhase('verdict')
  }

  function restart() {
    if (!window.confirm('Refazer a análise apaga as respostas atuais. Continuar?')) return
    setAnswers({})
    setStepIndex(0)
    setPhase('cta')
    onSave(null)
  }

  function editAnswers() {
    setStepIndex(0)
    setPhase('asking')
  }

  // ── View: CTA inicial ─────────────────────────────────────────────────────
  if (phase === 'cta') {
    return (
      <div className="glass-card p-5 border-2 border-dashed border-rl-gold/30 text-center space-y-3">
        <Flame className="w-8 h-8 text-rl-gold mx-auto" />
        <div>
          <h3 className="text-sm font-bold text-rl-text">
            Cabe uma Oferta Matadora aqui?
          </h3>
          <p className="text-xs text-rl-muted mt-1 max-w-md mx-auto">
            6 perguntas rápidas em 5 pilares pra você devolver pro cliente se faz
            sentido investir agora numa oferta agressiva — ou se a estratégia precisa
            ser outra.
          </p>
        </div>
        <button
          onClick={() => { setStepIndex(0); setPhase('asking') }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rl-gold text-white shadow-glow hover:bg-rl-gold/90 transition-all"
        >
          <Flame className="w-4 h-4" />
          Iniciar análise
        </button>
      </div>
    )
  }

  // ── View: questionário ────────────────────────────────────────────────────
  if (phase === 'asking') {
    const answered = q ? (answers[q.id] != null && answers[q.id] !== '') : false
    return (
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rl-gold" />
            <h3 className="text-sm font-bold text-rl-text">Análise de Oferta Matadora</h3>
          </div>
          <span className="text-[10px] text-rl-muted font-semibold">
            {safeStep + 1} de {total}
          </span>
        </div>

        {/* Barra de progresso */}
        <div className="h-1 rounded-full bg-rl-surface overflow-hidden">
          <div
            className="h-full bg-rl-gold transition-all"
            style={{ width: `${((safeStep + 1) / total) * 100}%` }}
          />
        </div>

        <div className="pt-2">
          <KickoffQuestionForm
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswer(q.id, v)}
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-rl-border/40">
          <button
            onClick={prevStep}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Anterior
          </button>
          <p className="text-[10px] text-rl-muted">
            {answered ? '✓ Respondida' : 'Sem resposta = score 0 pra esse pilar'}
          </p>
          {safeStep < total - 1 ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-rl-gold text-white hover:bg-rl-gold/90 transition-all"
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={finish}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-rl-green text-white shadow-glow hover:bg-rl-green/90 transition-all"
            >
              <Sparkles className="w-4 h-4" /> Ver veredito
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── View: veredito ────────────────────────────────────────────────────────
  const verdictColor = persisted?.verdictColor || diagnosis.verdict.color
  const verdictEmoji = persisted?.verdictEmoji || diagnosis.verdict.emoji
  const verdictLabel = persisted?.verdictLabel || diagnosis.verdict.label
  const verdictDesc  = persisted?.verdictDesc  || diagnosis.verdict.desc
  const totalScore   = persisted?.totalScore   ?? diagnosis.totalScore
  const scores       = persisted?.scores       ?? diagnosis.scores

  return (
    <div className="glass-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-rl-gold" />
          <h3 className="text-sm font-bold text-rl-text">Veredito: Oferta Matadora</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={editAnswers}
            className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
          >
            <Pencil className="w-3 h-3" /> Editar
          </button>
          <button
            onClick={restart}
            className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
          >
            <RotateCcw className="w-3 h-3" /> Refazer
          </button>
        </div>
      </div>

      {/* Card de veredito */}
      <div
        className="rounded-xl p-5 relative overflow-hidden"
        style={{ background: `${verdictColor}10`, border: `1px solid ${verdictColor}40` }}
      >
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ background: verdictColor }}
        />
        <div className="pl-3 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-2xl mb-1">{verdictEmoji}</div>
            <h4 className="text-lg font-black leading-tight" style={{ color: verdictColor }}>
              {verdictLabel}
            </h4>
            <p className="text-sm text-rl-muted mt-2 max-w-2xl leading-relaxed">
              {verdictDesc}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-4xl font-black tabular-nums" style={{ color: verdictColor }}>
              {totalScore}
            </div>
            <div className="text-[10px] text-rl-muted font-semibold">/ 100</div>
          </div>
        </div>
      </div>

      {/* Breakdown por pilar */}
      <div className="space-y-2.5">
        <p className="text-[10px] uppercase tracking-wider text-rl-muted font-semibold">
          Diagnóstico pilar a pilar
        </p>
        {OM_PILLARS.map((p) => {
          const score = scores?.[p.id] ?? 0
          const just  = pillarJustification(p.id, score)
          return (
            <div
              key={p.id}
              className="rounded-xl p-3 bg-rl-surface/40 border border-rl-border/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-rl-text">{p.label}</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: `${just.color}15`, color: just.color }}
                    >
                      {just.tag}
                    </span>
                  </div>
                  <p className="text-xs text-rl-muted mt-1 leading-snug">{just.text}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-black tabular-nums" style={{ color: just.color }}>
                    {score}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-rl-muted text-center pt-2 border-t border-rl-border/40">
        <Check className="w-3 h-3 inline-block mr-1 text-rl-green" />
        Diagnóstico salvo no projeto e incluído no PDF do Kickoff.
      </p>
    </div>
  )
}
