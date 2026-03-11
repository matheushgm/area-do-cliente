import { useState, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import {
  Upload, Paperclip, Download, Trash2, AlertCircle,
  FileText, Image, File, FileSpreadsheet, FileVideo,
  FileAudio, Archive,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_MB  = 8
const MAX_TOTAL_MB = 30
const MAX_FILE     = MAX_FILE_MB  * 1024 * 1024
const MAX_TOTAL    = MAX_TOTAL_MB * 1024 * 1024

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024)             return `${bytes} B`
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function FileIcon({ type, className = 'w-4 h-4' }) {
  if (type?.startsWith('image/'))                   return <Image          className={className} />
  if (type === 'application/pdf')                   return <FileText       className={className} />
  if (type?.includes('sheet') || type?.includes('excel') || type?.includes('csv'))
                                                    return <FileSpreadsheet className={className} />
  if (type?.includes('video'))                      return <FileVideo      className={className} />
  if (type?.includes('audio'))                      return <FileAudio      className={className} />
  if (type?.includes('zip') || type?.includes('rar'))return <Archive       className={className} />
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
  const [dragging,  setDragging]  = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState(null)

  const attachments = project.attachments || []
  const totalSize   = attachments.reduce((s, a) => s + (a.size || 0), 0)
  const pct         = Math.min(100, (totalSize / MAX_TOTAL) * 100)

  const readFile = useCallback((file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = (ev) => resolve(ev.target.result)
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo'))
    reader.readAsDataURL(file)
  }), [])

  const handleFiles = useCallback(async (files) => {
    setError(null)
    if (!files?.length) return
    setUploading(true)

    const fileArray = Array.from(files)
    const newAttachments = []

    for (const file of fileArray) {
      if (file.size > MAX_FILE) {
        setError(`"${file.name}" excede o limite de ${MAX_FILE_MB} MB por arquivo.`)
        setUploading(false)
        return
      }
      const projectedTotal = totalSize + newAttachments.reduce((s, a) => s + a.size, 0) + file.size
      if (projectedTotal > MAX_TOTAL) {
        setError(`Limite total de ${MAX_TOTAL_MB} MB atingido. Remova arquivos antes de adicionar novos.`)
        setUploading(false)
        return
      }
      try {
        const data = await readFile(file)
        newAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          data,
          uploadedAt: new Date().toISOString(),
        })
      } catch {
        setError(`Erro ao processar "${file.name}".`)
        setUploading(false)
        return
      }
    }

    updateProject(project.id, { attachments: [...attachments, ...newAttachments] })
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [attachments, project.id, readFile, totalSize, updateProject])

  const handleDelete = useCallback((id) => {
    updateProject(project.id, { attachments: attachments.filter((a) => a.id !== id) })
  }, [attachments, project.id, updateProject])

  const handleDownload = useCallback((a) => {
    const link = document.createElement('a')
    link.href     = a.data
    link.download = a.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ${
          dragging
            ? 'border-rl-purple bg-rl-purple/10 scale-[1.01]'
            : 'border-rl-border hover:border-rl-purple/50 hover:bg-rl-purple/5'
        }`}
      >
        <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center transition-colors ${
          dragging ? 'bg-rl-purple/20' : 'bg-rl-surface'
        }`}>
          <Upload className={`w-6 h-6 ${dragging ? 'text-rl-purple' : 'text-rl-muted'}`} />
        </div>
        <p className="text-sm font-semibold text-rl-text mb-1">
          {uploading ? 'Processando...' : 'Solte arquivos aqui ou clique para selecionar'}
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
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Paperclip className="w-8 h-8 text-rl-muted/30 mb-3" />
          <p className="text-sm text-rl-muted">Nenhum anexo ainda</p>
          <p className="text-xs text-rl-muted/60 mt-1">Adicione contratos, briefings, relatórios e documentos importantes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 glass-card px-4 py-3 hover:border-rl-border/60 transition-colors">
              {/* Icon */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${fileColor(a.type)}`}>
                <FileIcon type={a.type} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-rl-text truncate">{a.name}</p>
                <p className="text-xs text-rl-muted mt-0.5">
                  {fmtSize(a.size)} · {new Date(a.uploadedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleDownload(a)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                  title="Baixar arquivo"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
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
    </div>
  )
}
