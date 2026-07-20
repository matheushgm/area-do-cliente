// ─────────────────────────────────────────────────────────────────────────────
// Shell do Wizard de Mecanismo Único — trilha de passos + corpo + navegação.
// Usado pelo módulo interno (visão "Guiado") e pela página pública
// /mecanismo/:token. A tela final é injetada via `finalContent`.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { STEP_META, computeFilledMap } from './mecanismoShared'
import {
  StepConcorrentes, StepMercado, StepTentativas, StepVilao, StepProva,
  StepDiferente, StepNome, StepPorque, StepMontagem, StepValidacao,
} from './WizardSteps'

const STEP_COMPONENTS = {
  concorrentes: StepConcorrentes,
  mercado:      StepMercado,
  tentativas:   StepTentativas,
  vilao:        StepVilao,
  prova:        StepProva,
  diferente:    StepDiferente,
  nome:         StepNome,
  porque:       StepPorque,
  montagem:     StepMontagem,
  validacao:    StepValidacao,
}

export default function MecanismoWizardShell({
  data, set, setNested,
  finalContent = null,   // node renderizado na última tela
  finalFooter = null,    // node no rodapé da última tela (ex.: Enviar)
}) {
  const [stepIndex, setStepIndex] = useState(0)

  const step = STEP_META[stepIndex]
  const isFinal = step.id === 'final'
  const StepComp = STEP_COMPONENTS[step.id]
  const filledMap = useMemo(() => computeFilledMap(data), [data])

  const goTo = (i) => {
    setStepIndex(Math.max(0, Math.min(STEP_META.length - 1, i)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      {/* Trilha de passos */}
      <div className="glass-card p-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEP_META.map((s, i) => {
            const active = i === stepIndex
            const filled = filledMap[s.id]
            return (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all shrink-0 ${
                  active ? 'bg-rl-purple/15 text-rl-text font-semibold' : 'text-rl-muted hover:bg-rl-border/40'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  filled ? 'bg-green-500 text-white' : active ? 'bg-rl-purple text-white' : 'bg-rl-border text-rl-muted'
                }`}>
                  {filled ? <Check className="w-2.5 h-2.5" /> : i + 1}
                </span>
                {s.title}
              </button>
            )
          })}
        </div>
      </div>

      {/* Corpo do passo */}
      <div className="glass-card p-5 lg:p-6">
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-wide text-rl-purple font-semibold">
            Passo {stepIndex + 1} de {STEP_META.length}{step.optional && ' · opcional'}
          </p>
          <h3 className="text-lg font-bold text-rl-text">{step.title}</h3>
          <p className="text-xs text-rl-muted">{step.subtitle}</p>
        </div>

        {isFinal
          ? finalContent
          : <StepComp data={data} set={set} setNested={setNested} />}
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => goTo(stepIndex - 1)}
          disabled={stepIndex === 0}
          className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="flex items-center gap-2">
          {step.optional && !isFinal && (
            <button onClick={() => goTo(stepIndex + 1)} className="text-sm text-rl-muted hover:text-rl-text px-3 py-2">
              Pular
            </button>
          )}
          {!isFinal ? (
            <button onClick={() => goTo(stepIndex + 1)} className="btn-primary flex items-center gap-1.5">
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            finalFooter
          )}
        </div>
      </div>
    </div>
  )
}
