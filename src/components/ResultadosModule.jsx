import { useCallback } from 'react'
import { BarChart3, Filter } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useDashboardData } from '../hooks/useDashboardData'
import ModelSelector from './Resultados/ModelSelector'
import B2BView from './Resultados/B2BResultados'
import B2CView from './Resultados/B2CResultados'
import ProjectTrafficDashboard from './Resultados/ProjectTrafficDashboard'

// ─── Main Export ───────────────────────────────────────────────────────────────
export default function ResultadosModule({ project }) {
  const { updateProject } = useApp()

  // Fonte NOVA (dash_insights via /api). Carregada UMA vez aqui e compartilhada
  // entre o dashboard de tráfego e o comparativo de canais do funil.
  const dash = useDashboardData({ source: 'api' })

  const resultados = project.resultados || {}
  const modelo = resultados.modelo

  const handleUpdate = (updated) => {
    updateProject(project.id, { resultados: updated })
  }

  const selectModel = (m) => {
    handleUpdate({ ...resultados, modelo: m })
  }

  // ── Token de compartilhamento ──────────────────────────────────────────────
  // Mesmo token usado pelo CRM público e pelo formulário B2C. Quando não
  // existe, geramos um UUID e persistimos no campo `clientShareToken` do
  // project; assim qualquer lugar do app pode chamar `getOrCreateShareToken()`
  // e receber um token válido na hora.
  const getOrCreateShareToken = useCallback(() => {
    if (project.clientShareToken) return project.clientShareToken
    const token = crypto.randomUUID()
    updateProject(project.id, { clientShareToken: token })
    return token
  }, [project.id, project.clientShareToken, updateProject])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* ─── Seção: Resultados de Tráfego (Meta + Google, contas vinculadas) ─── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
            <BarChart3 size={18} className="text-rl-purple" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-rl-text leading-tight">Resultados de Tráfego</h2>
            <p className="text-xs text-rl-muted">Dados reais das contas de anúncio vinculadas a este projeto</p>
          </div>
        </div>
        <ProjectTrafficDashboard project={project} dash={dash} />
      </section>

      {/* ─── Divisória entre Tráfego e Funil ─── */}
      <div className="py-8" role="separator" aria-label="Separação entre resultados de tráfego e de funil">
        <div className="border-t border-rl-border" />
      </div>

      {/* ─── Seção: Resultados do Funil (preenchimento manual B2B/B2C) ─── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rl-blue/10 flex items-center justify-center shrink-0">
              <Filter size={18} className="text-rl-blue" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-rl-text leading-tight">Resultados do Funil</h2>
              <p className="text-xs text-rl-muted">Leads, MQLs, vendas e métricas preenchidas manualmente</p>
            </div>
            {modelo && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                  modelo === 'b2b'
                    ? 'border-rl-blue/30  text-rl-blue  bg-rl-blue/10'
                    : 'border-rl-green/30 text-rl-green bg-rl-green/10'
                }`}
              >
                {modelo === 'b2b' ? '🏢 B2B · Semanal' : '🛒 B2C · Diário'}
              </span>
            )}
          </div>
          {modelo && (
            <button
              onClick={() => handleUpdate({ ...resultados, modelo: null })}
              className="btn-secondary text-xs"
            >
              Trocar Modelo
            </button>
          )}
        </div>

        {!modelo && <ModelSelector onSelect={selectModel} />}

        {modelo === 'b2b' && (
          <B2BView
            resultados={resultados}
            onUpdate={handleUpdate}
            companyName={project.companyName}
            roiCalc={project.roiCalc}
            getOrCreateShareToken={getOrCreateShareToken}
            dash={dash}
            projectId={project.id}
          />
        )}

        {modelo === 'b2c' && (
          <B2CView
            resultados={resultados}
            onUpdate={handleUpdate}
            clientShareToken={project.clientShareToken}
            getOrCreateShareToken={getOrCreateShareToken}
            companyName={project.companyName}
            roiCalc={project.roiCalc}
            dash={dash}
            projectId={project.id}
          />
        )}
      </section>
    </div>
  )
}
