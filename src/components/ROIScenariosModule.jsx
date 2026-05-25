import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Plus, Pencil, Trash2, Check, X, Calculator } from 'lucide-react'
import { useApp } from '../context/AppContext'
import ROICalculator from './ROICalculator'

// Orquestra MÚLTIPLAS calculadoras de ROI (cenários) por cliente.
// Cada cenário: { id, nome, calc, result, createdAt, updatedAt }.
// O primeiro cenário é espelhado em project.roiCalc/roiResult pra manter
// compatibilidade com o onboarding e o status da Jornada.
export default function ROIScenariosModule({ project, onSave }) {
  const { updateProject } = useApp()

  // Estado local: lista de cenários. Seed do legado (roiCalc) se vazio.
  const [cenarios, setCenarios] = useState(() => {
    const existing = Array.isArray(project.roiCenarios) ? project.roiCenarios : []
    if (existing.length) return existing
    const now = new Date().toISOString()
    return [{
      id: crypto.randomUUID(),
      nome: 'Cenário principal',
      calc: project.roiCalc || null,
      result: project.roiResult || null,
      createdAt: now,
      updatedAt: now,
    }]
  })
  const [activeId, setActiveId] = useState(() => (
    Array.isArray(project.roiCenarios) && project.roiCenarios[0]
      ? project.roiCenarios[0].id
      : null
  ))

  // Garante um activeId válido
  const activeScenarioId = useMemo(() => {
    if (activeId && cenarios.some((c) => c.id === activeId)) return activeId
    return cenarios[0]?.id || null
  }, [activeId, cenarios])

  const active = cenarios.find((c) => c.id === activeScenarioId) || cenarios[0] || null

  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  function persist(nextCenarios) {
    setCenarios(nextCenarios)
    const patch = { roiCenarios: nextCenarios }
    // Espelha o primeiro cenário no roiCalc/roiResult (compat onboarding/Jornada)
    const primary = nextCenarios[0]
    if (primary) {
      patch.roiCalc = primary.calc || null
      patch.roiResult = primary.result || null
    }
    updateProject(project.id, patch)
  }

  // Chamado pelo ROICalculator a cada edição do cenário ativo
  function handlePersistActive(calc, result) {
    const next = cenarios.map((c) =>
      c.id === activeScenarioId
        ? { ...c, calc, result, updatedAt: new Date().toISOString() }
        : c
    )
    persist(next)
  }

  function addCenario() {
    const now = new Date().toISOString()
    const novo = {
      id: crypto.randomUUID(),
      nome: `Cenário ${cenarios.length + 1}`,
      calc: null,
      result: null,
      createdAt: now,
      updatedAt: now,
    }
    persist([...cenarios, novo])
    setActiveId(novo.id)
  }

  function deleteCenario(id) {
    if (cenarios.length <= 1) return
    if (!window.confirm('Excluir este cenário de ROI? Essa ação não pode ser desfeita.')) return
    const next = cenarios.filter((c) => c.id !== id)
    persist(next)
    if (activeScenarioId === id) setActiveId(next[0]?.id || null)
  }

  function commitRename(id) {
    const nome = renameValue.trim()
    if (nome) {
      persist(cenarios.map((c) => (c.id === id ? { ...c, nome, updatedAt: new Date().toISOString() } : c)))
    }
    setRenamingId(null)
    setRenameValue('')
  }

  return (
    <div className="space-y-5">
      {/* Tabs de cenários */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 mr-1 text-rl-muted">
          <Calculator className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Cenários</span>
        </div>
        {cenarios.map((c) => {
          const isActive = c.id === activeScenarioId
          const isRenaming = renamingId === c.id
          if (isRenaming) {
            return (
              <div key={c.id} className="flex items-center gap-1 bg-rl-surface border border-rl-purple/40 rounded-xl px-2 py-1">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(c.id)
                    if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                  }}
                  className="bg-transparent text-sm text-rl-text outline-none w-28"
                />
                <button onClick={() => commitRename(c.id)} className="p-0.5 text-rl-green hover:bg-rl-green/10 rounded">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setRenamingId(null); setRenameValue('') }} className="p-0.5 text-rl-muted hover:bg-rl-surface rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          }
          return (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-xl border transition-all ${
                isActive
                  ? 'bg-rl-purple text-white border-rl-purple shadow-glow'
                  : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
              }`}
            >
              <button
                onClick={() => setActiveId(c.id)}
                className="pl-3 pr-1 py-1.5 text-xs font-bold"
              >
                {c.nome}
              </button>
              <div className={`flex items-center pr-1.5 ${isActive ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                <button
                  onClick={() => { setRenamingId(c.id); setRenameValue(c.nome) }}
                  className={`p-1 rounded ${isActive ? 'hover:bg-white/20' : 'hover:bg-rl-bg'}`}
                  title="Renomear"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {cenarios.length > 1 && (
                  <button
                    onClick={() => deleteCenario(c.id)}
                    className={`p-1 rounded ${isActive ? 'hover:bg-white/20' : 'hover:bg-red-400/10 hover:text-red-400'}`}
                    title="Excluir"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <button
          onClick={addCenario}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border border-dashed border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Novo cenário
        </button>
      </div>

      {/* Calculadora do cenário ativo — key força remount ao trocar de cenário */}
      {active && (
        <ROICalculator
          key={active.id}
          project={project}
          onSave={onSave}
          overrideCalc={active.calc || undefined}
          onPersist={handlePersistActive}
        />
      )}
    </div>
  )
}

ROIScenariosModule.propTypes = {
  project: PropTypes.object.isRequired,
  onSave: PropTypes.func,
}
