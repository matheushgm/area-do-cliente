import { useState } from 'react'
import { Copy, CheckCheck, FileDown, Pencil, Check, X, Sparkles, Loader2 } from 'lucide-react'
import MarkdownBlock from './MarkdownBlock'
import { exportCreativoSinglePDF } from '../../lib/creativoPDF'

// ── Split ─────────────────────────────────────────────────────────────────────

const AD_HEADER = /^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+/im

function isNonAd(chunk) {
  return (
    /TABELA\s+DO\s+LABORAT/i.test(chunk)    ||
    /INSIGHTS?\s+ESTRAT[ÉE]G/i.test(chunk)  ||
    /COMBINAÇÕES?\s+DE\s+ALTA/i.test(chunk) ||
    /PRÓXIMOS?\s+GANCHOS/i.test(chunk)      ||
    /^\|\s*Tipo\s+de\s+Gancho/im.test(chunk)
  )
}

function splitChunks(content) {
  const parts = content.split(/(?=^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+)/im)
  const adChunks = parts.filter((p) => {
    const t = p.trim()
    return t && AD_HEADER.test(t) && !isNonAd(t)
  })
  if (adChunks.length > 0) return adChunks.map((chunk) => ({ chunk }))

  const chunks = content.split(/\n---\n/).map((c) => c.trim()).filter(Boolean)
  if (chunks.length > 1) return chunks.map((chunk) => ({ chunk }))

  return [{ chunk: content }]
}

function parseChunk(chunk) {
  const firstLine = chunk.split('\n')[0].trim()
  const headingMatch = firstLine.match(/^#{1,3}\s+(.+)/)
  if (!headingMatch) return { title: '', body: chunk }
  const title = headingMatch[1].trim()
  const body  = chunk.slice(firstLine.length).trimStart()
  return { title, body: body || chunk }
}

// ── ChunkCard ─────────────────────────────────────────────────────────────────

function ChunkCard({ item, index, type, companyName, onChange, onRefine }) {
  const { title, body } = parseChunk(item.chunk)

  const [copied,        setCopied]        = useState(false)
  const [exporting,     setExporting]     = useState(false)
  const [editing,       setEditing]       = useState(false)
  const [draft,         setDraft]         = useState('')
  const [refineOpen,    setRefineOpen]    = useState(false)
  const [refineNote,    setRefineNote]    = useState('')
  const [isRefining,    setIsRefining]    = useState(false)
  const [streamingBody, setStreamingBody] = useState('')

  function copyAll() {
    navigator.clipboard.writeText(item.chunk)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  function handleExport() {
    setExporting(true)
    try { exportCreativoSinglePDF({ content: item.chunk, type: type || 'estatico', index, companyName }) }
    finally { setExporting(false) }
  }

  function startEdit() { setDraft(body); setEditing(true); setRefineOpen(false) }
  function cancelEdit() { setEditing(false); setDraft('') }
  function saveEdit() {
    if (onChange && draft.trim()) onChange(draft.trim())
    setEditing(false)
    setDraft('')
  }

  function toggleRefine() {
    setRefineOpen((v) => !v)
    setEditing(false)
    setRefineNote('')
  }

  async function submitRefine() {
    if (!refineNote.trim() || !onRefine || isRefining) return
    setIsRefining(true)
    setStreamingBody('')
    try {
      const refined = await onRefine(item.chunk, refineNote, (text) => setStreamingBody(text))
      if (onChange) onChange(refined)
      setRefineOpen(false)
      setRefineNote('')
    } catch (e) {
      console.error('Refinar falhou:', e)
    } finally {
      setIsRefining(false)
      setStreamingBody('')
    }
  }

  const displayBody = streamingBody || body

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-rl-border/40 flex items-start justify-between gap-3 bg-rl-surface/40">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-rl-muted font-semibold uppercase tracking-wide mb-0.5">
            Criativo {index + 1}
          </div>
          {title && (
            <p className="text-sm font-semibold text-rl-text leading-snug">{title}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {editing ? (
            <>
              <button
                onClick={saveEdit}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-rl-purple/10 border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20 transition-all"
              >
                <Check className="w-3 h-3" /> Salvar
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-red-400 transition-all"
              >
                <X className="w-3 h-3" /> Cancelar
              </button>
            </>
          ) : (
            <>
              {onRefine && (
                <button
                  onClick={toggleRefine}
                  className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                    refineOpen
                      ? 'bg-rl-purple/20 border-rl-purple/40 text-rl-purple'
                      : 'bg-rl-purple/10 border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20'
                  }`}
                >
                  <Sparkles className="w-3 h-3" /> Refinar
                </button>
              )}
              {onChange && (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-blue transition-all"
                >
                  <Pencil className="w-3 h-3" /> Editar
                </button>
              )}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple transition-all disabled:opacity-50"
              >
                <FileDown className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={copyAll}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple transition-all"
              >
                {copied ? <CheckCheck className="w-3 h-3 text-rl-green" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full min-h-[260px] bg-rl-surface/60 border border-rl-purple/40 rounded-xl p-3 text-xs text-rl-text font-mono leading-relaxed resize-y focus:outline-none focus:border-rl-purple transition-colors"
            autoFocus
          />
        ) : (
          <MarkdownBlock content={displayBody} />
        )}
      </div>

      {/* Painel de refinamento */}
      {refineOpen && !editing && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-rl-purple/20 bg-rl-purple/5">
          <p className="text-[10px] font-semibold text-rl-purple uppercase tracking-wide pt-3">
            O que deseja melhorar?
          </p>
          <textarea
            value={refineNote}
            onChange={(e) => setRefineNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitRefine() }}
            disabled={isRefining}
            placeholder="Ex: deixe mais direto, use linguagem mais informal, enfatize o prazo..."
            rows={3}
            className="w-full bg-rl-surface/60 border border-rl-purple/30 rounded-xl p-3 text-xs text-rl-text leading-relaxed resize-none focus:outline-none focus:border-rl-purple/60 transition-colors disabled:opacity-50 placeholder:text-rl-muted/60"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={submitRefine}
              disabled={isRefining || !refineNote.trim()}
              className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-rl-purple/10 border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20 transition-all disabled:opacity-50"
            >
              {isRefining
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Refinando...</>
                : <><Sparkles className="w-3 h-3" /> Refinar</>}
            </button>
            <button
              onClick={() => { setRefineOpen(false); setRefineNote('') }}
              disabled={isRefining}
              className="text-[10px] px-2.5 py-1 text-rl-muted hover:text-rl-text transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CreativeResultBlock ───────────────────────────────────────────────────────

export default function CreativeResultBlock({ content, type, companyName, onChunkChange, onRefine }) {
  const [allCopied, setAllCopied] = useState(false)
  const items = splitChunks(content)

  function copyAll() {
    navigator.clipboard.writeText(content)
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-rl-muted">
          {items.length} criativo{items.length !== 1 ? 's' : ''} gerado{items.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={copyAll}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
        >
          {allCopied ? <CheckCheck className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />}
          {allCopied ? 'Tudo copiado!' : 'Copiar tudo'}
        </button>
      </div>

      {items.map((item, i) => (
        <ChunkCard
          key={i}
          item={item}
          index={i}
          type={type}
          companyName={companyName}
          onChange={onChunkChange ? (newContent) => onChunkChange(i, newContent) : undefined}
          onRefine={onRefine ? (chunkContent, note, onChunk) => onRefine(i, chunkContent, note, onChunk) : undefined}
        />
      ))}
    </div>
  )
}
