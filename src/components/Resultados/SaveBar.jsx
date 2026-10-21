import { Loader2, CheckCircle2, AlertTriangle, Save } from 'lucide-react'

const hhmm = (d) => d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

// Estado + botão "Salvar" dos formulários públicos de Resultados.
// `pendingEdit`: há uma linha aberta com campos ainda não confirmados.
export function SaveStatus({ status, savedAt, pendingEdit }) {
  if (status === 'saving') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-muted">
      <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
    </span>
  )
  if (status === 'error') return (
    <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
      <AlertTriangle className="w-3 h-3" /> Não salvou. Toque em Salvar
    </span>
  )
  if (status === 'dirty' || pendingEdit) return (
    <span className="flex items-center gap-1.5 text-xs text-rl-gold font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-rl-gold" /> {pendingEdit && status !== 'dirty' ? 'Linha aberta, confirme antes de salvar' : 'Alterações não salvas'}
    </span>
  )
  if (status === 'saved') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-green">
      <CheckCircle2 className="w-3 h-3" /> Salvo{savedAt ? ` às ${hhmm(savedAt)}` : ''}
    </span>
  )
  return null
}

export function SaveButton({ status, onClick, className = '' }) {
  const busy = status === 'saving'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`btn-primary flex items-center justify-center gap-1.5 text-sm disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      {status === 'error' ? 'Tentar salvar de novo' : 'Salvar'}
    </button>
  )
}

// Barra fixa no rodapé: o botão fica sempre ao alcance, inclusive no celular.
export default function SaveBar({ status, savedAt, pendingEdit, onSave }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-20 border-t border-rl-border bg-rl-surface/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <SaveStatus status={status} savedAt={savedAt} pendingEdit={pendingEdit} />
        <SaveButton status={status} onClick={onSave} className="min-w-[140px]" />
      </div>
    </div>
  )
}
