import { useState } from 'react'
import { History, ChevronDown, ChevronUp, Trash2, FileDown } from 'lucide-react'
import RatingSelector from '../RatingSelector'
import ResultBlock, { replaceAdInContent } from './ResultBlock'
import { exportCreativoSetPDF } from '../../lib/creativoPDF'

export default function CreativeHistory({ project, updateProject }) {
  const allCreatives = (project.creatives || []).slice().reverse() // newest first
  const [expandedId,  setExpandedId]  = useState(null)
  const [showAll,     setShowAll]     = useState(false)
  const [exportingId, setExportingId] = useState(null)

  if (!allCreatives.length) return null

  const visible = showAll ? allCreatives : allCreatives.slice(0, 5)
  const companyName = project.companyName || project.company_name || 'Cliente'

  function handleRating(id, rating) {
    const updated = (project.creatives || []).map((c) =>
      c.id === id ? { ...c, rating } : c
    )
    updateProject(project.id, { creatives: updated })
  }

  function handleDelete(id) {
    const updated = (project.creatives || []).filter((c) => c.id !== id)
    updateProject(project.id, { creatives: updated })
  }

  async function handleExport(creative) {
    setExportingId(creative.id)
    try {
      exportCreativoSetPDF({ creative, companyName })
    } finally {
      setExportingId(null)
    }
  }

  function handleChunkEdit(creative, chunkIndex, newContent) {
    const newFullContent = replaceAdInContent(creative.content, chunkIndex, newContent)
    const updated = (project.creatives || []).map((c) =>
      c.id === creative.id ? { ...c, content: newFullContent } : c
    )
    updateProject(project.id, { creatives: updated })
  }

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-rl-muted" />
        <h3 className="text-sm font-semibold text-rl-text">Histórico de Criativos</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-surface text-rl-muted border border-rl-border">
          {allCreatives.length}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[120px_88px_1fr_36px_auto_72px] gap-3 px-4 py-2.5 bg-rl-surface/60 border-b border-rl-border text-[10px] font-bold text-rl-muted uppercase tracking-wider">
          <span>Data</span>
          <span>Tipo</span>
          <span>Tipos de Anúncio</span>
          <span className="text-center">Qtd</span>
          <span>Resultado</span>
          <span />
        </div>

        {/* Rows */}
        {visible.map((c) => (
          <div key={c.id}>
            {/* Row */}
            <div className="px-4 py-3 border-b border-rl-border/40 flex flex-col sm:grid sm:grid-cols-[120px_88px_1fr_36px_auto_72px] gap-2 sm:gap-3 sm:items-center">
              {/* Date */}
              <span className="text-[10px] text-rl-muted">{fmtDate(c.createdAt)}</span>

              {/* Type badge */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit ${
                c.type === 'video'
                  ? 'text-rl-purple bg-rl-purple/10 border-rl-purple/30'
                  : 'text-rl-blue bg-rl-blue/10 border-rl-blue/30'
              }`}>
                {c.type === 'video' ? '🎬 Vídeo' : '🖼️ Estático'}
              </span>

              {/* Ad type chips */}
              <div className="flex flex-wrap gap-1 min-w-0">
                {(c.adTypeLabels || []).slice(0, 4).map((label) => (
                  <span key={label} className="text-[9px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted">
                    {label}
                  </span>
                ))}
                {(c.adTypeLabels || []).length > 4 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted">
                    +{c.adTypeLabels.length - 4}
                  </span>
                )}
              </div>

              {/* Quantity */}
              <span className="text-xs font-bold text-rl-text text-center">{c.quantity}</span>

              {/* Rating */}
              <RatingSelector value={c.rating} onChange={(r) => handleRating(c.id, r)} />

              {/* Actions */}
              <div className="flex items-center gap-1 justify-end">
                {/* Export PDF */}
                <button
                  onClick={() => handleExport(c)}
                  disabled={exportingId === c.id}
                  title="Exportar criativos desta geração em PDF"
                  className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all disabled:opacity-40"
                  aria-label="Exportar PDF"
                >
                  <FileDown className="w-3.5 h-3.5" />
                </button>

                {/* Expand */}
                <button
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
                  aria-label={expandedId === c.id ? 'Ocultar conteúdo' : 'Ver conteúdo'}
                  title="Ver conteúdo"
                >
                  {expandedId === c.id
                    ? <ChevronUp className="w-3.5 h-3.5" />
                    : <ChevronDown className="w-3.5 h-3.5" />
                  }
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                  aria-label="Excluir criativo"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {expandedId === c.id && (
              <div className="px-4 py-5 bg-rl-surface/20 border-b border-rl-border/40">
                {c.customNote && (
                  <div className="mb-4 rounded-xl bg-rl-purple/5 border border-rl-purple/20 px-4 py-3">
                    <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-1">Direção criativa aplicada</p>
                    <p className="text-xs text-rl-text italic">"{c.customNote}"</p>
                  </div>
                )}
                <ResultBlock
                  content={c.content}
                  type={c.type}
                  companyName={companyName}
                  onChunkChange={(chunkIndex, newContent) => handleChunkEdit(c, chunkIndex, newContent)}
                />
              </div>
            )}
          </div>
        ))}

        {/* Show more / less */}
        {allCreatives.length > 5 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="w-full px-4 py-3 text-xs text-rl-muted hover:text-rl-text transition-colors text-center"
          >
            {showAll ? '▲ Mostrar menos' : `▼ Ver mais ${allCreatives.length - 5} entradas`}
          </button>
        )}
      </div>
    </div>
  )
}
