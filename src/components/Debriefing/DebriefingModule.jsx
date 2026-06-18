import { useMemo, useState } from 'react'
import {
  Megaphone, Plus, Pencil, Trash2, ExternalLink, Video, Image as ImageIcon, Layers,
  Filter, X, Clock, Play, CheckCircle2, Paperclip, FlaskConical,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../hooks/useToast'
import { deleteFile } from '../../lib/supabase'
import Toast from '../UI/Toast'
import DebriefingAdModal, { TIPOS_ANUNCIO, flattenCampaigns } from './DebriefingAdModal'
import CreativeTestModal from './CreativeTestModal'
import { FUNNELS } from '../Kickoff/KickoffFunnelRecommendations'
import { STATUS_OPTIONS, STATUS_BY_ID, RESULTADO_BY_ID, fmtDateBR, todayISO } from './debriefingData'

const ATTACHMENT_BUCKET = 'attachments'

const EMPTY = { ads: [] }
const TIPO_ICON = { video: Video, imagem: ImageIcon, carrossel: Layers }
const STATUS_ICON = { para_subir: Clock, em_andamento: Play, finalizado: CheckCircle2 }

export default function DebriefingModule({ project }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()

  const persisted = project.debriefing || EMPTY
  const [editingAd, setEditingAd] = useState(null) // ad obj | {} | null
  const [showTest, setShowTest] = useState(false)  // modal "Subir teste no Meta"
  const [filterTipo,    setFilterTipo]    = useState('')
  const [filterFunil,   setFilterFunil]   = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')

  const ads = useMemo(() => persisted.ads || [], [persisted.ads])
  const campaigns = useMemo(() => flattenCampaigns(project.campaignPlan), [project.campaignPlan])

  // Ordena por data de criação (do mais recente pro mais antigo)
  // e aplica filtros
  const visibleAds = useMemo(() => {
    return ads
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .filter((ad) => {
        if (filterTipo && ad.tipo !== filterTipo) return false
        if (filterFunil && ad.funilId !== filterFunil) return false
        if (filterStatus && (ad.status || 'para_subir') !== filterStatus) return false
        return true
      })
  }, [ads, filterTipo, filterFunil, filterStatus])

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
    if (!window.confirm('Excluir esse anúncio da central?')) return
    const target = (persisted.ads || []).find((x) => x.id === id)
    // Remove o anexo do Storage (best-effort) pra não deixar lixo
    if (target?.attachmentPath) {
      deleteFile(ATTACHMENT_BUCKET, target.attachmentPath).catch(() => {})
    }
    const next = (persisted.ads || []).filter((x) => x.id !== id)
    persist({ ...persisted, ads: next })
    showToast('Anúncio removido.')
  }

  // Atualiza um campo único de um anúncio (edição inline na tabela).
  // Quando muda status, aplica a mesma lógica de auto-data do modal.
  function updateAd(id, patch) {
    const list = persisted.ads || []
    const next = list.map((x) => {
      if (x.id !== id) return x
      const merged = { ...x, ...patch, updatedAt: new Date().toISOString() }
      // Auto-data ao mudar status
      if ('status' in patch) {
        const today = todayISO()
        if (patch.status === 'em_andamento' && !merged.startedAt) merged.startedAt = today
        if (patch.status === 'finalizado') {
          if (!merged.startedAt)  merged.startedAt  = today
          if (!merged.finishedAt) merged.finishedAt = today
        }
      }
      return merged
    })
    persist({ ...persisted, ads: next })
  }

  const hasFilters = filterTipo || filterFunil || filterStatus

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
          <Megaphone className="w-5 h-5 text-rl-purple" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-black text-rl-text leading-tight">Central de anúncios</h2>
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
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field text-xs py-1.5 pl-3 pr-8 w-auto"
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
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
              onClick={() => { setFilterTipo(''); setFilterFunil(''); setFilterStatus('') }}
              className="text-[10px] text-rl-muted hover:text-rl-red transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
          <span className="text-xs text-rl-muted ml-1">
            {visibleAds.length} {visibleAds.length === 1 ? 'anúncio' : 'anúncios'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTest(true)}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-rl-purple/40 text-rl-purple hover:bg-rl-purple/10 transition-all"
          >
            <FlaskConical className="w-4 h-4" /> Subir teste no Meta
          </button>
          <button
            onClick={() => setEditingAd({})}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
          >
            <Plus className="w-4 h-4" /> Novo anúncio
          </button>
        </div>
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
                  <Th>Status</Th>
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
                  const status = STATUS_BY_ID[ad.status || 'para_subir']
                  const StatusIcon = STATUS_ICON[ad.status || 'para_subir'] || Clock
                  const resultado = ad.resultado ? RESULTADO_BY_ID[ad.resultado] : null
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
                        <InlineSelect
                          value={ad.tipo || ''}
                          onChange={(v) => updateAd(ad.id, { tipo: v })}
                          options={TIPOS_ANUNCIO.map((t) => ({ value: t.id, label: t.label }))}
                          color="#7C3AED"
                          bgColor="rgba(124,58,237,0.10)"
                          borderColor="rgba(124,58,237,0.30)"
                          LeftIcon={TipoIcon}
                        />
                      </Td>
                      <Td>
                        <div className="flex flex-col items-start gap-1">
                          <InlineSelect
                            value={ad.status || 'para_subir'}
                            onChange={(v) => updateAd(ad.id, { status: v })}
                            options={STATUS_OPTIONS.map((s) => ({ value: s.id, label: s.label }))}
                            color={status.color}
                            bgColor={status.bgColor}
                            borderColor={status.borderColor}
                            LeftIcon={StatusIcon}
                          />
                          {resultado && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap"
                              style={{
                                color: resultado.color,
                                background: resultado.bgColor,
                                borderColor: resultado.borderColor,
                              }}
                              title={ad.justificativa || ''}
                            >
                              <span>{resultado.emoji}</span> {resultado.label}
                            </span>
                          )}
                          {ad.status === 'em_andamento' && ad.startedAt && (
                            <span className="text-[9px] text-rl-muted whitespace-nowrap">
                              desde {fmtDateBR(ad.startedAt)}
                            </span>
                          )}
                          {ad.status === 'finalizado' && ad.finishedAt && (
                            <span className="text-[9px] text-rl-muted whitespace-nowrap">
                              fim {fmtDateBR(ad.finishedAt)}
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td className="text-xs">
                        <InlineSelect
                          value={ad.campanhaId || ''}
                          onChange={(v) => updateAd(ad.id, { campanhaId: v })}
                          options={[
                            { value: '', label: '— sem campanha —' },
                            ...campaigns.map((c) => ({
                              value: c.id,
                              label: `[${c.stageLabel}] ${c.name}${c.channel ? ' · ' + c.channel : ''}`,
                            })),
                          ]}
                          color="#0F172A"
                          bgColor="#F8FAFC"
                          borderColor="#E2E8F0"
                          textPlaceholder="— sem campanha —"
                        />
                      </Td>
                      <Td>
                        <InlineSelect
                          value={ad.funilId || ''}
                          onChange={(v) => updateAd(ad.id, { funilId: v })}
                          options={[
                            { value: '', label: '— sem funil —' },
                            ...FUNNELS.map((f) => ({ value: f.id, label: `${f.icon} ${f.label}` })),
                          ]}
                          color="#2563EB"
                          bgColor="rgba(37,99,235,0.08)"
                          borderColor="rgba(37,99,235,0.25)"
                          textPlaceholder="— sem funil —"
                        />
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2 flex-wrap">
                          {ad.url ? (
                            <a
                              href={ad.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-rl-purple font-semibold hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" /> Link
                            </a>
                          ) : (
                            !ad.attachmentUrl && <span className="text-rl-muted italic text-xs">—</span>
                          )}
                          {ad.attachmentUrl && (
                            <a
                              href={ad.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-rl-blue font-semibold hover:underline"
                              title={ad.attachmentName || 'Anexo'}
                            >
                              <Paperclip className="w-3 h-3" /> Anexo
                            </a>
                          )}
                        </div>
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
          projectId={project.id}
          existingAdsCount={ads.length}
          onSave={handleSaveAd}
          onClose={() => setEditingAd(null)}
        />
      )}

      {showTest && (
        <CreativeTestModal
          project={project}
          onClose={() => setShowTest(false)}
          onToast={showToast}
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

// InlineSelect: dropdown estilizado como chip pra edição inline na tabela.
// Stop-propagation no click pra não disparar o onClick da linha (que abre o modal).
function InlineSelect({
  value, onChange, options = [],
  color = '#0F172A', bgColor = '#F8FAFC', borderColor = '#E2E8F0',
  LeftIcon = null,
  textPlaceholder = null,
}) {
  const isEmpty = !value
  const displayColor = isEmpty && textPlaceholder ? '#94A3B8' : color
  const displayBg    = isEmpty && textPlaceholder ? 'transparent' : bgColor
  const displayBorder= isEmpty && textPlaceholder ? '#E2E8F0' : borderColor

  return (
    <div
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      {LeftIcon && !isEmpty && (
        <LeftIcon
          className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
          style={{ color: displayColor }}
        />
      )}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none cursor-pointer text-[11px] font-bold rounded-full border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-white focus:ring-rl-purple/30 transition-all ${
          LeftIcon && !isEmpty ? 'pl-7' : 'pl-2.5'
        } pr-6 py-0.5`}
        style={{
          color: displayColor,
          background: displayBg,
          borderColor: displayBorder,
          fontStyle: isEmpty && textPlaceholder ? 'italic' : 'normal',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <svg
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ color: displayColor }}
        aria-hidden
      >
        <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function EmptyState({ onCreate }) {
  return (
    <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-10 px-6 text-center space-y-3">
      <Megaphone className="w-8 h-8 text-rl-muted/40 mx-auto" />
      <div>
        <p className="text-sm font-semibold text-rl-text">
          Nenhum anúncio cadastrado na central ainda.
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
