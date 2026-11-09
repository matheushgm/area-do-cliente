import { useState, useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BANCO_FUNIS as FUNILS, rotuloFunil } from '../lib/constants'
import { WIREFRAMES } from '../components/Wireframes'
import { useI18n } from '../i18n'
import {
  Layout, Plus, X, Upload,
  Share2, Loader2, Check, Trash2,
  ChevronDown, Filter, ExternalLink,
  Menu, Zap, LayoutTemplate, Eye,
} from 'lucide-react'

const READY_WIREFRAMES = Object.values(WIREFRAMES).filter((w) => w.ready)

// O funil é gravado em português (lp_bank.funil, valores de BANCO_FUNIS); só o rótulo
// domínio “limpo” de uma URL, para exibir no card quando não há print
function prettyDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

// ─── Modelo padrão (wireframe) — card + preview em tela cheia ─────────────────
function TemplatePreview({ wireframe, onClose }) {
  const { t } = useI18n()
  const Component = wireframe.Component
  return (
    <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto" onClick={onClose}>
      <div className="min-h-full py-8 px-4 flex justify-center">
        <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">{wireframe.label}</h3>
              <p className="text-xs text-white/60 mt-0.5">{t('bancoLps.modeloPadraoSub')}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label={t('comum.fechar')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <Component content={wireframe.emptyContent || {}} />
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ wireframe, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="glass-card p-4 text-left flex flex-col gap-2 group hover:border-rl-cyan/40 transition-colors"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-rl-purple/10 flex items-center justify-center shrink-0">
          <LayoutTemplate className="w-4 h-4 text-rl-purple" />
        </div>
        <span className="text-sm font-bold text-rl-text">{wireframe.name}</span>
        <Eye className="w-3.5 h-3.5 text-rl-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-[11px] text-rl-muted line-clamp-2 leading-snug">{wireframe.description}</p>
    </button>
  )
}

// ─── Card de LP na biblioteca ────────────────────────────────────────────────
function LpCard({ lp, onDelete }) {
  const { t } = useI18n()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await onDelete(lp)
  }

  return (
    <div className="glass-card overflow-hidden group relative flex flex-col">
      {/* Preview */}
      <a
        href={lp.url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="relative bg-rl-bg aspect-[4/3] flex items-center justify-center overflow-hidden"
      >
        {lp.image_url ? (
          <img
            src={lp.image_url}
            alt={lp.title || t('bancoLps.altLp')}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-rl-muted p-4 text-center">
            <Layout className="w-8 h-8 opacity-40" />
            <span className="text-[11px] break-all">{lp.url ? prettyDomain(lp.url) : t('bancoLps.semPreview')}</span>
          </div>
        )}

        {/* Action buttons — visible on hover */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {lp.url && (
            <span
              title={t('bancoLps.abrirLp')}
              className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-rl-cyan/80 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </span>
          )}
          <button
            onClick={(e) => { e.preventDefault(); handleDelete() }}
            disabled={deleting}
            title={t('comum.excluir')}
            className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-red-500/80 transition-colors"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </a>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rl-gold/10 text-rl-gold border border-rl-gold/25 truncate max-w-full w-fit">
          {rotuloFunil(lp.funil)}
        </span>
        {lp.title && (
          <p className="text-xs font-semibold text-rl-text line-clamp-1">{lp.title}</p>
        )}
        {lp.notes && (
          <p className="text-[11px] text-rl-muted line-clamp-2">{lp.notes}</p>
        )}
        {lp.url && (
          <a href={lp.url} target="_blank" rel="noopener noreferrer" title={lp.url} className="text-[10px] text-rl-cyan truncate hover:underline">
            🔗 {prettyDomain(lp.url)}
          </a>
        )}
      </div>
    </div>
  )
}

function ImageUploadZone({ preview, onSelect, onClear }) {
  const { t } = useI18n()
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  function handleFile(f) {
    if (!f || !f.type.startsWith('image/')) return
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
          <img src={preview} alt={t('bancoLps.upload.previa')} className="w-full max-h-56 object-cover rounded-2xl" />
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
            {t('bancoLps.upload.trocar')}
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-rl-muted p-6">
          <Upload className="w-8 h-8" />
          <p className="text-sm font-medium text-rl-text">{t('bancoLps.upload.arraste')}</p>
          <p className="text-xs">{t('bancoLps.upload.limite')}</p>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  )
}

export default function BancoDeLPs() {
  const { openSidebar } = useOutletContext()
  const { t } = useI18n()


  // ── Form state
  const [funil,   setFunil]   = useState('')
  const [url,     setUrl]     = useState('')
  const [title,   setTitle]   = useState('')
  const [notes,   setNotes]   = useState('')
  const [file,    setFile]    = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [formError, setFormError] = useState(null)

  // ── Library state
  const [lps,         setLps]         = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filterFunil, setFilterFunil] = useState('todos')
  const [copied,      setCopied]      = useState(false)

  // ── Template preview
  const [templateOpen, setTemplateOpen] = useState(null)

  useEffect(() => { loadLps() }, [])

  async function loadLps() {
    setLoading(true)
    const { data } = await supabase
      .from('lp_bank')
      .select('*')
      .order('created_at', { ascending: false })
    setLps(data || [])
    setLoading(false)
  }

  function handleSelect(f) {
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(f)
  }

  function handleClear() {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
  }

  function resetForm() {
    handleClear()
    setFunil('')
    setUrl('')
    setTitle('')
    setNotes('')
    setFormError(null)
  }

  const canAdd = funil && url.trim()

  async function handleAdd() {
    if (!canAdd) return
    setFormError(null)
    setSaving(true)
    try {
      let image_url = null
      if (file) {
        const ext  = file.name.split('.').pop()
        const path = `${crypto.randomUUID()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('lp-bank')
          .upload(path, file, { contentType: file.type })
        if (uploadErr) throw uploadErr
        image_url = supabase.storage.from('lp-bank').getPublicUrl(path).data.publicUrl
      }

      const { error } = await supabase.from('lp_bank').insert({
        funil,
        url: url.trim(),
        title: title.trim() || null,
        image_url,
        notes: notes.trim() || null,
      })
      if (error) throw error

      resetForm()
      await loadLps()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(lp) {
    await supabase.from('lp_bank').delete().eq('id', lp.id)
    // remove o print do storage se existir
    if (lp.image_url) {
      const path = lp.image_url.split('/lp-bank/')[1]
      if (path) await supabase.storage.from('lp-bank').remove([path])
    }
    setLps((prev) => prev.filter((l) => l.id !== lp.id))
  }

  function handleShare() {
    const params = new URLSearchParams()
    if (filterFunil !== 'todos') params.set('funil', filterFunil)
    const url = `${window.location.origin}/banco-lps-publico${params.toString() ? '?' + params.toString() : ''}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const filtered = lps.filter((lp) => {
    if (filterFunil !== 'todos' && lp.funil !== filterFunil) return false
    return true
  })

  return (
    <>


      <div className="flex-1 min-w-0 flex flex-col">

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button
            onClick={openSidebar}
            aria-label={t('bancoLps.abrirMenu')}
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-rl-text text-sm">{t('bancoLps.titulo')}</span>
          </div>
        </div>

        <main className="flex-1 px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rl-cyan/10 flex items-center justify-center">
            <Layout className="w-5 h-5 text-rl-cyan" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-rl-text">{t('bancoLps.titulo')}</h1>
            <p className="text-sm text-rl-muted">{t('bancoLps.subtitulo')}</p>
          </div>
        </div>

        {/* ── Modelos padrão (wireframes) ───────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-rl-purple" />
            <h2 className="text-sm font-bold text-rl-text">{t('bancoLps.modelosPadrao')}</h2>
            <span className="text-xs font-normal text-rl-muted">
              {t('bancoLps.modelosPadraoSub')}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {READY_WIREFRAMES.map((wf) => (
              <TemplateCard key={wf.id} wireframe={wf} onOpen={() => setTemplateOpen(wf)} />
            ))}
          </div>
        </div>

        {/* ── Add Form ──────────────────────────────────────────── */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-rl-text mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-rl-cyan" /> {t('bancoLps.adicionarLp')}
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* LEFT — print upload */}
            <ImageUploadZone
              preview={preview}
              onSelect={handleSelect}
              onClear={handleClear}
            />

            {/* RIGHT — metadata */}
            <div className="space-y-3">
              {/* Funil */}
              <div>
                <label className="label-field mb-2">{t('bancoLps.form.funil')}</label>
                <div className="relative">
                  <select
                    value={funil}
                    onChange={(e) => setFunil(e.target.value)}
                    className="input-field w-full text-sm appearance-none pr-8"
                  >
                    <option value="">{t('bancoLps.form.selecioneFunil')}</option>
                    {FUNILS.map((f) => <option key={f} value={f}>{rotuloFunil(f)}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rl-muted pointer-events-none" />
                </div>
              </div>

              {/* URL */}
              <div>
                <label className="label-field mb-2">{t('bancoLps.form.link')}</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="input-field w-full text-sm"
                />
              </div>

              {/* Title */}
              <div>
                <label className="label-field mb-2">
                  {t('bancoLps.form.titulo')} <span className="text-rl-muted font-normal">{t('bancoLps.form.opcional')}</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('bancoLps.form.tituloPlaceholder')}
                  className="input-field w-full text-sm"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="label-field mb-2">
                  {t('bancoLps.form.observacoes')} <span className="text-rl-muted font-normal">{t('bancoLps.form.opcional')}</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('bancoLps.form.observacoesPlaceholder')}
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
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('bancoLps.form.enviando')}</>
                  : <><Plus className="w-4 h-4" /> {t('bancoLps.form.adicionarAoBanco')}</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* ── Library ───────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-bold text-rl-text flex items-center gap-2">
              <Filter className="w-4 h-4 text-rl-muted" />
              {t('bancoLps.biblioteca')}
              {!loading && (
                <span className="text-xs font-normal text-rl-muted">
                  ({t('bancoLps.contagem', { count: filtered.length })})
                </span>
              )}
            </h2>

            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-rl-cyan/10 border border-rl-cyan/30 text-rl-cyan hover:bg-rl-cyan/20 transition-all"
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copied ? t('bancoLps.linkCopiado') : t('bancoLps.compartilhar')}
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <select
                value={filterFunil}
                onChange={(e) => setFilterFunil(e.target.value)}
                className="input-field text-xs py-1.5 pr-7 appearance-none cursor-pointer min-w-[180px]"
              >
                <option value="todos">{t('bancoLps.todosFunis')}</option>
                {FUNILS.map((f) => <option key={f} value={f}>{rotuloFunil(f)}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rl-muted pointer-events-none" />
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-rl-muted gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">{t('bancoLps.carregando')}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-rl-muted gap-3">
              <Layout className="w-10 h-10 opacity-30" />
              <p className="text-sm">{t('bancoLps.vazio')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((lp) => (
                <LpCard key={lp.id} lp={lp} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>

        </div>
        </main>
      </div>

      {templateOpen && (
        <TemplatePreview wireframe={templateOpen} onClose={() => setTemplateOpen(null)} />
      )}
    </>
  )
}
