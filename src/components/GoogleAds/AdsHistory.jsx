import { fmtDate } from '../../lib/utils'
import { useState } from 'react'
import { History, ChevronDown, ChevronUp, Trash2, Copy, CheckCheck } from 'lucide-react'
import ResultCard from './ResultCard'
import { useI18n } from '../../i18n'

// Rótulo em locales/{pt,en}/googleAds.js (tipos.<id>.label).
const CAMPAIGN_TYPES = [
  { id: 'marca',        emoji: '🏷️' },
  { id: 'generico',     emoji: '🔍' },
  { id: 'concorrentes', emoji: '⚔️' },
  { id: 'problema',     emoji: '💊' },
]

export function ResultBlock({ content }) {
  const { t } = useI18n()
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
          {allCopied ? t('googleAds.historico.tudoCopiado') : t('googleAds.historico.copiarTudo')}
        </button>
      </div>
      {chunks.map((chunk, i) => <ResultCard key={i} content={chunk} index={i} />)}
    </div>
  )
}

export default function AdsHistory({ project, updateProject }) {
  const { t } = useI18n()
  const all = (project.googleAds || []).filter((e) => !e.isDraft).slice().reverse()
  const [expandedId, setExpandedId] = useState(null)
  const [showAll, setShowAll] = useState(false)

  if (!all.length) return null

  const visible = showAll ? all : all.slice(0, 5)

  function handleDelete(id) {
    updateProject(project.id, { googleAds: (project.googleAds || []).filter((g) => g.id !== id) })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-rl-muted" />
        <h3 className="text-sm font-semibold text-rl-text">{t('googleAds.historico.titulo')}</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-surface text-rl-muted border border-rl-border">
          {all.length}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        {visible.map((entry) => (
          <div key={entry.id}>
            <div className="px-4 py-3 border-b border-rl-border/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-[10px] text-rl-muted shrink-0">{fmtDate(entry.createdAt, { time: true, year: false }) || '—'}</span>
                <div className="flex flex-wrap gap-1 min-w-0">
                  {(entry.campaignTypes || []).map((tipo) => {
                    const ct = CAMPAIGN_TYPES.find((c) => c.id === tipo)
                    return ct ? (
                      <span key={tipo} className="text-[9px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted">
                        {ct.emoji} {t(`googleAds.tipos.${ct.id}.label`)}
                      </span>
                    ) : null
                  })}
                </div>
                {entry.keywordGroups?.length > 0 && (
                  <span className="text-[10px] text-rl-muted truncate hidden sm:block">
                    · {entry.keywordGroups.map((g) => g.name || t('googleAds.grupoSemNome')).join(', ').slice(0, 40)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
                  title={t('googleAds.historico.verConteudo')}
                >
                  {expandedId === entry.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                  title={t('comum.excluir')}
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
            {showAll ? t('googleAds.historico.mostrarMenos') : t('googleAds.historico.verMais', { count: all.length - 5 })}
          </button>
        )}
      </div>
    </div>
  )
}
