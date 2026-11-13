import { fmtDate } from '../../lib/utils'
import { useState } from 'react'
import { Copy, CheckCheck, FileDown, Pencil, Check, X } from 'lucide-react'
import { exportCreativoSinglePDF } from '../../lib/creativoPDF'
import MarkdownBlock from './MarkdownBlock'
import { useI18n } from '../../i18n'

export default function CreativeCard({ content, index, type, companyName, onChange, createdAt }) {
  const { t } = useI18n()
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
          <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">{t('criativos.card.criativoN', { n: index + 1 })}</span>
          {fmtDate(createdAt, { time: true }) && (
            <span className="text-[10px] text-rl-muted/70">· {fmtDate(createdAt, { time: true })}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Edit mode: save / cancel */}
          {editing ? (
            <>
              <button
                onClick={saveEdit}
                title={t('criativos.card.salvarEdicao')}
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-purple/10 border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20 transition-all"
              >
                <Check className="w-3 h-3" />
                {t('comum.salvar')}
              </button>
              <button
                onClick={cancelEdit}
                title={t('criativos.card.cancelarEdicao')}
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-red-400 transition-all"
              >
                <X className="w-3 h-3" />
                {t('comum.cancelar')}
              </button>
            </>
          ) : (
            <>
              {/* Edit button — only when onChange provided */}
              {onChange && (
                <button
                  onClick={startEdit}
                  title={t('criativos.card.editarAnuncio')}
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-blue transition-all"
                >
                  <Pencil className="w-3 h-3" />
                  {t('comum.editar')}
                </button>
              )}
              <button
                onClick={handleExport}
                disabled={exporting}
                title={t('criativos.card.exportarPdf')}
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
                {copied ? t('comum.copiado') : t('comum.copiar')}
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
