// ─────────────────────────────────────────────────────────────────────────────
// Shell do Wizard de Oferta Matadora — trilha de passos + corpo + navegação.
// Usado pela página interna (OfertaMatadora) e pela pública (/oferta/:token).
// A tela final é injetada via `finalContent` (interna = IA; pública = envio).
//
// Dois modos (escolha salva em localStorage `oferta.wizard.modo`):
//  • 'uma'  (padrão): uma pergunta por vez; ao fim de cada passo aparece a
//    prévia com tudo que foi preenchido nele (StepReview), com "Editar".
//  • 'tudo': o passo inteiro numa tela só (comportamento antigo).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Check, Eye, ListChecks, Rows3 } from 'lucide-react'
import { STEP_META } from './ofertaShared'
import {
  StepDiagnostico, StepSonho, StepProblemas, StepSolucoes, StepEntrega,
  StepNucleo, StepEscassez, StepBonus, StepGarantia, StepNome,
  StepReview, questionCount,
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

const REVIEW = 'review'
const MODO_KEY = 'oferta.wizard.modo'

function lerModo() {
  try { return localStorage.getItem(MODO_KEY) === 'tudo' ? 'tudo' : 'uma' } catch { return 'uma' }
}
function gravarModo(m) {
  try { localStorage.setItem(MODO_KEY, m) } catch { /* sem storage: só não lembra */ }
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
  const [qIndex, setQIndex] = useState(0)        // número da pergunta ou REVIEW
  const [modo, setModo] = useState(lerModo)
  const autoTimer = useRef(null)
  const topRef = useRef(null)

  useEffect(() => () => clearTimeout(autoTimer.current), [])

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

  const umaPorVez = modo === 'uma'
  const total = isFinal ? 0 : questionCount(step.id, oferta)
  const inReview = umaPorVez && !isFinal && qIndex === REVIEW
  // Se a contagem encolher (ex.: apagou uma objeção), não deixa o índice estourar
  const q = umaPorVez && !isFinal && !inReview ? Math.min(qIndex, Math.max(0, total - 1)) : undefined

  const scrollTop = () => {
    const el = topRef.current
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 16
      if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  const goStep = (i, qi = 0) => {
    clearTimeout(autoTimer.current)
    setStepIndex(Math.max(0, Math.min(meta.length - 1, i)))
    setQIndex(qi)
    scrollTop()
  }
  const goQ = (qi) => {
    clearTimeout(autoTimer.current)
    setQIndex(qi)
    scrollTop()
  }

  // Abrir um passo pela trilha: se já tem resposta, abre direto na prévia
  const openStep = (i) => {
    const id = meta[i].id
    goStep(i, umaPorVez && id !== 'final' && filledMap[id] ? REVIEW : 0)
  }

  const next = () => {
    if (!umaPorVez || isFinal) return goStep(stepIndex + 1)
    if (inReview) return goStep(stepIndex + 1)
    if (q < total - 1) return goQ(q + 1)
    return goQ(REVIEW)
  }

  const prev = () => {
    if (!umaPorVez) return goStep(stepIndex - 1)
    if (inReview) return goQ(Math.max(0, total - 1))
    if (!isFinal && q > 0) return goQ(q - 1)
    if (stepIndex === 0) return
    const prevId = meta[stepIndex - 1].id
    return goStep(stepIndex - 1, prevId === 'final' ? 0 : REVIEW)
  }

  // Escolha única (diagnóstico) avança sozinha, com uma pausa pra ver a marcação
  const avancar = umaPorVez && !inReview && !isFinal
    ? () => { clearTimeout(autoTimer.current); autoTimer.current = setTimeout(next, 350) }
    : undefined

  const trocarModo = (m) => {
    setModo(m); gravarModo(m); setQIndex(0)
  }

  const canPrev = umaPorVez ? !(stepIndex === 0 && (q ?? 0) === 0 && !inReview) : stepIndex > 0
  const nextLabel = !umaPorVez
    ? 'Continuar'
    : inReview
      ? (meta[stepIndex + 1]?.id === 'final' ? (publicMode ? 'Revisar e enviar' : 'Ir para Gerar oferta') : 'Próxima etapa')
      : q === total - 1 ? 'Ver prévia da etapa' : 'Próxima pergunta'

  return (
    <div className="space-y-6" ref={topRef}>
      {/* Trilha de passos */}
      <div className="glass-card p-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 flex-1 min-w-0">
            {meta.map((s, i) => {
              const active = i === stepIndex
              const filled = filledMap[s.id]
              return (
                <button
                  key={s.id}
                  onClick={() => openStep(i)}
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

          {/* Modo de preenchimento */}
          <div className="hidden sm:flex items-center shrink-0 rounded-lg border border-rl-border p-0.5 text-[11px]">
            {[
              { v: 'uma', l: 'Uma por vez', I: ListChecks },
              { v: 'tudo', l: 'Tudo junto', I: Rows3 },
            ].map(({ v, l, I }) => (
              <button
                key={v}
                onClick={() => trocarModo(v)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                  modo === v ? 'bg-rl-gold/15 text-rl-text font-semibold' : 'text-rl-muted hover:text-rl-text'
                }`}
                title={v === 'uma' ? 'Uma pergunta por tela, com prévia no fim de cada etapa' : 'A etapa inteira numa tela só'}
              >
                <I className="w-3.5 h-3.5" /> {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Corpo do passo */}
      <div className="glass-card p-5 lg:p-6">
        <div className="mb-4 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-rl-gold font-semibold">
              Passo {stepIndex} de {meta.length - 1}{step.optional && ' · opcional'}
              {umaPorVez && !isFinal && (
                inReview
                  ? <> · Prévia da etapa</>
                  : <> · Pergunta {q + 1} de {total}</>
              )}
            </p>
            <h3 className="text-lg font-bold text-rl-text flex items-center gap-2">
              {inReview && <Eye className="w-4 h-4 text-rl-gold" />}
              {inReview ? `Prévia: ${step.title}` : step.title}
            </h3>
            <p className="text-xs text-rl-muted">{step.subtitle}</p>
          </div>

          {/* Barra de perguntas da etapa (clicável) + prévia */}
          {umaPorVez && !isFinal && total > 0 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goQ(i)}
                  title={`Pergunta ${i + 1}`}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    !inReview && i === q ? 'bg-rl-gold' : (inReview || i < q) ? 'bg-rl-gold/40' : 'bg-rl-border'
                  }`}
                />
              ))}
              <button
                onClick={() => goQ(REVIEW)}
                title="Prévia da etapa"
                className={`ml-1 flex items-center justify-center w-6 h-6 rounded-full border transition-all ${
                  inReview ? 'border-rl-gold bg-rl-gold/15 text-rl-gold' : 'border-rl-border text-rl-muted hover:text-rl-text'
                }`}
              >
                <Eye className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {isFinal
          ? finalContent
          : inReview
            ? <StepReview stepId={step.id} title={step.title} oferta={oferta} onEdit={goQ} />
            : <StepComp oferta={oferta} set={set} project={project} publicMode={publicMode} q={q} avancar={avancar} />}
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between">
        <button
          onClick={prev}
          disabled={!canPrev}
          className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="flex items-center gap-2">
          {step.optional && !isFinal && !inReview && (
            <button onClick={() => goStep(stepIndex + 1)} className="text-sm text-rl-muted hover:text-rl-text px-3 py-2">
              Pular etapa
            </button>
          )}
          {!isFinal ? (
            <button onClick={next} className="btn-primary flex items-center gap-1.5">
              {nextLabel} <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            finalFooter
          )}
        </div>
      </div>
    </div>
  )
}
