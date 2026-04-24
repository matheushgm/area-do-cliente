import { useState } from 'react'
import {
  History, Trash2, FileDown,
  Pencil, Check, X as XIcon, Link2,
} from 'lucide-react'
import RatingSelector from '../RatingSelector'
import { exportCreativoSetPDF } from '../../lib/creativoPDF'

export default function CreativeHistory({ project, updateProject, onOpen }) {
  const allCreatives = (project.creatives || []).slice().reverse()
  const [showAll,       setShowAll]       = useState(false)
  const [exportingId,   setExportingId]   = useState(null)
  const [editingNameId, setEditingNameId] = useState(null)
  const [nameInput,     setNameInput]     = useState('')

  if (!allCreatives.length) return null

  const visible = showAll ? allCreatives : allCreatives.slice(0, 5)
  const companyName = project.companyName || project.company_name || 'Cliente'

  // Flatten campaigns from plan for the campaign-link selector
  const STAGE_LABELS = { topo: 'Topo', meio: 'Meio', fundo: 'Fundo' }
  const allCampaigns = (() => {
    const result = []
    for (const account of (project.campaignPlan?.accounts || [])) {
      for (const channel of (account.channels || [])) {
        for (const stageKey of ['topo', 'meio', 'fundo']) {
          for (const camp of (channel.stages?.[stageKey]?.campaigns || [])) {
            if (camp.name?.trim()) {
              result.push({
                id:      camp.id,
                name:    camp.name.trim(),
                channel: channel.name,
                stage:   STAGE_LABELS[stageKey],
              })
            }
          }
        }
      }
    }
    return result
  })()

  function getDefaultName(c) {
    const prefix = c.type === 'video' ? 'Vídeo' : 'Estático'
    const types  = (c.adTypeLabels || []).slice(0, 2).join(', ')
    return types ? `${prefix} — ${types}` : prefix
  }

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function patch(id, fields) {
    const updated = (project.creatives || []).map((c) =>
      c.id === id ? { ...c, ...fields } : c
    )
    updateProject(project.id, { creatives: updated })
  }

  function handleRating(id, rating)           { patch(id, { rating }) }
  function handleCampaignLink(id, campaignId) { patch(id, { campaignId: campaignId || null }) }

  function handleDelete(e, id) {
    e.stopPropagation()
    updateProject(project.id, {
      creatives: (project.creatives || []).filter((c) => c.id !== id),
    })
  }

  async function handleExport(e, creative) {
    e.stopPropagation()
    setExportingId(creative.id)
    try { exportCreativoSetPDF({ creative, companyName }) }
    finally { setExportingId(null) }
  }

  function startEditName(e, c) {
    e.stopPropagation()
    setEditingNameId(c.id)
    setNameInput(c.name || getDefaultName(c))
  }

  function saveName(id) {
    const trimmed = nameInput.trim()
    if (trimmed) patch(id, { name: trimmed })
    setEditingNameId(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-rl-muted" />
        <h3 className="text-sm font-semibold text-rl-text">Histórico de Criativos</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-surface text-rl-muted border border-rl-border">
          {allCreatives.length}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        {visible.map((c) => {
          const linkedCampaign = allCampaigns.find((a) => a.id === c.campaignId)
          const isEditingName  = editingNameId === c.id

          return (
            <div
              key={c.id}
              onClick={() => !isEditingName && onOpen(c)}
              className={`px-4 pt-3 pb-2.5 border-b border-rl-border/40 transition-colors ${
                isEditingName ? '' : 'cursor-pointer hover:bg-rl-surface/40'
              }`}
            >
              {/* ── Name + Campaign row ── */}
              <div className="flex items-center gap-2 mb-2">
                {isEditingName ? (
                  <div
                    className="flex items-center gap-1.5 flex-1 min-w-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')  saveName(c.id)
                        if (e.key === 'Escape') setEditingNameId(null)
                      }}
                      onBlur={() => saveName(c.id)}
                      className="flex-1 min-w-0 text-xs font-semibold text-rl-text bg-rl-surface border border-rl-blue/40 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-rl-blue/30"
                    />
                    <button
                      onMouseDown={(e) => { e.preventDefault(); saveName(c.id) }}
                      className="p-1 rounded-md text-rl-green hover:bg-rl-green/10 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); setEditingNameId(null) }}
                      className="p-1 rounded-md text-rl-muted hover:bg-rl-surface transition-colors"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => startEditName(e, c)}
                    className="flex items-center gap-1.5 group text-left min-w-0 flex-1"
                    title="Clique para renomear"
                  >
                    <span className="text-xs font-semibold text-rl-text truncate">
                      {c.name || getDefaultName(c)}
                    </span>
                    <Pencil className="w-3 h-3 text-rl-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                )}

                {allCampaigns.length > 0 && !isEditingName && (
                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link2 className="w-3 h-3 text-rl-muted" />
                    <select
                      value={c.campaignId || ''}
                      onChange={(e) => handleCampaignLink(c.id, e.target.value)}
                      className={`text-[10px] border rounded-md px-1.5 py-0.5 focus:outline-none cursor-pointer transition-colors max-w-[180px] ${
                        linkedCampaign
                          ? 'bg-rl-blue/5 border-rl-blue/30 text-rl-blue font-semibold'
                          : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-blue/30'
                      }`}
                    >
                      <option value="">— Sem campanha —</option>
                      {allCampaigns.map((camp) => (
                        <option key={camp.id} value={camp.id}>
                          {camp.name} · {camp.channel} · {camp.stage}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* ── Meta row ── */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-[10px] text-rl-muted">{fmtDate(c.createdAt)}</span>

                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit ${
                  c.type === 'video'
                    ? 'text-rl-purple bg-rl-purple/10 border-rl-purple/30'
                    : 'text-rl-blue   bg-rl-blue/10   border-rl-blue/30'
                }`}>
                  {c.type === 'video' ? '🎬 Vídeo' : '🖼️ Estático'}
                </span>

                <div className="flex flex-wrap gap-1 min-w-0 flex-1">
                  {(c.adTypeLabels || []).slice(0, 3).map((label) => (
                    <span key={label} className="text-[9px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted">
                      {label}
                    </span>
                  ))}
                  {(c.adTypeLabels || []).length > 3 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted">
                      +{c.adTypeLabels.length - 3}
                    </span>
                  )}
                </div>

                <div
                  className="flex items-center gap-1.5 ml-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RatingSelector value={c.rating} onChange={(r) => handleRating(c.id, r)} />
                  <button
                    onClick={(e) => handleExport(e, c)}
                    disabled={exportingId === c.id}
                    title="Exportar PDF"
                    className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all disabled:opacity-40"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, c.id)}
                    title="Excluir"
                    className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

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
