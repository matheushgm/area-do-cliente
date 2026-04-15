import { useApp } from '../context/AppContext'
import ModelSelector from './Resultados/ModelSelector'
import B2BView from './Resultados/B2BResultados'
import B2CView from './Resultados/B2CResultados'

// ─── Main Export ───────────────────────────────────────────────────────────────
export default function ResultadosModule({ project }) {
  const { updateProject } = useApp()

  const resultados = project.resultados || {}
  const modelo     = resultados.modelo

  const handleUpdate = (updated) => {
    updateProject(project.id, { resultados: updated })
  }

  const selectModel = (m) => {
    handleUpdate({ ...resultados, modelo: m })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-rl-text">Resultados</h2>
          {modelo && (
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border mt-1.5 ${
              modelo === 'b2b'
                ? 'border-rl-blue/30  text-rl-blue  bg-rl-blue/10'
                : 'border-rl-green/30 text-rl-green bg-rl-green/10'
            }`}>
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
        <B2BView resultados={resultados} onUpdate={handleUpdate} companyName={project.companyName} roiCalc={project.roiCalc} />
      )}

      {modelo === 'b2c' && (
        <B2CView
          resultados={resultados}
          onUpdate={handleUpdate}
          clientShareToken={project.clientShareToken}
          companyName={project.companyName}
        />
      )}
    </div>
  )
}
