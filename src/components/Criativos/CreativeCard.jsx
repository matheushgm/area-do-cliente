import { useState } from 'react'
import { Copy, CheckCheck, FileDown, Pencil, Check, X } from 'lucide-react'
import { exportCreativoSinglePDF } from '../../lib/creativoPDF'
import MarkdownBlock from './MarkdownBlock'

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function CreativeCard({ content, index, type, companyName, onChange, createdAt }) {
  const [copied,    setCopied]    = useState(false)
  const [exporting, setExporting] = useState(false)
  const [editing,   setEditing]   = useState(false)
  const [draft,     setDraft]     = useState('')

  function handleCopy() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleExport() {
    setExporting(true)
    try {
      exportCreativoSinglePDF({ content, type: type || 'estatico', index, companyName })
    } finally {
      setExporting(false)
    }
  }

  function startEdit() {
    setDraft(content)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft('')
  }

  function saveEdit() {
    if (onChange && draft.trim()) onChange(draft.trim())
    setEditing(false)
    setDraft('')
  }


  return (
    <div className="glass-card p-5 border border-rl-border/60">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">Criativo {index + 1}</span>
          {fmtDate(createdAt) && (
            <span className="text-[10px] text-rl-muted/70">· {fmtDate(createdAt)}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Edit mode: save / cancel */}
          {editing ? (
            <>
              <button
                onClick={saveEdit}
                title="Salvar edição"
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-purple/10 border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20 transition-all"
              >
                <Check className="w-3 h-3" />
                Salvar
              </button>
              <button
                onClick={cancelEdit}
                title="Cancelar edição"
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-red-400 transition-all"
              >
                <X className="w-3 h-3" />
                Cancelar
              </button>
            </>
          ) : (
            <>
              {/* Edit button — only when onChange provided */}
              {onChange && (
                <button
                  onClick={startEdit}
                  title="Editar anúncio"
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-blue transition-all"
                >
                  <Pencil className="w-3 h-3" />
                  Editar
                </button>
              )}
              <button
                onClick={handleExport}
                disabled={exporting}
                title="Exportar este anúncio em PDF"
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple transition-all disabled:opacity-50"
              >
                <FileDown className="w-3 h-3" />
                PDF
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple transition-all"
              >
                {copied ? <CheckCheck className="w-3 h-3 text-rl-green" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit mode: textarea */}
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full min-h-[260px] bg-rl-surface/60 border border-rl-purple/40 rounded-xl p-3 text-xs text-rl-text font-mono leading-relaxed resize-y focus:outline-none focus:border-rl-purple transition-colors"
          autoFocus
        />
      ) : (
        <MarkdownBlock content={content} />
      )}
    </div>
  )
}
