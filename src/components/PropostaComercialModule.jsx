import { useState, useEffect, useRef, useCallback } from 'react'
import { FileSignature, FileDown } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import { exportPropostaComercialPDF } from '../utils/exportPDF'
import { PROPOSTA_SECTIONS, PROPOSTA_DEFAULTS } from '../lib/propostaComercial'

// Monta o estado inicial: valor salvo tem prioridade; se o campo nunca foi
// salvo (undefined), usa a fala-modelo (default). String vazia salva é mantida,
// permitindo que o usuário apague um default propositalmente.
function buildInitial(saved) {
  const out = {}
  for (const sec of PROPOSTA_SECTIONS) {
    for (const f of sec.campos) {
      out[f.id] = saved[f.id] ?? PROPOSTA_DEFAULTS[f.id] ?? ''
    }
  }
  return out
}

export default function PropostaComercialModule({ project }) {
  const { updateProject } = useApp()
  const saved = project.propostaComercial || {}

  const [data, setData] = useState(() => buildInitial(saved))
  const isMounted = useRef(false)

  // Auto-save: persiste ao alterar qualquer campo (pula o 1º render).
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    updateProject(project.id, {
      propostaComercial: { ...data, updatedAt: new Date().toISOString() },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const set = useCallback((id, val) => {
    setData((prev) => ({ ...prev, [id]: val }))
  }, [])

  const handleExport = () => exportPropostaComercialPDF(project, data)

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-rl-cyan" />
            Proposta Comercial
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            Preencha o roteiro seção por seção e exporte o PDF pra montar sua apresentação.
            Cada bloco vira uma página no PDF, marcada como <strong>Momento</strong> (fala) ou{' '}
            <strong>Slide</strong>.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <AutoSaveIndicator />
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <FileDown className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* ── Seções ─────────────────────────────────────────────────────────── */}
      {PROPOSTA_SECTIONS.map((sec) => {
        const isSlide = sec.tipo === 'SLIDE'
        return (
          <div key={sec.n} className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-extrabold text-rl-cyan tabular-nums">
                {String(sec.n).padStart(2, '0')}
              </span>
              <h3 className="text-base font-bold text-rl-text">{sec.titulo}</h3>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isSlide
                    ? 'bg-rl-purple/15 text-rl-purple border-rl-purple/30'
                    : 'bg-rl-surface text-rl-muted border-rl-border/50'
                }`}
              >
                {isSlide ? 'Slide' : 'Momento'}
              </span>
            </div>

            {sec.descricao && (
              <p className="text-xs text-rl-muted -mt-2 leading-snug">{sec.descricao}</p>
            )}

            <div className="space-y-4">
              {sec.campos.map((f) => (
                <div key={f.id}>
                  <label className="label-field mb-1.5">
                    {f.label}
                    {f.hint && (
                      <span className="ml-2 text-[10px] text-rl-muted font-normal normal-case">
                        {f.hint}
                      </span>
                    )}
                  </label>
                  {f.tipo === 'textarea' ? (
                    <textarea
                      value={data[f.id] || ''}
                      onChange={(e) => set(f.id, e.target.value)}
                      rows={f.rows || 3}
                      className="input-field w-full text-sm resize-none leading-relaxed"
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[f.id] || ''}
                      onChange={(e) => set(f.id, e.target.value)}
                      className="input-field w-full text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <AutoSaveIndicator />
        <button onClick={handleExport} className="btn-primary flex items-center gap-2 text-sm">
          <FileDown className="w-4 h-4" />
          Exportar PDF
        </button>
      </div>
    </div>
  )
}
