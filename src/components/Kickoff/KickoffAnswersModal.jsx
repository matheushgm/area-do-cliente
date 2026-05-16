import { X, ListChecks } from 'lucide-react'
import Modal from '../UI/Modal'
import { PILLARS_BY_ID } from './KickoffQuestions'
import { extractScore } from './KickoffScorer'
import { formatAnswer, severityColor } from './kickoffViewHelpers'

// Lista única com todas as perguntas + respostas do questionário, em ordem.
// Conta também respostas em branco (mostradas com "— sem resposta —").
export default function KickoffAnswersModal({ questions = [], answers = {}, onClose }) {
  const answeredCount = questions.filter((q) => {
    const a = answers[q.id]
    return a != null && a !== '' && !(Array.isArray(a) && !a.length)
  }).length

  return (
    <Modal onClose={onClose} maxWidth="2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-rl-border">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
            <ListChecks className="w-5 h-5 text-rl-purple" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-rl-text leading-tight">
              Todas as respostas
            </h3>
            <p className="text-xs text-rl-subtle mt-0.5">
              {answeredCount} de {questions.length} pergunta{questions.length !== 1 ? 's' : ''} respondida{answeredCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all shrink-0"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-2.5 max-h-[68vh] overflow-y-auto pr-1">
        {questions.length === 0 && (
          <p className="text-sm text-rl-muted text-center py-8">
            Nenhuma pergunta cadastrada.
          </p>
        )}
        {questions.map((q, i) => {
          const raw = answers[q.id]
          const formatted = formatAnswer(q, raw)
          const partial = extractScore(q, raw)
          const isAnswered = partial != null
          const partialColor = isAnswered ? severityColor(partial) : '#94A3B8'
          const pillarLabels = (q.pillarIds || [])
            .map((pid) => PILLARS_BY_ID[pid]?.short || pid)
            .join(' · ')

          return (
            <div
              key={q.id}
              className="rounded-xl border border-rl-border p-3 bg-rl-surface/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-bold text-rl-muted">#{i + 1}</span>
                    <span className="text-[9px] uppercase tracking-wide text-rl-muted font-semibold">
                      {q.type}
                    </span>
                    {pillarLabels && (
                      <span className="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full bg-rl-purple/10 text-rl-purple border border-rl-purple/20">
                        {pillarLabels}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-rl-text leading-snug">{q.label}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-black tabular-nums" style={{ color: partialColor }}>
                    {isAnswered ? partial : '—'}
                  </div>
                  <div className="text-[9px] text-rl-muted font-bold">/ 100</div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-rl-border/60">
                <p className="text-[10px] uppercase tracking-wide text-rl-muted font-semibold mb-0.5">
                  Resposta
                </p>
                {isAnswered ? (
                  <p className="text-sm text-rl-text leading-snug whitespace-pre-wrap break-words">
                    {formatted}
                  </p>
                ) : (
                  <p className="text-sm italic text-rl-muted">— sem resposta —</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-rl-border flex items-center justify-end">
        <button
          onClick={onClose}
          className="text-xs px-4 py-2 rounded-xl bg-rl-purple text-white font-semibold hover:bg-rl-purple/90 transition-all"
        >
          Fechar
        </button>
      </div>
    </Modal>
  )
}
