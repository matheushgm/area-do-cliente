import { useState, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase, deleteFile, getSignedUrl } from '../lib/supabase'
import {
  Upload, Paperclip, Download, Trash2, AlertCircle,
  FileText, Image, File, FileSpreadsheet, FileVideo,
  FileAudio, Archive, Save, CheckCircle2, Loader2,
} from 'lucide-react'
import EmptyState from './UI/EmptyState'

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_MB  = 8
const MAX_TOTAL_MB = 30
const MAX_FILE     = MAX_FILE_MB  * 1024 * 1024
const MAX_TOTAL    = MAX_TOTAL_MB * 1024 * 1024

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function FileIcon({ type, className = 'w-4 h-4' }) {
  if (type?.startsWith('image/'))                              return <Image           className={className} />
  if (type === 'application/pdf')                              return <FileText        className={className} />
  if (type?.includes('sheet') || type?.includes('excel') || type?.includes('csv'))
                                                               return <FileSpreadsheet className={className} />
  if (type?.includes('video'))                                 return <FileVideo       className={className} />
  if (type?.includes('audio'))                                 return <FileAudio       className={className} />
  if (type?.includes('zip') || type?.includes('rar'))          return <Archive         className={className} />
  return <File className={className} />
}

function fileColor(type) {
  if (type?.startsWith('image/'))    return 'text-rl-blue   bg-rl-blue/10'
  if (type === 'application/pdf')    return 'text-red-400   bg-red-400/10'
  if (type?.includes('sheet') || type?.includes('excel') || type?.includes('csv'))
                                     return 'text-rl-green  bg-rl-green/10'
  if (type?.includes('video'))       return 'text-rl-purple bg-rl-purple/10'
  if (type?.includes('audio'))       return 'text-rl-cyan   bg-rl-cyan/10'
  return 'text-rl-muted bg-rl-surface'
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AnexosModule({ project }) {
  const { updateProject } = useApp()
  const fileInputRef = useRef(null)
  const savedTimer   = useRef(null)

  const [dragging,  setDragging]  = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState(null)
  const [saved,     setSaved]     = useState(false)

  const attachments = project.attachments || []
  const totalSize   = attachments.reduce((s, a) => s + (a.size || 0), 0)
  const pct         = Math.min(100, (totalSize / MAX_TOTAL) * 100)

  // ── Upload files to Supabase Storage ────────────────────────────────────────
  const handleFiles = useCallback(async (files) => {
    setError(null)
    if (!files?.length) return
    setUploading(true)

    const fileArray      = Array.from(files)
    const newAttachments = []

    for (const file of fileArray) {
      if (file.size > MAX_FILE) {
        setError(`"${file.name}" excede o limite de ${MAX_FILE_MB} MB por arquivo.`)
        setUploading(false)
        return
      }
      const projectedTotal = totalSize
        + newAttachments.reduce((s, a) => s + a.size, 0)
        + file.size
      if (projectedTotal > MAX_TOTAL) {
        setError(`Limite total de ${MAX_TOTAL_MB} MB atingido. Remova arquivos antes de adicionar novos.`)
        setUploading(false)
        return
      }

      // Gera ID único e faz upload para o bucket 'attachments'
      const attachId    = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const storagePath = `${project.id}/${attachId}`

      if (supabase) {
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(storagePath, file, { upsert: true })

        if (uploadError) {
          setError(`Erro ao salvar "${file.name}": ${uploadError.message}`)
          setUploading(false)
          return
        }
      }

      newAttachments.push({
        id:           attachId,
        name:         file.name,
        size:         file.size,
        type:         file.type || 'application/octet-stream',
        storage_path: storagePath,
        uploadedAt:   new Date().toISOString(),
      })
    }

    const updated = [...attachments, ...newAttachments]
    updateProject(project.id, { attachments: updated })
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''

    // Feedback de salvo automático após upload
    clearTimeout(savedTimer.current)
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 3000)
  }, [attachments, project.id, totalSize, updateProject])

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (a) => {
    if (a.storage_path) {
      await deleteFile('attachments', a.storage_path)
    }
    updateProject(project.id, {
      attachments: attachments.filter((att) => att.id !== a.id),
    })
  }, [attachments, project.id, updateProject])

  // ── Download ─────────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async (a) => {
    // Suporte a anexos legados com base64
    let href = a.data ?? null

    if (!href && a.storage_path) {
      href = await getSignedUrl('attachments', a.storage_path)
      if (!href) {
        setError('Erro ao gerar link de download. Tente novamente.')
        return
      }
    }

    if (!href) {
      setError('Arquivo não disponível para download.')
      return
    }

    const link = document.createElement('a')
    link.href     = href
    link.download = a.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  // ── Manual save (re-sync com Supabase) ───────────────────────────────────────
  const handleSave = useCallback(() => {
    clearTimeout(savedTimer.current)
    updateProject(project.id, { attachments })
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 3000)
  }, [attachments, project.id, updateProject])

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Drop zone */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
          uploading
            ? 'border-rl-purple/40 bg-rl-purple/5 cursor-wait'
            : dragging
              ? 'border-rl-purple bg-rl-purple/10 scale-[1.01] cursor-copy'
              : 'border-rl-border hover:border-rl-purple/50 hover:bg-rl-purple/5 cursor-pointer'
        }`}
      >
        <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center transition-colors ${
          dragging ? 'bg-rl-purple/20' : 'bg-rl-surface'
        }`}>
          {uploading
            ? <Loader2 className="w-6 h-6 text-rl-purple animate-spin" />
            : <Upload className={`w-6 h-6 ${dragging ? 'text-rl-purple' : 'text-rl-muted'}`} />
          }
        </div>
        <p className="text-sm font-semibold text-rl-text mb-1">
          {uploading ? 'Fazendo upload...' : 'Solte arquivos aqui ou clique para selecionar'}
        </p>
        <p className="text-xs text-rl-muted">
          PDF, DOC, XLS, PNG, JPG, MP4 e mais · Máx. {MAX_FILE_MB} MB por arquivo · Total: {MAX_TOTAL_MB} MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto shrink-0 text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {/* Storage usage */}
      {attachments.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-rl-muted mb-1.5">
            <span>{attachments.length} arquivo{attachments.length !== 1 ? 's' : ''} anexado{attachments.length !== 1 ? 's' : ''}</span>
            <span className={pct > 85 ? 'text-rl-gold font-semibold' : ''}>
              {fmtSize(totalSize)} / {MAX_TOTAL_MB} MB
            </span>
          </div>
          <div className="h-1.5 bg-rl-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct > 85 ? 'bg-rl-gold' : 'bg-gradient-rl'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* File list */}
      {attachments.length === 0 ? (
        <EmptyState
          icon={<Paperclip className="w-8 h-8" />}
          title="Nenhum anexo ainda"
          subtitle="Adicione contratos, briefings, relatórios e documentos importantes"
        />
      ) : (
        <div className="space-y-2">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 glass-card px-4 py-3 hover:border-rl-border/60 transition-colors">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${fileColor(a.type)}`}>
                <FileIcon type={a.type} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-rl-text truncate">{a.name}</p>
                <p className="text-xs text-rl-muted mt-0.5">
                  {fmtSize(a.size)} · {fmtDate(a.uploadedAt || a.uploaded_at)}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleDownload(a)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                  title="Baixar arquivo"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(a)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                  title="Remover arquivo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save button + confirmation */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={uploading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
              saved
                ? 'bg-rl-green/10 border-rl-green/40 text-rl-green'
                : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/40 hover:text-rl-purple'
            }`}
          >
            {saved
              ? <><CheckCircle2 className="w-4 h-4" /> Anexos salvos!</>
              : <><Save className="w-4 h-4" /> Salvar anexos</>
            }
          </button>

          {saved && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rl-green/5 border border-rl-green/20 text-rl-green text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {attachments.length} arquivo{attachments.length !== 1 ? 's' : ''} salvo{attachments.length !== 1 ? 's' : ''} com sucesso
            </div>
          )}
        </div>
      )}
    </div>
  )
}
