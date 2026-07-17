import { useState, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import { Zap, FileDown, ChevronLeft, ChevronRight, CheckCircle2, Check } from 'lucide-react'
import { exportOfertaPDF } from '../utils/exportPDF'
import { streamClaude } from '../lib/claude'
import VideoGuide from '../components/VideoGuide'
import {
  hydrateOferta, STEP_META, GOM_SYSTEM_PROMPT, buildFinalPrompt,
} from '../components/OfertaWizard/ofertaShared'
import {
  StepDiagnostico, StepSonho, StepProblemas, StepSolucoes, StepEntrega,
  StepNucleo, StepEscassez, StepBonus, StepGarantia, StepNome, StepFinal,
} from '../components/OfertaWizard/StepComponents'

// Mapa id do passo → componente
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

export default function OfertaMatadora({ project, onSave }) {
  const { updateProject } = useApp()
  const [oferta, setOferta] = useState(() => hydrateOferta(project.ofertaData))
  const [stepIndex, setStepIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = useCallback((field, val) => {
    setOferta((prev) => {
      const next = { ...prev, [field]: val }
      updateProject(project.id, { ofertaData: next })
      return next
    })
  }, [project.id, updateProject])

  const step = STEP_META[stepIndex]
  const isFinal = step.id === 'final'
  const StepComp = STEP_COMPONENTS[step.id]

  // Progresso simples de preenchimento por passo (para os checks da barra)
  const filledMap = useMemo(() => ({
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
  }), [oferta])

  const hasContent = STEP_META.some((s) => filledMap[s.id] && s.id !== 'final')

  const generate = async () => {
    setLoading(true); setError(null)
    set('generatedOffer', '')
    try {
      const fullText = await streamClaude({
        model: 'claude-sonnet-4-5',
        max_tokens: 16000,
        system: [{ type: 'text', text: GOM_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildFinalPrompt(project, oferta) }],
        onChunk: (text) => set('generatedOffer', text),
      })
      updateProject(project.id, { ofertaData: { ...oferta, generatedOffer: fullText } })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const goTo = (i) => setStepIndex(Math.max(0, Math.min(STEP_META.length - 1, i)))

  return (
    <div className="space-y-6">
      <VideoGuide videoId="wMgDhGb8aAw" label="Como preencher o módulo de Oferta Matadora" />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <Zap className="w-5 h-5 text-rl-gold" /> Oferta Matadora
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            Linha de produção passo-a-passo baseada em $100M Offers (Alex Hormozi)
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <AutoSaveIndicator />
          <button
            onClick={() => exportOfertaPDF(oferta, project)}
            disabled={!hasContent}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar PDF"
          >
            <FileDown className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Stepper — trilha de passos */}
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
            Passo {stepIndex} de {STEP_META.length - 1}{step.optional && ' · opcional'}
          </p>
          <h3 className="text-lg font-bold text-rl-text">{step.title}</h3>
          <p className="text-xs text-rl-muted">{step.subtitle}</p>
        </div>

        {isFinal ? (
          <StepFinal
            onGenerate={generate}
            loading={loading}
            error={error}
            generatedOffer={oferta.generatedOffer}
          />
        ) : (
          <StepComp oferta={oferta} set={set} project={project} />
        )}
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
            onSave && (
              <button
                onClick={() => onSave(oferta)}
                disabled={!hasContent}
                className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" /> Concluir Oferta Matadora
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
