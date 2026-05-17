import { useMemo, useState } from 'react'
import {
  Megaphone, Plus, Pencil, Trash2, ExternalLink, Video, Image as ImageIcon, Layers,
  Filter, X,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../hooks/useToast'
import Toast from '../UI/Toast'
import DebriefingAdModal, { TIPOS_ANUNCIO, flattenCampaigns } from './DebriefingAdModal'
import { FUNNELS, FUNNELS_BY_ID } from '../Kickoff/KickoffFunnelRecommendations'

const EMPTY = { ads: [] }
const TIPO_ICON = { video: Video, imagem: ImageIcon, carrossel: Layers }
const TIPO_LABEL = Object.fromEntries(TIPOS_ANUNCIO.map((t) => [t.id, t.label]))

export default function DebriefingModule({ project }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()

  const persisted = project.debriefing || EMPTY
  const [editingAd, setEditingAd] = useState(null) // ad obj | {} | null
  const [filterTipo,    setFilterTipo]    = useState('')
  const [filterFunil,   setFilterFunil]   = useState('')

  const ads = useMemo(() => persisted.ads || [], [persisted.ads])
  const campaigns = useMemo(() => flattenCampaigns(project.campaignPlan), [project.campaignPlan])
  const campaignById = useMemo(
    () => Object.fromEntries(campaigns.map((c) => [c.id, c])),
    [campaigns]
  )

  // Ordena por data de criação (do mais recente pro mais antigo)
  // e aplica filtros
  const visibleAds = useMemo(() => {
    return ads
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .filter((ad) => {
        if (filterTipo && ad.tipo !== filterTipo) return false
        if (filterFunil && ad.funilId !== filterFunil) return false
        return true
      })
  }, [ads, filterTipo, filterFunil])

  function persist(next) {
    updateProject(project.id, { debriefing: next })
  }

  function handleSaveAd(ad) {
    const list = persisted.ads || []
    const exists = list.some((x) => x.id === ad.id)
    const next = exists
      ? list.map((x) => (x.id === ad.id ? ad : x))
      : [...list, ad]
    persist({ ...persisted, ads: next })
    setEditingAd(null)
    showToast(exists ? 'Anúncio atualizado!' : 'Anúncio cadastrado!')
  }

  function handleDelete(id) {
    if (!window.confirm('Excluir esse anúncio do debriefing?')) return
    const next = (persisted.ads || []).filter((x) => x.id !== id)
    persist({ ...persisted, ads: next })
    showToast('Anúncio removido.')
  }

  const hasFilters = filterTipo || filterFunil

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
          <Megaphone className="w-5 h-5 text-rl-purple" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-black text-rl-text leading-tight">Debriefing</h2>
          <p className="text-sm text-rl-subtle mt-0.5 max-w-2xl">
            Lista de criativos rodando — com link, tipo, campanha, funil e observações. Use pra análise pós-veiculação e pra organizar o pipeline de produção.
          </p>
        </div>
      </div>

      {/* Toolbar: filtros + novo */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-rl-muted">
            <Filter className="w-3.5 h-3.5" /> Filtros:
          </div>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="input-field text-xs py-1.5 pl-3 pr-8 w-auto"
          >
            <option value="">Todos os tipos</option>
            {TIPOS_ANUNCIO.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <select
            value={filterFunil}
            onChange={(e) => setFilterFunil(e.target.value)}
            className="input-field text-xs py-1.5 pl-3 pr-8 w-auto"
          >
            <option value="">Todos os funis</option>
            {FUNNELS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={() => { setFilterTipo(''); setFilterFunil('') }}
              className="text-[10px] text-rl-muted hover:text-rl-red transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
          <span className="text-xs text-rl-muted ml-1">
            {visibleAds.length} {visibleAds.length === 1 ? 'anúncio' : 'anúncios'}
          </span>
        </div>
        <button
          onClick={() => setEditingAd({})}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
        >
          <Plus className="w-4 h-4" /> Novo anúncio
        </button>
      </div>

      {/* Tabela */}
      {ads.length === 0 ? (
        <EmptyState onCreate={() => setEditingAd({})} />
      ) : visibleAds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-10 text-center">
          <p className="text-sm text-rl-muted">
            Nenhum anúncio bate com os filtros atuais.
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-rl-surface/60 border-b border-rl-border">
                  <Th>Data</Th>
                  <Th>Nome</Th>
                  <Th>Tipo</Th>
                  <Th>Campanha</Th>
                  <Th>Funil</Th>
                  <Th>Link</Th>
                  <Th>Obs.</Th>
                  <Th className="w-20"></Th>
                </tr>
              </thead>
              <tbody>
                {visibleAds.map((ad) => {
                  const TipoIcon = TIPO_ICON[ad.tipo] || Layers
                  const camp = ad.campanhaId ? campaignById[ad.campanhaId] : null
                  const funnel = ad.funilId ? FUNNELS_BY_ID[ad.funilId] : null
                  const dt = ad.createdAt ? new Date(ad.createdAt) : null
                  const dtStr = dt
                    ? `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
                    : '—'

                  return (
                    <tr
                      key={ad.id}
                      onClick={() => setEditingAd(ad)}
                      className="border-b border-rl-border/40 hover:bg-rl-surface/40 cursor-pointer transition-colors"
                    >
                      <Td className="whitespace-nowrap text-rl-subtle">{dtStr}</Td>
                      <Td className="font-mono text-xs font-semibold text-rl-text">{ad.nome || '—'}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rl-purple/10 text-rl-purple border border-rl-purple/30">
                          <TipoIcon className="w-3 h-3" />
                          {TIPO_LABEL[ad.tipo] || ad.tipo}
                        </span>
                      </Td>
                      <Td className="text-xs">
                        {camp ? (
                          <span className="text-rl-text">
                            <span className="text-[9px] font-bold text-rl-muted uppercase tracking-wider mr-1">{camp.stageLabel}</span>
                            {camp.name}
                          </span>
                        ) : (
                          <span className="text-rl-muted italic">— sem campanha —</span>
                        )}
                      </Td>
                      <Td>
                        {funnel ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rl-blue">
                            {funnel.icon} {funnel.label}
                          </span>
                        ) : (
                          <span className="text-rl-muted italic text-xs">—</span>
                        )}
                      </Td>
                      <Td>
                        {ad.url ? (
                          <a
                            href={ad.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-rl-purple font-semibold hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" /> Abrir
                          </a>
                        ) : (
                          <span className="text-rl-muted italic text-xs">—</span>
                        )}
                      </Td>
                      <Td className="max-w-[200px]">
                        {ad.observacao ? (
                          <span className="text-[11px] text-rl-subtle line-clamp-2" title={ad.observacao}>
                            {ad.observacao}
                          </span>
                        ) : (
                          <span className="text-rl-muted italic text-xs">—</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingAd(ad) }}
                            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(ad.id) }}
                            className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {editingAd !== null && (
        <DebriefingAdModal
          initial={editingAd.id ? editingAd : null}
          campaignPlan={project.campaignPlan}
          existingAdsCount={ads.length}
          onSave={handleSaveAd}
          onClose={() => setEditingAd(null)}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}

// ─── Pequenos subcomponentes ──────────────────────────────────────────────────
function Th({ children, className = '' }) {
  return (
    <th className={`text-left text-[10px] font-bold uppercase tracking-wider text-rl-muted px-3 py-2.5 ${className}`}>
      {children}
    </th>
  )
}
function Td({ children, className = '' }) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>
}

function EmptyState({ onCreate }) {
  return (
    <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-10 px-6 text-center space-y-3">
      <Megaphone className="w-8 h-8 text-rl-muted/40 mx-auto" />
      <div>
        <p className="text-sm font-semibold text-rl-text">
          Nenhum anúncio cadastrado no debriefing ainda.
        </p>
        <p className="text-xs text-rl-muted mt-1 max-w-md mx-auto">
          Adicione o primeiro anúncio com link, tipo, campanha e funil pra organizar o que está rodando.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
      >
        <Plus className="w-4 h-4" /> Adicionar primeiro anúncio
      </button>
    </div>
  )
}
