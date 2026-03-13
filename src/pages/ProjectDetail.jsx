import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  ArrowLeft, Zap, Calculator, Target, Lock, CheckCircle2,
  TrendingUp, Users, PartyPopper, FileText,
} from 'lucide-react'
import PersonaCreator from './PersonaCreator'
import OfertaMatadora from './OfertaMatadora'
import ClientProfile from './ClientProfile'
import ROICalculator from '../components/ROICalculator'

// ─── Journey Steps ────────────────────────────────────────────────────────────
const JOURNEY_STEPS = [
  { id: 'roi',      label: 'Calculadora de ROI', icon: Calculator, xp: 150 },
  { id: 'strategy', label: 'Criação de ICP',     icon: Target,     xp: 200 },
  { id: 'oferta',   label: 'Oferta Matadora',    icon: Zap,        xp: 200 },
  { id: 'profile',  label: 'Perfil do Cliente',  icon: Users,      xp: 0   },
]

const CORE_STEPS = ['roi', 'strategy', 'oferta']

// ─── Conclusion Modal ─────────────────────────────────────────────────────────
function ConclusionModal({ project, onViewProfile, onDashboard }) {
  const personaCount = project.personas?.length || 0
  const ofertaNome   = project.ofertaData?.nome

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-8 border border-rl-green/40 animate-slide-up shadow-2xl text-center">

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-rl-green/10 border border-rl-green/30 flex items-center justify-center mx-auto mb-5">
          <PartyPopper className="w-8 h-8 text-rl-green" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-rl-text mb-1">Onboarding Concluído!</h2>
        <p className="text-sm text-rl-muted mb-6">
          O perfil de <span className="font-semibold text-rl-text">{project.companyName}</span> está pronto.
        </p>

        {/* Summary chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <div className="flex items-center gap-1.5 bg-rl-purple/10 border border-rl-purple/20 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 text-rl-purple" />
            <span className="text-xs font-medium text-rl-purple">ROI Calculado</span>
          </div>
          {personaCount > 0 && (
            <div className="flex items-center gap-1.5 bg-rl-blue/10 border border-rl-blue/20 px-3 py-1.5 rounded-full">
              <Users className="w-3.5 h-3.5 text-rl-blue" />
              <span className="text-xs font-medium text-rl-blue">
                {personaCount} Persona{personaCount > 1 ? 's' : ''} criada{personaCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {ofertaNome && (
            <div className="flex items-center gap-1.5 bg-rl-gold/10 border border-rl-gold/20 px-3 py-1.5 rounded-full">
              <Zap className="w-3.5 h-3.5 text-rl-gold" />
              <span className="text-xs font-medium text-rl-gold truncate max-w-[160px]">{ofertaNome}</span>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onViewProfile}
            className="btn-primary flex items-center justify-center gap-2 w-full"
          >
            <FileText className="w-4 h-4" />
            Ver Perfil do Cliente
          </button>
          <button
            onClick={onDashboard}
            className="btn-ghost w-full"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { projects, updateProject } = useApp()

  const project = projects.find((p) => String(p.id) === String(id))

  const [activeStep, setActiveStep] = useState('roi')
  const [showConclusion, setShowConclusion] = useState(false)

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-rl-muted text-lg">Projeto não encontrado.</p>
          <button onClick={() => navigate('/')} className="btn-primary mt-4">
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    )
  }

  const completedSteps = project.completedSteps || []
  const allDone = CORE_STEPS.every(s => completedSteps.includes(s))

  // ── Modo Perfil Puro (onboarding completo) ────────────────────────────────
  if (allDone && !showConclusion) {
    return (
      <div className="min-h-screen bg-gradient-dark">
        <nav className="sticky top-0 z-50 border-b border-rl-border bg-rl-bg/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all duration-150"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rl-green/15 border border-rl-green/30 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-rl-green" />
              </div>
              <span className="font-semibold text-rl-text">{project.companyName}</span>
              <span className="text-rl-border text-lg leading-none">|</span>
              <span className="text-rl-muted text-sm">{project.responsibleName}</span>
            </div>
            <div className="ml-auto">
              <span className="text-xs bg-rl-green/10 text-rl-green border border-rl-green/30 px-2.5 py-1 rounded-full font-medium">
                Perfil Completo
              </span>
            </div>
          </div>
        </nav>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <ClientProfile project={project} />
        </div>
      </div>
    )
  }

  function calcProgress(done) {
    return Math.min(100, Math.round((done.filter(s => CORE_STEPS.includes(s)).length / CORE_STEPS.length) * 100))
  }

  function handleSaveROI(calcData, resultData) {
    const alreadyDone = completedSteps.includes('roi')
    const newCompleted = alreadyDone ? completedSteps : [...completedSteps, 'roi']
    updateProject(project.id, {
      roiCalc: calcData,
      roiResult: resultData,
      completedSteps: newCompleted,
      progress: calcProgress(newCompleted),
    })
    setActiveStep('strategy')
  }

  function handleSaveStrategy(personasData) {
    const alreadyDone = completedSteps.includes('strategy')
    const newCompleted = alreadyDone ? completedSteps : [...completedSteps, 'strategy']
    updateProject(project.id, {
      personas: personasData,
      completedSteps: newCompleted,
      progress: calcProgress(newCompleted),
    })
    setActiveStep('oferta')
  }

  function handleSaveOferta(ofertaData) {
    const alreadyDone = completedSteps.includes('oferta')
    const newCompleted = alreadyDone ? completedSteps : [...completedSteps, 'oferta']
    updateProject(project.id, {
      ofertaData,
      completedSteps: newCompleted,
      progress: calcProgress(newCompleted),
    })
    if (!alreadyDone) {
      setShowConclusion(true)
    } else {
      setActiveStep('profile')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 border-b border-rl-border bg-rl-bg/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all duration-150"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-rl flex items-center justify-center shadow-glow">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-rl-text">{project.companyName}</span>
            <span className="text-rl-border text-lg leading-none">|</span>
            <span className="text-rl-muted text-sm">{project.responsibleName}</span>
          </div>
          <div className="ml-auto">
            <span className="text-xs bg-rl-cyan/10 text-rl-cyan border border-rl-cyan/30 px-2.5 py-1 rounded-full font-medium">
              {project.progress ?? 0}% concluído
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-6">
        {/* ── Sidebar Journey ─────────────────── */}
        <aside className="w-64 shrink-0">
          <div className="glass-card p-4 sticky top-24">
            <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">
              Jornada de Onboarding
            </p>
            <div className="space-y-1">
              {JOURNEY_STEPS.map((step, i) => {
                const done    = completedSteps.includes(step.id)
                const active  = activeStep === step.id
                const allCoreDone = CORE_STEPS.every(s => completedSteps.includes(s))
                const locked  = done ? false : (
                  step.id === 'profile'
                    ? !allCoreDone
                    : (i > 0 && !completedSteps.includes(JOURNEY_STEPS[i - 1].id))
                )
                const Icon    = step.icon

                return (
                  <button
                    key={step.id}
                    onClick={() => !locked && setActiveStep(step.id)}
                    disabled={locked}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-150 ${
                      active
                        ? 'bg-gradient-rl text-white shadow-glow'
                        : done
                        ? 'bg-rl-green/10 text-rl-green hover:bg-rl-green/20'
                        : locked
                        ? 'text-rl-muted/40 cursor-not-allowed'
                        : 'text-rl-muted hover:bg-rl-surface hover:text-rl-text'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      active ? 'bg-white/20' : done ? 'bg-rl-green/20' : 'bg-rl-surface'
                    }`}>
                      {done && !active ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : locked ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{step.label}</p>
                      <p className={`text-[10px] ${active ? 'text-white/70' : 'text-rl-muted'}`}>
                        {step.xp > 0 ? `+${step.xp} XP` : 'Dashboard'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Progress bar */}
            <div className="mt-4 pt-4 border-t border-rl-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-rl-muted">Progresso</span>
                <span className="text-xs font-semibold text-rl-purple">{project.progress ?? 0}%</span>
              </div>
              <div className="h-1.5 bg-rl-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-rl rounded-full progress-fill"
                  style={{ width: `${project.progress ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────── */}
        <main className="flex-1 min-w-0 animate-slide-up">
          {activeStep === 'roi' && (
            <ROICalculator project={project} onSave={handleSaveROI} />
          )}
          {activeStep === 'strategy' && (
            <PersonaCreator project={project} onSave={handleSaveStrategy} />
          )}
          {activeStep === 'oferta' && (
            <OfertaMatadora project={project} onSave={handleSaveOferta} />
          )}
          {activeStep === 'profile' && (
            <ClientProfile project={project} />
          )}
        </main>
      </div>

      {showConclusion && (
        <ConclusionModal
          project={project}
          onViewProfile={() => setShowConclusion(false)}
          onDashboard={() => navigate('/')}
        />
      )}
    </div>
  )
}
