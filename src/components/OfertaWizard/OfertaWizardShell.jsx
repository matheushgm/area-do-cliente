// ─────────────────────────────────────────────────────────────────────────────
// Shell do Wizard de Oferta Matadora — trilha de passos + corpo + navegação.
// Usado pela página interna (OfertaMatadora) e pela pública (/oferta/:token).
// A tela final é injetada via `finalContent` (interna = IA; pública = envio).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { STEP_META } from './ofertaShared'
import {
  StepDiagnostico, StepSonho, StepProblemas, StepSolucoes, StepEntrega,
  StepNucleo, StepEscassez, StepBonus, StepGarantia, StepNome,
} from './StepComponents'

const STEP_COMPONENTS = {
  diagnostico: StepDiagnostico,
  sonho: StepSonho,
  problemas: StepProblemas,
  solucoes: StepSolucoes,
  entrega: StepEntrega,
  nucleo: StepNucleo,
  escassez: StepEscassez,
  bonus: StepBonus,
  garantia: StepGarantia,
  nome: StepNome,
}

// Progresso de preenchimento por passo (checks da trilha)
export function computeFilledMap(oferta) {
  return {
    diagnostico: !!oferta.tipoCliente && (oferta.diagnostico?.answeredCount || 0) > 0,
    sonho: !!oferta.resultadoSonho?.trim(),
    problemas: (oferta.problemas || []).some((p) => p.texto?.trim()),
    solucoes: (oferta.solucoes || []).some((s) => s.comoResolve?.trim()),
    entrega: !!oferta.entrega?.atencao || !!oferta.entrega?.esforcoModelo,
    nucleo: !!oferta.nucleo?.trim() || (oferta.itensStack || []).length > 0,
    escassez: !!oferta.escassez?.trim() || !!oferta.urgencia?.trim(),
    bonus: (oferta.bonus || []).some((b) => b.trim()),
    garantia: !!oferta.garantia?.trim(),
    nome: !!oferta.nome?.trim(),
    final: !!oferta.generatedOffer,
  }
}

export default function OfertaWizardShell({
  oferta, set, project,
  publicMode = false,
  finalContent = null,   // node renderizado na última tela
  finalFooter = null,    // node no rodapé da última tela (ex.: Concluir)
}) {
  const [stepIndex, setStepIndex] = useState(0)

  const meta = useMemo(() => (
    publicMode
      ? STEP_META.map((s) => s.id === 'final'
          ? { ...s, title: 'Revisar e enviar', subtitle: 'Confira e envie para a Revenue Lab' }
          : s)
      : STEP_META
  ), [publicMode])

  const step = meta[stepIndex]
  const isFinal = step.id === 'final'
  const StepComp = STEP_COMPONENTS[step.id]
  const filledMap = useMemo(() => computeFilledMap(oferta), [oferta])

  const goTo = (i) => {
    setStepIndex(Math.max(0, Math.min(meta.length - 1, i)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      {/* Trilha de passos */}
      <div className="glass-card p-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {meta.map((s, i) => {
            const active = i === stepIndex
            const filled = filledMap[s.id]
            return (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all shrink-0 ${
                  active ? 'bg-rl-gold/15 text-rl-text font-semibold' : 'text-rl-muted hover:bg-rl-border/40'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  filled ? 'bg-green-500 text-white' : active ? 'bg-rl-gold text-white' : 'bg-rl-border text-rl-muted'
                }`}>
                  {filled ? <Check className="w-2.5 h-2.5" /> : i}
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
          <p className="text-[11px] uppercase tracking-wide text-rl-gold font-semibold">
            Passo {stepIndex} de {meta.length - 1}{step.optional && ' · opcional'}
          </p>
          <h3 className="text-lg font-bold text-rl-text">{step.title}</h3>
          <p className="text-xs text-rl-muted">{step.subtitle}</p>
        </div>

        {isFinal
          ? finalContent
          : <StepComp oferta={oferta} set={set} project={project} publicMode={publicMode} />}
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
