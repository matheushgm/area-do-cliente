import { useMemo } from 'react'
import { Map, Check, Clock, Circle, ChevronRight } from 'lucide-react'
import {
  PHASES, getModuleStatus, computeProgress, computePhaseProgress,
} from './jornadaPhases'

// Página de jornada do cliente — vai como primeiro item da sidebar.
// Mostra todas as fases (Preparação / Criação / Campanhas no ar / Primeiros
// resultados) com cards de cada módulo + status individual + barra de
// progresso geral no topo.
//
// Click em um módulo → onNavigate(sectionId, toolId?) — sectionId é o id
// usado no switch de renderContent em ClientProfile. toolId é passado quando
// o módulo está dentro de Ferramentas (Mecanismo Único, Promessa).
export default function JornadaModule({ project, onNavigate }) {
  const progress = useMemo(() => computeProgress(project), [project])
  const companyName = project?.companyName || project?.company_name || 'Cliente'

  function handleClick(mod) {
    if (typeof onNavigate !== 'function') return
    if (mod.viaFerramentas) {
      onNavigate('ferramentas', mod.id)
    } else {
      onNavigate(mod.id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-rl-cyan/10 flex items-center justify-center shrink-0">
          <Map className="w-5 h-5 text-rl-cyan" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-rl-text leading-tight">Jornada</h2>
          <p className="text-sm text-rl-subtle mt-0.5 max-w-2xl">
            Visão completa do projeto de <strong>{companyName}</strong> em 4 fases. Use a Jornada
            como ponto de partida pra saber o que falta atacar.
          </p>
        </div>
      </div>

      {/* Progresso geral */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-rl-text">Progresso geral</h3>
          <span className="text-2xl font-black text-rl-green tabular-nums">{progress.percent}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-rl-surface overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rl-green to-rl-cyan transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-rl-muted">
          <span>
            {progress.done} de {progress.total} etapa{progress.total !== 1 ? 's' : ''} concluída{progress.done !== 1 ? 's' : ''}
            {progress.andamento > 0 && (
              <span className="ml-2 text-rl-gold font-semibold">
                · {progress.andamento} em andamento
              </span>
            )}
          </span>
          {progress.pendente > 0 && (
            <span>
              Próxima: <strong className="text-rl-text">{findNextPending(project)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Fases */}
      {PHASES.map((phase) => (
        <PhaseCard
          key={phase.id}
          phase={phase}
          project={project}
          onClick={handleClick}
        />
      ))}
    </div>
  )
}

// ─── Card de cada fase ────────────────────────────────────────────────────────
function PhaseCard({ phase, project, onClick }) {
  const stats = computePhaseProgress(project, phase)
  const isComplete = stats.done === stats.total

  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-1.5 ${phase.bgClass} ${phase.borderClass}`}
    >
      <div className="p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
              style={{ background: `${phase.accent}15`, color: phase.accent }}
            >
              0{phase.number}
            </div>
            <div>
              <h3 className="text-base font-black text-rl-text leading-tight">
                Fase 0{phase.number}: {phase.title}
              </h3>
              <p className="text-xs text-rl-subtle mt-0.5">{phase.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-rl-muted tabular-nums">
              {stats.done}/{stats.total} concluídas
            </span>
            {phase.badge && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: `${phase.accent}15`, color: phase.accent }}
              >
                {phase.badge}
              </span>
            )}
          </div>
        </div>

        {/* Mini progress bar da fase */}
        <div className="h-1 rounded-full bg-rl-surface overflow-hidden mb-3">
          <div
            className="h-full transition-all"
            style={{
              width: `${stats.total > 0 ? Math.round(((stats.done + stats.andamento * 0.5) / stats.total) * 100) : 0}%`,
              background: phase.accent,
              opacity: isComplete ? 1 : 0.75,
            }}
          />
        </div>

        {/* Lista de módulos */}
        <div className="space-y-2">
          {phase.modules.map((mod, i) => {
            const status = getModuleStatus(project, mod.id)
            return (
              <button
                key={mod.id}
                onClick={() => onClick(mod)}
                className="w-full group flex items-center gap-3 text-left rounded-xl bg-white border border-rl-border hover:border-rl-purple/40 hover:shadow-sm transition-all px-3 py-2.5"
              >
                <div className="text-2xl shrink-0">{mod.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-rl-text leading-tight">
                    <span className="text-[10px] font-mono text-rl-muted mr-2">
                      0{i + 1}
                    </span>
                    {mod.label}
                  </p>
                  <p className="text-[11px] text-rl-subtle mt-0.5 line-clamp-1">
                    {mod.desc}
                  </p>
                </div>
                <StatusBadge status={status} />
                <ChevronRight className="w-4 h-4 text-rl-muted group-hover:text-rl-purple group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Badge de status do módulo ───────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'concluido') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-rl-green/10 text-rl-green border border-rl-green/30 shrink-0 whitespace-nowrap">
        <Check className="w-3 h-3" /> Concluído
      </span>
    )
  }
  if (status === 'andamento') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-rl-gold/10 text-rl-gold border border-rl-gold/30 shrink-0 whitespace-nowrap">
        <Clock className="w-3 h-3" /> Em andamento
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-rl-surface text-rl-muted border border-rl-border shrink-0 whitespace-nowrap">
      <Circle className="w-3 h-3" /> Pendente
    </span>
  )
}

// ─── Helper: próximo módulo pendente ──────────────────────────────────────────
function findNextPending(project) {
  for (const phase of PHASES) {
    for (const mod of phase.modules) {
      const s = getModuleStatus(project, mod.id)
      if (s === 'pendente') return mod.label
    }
  }
  return 'tudo pronto 🎉'
}
