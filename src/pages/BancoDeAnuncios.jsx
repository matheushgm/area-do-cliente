import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import AppSidebar from '../components/AppSidebar'
import {
  Library, Plus, Image, X, Upload,
  Share2, Loader2, Check, Trash2,
  ChevronDown, Play, Film, Filter,
  Download, Maximize2, Menu, Zap,
} from 'lucide-react'

const FUNILS = [
  'Funil de Webinar',
  'Funil de Aplicação',
  'Funil de Diagnóstico',
  'Funil de E-commerce (Venda Direta)',
  'Funil de Webinar Pago',
  'Funil de Isca Digital',
  'Funil de VSL',
  'Funil de Quiz',
  'Lançamento',
  'Funil de Desafio',
  'Funil Win-Your-Money-Back',
]

function AdCard({ ad, onDelete }) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await onDelete(ad.id)
  }

  async function handleDownload() {
    try {
      const res  = await fetch(ad.url)
      const blob = await res.blob()
      const ext  = ad.url.split('.').pop().split('?')[0] || (ad.type === 'video' ? 'mp4' : 'jpg')
      const name = (ad.title || `anuncio-${ad.id.slice(0, 8)}`).replace(/\s+/g, '-') + '.' + ext
      const href = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = href; a.download = name
      a.click()
      URL.revokeObjectURL(href)
    } catch {
      window.open(ad.url, '_blank')
    }
  }

  return (
    <div className="glass-card overflow-hidden group relative flex flex-col">
      {/* Media area */}
      <div className="relative bg-rl-bg aspect-video flex items-center justify-center overflow-hidden">
        {ad.type === 'video' ? (
          <video
            src={ad.url}
            controls
            className="w-full h-full object-cover"
            preload="metadata"
          />
        ) : (
          <img
            src={ad.url}
            alt={ad.title || 'Anúncio estático'}
            className="w-full h-full object-cover"
          />
        )}

        {/* Action buttons — visible on hover */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* View full */}
          <a
            href={ad.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Visualizar"
            className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-rl-purple/80 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </a>
          {/* Download */}
          <button
            onClick={handleDownload}
            title="Baixar arquivo"
            className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-rl-blue/80 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Excluir"
            className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-red-500/80 transition-colors"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            ad.type === 'video'
              ? 'bg-rl-purple/10 text-rl-purple border-rl-purple/25'
              : 'bg-rl-blue/10 text-rl-blue border-rl-blue/25'
          }`}>
            {ad.type === 'video' ? 'Vídeo' : 'Estático'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rl-gold/10 text-rl-gold border border-rl-gold/25 truncate max-w-[180px]">
            {ad.funil}
          </span>
        </div>
        {ad.title && (
          <p className="text-xs font-semibold text-rl-text line-clamp-1">{ad.title}</p>
        )}
        {ad.notes && (
          <p className="text-[11px] text-rl-muted line-clamp-2">{ad.notes}</p>
        )}
      </div>
    </div>
  )
}

function UploadZone({ type, file, preview, onSelect, onClear }) {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const accept   = type === 'video' ? 'video/*' : 'image/*'
  const isVideo  = type === 'video'
  const maxLabel = isVideo ? 'MP4, MOV, WEBM — máx. 200 MB' : 'PNG, JPG, WEBP — máx. 10 MB'

  function handleFile(f) {
    if (!f) return
    const isValidType = isVideo ? f.type.startsWith('video/') : f.type.startsWith('image/')
    if (!isValidType) return
    onSelect(f)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
      onClick={() => !preview && fileRef.current?.click()}
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all min-h-[180px] ${
        dragging
          ? 'border-rl-cyan bg-rl-cyan/10 cursor-copy'
          : preview
          ? 'border-rl-border p-0 overflow-hidden cursor-default'
          : 'border-rl-border hover:border-rl-cyan/50 bg-rl-surface cursor-pointer'
      }`}
    >
      {preview ? (
        <>
          {isVideo ? (
            <video src={preview} controls className="w-full max-h-56 rounded-2xl object-cover" />
          ) : (
            <img src={preview} alt="Preview" className="w-full max-h-56 object-cover rounded-2xl" />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onClear() }}
            className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-red-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
            className="absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded-lg bg-black/50 text-white hover:bg-black/70"
          >
            Trocar arquivo
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-rl-muted p-6">
          {isVideo ? <Play className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
          <p className="text-sm font-medium text-rl-text">
            {isVideo ? 'Arraste o vídeo ou clique para enviar' : 'Arraste a imagem ou clique para enviar'}
          </p>
          <p className="text-xs">{maxLabel}</p>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  )
}

export default function BancoDeAnuncios() {
  const navigate = useNavigate()
  const { squads, teamMembers } = useApp()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const emptyCounts = { all: 0, churn: 0, squads: {}, risks: {}, momentos: {} }
  const activeAccounts = teamMembers.filter(m => !m.disabled)

  // ── Form state
  const [type,    setType]    = useState('video')
  const [funil,   setFunil]   = useState('')
  const [title,   setTitle]   = useState('')
  const [notes,   setNotes]   = useState('')
  const [file,    setFile]    = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [formError, setFormError] = useState(null)

  // ── Library state
  const [ads,         setAds]         = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filterType,  setFilterType]  = useState('todos')
  const [filterFunil, setFilterFunil] = useState('todos')
  const [copied,      setCopied]      = useState(false)

  useEffect(() => { loadAds() }, [])

  async function loadAds() {
    setLoading(true)
    const { data } = await supabase
      .from('ad_bank')
      .select('*')
      .order('created_at', { ascending: false })
    setAds(data || [])
    setLoading(false)
  }

  function handleSelect(f) {
    setFile(f)
    const isVideo = f.type.startsWith('video/')
    if (isVideo) {
      setPreview(URL.createObjectURL(f))
    } else {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target.result)
      reader.readAsDataURL(f)
    }
  }

  function handleClear() {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
  }

  function resetForm() {
    handleClear()
    setFunil('')
    setTitle('')
    setNotes('')
    setFormError(null)
  }

  const canAdd = funil && file

  async function handleAdd() {
    if (!canAdd) return
    setFormError(null)
    setSaving(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('ad-bank')
        .upload(path, file, { contentType: file.type })
      if (uploadErr) throw uploadErr

      const url = supabase.storage.from('ad-bank').getPublicUrl(path).data.publicUrl

      const { error } = await supabase.from('ad_bank').insert({
        type,
        funil,
        title: title.trim() || null,
        url,
        notes: notes.trim() || null,
      })
      if (error) throw error

      resetForm()
      await loadAds()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await supabase.from('ad_bank').delete().eq('id', id)
    setAds((prev) => prev.filter((a) => a.id !== id))
  }

  function handleShare() {
    const params = new URLSearchParams()
    if (filterType  !== 'todos') params.set('type',  filterType)
    if (filterFunil !== 'todos') params.set('funil', filterFunil)
    const url = `${window.location.origin}/banco-publico${params.toString() ? '?' + params.toString() : ''}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const filtered = ads.filter((ad) => {
    if (filterType  !== 'todos' && ad.type  !== filterType)  return false
    if (filterFunil !== 'todos' && ad.funil !== filterFunil) return false
    return true
  })

  return (
    <div className="min-h-screen flex bg-gradient-dark">

      <AppSidebar
        filter="all"
        setFilter={() => navigate('/')}
        counts={emptyCounts}
        activeAccounts={activeAccounts}
        squads={squads}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu de navegação"
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-rl-text text-sm">Banco de Anúncios</span>
          </div>
        </div>

        <main className="flex-1 px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rl-cyan/10 flex items-center justify-center">
            <Library className="w-5 h-5 text-rl-cyan" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-rl-text">Banco de Anúncios</h1>
            <p className="text-sm text-rl-muted">Arsenal de referência para criativos por funil</p>
          </div>
        </div>

        {/* ── Add Form ──────────────────────────────────────── */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-rl-text mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-rl-cyan" /> Adicionar anúncio
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* LEFT — upload area */}
            <UploadZone
              type={type}
              file={file}
              preview={preview}
              onSelect={handleSelect}
              onClear={handleClear}
            />

            {/* RIGHT — metadata */}
            <div className="space-y-3">
              {/* Type toggle */}
              <div>
                <label className="label-field mb-2">Tipo</label>
                <div className="flex gap-2">
                  {[
                    { id: 'video',    Icon: Film,  label: 'Vídeo' },
                    { id: 'estatico', Icon: Image, label: 'Estático' },
                  ].map(({ id, Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => { setType(id); handleClear() }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold border transition-all ${
                        type === id
                          ? 'bg-rl-cyan/10 border-rl-cyan/50 text-rl-cyan'
                          : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Funil */}
              <div>
                <label className="label-field mb-2">Funil</label>
                <div className="relative">
                  <select
                    value={funil}
                    onChange={(e) => setFunil(e.target.value)}
                    className="input-field w-full text-sm appearance-none pr-8"
                  >
                    <option value="">Selecione o funil...</option>
                    {FUNILS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rl-muted pointer-events-none" />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="label-field mb-2">
                  Título <span className="text-rl-muted font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: VSL produto X - Versão 3"
                  className="input-field w-full text-sm"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="label-field mb-2">
                  Observações <span className="text-rl-muted font-normal">(opcional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Referências, contexto, resultado..."
                  rows={2}
                  className="input-field w-full text-sm resize-none"
                />
              </div>

              {formError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{formError}</p>
              )}

              <button
                onClick={handleAdd}
                disabled={!canAdd || saving}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  : <><Plus className="w-4 h-4" /> Adicionar ao banco</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* ── Library ───────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-bold text-rl-text flex items-center gap-2">
              <Filter className="w-4 h-4 text-rl-muted" />
              Biblioteca
              {!loading && (
                <span className="text-xs font-normal text-rl-muted">
                  ({filtered.length} anúncio{filtered.length !== 1 ? 's' : ''})
                </span>
              )}
            </h2>

            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-rl-cyan/10 border border-rl-cyan/30 text-rl-cyan hover:bg-rl-cyan/20 transition-all"
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copied ? 'Link copiado!' : 'Compartilhar com cliente'}
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1.5 p-1 bg-rl-surface rounded-xl border border-rl-border">
              {[
                { id: 'todos',    label: 'Todos' },
                { id: 'video',    label: 'Vídeo' },
                { id: 'estatico', label: 'Estático' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilterType(id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    filterType === id
                      ? 'bg-rl-purple/20 text-rl-purple'
                      : 'text-rl-muted hover:text-rl-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative">
              <select
                value={filterFunil}
                onChange={(e) => setFilterFunil(e.target.value)}
                className="input-field text-xs py-1.5 pr-7 appearance-none cursor-pointer min-w-[180px]"
              >
                <option value="todos">Todos os funis</option>
                {FUNILS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rl-muted pointer-events-none" />
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-rl-muted gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Carregando biblioteca...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-rl-muted gap-3">
              <Library className="w-10 h-10 opacity-30" />
              <p className="text-sm">Nenhum anúncio encontrado com esses filtros</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((ad) => (
                <AdCard key={ad.id} ad={ad} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>

        </div>
        </main>
      </div>
    </div>
  )
}
