// Central de Landing Pages — banco de LPs do cliente, espelho da Central de
// anúncios: lista com link, funil, status e o mesmo fluxo de aprovação do
// cliente (link público /aprovacao/:token, compartilhado com os criativos).
import { useMemo, useState } from 'react'
import {
  LayoutTemplate, Plus, Pencil, Trash2, ExternalLink, Filter, X,
  Link2, Send, PenTool, Globe, PowerOff, Clock,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../hooks/useToast'
import Toast from '../UI/Toast'
import LPCentralModal from './LPCentralModal'
import { FUNNELS } from '../Kickoff/KickoffFunnelRecommendations'
import { LP_STATUS_OPTIONS, LP_STATUS_BY_ID, APROVACAO_BY_ID, fmtDateTimeBR } from './lpCentralData'

const EMPTY = { lps: [] }
const STATUS_ICON = { em_producao: PenTool, no_ar: Globe, desativada: PowerOff }

export default function LPCentralModule({ project }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()

  const persisted = project.lpCentral || EMPTY
  const [editingLp, setEditingLp] = useState(null) // lp obj | {} | null
  const [filterFunil,  setFilterFunil]  = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const lps = useMemo(() => persisted.lps || [], [persisted.lps])

  const visibleLps = useMemo(() => {
    return lps
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .filter((lp) => {
        if (filterFunil && lp.funilId !== filterFunil) return false
        if (filterStatus && (lp.status || 'em_producao') !== filterStatus) return false
        return true
      })
  }, [lps, filterFunil, filterStatus])

  function persist(next) {
    updateProject(project.id, { lpCentral: next })
  }

  function handleSaveLp(lp) {
    const list = persisted.lps || []
    const exists = list.some((x) => x.id === lp.id)
    const next = exists
      ? list.map((x) => (x.id === lp.id ? lp : x))
      : [...list, lp]
    persist({ ...persisted, lps: next })
    setEditingLp(null)
    showToast(exists ? 'Landing page atualizada!' : 'Landing page cadastrada!')
  }

  function handleDelete(id) {
    if (!window.confirm('Excluir essa landing page da central?')) return
    const next = (persisted.lps || []).filter((x) => x.id !== id)
    persist({ ...persisted, lps: next })
    showToast('Landing page removida.')
  }

  function updateLp(id, patch) {
    const list = persisted.lps || []
    const next = list.map((x) =>
      x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x
    )
    persist({ ...persisted, lps: next })
  }

  // ── Link público de aprovação (mesmo client_share_token dos criativos) ─────
  function getOrCreateShareToken() {
    if (project.clientShareToken) return project.clientShareToken
    const token = crypto.randomUUID()
    updateProject(project.id, { clientShareToken: token })
    return token
  }

  function handleShareAprovacao() {
    const token = getOrCreateShareToken()
    if (!token) return
    const url = `${window.location.origin}/aprovacao/${token}`
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link de aprovação copiado!'))
      .catch(() => showToast('Link: ' + url))
  }

  const hasFilters = filterFunil || filterStatus

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-rl-green/10 flex items-center justify-center shrink-0">
          <LayoutTemplate className="w-5 h-5 text-rl-green" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-black text-rl-text leading-tight">Central de Landing Pages</h2>
          <p className="text-sm text-rl-subtle mt-0.5 max-w-2xl">
            Banco de landing pages do cliente — com link, funil, status e aprovação. Registre cada LP criada pra organizar o que está no ar e o histórico de páginas.
          </p>
        </div>
      </div>

      {/* Toolbar: filtros + ações */}
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
            {LP_STATUS_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
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
              onClick={() => { setFilterFunil(''); setFilterStatus('') }}
              className="text-[10px] text-rl-muted hover:text-rl-red transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
          <span className="text-xs text-rl-muted ml-1">
            {visibleLps.length} {visibleLps.length === 1 ? 'landing page' : 'landing pages'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShareAprovacao}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-rl-border text-rl-subtle hover:text-rl-green hover:border-rl-green/40 transition-all"
            title="Copiar o link em que o cliente aprova ou reprova as landing pages"
          >
            <Link2 className="w-4 h-4" /> Link de aprovação
          </button>
          <button
            onClick={() => setEditingLp({})}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-green text-white shadow-glow hover:bg-rl-green/90 transition-all"
          >
            <Plus className="w-4 h-4" /> Nova landing page
          </button>
        </div>
      </div>

      {/* Tabela */}
      {lps.length === 0 ? (
        <EmptyState onCreate={() => setEditingLp({})} />
      ) : visibleLps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-10 text-center">
          <p className="text-sm text-rl-muted">
            Nenhuma landing page bate com os filtros atuais.
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
                  <Th>Funil</Th>
                  <Th>Status</Th>
                  <Th>Aprovação</Th>
                  <Th>Link</Th>
                  <Th>Obs.</Th>
                  <Th className="w-20"></Th>
                </tr>
              </thead>
              <tbody>
                {visibleLps.map((lp) => {
                  const status = LP_STATUS_BY_ID[lp.status || 'em_producao']
                  const StatusIcon = STATUS_ICON[lp.status || 'em_producao'] || Clock
                  const funil = FUNNELS.find((f) => f.id === lp.funilId) || null
                  const dtStr = lp.createdAt
                    ? lp.createdAt.split('-').reverse().join('/')
                    : '—'

                  return (
                    <tr
                      key={lp.id}
                      onClick={() => setEditingLp(lp)}
                      className="border-b border-rl-border/40 hover:bg-rl-surface/40 cursor-pointer transition-colors"
                    >
                      <Td className="whitespace-nowrap text-rl-subtle">{dtStr}</Td>
                      <Td className="text-xs font-semibold text-rl-text max-w-[220px]">
                        <span className="line-clamp-2">{lp.nome || '—'}</span>
                      </Td>
                      <Td className="text-xs whitespace-nowrap">
                        {funil ? `${funil.icon} ${funil.label}` : <span className="text-rl-muted italic">—</span>}
                      </Td>
                      <Td>
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap"
                          style={{ color: status.color, background: status.bgColor, borderColor: status.borderColor }}
                        >
                          <StatusIcon className="w-3 h-3" /> {status.label}
                        </span>
                      </Td>
                      <Td>
                        <AprovacaoCell
                          lp={lp}
                          onEnviar={() => {
                            updateLp(lp.id, { aprovacao: { status: 'pendente', enviadoEm: new Date().toISOString() } })
                            showToast('Landing page enviada pra aprovação do cliente!')
                          }}
                        />
                      </Td>
                      <Td>
                        {lp.url ? (
                          <a
                            href={lp.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-rl-green font-semibold hover:underline whitespace-nowrap"
                          >
                            <ExternalLink className="w-3 h-3" /> Abrir LP
                          </a>
                        ) : (
                          <span className="text-rl-muted italic text-xs">—</span>
                        )}
                      </Td>
                      <Td className="max-w-[200px]">
                        {lp.observacao ? (
                          <span className="text-[11px] text-rl-subtle line-clamp-2" title={lp.observacao}>
                            {lp.observacao}
                          </span>
                        ) : (
                          <span className="text-rl-muted italic text-xs">—</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingLp(lp) }}
                            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-green hover:bg-rl-green/10 transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(lp.id) }}
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
      {editingLp !== null && (
        <LPCentralModal
          initial={editingLp.id ? editingLp : null}
          onSave={handleSaveLp}
          onClose={() => setEditingLp(null)}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}

// ─── Pequenos subcomponentes ──────────────────────────────────────────────────

// Célula de aprovação do cliente — mesmo comportamento da Central de anúncios.
function AprovacaoCell({ lp, onEnviar }) {
  const info = lp.aprovacao ? APROVACAO_BY_ID[lp.aprovacao.status] : null

  if (!info) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onEnviar() }}
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rl-border text-rl-muted hover:text-rl-green hover:border-rl-green/40 transition-all whitespace-nowrap"
        title="Enviar essa landing page pro cliente aprovar"
      >
        <Send className="w-3 h-3" /> Enviar
      </button>
    )
  }

  const tooltip = lp.aprovacao.status === 'reprovado'
    ? `Motivo: ${lp.aprovacao.motivo || '—'}\nComo deveria estar: ${lp.aprovacao.sugestao || '—'}`
    : undefined

  const marco = lp.aprovacao.status === 'pendente' ? lp.aprovacao.enviadoEm : lp.aprovacao.decididoEm

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap"
        style={{ color: info.color, background: info.bgColor, borderColor: info.borderColor }}
        title={tooltip}
      >
        {info.label}
      </span>
      {marco && (
        <span className="text-[9px] text-rl-muted whitespace-nowrap">
          {fmtDateTimeBR(marco)}
        </span>
      )}
    </div>
  )
}

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
      <LayoutTemplate className="w-8 h-8 text-rl-muted/40 mx-auto" />
      <div>
        <p className="text-sm font-semibold text-rl-text">
          Nenhuma landing page cadastrada na central ainda.
        </p>
        <p className="text-xs text-rl-muted mt-1 max-w-md mx-auto">
          Adicione a primeira landing page com link, funil e status pra montar o banco de LPs do cliente.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-green text-white shadow-glow hover:bg-rl-green/90 transition-all"
      >
        <Plus className="w-4 h-4" /> Adicionar primeira landing page
      </button>
    </div>
  )
}
