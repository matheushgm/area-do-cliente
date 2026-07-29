// Modal de cadastro/edição de landing page da Central de Landing Pages.
// Espelha o DebriefingAdModal (Central de anúncios), simplificado pra LPs:
// nome + link (obrigatórios), funil, status e envio pra aprovação do cliente.
import { useMemo, useState } from 'react'
import {
  X, Check, ExternalLink, AlertTriangle, Clock, CheckCircle2, XCircle, Send,
  PenTool, Globe, PowerOff,
} from 'lucide-react'
import Modal from '../UI/Modal'
import { FUNNELS } from '../Kickoff/KickoffFunnelRecommendations'
import { LP_STATUS_OPTIONS, LP_DEFAULT_STATUS, APROVACAO_BY_ID, fmtDateTimeBR } from './lpCentralData'

const STATUS_ICON = { em_producao: PenTool, no_ar: Globe, desativada: PowerOff }

const TODAY = () => new Date().toISOString().slice(0, 10) // yyyy-mm-dd

export default function LPCentralModal({ initial, onSave, onClose }) {
  const stableId = useMemo(() => initial?.id || crypto.randomUUID(), [initial?.id])

  const [values, setValues] = useState(() => ({
    createdAt:  TODAY(),
    nome:       '',
    url:        '',
    funilId:    '',
    observacao: '',
    status:     LP_DEFAULT_STATUS,
    aprovacao:  null,
    ...(initial || {}),
  }))
  // Novas LPs vão pra aprovação do cliente por padrão, igual aos criativos.
  const [enviarAprovacao, setEnviarAprovacao] = useState(!initial)

  function set(field, val) {
    setValues((prev) => ({ ...prev, [field]: val }))
  }

  const selectedFunil = FUNNELS.find((f) => f.id === values.funilId) || null
  const isValidUrl = /^https?:\/\//i.test(values.url || '')
  const canSave = !!(values.nome || '').trim() && !!(values.url || '').trim()

  function handleSave() {
    if (!canSave) return
    const now = new Date().toISOString()
    const aprovacao = !initial && enviarAprovacao && !values.aprovacao
      ? { status: 'pendente', enviadoEm: now }
      : values.aprovacao
    onSave({
      ...values,
      aprovacao,
      id: stableId,
      addedAt: initial?.addedAt || now,
      updatedAt: now,
    })
  }

  return (
    <Modal onClose={onClose} maxWidth="2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-rl-border">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold mb-1">
            {initial ? 'Editando landing page' : 'Nova landing page'}
          </p>
          <h3 className="text-lg font-black text-rl-text leading-tight">
            Cadastro de landing page
          </h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form */}
      <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
        {/* Data + Nome */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Data de criação" required>
            <input
              type="date"
              value={values.createdAt || ''}
              onChange={(e) => set('createdAt', e.target.value)}
              className="input-field w-full"
            />
          </Field>
          <Field label="Nome da landing page" required>
            <input
              type="text"
              value={values.nome || ''}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Ex: LP Webinar Julho, LP Diagnóstico..."
              className="input-field w-full"
              maxLength={120}
            />
          </Field>
        </div>

        {/* URL */}
        <Field label="Link da landing page" required>
          <div className="relative">
            <input
              type="text"
              value={values.url || ''}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://..."
              className="input-field w-full pr-9"
            />
            {isValidUrl && (
              <a
                href={values.url}
                target="_blank"
                rel="noreferrer"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-rl-muted hover:text-rl-green transition-all"
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </Field>

        {/* Funil */}
        <Field
          label="Funil da landing page"
          hint="Usa os mesmos funis da metodologia (Webinar, Diagnóstico, VSL, etc)."
        >
          <select
            value={values.funilId || ''}
            onChange={(e) => set('funilId', e.target.value)}
            className="input-field w-full"
          >
            <option value="">— escolha um funil —</option>
            {FUNNELS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon}  {f.label}
              </option>
            ))}
          </select>
          {selectedFunil && (
            <p className="text-[11px] text-rl-muted mt-1.5 leading-snug">{selectedFunil.desc}</p>
          )}
        </Field>

        {/* Observação */}
        <Field label="Observação (opcional)">
          <textarea
            value={values.observacao || ''}
            onChange={(e) => set('observacao', e.target.value)}
            rows={3}
            placeholder="Ex: variante B do teste de headline, promessa focada em prazo..."
            className="input-field w-full resize-none"
          />
        </Field>

        {/* Status */}
        <Field label="Status da landing page" required>
          <div className="grid grid-cols-3 gap-2">
            {LP_STATUS_OPTIONS.map((s) => {
              const Icon = STATUS_ICON[s.id] || Clock
              const active = values.status === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => set('status', s.id)}
                  className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-semibold transition-all"
                  style={{
                    background: active ? s.bgColor : undefined,
                    borderColor: active ? s.borderColor : undefined,
                    color: active ? s.color : undefined,
                  }}
                >
                  <Icon className="w-3.5 h-3.5" /> {s.label}
                </button>
              )
            })}
          </div>
        </Field>

        {/* ── Aprovação do cliente ───────────────────────────────────────── */}
        <div className="pt-3 border-t border-rl-border">
          {!initial ? (
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enviarAprovacao}
                onChange={(e) => setEnviarAprovacao(e.target.checked)}
                className="mt-0.5 accent-[#7C3AED]"
              />
              <span>
                <span className="text-xs font-bold text-rl-text uppercase tracking-wide block">
                  Enviar pra aprovação do cliente
                </span>
                <span className="text-[11px] text-rl-muted">
                  A landing page aparece no link de aprovação e o cliente aprova ou reprova antes de ir pro ar.
                </span>
              </span>
            </label>
          ) : (
            <AprovacaoStatus
              aprovacao={values.aprovacao}
              onEnviar={() => set('aprovacao', { status: 'pendente', enviadoEm: new Date().toISOString() })}
            />
          )}
        </div>

        {/* Aviso URL inválida */}
        {values.url && !isValidUrl && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-gold/5 border border-rl-gold/30">
            <AlertTriangle className="w-4 h-4 text-rl-gold mt-0.5 shrink-0" />
            <p className="text-xs text-rl-text">
              O link parece não começar com http(s)://. Confira antes de salvar.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-rl-border flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="text-xs px-4 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-rl-green text-white font-semibold hover:bg-rl-green/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-3.5 h-3.5" /> {initial ? 'Salvar alterações' : 'Salvar landing page'}
        </button>
      </div>
    </Modal>
  )
}

// Status da aprovação do cliente ao EDITAR uma LP — espelho do modal de anúncio.
function AprovacaoStatus({ aprovacao, onEnviar }) {
  const info = aprovacao ? APROVACAO_BY_ID[aprovacao.status] : null

  const enviarBtn = (label) => (
    <button
      type="button"
      onClick={onEnviar}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-rl-purple/40 text-rl-purple hover:bg-rl-purple/10 transition-all"
    >
      <Send className="w-3.5 h-3.5" /> {label}
    </button>
  )

  if (!info) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-rl-text uppercase tracking-wide">Aprovação do cliente</p>
          <p className="text-[11px] text-rl-muted">Essa landing page ainda não foi enviada pro cliente avaliar.</p>
        </div>
        {enviarBtn('Enviar pra aprovação')}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-rl-text uppercase tracking-wide">Aprovação do cliente</p>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
            style={{ color: info.color, background: info.bgColor, borderColor: info.borderColor }}
          >
            {aprovacao.status === 'aprovado' && <CheckCircle2 className="w-3 h-3" />}
            {aprovacao.status === 'reprovado' && <XCircle className="w-3 h-3" />}
            {aprovacao.status === 'pendente' && <Clock className="w-3 h-3" />}
            {info.label}
          </span>
        </div>
        {aprovacao.status === 'reprovado' && enviarBtn('Reenviar pra aprovação')}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-rl-muted">
        {aprovacao.enviadoEm && (
          <span>Enviada pra aprovação em <span className="font-semibold text-rl-subtle">{fmtDateTimeBR(aprovacao.enviadoEm)}</span></span>
        )}
        {aprovacao.decididoEm && (
          <span>
            {aprovacao.status === 'aprovado' ? 'Aprovada' : 'Reprovada'} pelo cliente em{' '}
            <span className="font-semibold text-rl-subtle">{fmtDateTimeBR(aprovacao.decididoEm)}</span>
          </span>
        )}
      </div>

      {aprovacao.status === 'reprovado' && (
        <>
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-red-500">Motivo da reprovação</p>
            <p className="text-sm text-rl-text mt-1 whitespace-pre-wrap">{aprovacao.motivo || '—'}</p>
          </div>
          <div className="rounded-xl bg-rl-surface/60 border border-rl-border px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-rl-muted">Como o cliente quer a landing page</p>
            <p className="text-sm text-rl-text mt-1 whitespace-pre-wrap">{aprovacao.sugestao || '—'}</p>
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="text-xs font-bold text-rl-text uppercase tracking-wide mb-1 block">
        {label} {required && <span className="text-rl-red">*</span>}
      </label>
      {hint && <p className="text-[11px] text-rl-muted mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}
