import { useState } from 'react'
import { History, ChevronDown, ChevronUp, Trash2, Copy, CheckCheck } from 'lucide-react'
import ResultCard from './ResultCard'

const CAMPAIGN_TYPES = [
  { id: 'marca',        label: 'Marca / Brand',    emoji: '🏷️', desc: 'Protege sua marca e captura buscas diretas pelo nome' },
  { id: 'generico',     label: 'Genérico',          emoji: '🔍', desc: 'Termos genéricos do serviço — maior volume de buscas' },
  { id: 'concorrentes', label: 'Concorrentes',      emoji: '⚔️', desc: 'Nomes de concorrentes — captura quem busca alternativas' },
  { id: 'problema',     label: 'Problema / Dor',    emoji: '💊', desc: 'Termos de dor — topo de funil, intenção de resolver' },
]

export function ResultBlock({ content }) {
  const [allCopied, setAllCopied] = useState(false)
  function copyAll() {
    navigator.clipboard.writeText(content)
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 2000)
  }
  const chunks = content.split(/\n---\n/).map((c) => c.trim()).filter(Boolean)
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={copyAll} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
          {allCopied ? <CheckCheck className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />}
          {allCopied ? 'Tudo copiado!' : 'Copiar tudo'}
        </button>
      </div>
      {chunks.map((chunk, i) => <ResultCard key={i} content={chunk} index={i} />)}
    </div>
  )
}

export default function AdsHistory({ project, updateProject }) {
  const all = (project.googleAds || []).filter((e) => !e.isDraft).slice().reverse()
  const [expandedId, setExpandedId] = useState(null)
  const [showAll, setShowAll] = useState(false)

  if (!all.length) return null

  const visible = showAll ? all : all.slice(0, 5)

  function handleDelete(id) {
    updateProject(project.id, { googleAds: (project.googleAds || []).filter((g) => g.id !== id) })
  }

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-rl-muted" />
        <h3 className="text-sm font-semibold text-rl-text">Histórico de Estruturas</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-surface text-rl-muted border border-rl-border">
          {all.length}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        {visible.map((entry) => (
          <div key={entry.id}>
            <div className="px-4 py-3 border-b border-rl-border/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-[10px] text-rl-muted shrink-0">{fmtDate(entry.createdAt)}</span>
                <div className="flex flex-wrap gap-1 min-w-0">
                  {(entry.campaignTypes || []).map((t) => {
                    const ct = CAMPAIGN_TYPES.find((c) => c.id === t)
                    return ct ? (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted">
                        {ct.emoji} {ct.label}
                      </span>
                    ) : null
                  })}
                </div>
                {entry.keywordGroups?.length > 0 && (
                  <span className="text-[10px] text-rl-muted truncate hidden sm:block">
                    · {entry.keywordGroups.map((g) => g.name || 'Grupo').join(', ').slice(0, 40)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
                  title="Ver conteúdo"
                >
                  {expandedId === entry.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {expandedId === entry.id && (
              <div className="px-4 py-5 bg-rl-surface/20 border-b border-rl-border/40">
                <ResultBlock content={entry.content} />
              </div>
            )}
          </div>
        ))}

        {all.length > 5 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="w-full px-4 py-3 text-xs text-rl-muted hover:text-rl-text transition-colors text-center"
          >
            {showAll ? '▲ Mostrar menos' : `▼ Ver mais ${all.length - 5} entradas`}
          </button>
        )}
      </div>
    </div>
  )
}
