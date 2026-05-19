import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  FileText, Calendar, Video, Users, ExternalLink, Loader2, AlertTriangle,
  CheckCircle2, Lock, PenLine, ChevronRight,
} from 'lucide-react'

// Mesmas seções do template original — replicamos aqui (sem importar) pra que
// a página pública não dependa do bundle do app interno.
const TEMPLATE_SECTIONS = [
  { id: 'resumo',                title: 'Resumo da reunião' },
  { id: 'resultados',            title: 'Resultados desde a última reunião' },
  { id: 'metricas',              title: 'Principais métricas reportadas' },
  { id: 'pontos_atencao',        title: 'Pontos de atenção / bloqueios' },
  { id: 'discussoes',            title: 'Principais discussões e decisões' },
  { id: 'compromissos_cliente',  title: 'Compromissos do cliente' },
  { id: 'compromissos_agencia',  title: 'Compromissos da agência' },
]

function fmtDateBR(iso) {
  if (!iso) return ''
  // ISO YYYY-MM-DD ou timestamp — extrai dd/mm/yyyy
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

function fmtDateTimeBR(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function MeetingMinutePublic() {
  const { token } = useParams()
  const [loading, setLoading]     = useState(true)
  const [error,   setError]       = useState(null)
  const [minute,  setMinute]      = useState(null)
  const [company, setCompany]     = useState('')
  const [acks,    setAcks]        = useState({})  // local diff
  const [signName,    setSignName]    = useState('')
  const [signing,     setSigning]     = useState(false)
  const [signError,   setSignError]   = useState(null)

  // ── Load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/meeting-minute?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar.')
        setMinute(data.minute || null)
        setCompany(data.companyName || '')
        setAcks(data.minute?.client_acknowledgements || {})
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const isSigned = !!minute?.client_signature
  const template = minute?.template || {}
  const actions  = Array.isArray(minute?.next_actions) ? minute.next_actions : []
  const attendees = Array.isArray(minute?.attendees) ? minute.attendees : []
  const internalSigs = minute?.internal_signatures || {}

  // Quais seções existem no template (preenchidas)
  const filledSections = useMemo(
    () => TEMPLATE_SECTIONS.filter((s) => (template[s.id] || '').trim()),
    [template]
  )

  const totalItems = filledSections.length + actions.length
  const checkedItems = filledSections.filter((s) => !!acks[s.id]).length
    + actions.filter((a) => !!acks[`action:${a.id}`]).length
  const allChecked = totalItems > 0 && checkedItems === totalItems

  // ── Mark/unmark item (debounced save sem await) ──────────────────────
  async function toggleAck(key) {
    if (isSigned) return
    const next = { ...acks, [key]: !acks[key] }
    setAcks(next)
    try {
      await fetch('/api/meeting-minute', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, acknowledgements: next }),
      })
    } catch (e) {
      console.warn('[MeetingMinutePublic] erro ao salvar ciência:', e.message)
    }
  }

  // ── Signature ──────────────────────────────────────────────────────────
  async function handleSign() {
    if (!signName.trim()) {
      setSignError('Informe seu nome completo pra assinar.')
      return
    }
    if (!allChecked) {
      setSignError('Marque todos os pontos como ciente antes de assinar.')
      return
    }
    setSigning(true)
    setSignError(null)
    try {
      const res = await fetch('/api/meeting-minute', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          acknowledgements: acks,
          signature: { name: signName.trim() },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao assinar.')
      // Recarrega minute com assinatura
      const reload = await fetch(`/api/meeting-minute?token=${encodeURIComponent(token)}`)
      const reloaded = await reload.json()
      if (reload.ok) setMinute(reloaded.minute || null)
    } catch (e) {
      setSignError(e.message)
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-rl-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-rl-purple animate-spin" />
          <p className="text-rl-muted text-sm">Carregando ata...</p>
        </div>
      </div>
    )
  }

  if (error || !minute) {
    return (
      <div className="min-h-screen bg-rl-bg flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-rl-text">Link inválido</h2>
          <p className="text-sm text-rl-muted">{error || 'Ata não encontrada.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-rl-bg">
      {/* Header sticky */}
      <div className="border-b border-rl-border bg-white/85 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold">
              Ata de reunião
            </p>
            <h1 className="text-base font-black text-rl-text leading-tight">
              {company}
            </h1>
          </div>
          {isSigned ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rl-green/10 border border-rl-green/30 text-rl-green text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Assinado em {fmtDateTimeBR(minute.client_signature.signedAt)}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-rl-muted font-semibold">{checkedItems}/{totalItems}</span>
              <span className="text-rl-muted">ciências</span>
              <div className="w-24 h-1.5 rounded-full bg-rl-surface overflow-hidden">
                <div
                  className="h-full bg-rl-green transition-all"
                  style={{ width: `${totalItems > 0 ? (checkedItems / totalItems) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Capa da ata */}
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-rl-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black text-rl-text leading-tight">{minute.title}</h2>
              <div className="mt-2 flex items-center gap-3 text-xs text-rl-muted flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {fmtDateBR(minute.meeting_date)}
                </span>
                {minute.recording_url && (
                  <a
                    href={minute.recording_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-rl-purple font-semibold hover:underline"
                  >
                    <Video className="w-3.5 h-3.5" /> Gravação
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {attendees.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-rl-muted flex-wrap">
                  <Users className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{attendees.map((a) => (typeof a === 'string' ? a : (a?.name || ''))).filter(Boolean).join(' · ')}</span>
                </div>
              )}
            </div>
          </div>
          {!isSigned && (
            <div className="rounded-xl bg-rl-blue/5 border border-rl-blue/30 p-3 text-xs text-rl-text leading-relaxed">
              <strong>Como funciona:</strong> revise cada bloco e marque como
              ciente. Quando estiver tudo confirmado, preencha seu nome no
              rodapé pra assinar a ata. Após assinada, ela fica congelada.
            </div>
          )}
        </div>

        {/* Seções */}
        {filledSections.map((s, i) => {
          const checked = !!acks[s.id]
          return (
            <SectionCard
              key={s.id}
              index={i + 1}
              title={s.title}
              content={template[s.id]}
              checked={checked}
              onToggle={() => toggleAck(s.id)}
              disabled={isSigned}
            />
          )
        })}

        {/* Próximas ações */}
        {actions.length > 0 && (
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-rl-purple" />
              <h3 className="text-sm font-black text-rl-text">Próximas ações</h3>
              <span className="text-[10px] text-rl-muted ml-auto">
                {actions.length} {actions.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <ul className="space-y-2">
              {actions.map((a) => {
                const key = `action:${a.id}`
                const checked = !!acks[key]
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => toggleAck(key)}
                      disabled={isSigned}
                      className={`w-full flex items-start gap-3 text-left p-3 rounded-xl border transition-all ${
                        checked
                          ? 'bg-rl-green/5 border-rl-green/30'
                          : 'bg-white border-rl-border hover:border-rl-purple/40'
                      } ${isSigned ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <span className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        checked ? 'bg-rl-green border-rl-green' : 'border-rl-border'
                      }`}>
                        {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-rl-text">{a.title || a.text || a.description || '—'}</p>
                        {(a.owner || a.due_date || a.dueDate) && (
                          <p className="text-[11px] text-rl-muted mt-1">
                            {a.owner && <span>Responsável: <strong>{a.owner}</strong></span>}
                            {a.owner && (a.due_date || a.dueDate) && <span> · </span>}
                            {(a.due_date || a.dueDate) && <span>Prazo: {fmtDateBR(a.due_date || a.dueDate)}</span>}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Notas livres */}
        {minute.notes && minute.notes.trim() && (
          <div className="glass-card p-5">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-rl-muted mb-2">
              Observações
            </h3>
            <p className="text-sm text-rl-text whitespace-pre-wrap leading-relaxed">{minute.notes}</p>
          </div>
        )}

        {/* Assinaturas internas (read-only pro cliente) */}
        {(internalSigs.account_manager || internalSigs.trafego) && (
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-rl-muted">
              Assinaturas da agência
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'account_manager', label: 'Account Manager', color: '#7C3AED' },
                { id: 'trafego',         label: 'Gestor de Tráfego', color: '#2563EB' },
              ].map((r) => {
                const sig = internalSigs[r.id]
                return (
                  <div
                    key={r.id}
                    className={`rounded-xl border p-3 ${
                      sig ? 'bg-rl-green/5 border-rl-green/30' : 'bg-rl-surface/40 border-rl-border'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: r.color }}>
                      {r.label}
                    </p>
                    {sig ? (
                      <>
                        <p className="text-sm font-black text-rl-text leading-tight">{sig.name}</p>
                        <p className="text-[11px] text-rl-muted mt-0.5">{fmtDateTimeBR(sig.signedAt)}</p>
                      </>
                    ) : (
                      <p className="text-xs text-rl-muted italic">Pendente</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Assinatura */}
        <div className="glass-card p-6 space-y-4 border-2 border-rl-purple/30">
          <div className="flex items-center gap-2">
            {isSigned
              ? <Lock className="w-4 h-4 text-rl-green" />
              : <PenLine className="w-4 h-4 text-rl-purple" />
            }
            <h3 className="text-base font-black text-rl-text">
              {isSigned ? 'Ata assinada' : 'Sua assinatura'}
            </h3>
          </div>

          {isSigned ? (
            <div className="rounded-xl bg-rl-green/5 border border-rl-green/30 p-4">
              <p className="text-[10px] uppercase tracking-wider font-bold text-rl-muted mb-1">
                Assinada por
              </p>
              <p className="text-lg font-black text-rl-text">{minute.client_signature.name}</p>
              <p className="text-xs text-rl-muted mt-1">
                Em {fmtDateTimeBR(minute.client_signature.signedAt)}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-rl-muted leading-relaxed">
                Confirme abaixo que está ciente de todos os pontos da reunião. Após assinar, a ata
                ficará congelada — você não conseguirá mais editar as ciências.
              </p>
              <div>
                <label className="text-xs font-bold text-rl-text uppercase tracking-wide mb-1 block">
                  Seu nome completo
                </label>
                <input
                  type="text"
                  value={signName}
                  onChange={(e) => setSignName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="input-field w-full"
                />
              </div>
              {signError && (
                <div className="flex items-center gap-2 text-xs text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" /> {signError}
                </div>
              )}
              <button
                onClick={handleSign}
                disabled={signing || !allChecked || !signName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-black bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {signing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Assinando...</>
                  : <><PenLine className="w-4 h-4" /> Assinar ata</>
                }
              </button>
              {!allChecked && totalItems > 0 && (
                <p className="text-[11px] text-rl-muted text-center">
                  Faltam {totalItems - checkedItems} {totalItems - checkedItems === 1 ? 'item' : 'itens'} pra marcar como ciente antes de assinar.
                </p>
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="pt-2 pb-8 text-center">
          <p className="text-xs text-rl-muted/70">Revenue Lab © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Card de seção ─────────────────────────────────────────────────────────
function SectionCard({ index, title, content, checked, onToggle, disabled }) {
  return (
    <div
      className={`glass-card p-5 transition-all ${
        checked ? 'border-rl-green/40 bg-rl-green/5' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rl-muted">
            #{index}
          </span>
          <h3 className="text-base font-black text-rl-text leading-tight">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-all whitespace-nowrap ${
            checked
              ? 'bg-rl-green/10 border-rl-green/30 text-rl-green'
              : 'bg-white border-rl-border text-rl-muted hover:border-rl-purple/40 hover:text-rl-purple'
          } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
        >
          {checked
            ? <><CheckCircle2 className="w-3.5 h-3.5" /> Ciente</>
            : <span>Marcar como ciente</span>
          }
        </button>
      </div>
      <div className="text-sm text-rl-text whitespace-pre-wrap leading-relaxed">{content}</div>
    </div>
  )
}
