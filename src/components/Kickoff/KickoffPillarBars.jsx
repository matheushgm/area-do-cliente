import { useState } from 'react'
import { Eye, X } from 'lucide-react'
import { PILLARS, PILLARS_BY_ID } from './KickoffQuestions'
import { extractScore } from './KickoffScorer'
import Modal from '../UI/Modal'
import { fmtMoney } from '../Resultados/resultadosHelpers'

// Barras horizontais 0-100 por pilar, coloridas por severidade.
// O app inteiro é light theme (rl-bg = #EEF2F9). Mantemos o param `theme`
// apenas pra eventual reuso, mas o default sempre força contraste alto.
//
// Props extras:
// - questions: lista de perguntas (do tipo do projeto) — usada pra abrir
//   o detalhamento de cada pilar (pergunta + resposta + score parcial).
// - answers: objeto { [questionId]: value } com as respostas do usuário.
export default function KickoffPillarBars({
  pillarScores = {},
  questions = [],
  answers = {},
}) {
  const trackColor = '#E2E8F0'
  const labelColor = '#0F172A'
  const subColor   = '#334155'

  const [openPillar, setOpenPillar] = useState(null) // pillarId | null

  // Ordena por score crescente — fraquezas no topo
  const rows = PILLARS
    .map((p) => ({ ...p, score: pillarScores[p.id]?.score ?? pillarScores[p.id] ?? 0 }))
    .sort((a, b) => a.score - b.score)

  return (
    <>
      <div className="space-y-2.5">
        {rows.map((p) => {
          const color = severityColor(p.score)
          return (
            <div key={p.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm gap-2">
                <span className="font-extrabold tracking-tight" style={{ color: labelColor }}>
                  {p.label}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-black tabular-nums text-base" style={{ color }}>
                    {p.score}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenPillar(p.id)}
                    className="p-1 rounded-md text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                    title="Ver perguntas e respostas deste pilar"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: trackColor }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(2, p.score)}%`,
                    background: color,
                  }}
                />
              </div>
              <div className="text-xs font-semibold" style={{ color: subColor }}>
                {severityLabel(p.score)}
              </div>
            </div>
          )
        })}
      </div>

      {openPillar && (
        <PillarDetailModal
          pillarId={openPillar}
          questions={questions}
          answers={answers}
          score={pillarScores[openPillar]?.score ?? pillarScores[openPillar] ?? 0}
          onClose={() => setOpenPillar(null)}
        />
      )}
    </>
  )
}

// ─── Modal de detalhamento ────────────────────────────────────────────────────
function PillarDetailModal({ pillarId, questions, answers, score, onClose }) {
  const pillar = PILLARS_BY_ID[pillarId]
  // Filtra só as perguntas que afetam este pilar
  const related = questions.filter((q) => (q.pillarIds || []).includes(pillarId))
  const color = severityColor(score)

  return (
    <Modal onClose={onClose} maxWidth="xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-rl-border">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold mb-1">
            Pilar
          </p>
          <h3 className="text-lg font-black text-rl-text leading-tight">
            {pillar?.label || pillarId}
          </h3>
          <p className="text-xs text-rl-subtle mt-1">
            {related.length} pergunta{related.length !== 1 ? 's' : ''} contribu
            {related.length !== 1 ? 'em' : 'i'} pra este pilar
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-3xl font-black tabular-nums" style={{ color }}>{score}</div>
            <div className="text-[9px] text-rl-muted font-bold uppercase tracking-wider">/ 100</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista de perguntas */}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {related.length === 0 && (
          <p className="text-sm text-rl-muted text-center py-8">
            Nenhuma pergunta cadastrada pra este pilar.
          </p>
        )}
        {related.map((q, i) => {
          const raw = answers[q.id]
          const formatted = formatAnswer(q, raw)
          const partial = extractScore(q, raw)
          const isAnswered = partial != null
          const partialColor = isAnswered ? severityColor(partial) : '#94A3B8'
          return (
            <div
              key={q.id}
              className="rounded-xl border border-rl-border p-3 bg-rl-surface/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-rl-muted">#{i + 1}</span>
                    <span className="text-[10px] uppercase tracking-wide text-rl-muted font-semibold">
                      {q.type}
                    </span>
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
                  <p className="text-sm text-rl-text leading-snug">{formatted}</p>
                ) : (
                  <p className="text-sm italic text-rl-muted">— sem resposta —</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-rl-border">
        <p className="text-xs text-rl-muted leading-relaxed">
          O score do pilar é a média ponderada dos scores parciais das perguntas
          respondidas. Perguntas em branco não entram na média.
        </p>
      </div>
    </Modal>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Converte uma resposta crua em texto formatado pra exibição no modal.
function formatAnswer(question, answer) {
  if (answer == null || answer === '' || (Array.isArray(answer) && !answer.length)) {
    return '— sem resposta —'
  }
  const { type, options } = question

  switch (type) {
    case 'single':
    case 'yesno':
    case 'scale': {
      const opt = (options || []).find((o) => o.value === answer)
      return opt ? opt.label : String(answer)
    }
    case 'multi': {
      const arr = Array.isArray(answer) ? answer : [answer]
      const labels = arr.map((v) => {
        const opt = (options || []).find((o) => o.value === v)
        return opt ? opt.label : String(v)
      })
      return labels.join(', ')
    }
    case 'money': {
      const n = Number(answer) || 0
      return n > 0 ? fmtMoney(n) : '— sem valor —'
    }
    case 'percent': {
      if (answer === 'unknown') return 'Não sei calcular'
      const n = Number(answer)
      return isNaN(n) ? String(answer) : `${n}%`
    }
    case 'number':
      return String(answer)
    case 'text':
      return String(answer)
    default:
      return String(answer)
  }
}

function severityColor(score) {
  if (score < 31) return '#EF4444'
  if (score < 51) return '#F59E0B'
  if (score < 71) return '#EAB308'
  if (score < 86) return '#22C55E'
  return '#15803D'
}

function severityLabel(score) {
  if (score < 31) return 'Crítico — precisa de atenção imediata'
  if (score < 51) return 'Frágil — risco no curto prazo'
  if (score < 71) return 'Em estruturação — base existente, falta padronizar'
  if (score < 86) return 'Saudável — pronto pra acelerar'
  return 'Excelente — vantagem competitiva clara'
}
