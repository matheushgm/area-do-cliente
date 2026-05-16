import { useCallback, useMemo, useState } from 'react'
import {
  Compass, ChevronLeft, ChevronRight, Sparkles, Building2, Users, Layers,
  CheckCircle2,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { getQuestionsFor, PILLARS } from './KickoffQuestions'
import { fullDiagnosis } from './KickoffScorer'
import KickoffQuestionForm from './KickoffQuestionForm'
import KickoffResultView from './KickoffResultView'
import { exportKickoffPDF } from '../../lib/kickoffPDF'
import { useToast } from '../../hooks/useToast'
import Toast from '../UI/Toast'

const BUSINESS_OPTIONS = [
  {
    value: 'b2b',
    label: 'B2B',
    desc: 'Vende para outras empresas (PJ). Ciclo de venda complexo, ticket alto.',
    Icon: Building2,
    color: 'rl-blue',
  },
  {
    value: 'b2c',
    label: 'B2C',
    desc: 'Vende para pessoas físicas (PF). Volume alto, decisão mais rápida.',
    Icon: Users,
    color: 'rl-green',
  },
  {
    value: 'hibrido',
    label: 'Híbrido',
    desc: 'Vende para PF e PJ. Diagnóstico cobre as duas trilhas.',
    Icon: Layers,
    color: 'rl-purple',
  },
]

export default function KickoffModule({ project }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()

  // Carrega kickoff existente (se houver) ou estado vazio
  const persisted = project.kickoff || null
  const [phase, setPhase] = useState(persisted?.completedAt ? 'result' : 'intro')
  const [businessType, setBusinessType] = useState(persisted?.businessType || null)
  const [answers, setAnswers] = useState(persisted?.answers || {})
  const [stepIndex, setStepIndex] = useState(0)

  // Lista de perguntas conforme tipo
  const allQuestions = useMemo(
    () => (businessType ? getQuestionsFor(businessType) : []),
    [businessType]
  )
  // Aplica showWhen para filtrar perguntas condicionais
  const questions = useMemo(
    () => allQuestions.filter((q) => !q.showWhen || q.showWhen(answers)),
    [allQuestions, answers]
  )

  // Clamp do step ao tamanho atual da lista (sem useEffect — evita cascading render)
  const safeStepIndex = questions.length > 0
    ? Math.min(stepIndex, questions.length - 1)
    : 0

  // ── Diagnóstico computado ─────────────────────────────────────────────────
  const diagnosis = useMemo(() => {
    if (!businessType) return null
    return fullDiagnosis(answers, allQuestions, businessType)
  }, [answers, allQuestions, businessType])

  // ── Persistência ──────────────────────────────────────────────────────────
  const persist = useCallback(
    (patch) => {
      const merged = {
        ...persisted,
        businessType,
        answers,
        ...patch,
        updatedAt: new Date().toISOString(),
      }
      updateProject(project.id, { kickoff: merged })
      return merged
    },
    [persisted, businessType, answers, updateProject, project.id]
  )

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleChooseType(type) {
    setBusinessType(type)
    setAnswers((prev) => prev || {})
    setPhase('questions')
    setStepIndex(0)
  }

  function setAnswer(qId, value) {
    setAnswers((prev) => ({ ...prev, [qId]: value }))
  }

  function nextStep() {
    if (safeStepIndex < questions.length - 1) {
      setStepIndex(safeStepIndex + 1)
    } else {
      finish()
    }
  }

  function prevStep() {
    if (safeStepIndex > 0) setStepIndex(safeStepIndex - 1)
    else setPhase('intro')
  }

  function finish() {
    // Calcula tudo de novo já com os ids dos pilares textuais e persiste.
    const d = fullDiagnosis(answers, allQuestions, businessType)
    persist({
      scores:     d.scores,
      totalScore: d.totalScore,
      stageId:    d.stageId,
      stageLabel: d.stageLabel,
      stageColor: d.stageColor,
      stageDesc:  d.stageDesc,
      weaknesses: d.weaknesses,
      nextSteps:  d.nextSteps,
      completedAt: persisted?.completedAt || new Date().toISOString(),
    })
    setPhase('result')
    showToast('Diagnóstico salvo!')
  }

  function restart() {
    if (!window.confirm('Refazer o diagnóstico do zero apaga as respostas atuais. Continuar?')) return
    setAnswers({})
    setBusinessType(null)
    setStepIndex(0)
    setPhase('intro')
    updateProject(project.id, { kickoff: null })
  }

  function editAnswers() {
    setPhase('questions')
    setStepIndex(0)
  }

  function saveAi(markdown) {
    const next = persist({ aiAnalysis: markdown })
    // Garante que o estado local também tenha o aiAnalysis pro PDF / re-render
    if (next) {
      // o updateProject persiste; o realtime/local update já refresca o project
    }
    showToast('Análise IA salva!')
  }

  function exportPdf() {
    // Usa o diagnosis fresco (caso o user tenha editado uma resposta sem refinalizar)
    const merged = {
      ...(persisted || {}),
      businessType,
      answers,
      scores:     diagnosis?.scores ?? {},
      totalScore: diagnosis?.totalScore ?? 0,
      stageId:    diagnosis?.stageId ?? 0,
      stageLabel: diagnosis?.stageLabel ?? '',
      stageColor: diagnosis?.stageColor ?? '#7C3AED',
      stageDesc:  diagnosis?.stageDesc ?? '',
      weaknesses: diagnosis?.weaknesses ?? [],
      nextSteps:  diagnosis?.nextSteps ?? [],
      aiAnalysis: persisted?.aiAnalysis || null,
    }
    exportKickoffPDF({ project, kickoff: merged })
  }

  // ── Views ─────────────────────────────────────────────────────────────────

  // — Intro
  if (phase === 'intro') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-rl-cyan" />
          <h2 className="text-xl font-bold text-rl-text">Kickoff — Diagnóstico inicial</h2>
        </div>

        <div className="glass-card p-6 space-y-4">
          <p className="text-sm text-rl-text leading-relaxed">
            Um questionário guiado pra primeira reunião com o cliente. Você responde junto com ele
            e ao final ganhamos um score em 9 pilares fundamentais, um estágio de maturidade do negócio
            e um mapa visual de fraquezas — tudo exportável em PDF.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PILLARS.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs text-rl-muted">
                <CheckCircle2 className="w-3.5 h-3.5 text-rl-green shrink-0" />
                {p.label}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-rl-text mb-3">Como o cliente vende?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {BUSINESS_OPTIONS.map((opt) => {
              const Icon = opt.Icon
              return (
                <button
                  key={opt.value}
                  onClick={() => handleChooseType(opt.value)}
                  className={`glass-card p-5 text-left hover:border-${opt.color}/50 hover:shadow-glow transition-all duration-200 group`}
                >
                  <div className={`w-11 h-11 rounded-xl bg-${opt.color}/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-5 h-5 text-${opt.color}`} />
                  </div>
                  <h4 className="text-base font-bold text-rl-text mb-1">{opt.label}</h4>
                  <p className="text-xs text-rl-muted leading-relaxed">{opt.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {persisted?.completedAt && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-rl-purple/5 border border-rl-purple/30">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-rl-purple" />
              <span className="text-rl-text">Já existe um diagnóstico anterior salvo.</span>
            </div>
            <button
              onClick={() => setPhase('result')}
              className="text-xs px-3 py-1.5 rounded-lg bg-rl-purple text-white font-semibold hover:bg-rl-purple/90 transition-all"
            >
              Abrir
            </button>
          </div>
        )}

        <Toast toast={toast} />
      </div>
    )
  }

  // — Questions
  if (phase === 'questions') {
    const q = questions[safeStepIndex]
    const total = questions.length
    const answered = q ? (answers[q.id] != null && answers[q.id] !== '' && !(Array.isArray(answers[q.id]) && !answers[q.id].length)) : false
    return (
      <div className="space-y-5">
        {/* Header com progresso */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={prevStep}
            className="flex items-center gap-1 text-xs text-rl-muted hover:text-rl-text transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="text-xs text-rl-muted font-semibold">
            Pergunta {safeStepIndex + 1} de {total}
          </div>
          <div className="flex-1" />
        </div>

        {/* Barra de progresso */}
        <div className="h-1.5 rounded-full bg-rl-surface overflow-hidden">
          <div
            className="h-full bg-gradient-rl transition-all"
            style={{ width: `${((safeStepIndex + 1) / total) * 100}%` }}
          />
        </div>

        {/* Pergunta */}
        <div className="glass-card p-6">
          {q ? (
            <KickoffQuestionForm
              question={q}
              value={answers[q.id]}
              onChange={(v) => setAnswer(q.id, v)}
            />
          ) : (
            <p className="text-sm text-rl-muted">Sem perguntas para este tipo.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={prevStep}
            disabled={safeStepIndex === 0}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Anterior
          </button>

          <p className="text-[10px] text-rl-muted">
            {answered ? '✓ Respondida' : 'Você pode pular e voltar depois'}
          </p>

          {safeStepIndex < questions.length - 1 ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={finish}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-green text-white shadow-glow hover:bg-rl-green/90 transition-all"
            >
              <Sparkles className="w-4 h-4" /> Ver diagnóstico
            </button>
          )}
        </div>

        <Toast toast={toast} />
      </div>
    )
  }

  // — Result
  return (
    <>
      <KickoffResultView
        project={project}
        kickoff={{
          businessType,
          ...(persisted || {}),
          scores:     diagnosis?.scores ?? {},
          totalScore: diagnosis?.totalScore ?? 0,
          stageId:    diagnosis?.stageId ?? 0,
          stageLabel: diagnosis?.stageLabel ?? '',
          stageColor: diagnosis?.stageColor ?? '#7C3AED',
          stageDesc:  diagnosis?.stageDesc ?? '',
          weaknesses: diagnosis?.weaknesses ?? [],
          nextSteps:  diagnosis?.nextSteps ?? [],
          aiAnalysis: persisted?.aiAnalysis || null,
        }}
        questions={allQuestions}
        onRestart={restart}
        onEdit={editAnswers}
        onSaveAi={saveAi}
        onExportPdf={exportPdf}
      />
      <Toast toast={toast} />
    </>
  )
}
