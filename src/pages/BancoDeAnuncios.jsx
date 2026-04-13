import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Library, Plus, Video, Image, Link2, X, Upload,
  Share2, Loader2, Copy, Check, ExternalLink, Trash2,
  ChevronDown, Play, Film, Filter,
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

function getYouTubeId(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([\w-]{11})/)
  return m ? m[1] : null
}

function AdCard({ ad, onDelete }) {
  const ytId = ad.type === 'video' ? getYouTubeId(ad.url || '') : null
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await onDelete(ad.id)
  }

  return (
    <div className="glass-card overflow-hidden group relative flex flex-col">
      {/* Media area */}
      <div className="relative bg-rl-bg aspect-video flex items-center justify-center overflow-hidden">
        {ad.type === 'video' && ytId ? (
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={ad.title || 'Vídeo'}
          />
        ) : ad.type === 'video' ? (
          <a
            href={ad.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 text-rl-muted hover:text-rl-purple transition-colors p-4 text-center"
          >
            <Play className="w-10 h-10" />
            <span className="text-xs break-all line-clamp-2">{ad.url}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <img
            src={ad.url}
            alt={ad.title || 'Anúncio estático'}
            className="w-full h-full object-cover"
          />
        )}

        {/* Delete btn */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
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

export default function BancoDeAnuncios() {
  // ── Form state
  const [type,          setType]          = useState('video')
  const [funil,         setFunil]         = useState('')
  const [title,         setTitle]         = useState('')
  const [videoUrl,      setVideoUrl]      = useState('')
  const [staticFile,    setStaticFile]    = useState(null)
  const [staticPreview, setStaticPreview] = useState(null)
  const [notes,         setNotes]         = useState('')
  const [saving,        setSaving]        = useState(false)
  const [formError,     setFormError]     = useState(null)
  const [dragging,      setDragging]      = useState(false)

  // ── Library state
  const [ads,         setAds]         = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filterType,  setFilterType]  = useState('todos')
  const [filterFunil, setFilterFunil] = useState('todos')
  const [copied,      setCopied]      = useState(false)

  const fileRef = useRef()
  const navigate = useNavigate()

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

  function handleFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) return
    setStaticFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setStaticPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const canAdd = funil && (
    (type === 'video' && videoUrl.trim()) ||
    (type === 'estatico' && staticFile)
  )

  async function handleAdd() {
    if (!canAdd) return
    setFormError(null)
    setSaving(true)
    try {
      let url = videoUrl.trim()

      if (type === 'estatico') {
        const ext = staticFile.name.split('.').pop()
        const path = `${crypto.randomUUID()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('ad-bank')
          .upload(path, staticFile, { contentType: staticFile.type })
        if (uploadErr) throw uploadErr
        url = supabase.storage.from('ad-bank').getPublicUrl(path).data.publicUrl
      }

      const { error } = await supabase.from('ad_bank').insert({
        type,
        funil,
        title: title.trim() || null,
        url,
        notes: notes.trim() || null,
      })
      if (error) throw error

      setFunil('')
      setTitle('')
      setVideoUrl('')
      setStaticFile(null)
      setStaticPreview(null)
      setNotes('')
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
    <div className="min-h-screen bg-rl-bg">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

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

            {/* LEFT — media input */}
            <div>
              {type === 'video' ? (
                <div className="space-y-2">
                  <label className="label-field">URL do vídeo</label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... ou outro link"
                    className="input-field w-full text-sm"
                  />
                  {videoUrl && getYouTubeId(videoUrl) && (
                    <div className="rounded-xl overflow-hidden aspect-video mt-2">
                      <iframe
                        src={`https://www.youtube.com/embed/${getYouTubeId(videoUrl)}`}
                        className="w-full h-full"
                        allowFullScreen
                        title="Preview"
                      />
                    </div>
                  )}
                  {videoUrl && !getYouTubeId(videoUrl) && (
                    <div className="flex items-center gap-2 text-xs text-rl-muted bg-rl-surface rounded-xl px-3 py-2 border border-rl-border">
                      <Link2 className="w-3.5 h-3.5 shrink-0" />
                      Link externo será exibido como card com link
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    handleFileSelect(e.dataTransfer.files[0])
                  }}
                  onClick={() => fileRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-all min-h-[180px] ${
                    dragging
                      ? 'border-rl-cyan bg-rl-cyan/10'
                      : staticPreview
                      ? 'border-rl-border p-0 overflow-hidden'
                      : 'border-rl-border hover:border-rl-cyan/50 bg-rl-surface'
                  }`}
                >
                  {staticPreview ? (
                    <>
                      <img src={staticPreview} alt="Preview" className="w-full h-full object-cover max-h-64 rounded-2xl" />
                      <button
                        onClick={(e) => { e.stopPropagation(); setStaticFile(null); setStaticPreview(null) }}
                        className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-rl-muted p-6">
                      <Upload className="w-8 h-8" />
                      <p className="text-sm font-medium text-rl-text">Arraste ou clique para enviar</p>
                      <p className="text-xs">PNG, JPG, WEBP — máx. 10 MB</p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                  />
                </div>
              )}
            </div>

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
                      onClick={() => { setType(id); setVideoUrl(''); setStaticFile(null); setStaticPreview(null) }}
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
                <label className="label-field mb-2">Título <span className="text-rl-muted font-normal">(opcional)</span></label>
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
                <label className="label-field mb-2">Observações <span className="text-rl-muted font-normal">(opcional)</span></label>
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
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
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

            {/* Share button */}
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
            {/* Type filter */}
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

            {/* Funil filter */}
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
    </div>
  )
}
