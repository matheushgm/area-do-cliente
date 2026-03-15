import { useState, useRef, useCallback, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { getSignedUrl } from '../lib/supabase'
import {
  Upload, Download, Trash2, AlertCircle, Plus, X,
  Image, Film, Palette, Type, AlertTriangle, Camera,
} from 'lucide-react'

// ─── Limits ───────────────────────────────────────────────────────────────────
const PHOTO_MAX_MB  = 8
const VIDEO_MAX_MB  = 50
const TOTAL_MAX_MB  = 100
const PHOTO_MAX     = PHOTO_MAX_MB * 1024 * 1024
const VIDEO_MAX     = VIDEO_MAX_MB * 1024 * 1024
const TOTAL_MAX     = TOTAL_MAX_MB * 1024 * 1024

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsDataURL(file)
  })
}

function triggerDownload(data, name) {
  const a = document.createElement('a')
  a.href     = data
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ─── Color Chip ───────────────────────────────────────────────────────────────
function ColorChip({ color, onDelete }) {
  return (
    <div className="group flex items-center gap-2 bg-rl-surface border border-rl-border rounded-xl px-3 py-2">
      <div
        className="w-6 h-6 rounded-lg border border-black/10 shrink-0"
        style={{ backgroundColor: color.hex }}
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-rl-text">{color.hex.toUpperCase()}</p>
        {color.nome && <p className="text-[10px] text-rl-muted truncate">{color.nome}</p>}
      </div>
      <button
        onClick={onDelete}
        aria-label="Remover cor"
        className="ml-1 p-0.5 rounded text-rl-muted/40 hover:text-rl-red opacity-0 group-hover:opacity-100 transition-all shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Photo Grid ───────────────────────────────────────────────────────────────
function PhotoGrid({ fotos, onDelete }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {fotos.map((f) => (
        <div key={f.id} className="group relative aspect-square rounded-xl overflow-hidden border border-rl-border bg-rl-surface">
          <img src={f.data} alt={f.name} className="w-full h-full object-cover" />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              onClick={() => triggerDownload(f.data, f.name)}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-all"
              title="Baixar"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(f.id)}
              className="p-2 rounded-lg bg-red-500/60 hover:bg-red-500/80 text-white transition-all"
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          {/* Filename on bottom */}
          <div className="absolute bottom-0 inset-x-0 bg-black/40 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-[10px] text-white truncate">{f.name}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Video List ───────────────────────────────────────────────────────────────
function VideoList({ videos, onDelete }) {
  const [playing, setPlaying] = useState(null)

  return (
    <div className="space-y-3">
      {videos.map((v) => (
        <div key={v.id} className="glass-card overflow-hidden">
          {playing === v.id && (
            <video
              src={v.data}
              controls
              autoPlay
              className="w-full max-h-48 bg-black"
              onEnded={() => setPlaying(null)}
            />
          )}
          <div className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
              <Film className="w-5 h-5 text-rl-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-rl-text truncate">{v.name}</p>
              <p className="text-xs text-rl-muted">{fmtSize(v.size)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setPlaying(playing === v.id ? null : v.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rl-purple/10 text-rl-purple hover:bg-rl-purple/20 transition-all"
              >
                {playing === v.id ? 'Fechar' : 'Preview'}
              </button>
              <button
                onClick={() => triggerDownload(v.data, v.name)}
                className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                title="Baixar"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(v.id)}
                className="p-1.5 rounded-lg text-rl-muted hover:text-rl-red hover:bg-rl-red/10 transition-all"
                title="Remover"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────
function UploadZone({ accept, label, sublabel, onFiles, inputRef }) {
  const [dragging, setDragging] = useState(false)

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files) }}
      className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all duration-200 ${
        dragging ? 'border-rl-purple bg-rl-purple/10' : 'border-rl-border hover:border-rl-purple/50 hover:bg-rl-purple/5'
      }`}
    >
      <Upload className={`w-5 h-5 mx-auto mb-2 ${dragging ? 'text-rl-purple' : 'text-rl-muted'}`} />
      <p className="text-xs font-semibold text-rl-text">{label}</p>
      <p className="text-[11px] text-rl-muted mt-0.5">{sublabel}</p>
      <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BancoMidiaModule({ project }) {
  const { updateProject } = useApp()

  const logoInputRef  = useRef(null)
  const photoInputRef = useRef(null)
  const videoInputRef = useRef(null)

  const [error,      setError]      = useState(null)
  const [newColor,   setNewColor]   = useState({ hex: '#164496', nome: '' })
  const [showAddColor, setShowAddColor] = useState(false)
  const [logoSrc,    setLogoSrc]    = useState(null)

  // ── Data shortcuts ──────────────────────────────────────────────────────────
  const kit    = project.brandKit    || {}
  const fotos  = project.brandFotos  || []
  const videos = project.brandVideos || []

  // ── Resolve logo: base64 direto ou signed URL do Storage ───────────────────
  useEffect(() => {
    if (!kit.logo) { setLogoSrc(null); return }
    if (kit.logo.startsWith('data:') || kit.logo.startsWith('http')) {
      setLogoSrc(kit.logo)
    } else {
      getSignedUrl('brand-logos', kit.logo).then((url) => setLogoSrc(url))
    }
  }, [kit.logo])

  function saveKit(patch) {
    updateProject(project.id, { brandKit: { ...kit, ...patch } })
  }

  // ── Logo upload ─────────────────────────────────────────────────────────────
  async function handleLogo(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Selecione uma imagem para o logotipo.'); return }
    if (file.size > PHOTO_MAX) { setError(`Logotipo excede ${PHOTO_MAX_MB} MB.`); return }
    const data = await readFileAsBase64(file)
    saveKit({ logo: data })
  }

  // ── Colors ──────────────────────────────────────────────────────────────────
  function addColor() {
    if (!newColor.hex) return
    const cores = [...(kit.cores || []), { id: Date.now(), hex: newColor.hex, nome: newColor.nome }]
    saveKit({ cores })
    setNewColor({ hex: '#164496', nome: '' })
    setShowAddColor(false)
  }

  function deleteColor(id) {
    saveKit({ cores: (kit.cores || []).filter((c) => c.id !== id) })
  }

  // ── Photos ──────────────────────────────────────────────────────────────────
  const handlePhotos = useCallback(async (files) => {
    setError(null)
    if (!files?.length) return
    const list   = Array.from(files)
    const result = []
    const current = fotos.reduce((s, f) => s + (f.size || 0), 0)

    for (const file of list) {
      if (!file.type.startsWith('image/')) { setError(`"${file.name}" não é uma imagem.`); return }
      if (file.size > PHOTO_MAX) { setError(`"${file.name}" excede ${PHOTO_MAX_MB} MB.`); return }
      const allSize = current + result.reduce((s, f) => s + f.size, 0) + file.size
      if (allSize > TOTAL_MAX) { setError(`Limite total de ${TOTAL_MAX_MB} MB atingido.`); return }
      const data = await readFileAsBase64(file)
      result.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size, type: file.type, data, uploadedAt: new Date().toISOString() })
    }
    updateProject(project.id, { brandFotos: [...fotos, ...result] })
    if (photoInputRef.current) photoInputRef.current.value = ''
  }, [fotos, project.id, updateProject])

  function deletePhoto(id) {
    updateProject(project.id, { brandFotos: fotos.filter((f) => f.id !== id) })
  }

  // ── Videos ──────────────────────────────────────────────────────────────────
  const handleVideos = useCallback(async (files) => {
    setError(null)
    if (!files?.length) return
    const list   = Array.from(files)
    const result = []
    const current = videos.reduce((s, v) => s + (v.size || 0), 0)

    for (const file of list) {
      if (!file.type.startsWith('video/')) { setError(`"${file.name}" não é um vídeo.`); return }
      if (file.size > VIDEO_MAX) { setError(`"${file.name}" excede ${VIDEO_MAX_MB} MB por vídeo.`); return }
      const allSize = current + result.reduce((s, v) => s + v.size, 0) + file.size
      if (allSize > TOTAL_MAX) { setError(`Limite total de ${TOTAL_MAX_MB} MB atingido.`); return }
      const data = await readFileAsBase64(file)
      result.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size, type: file.type, data, uploadedAt: new Date().toISOString() })
    }
    updateProject(project.id, { brandVideos: [...videos, ...result] })
    if (videoInputRef.current) videoInputRef.current.value = ''
  }, [videos, project.id, updateProject])

  function deleteVideo(id) {
    updateProject(project.id, { brandVideos: videos.filter((v) => v.id !== id) })
  }

  // ── Storage calc ────────────────────────────────────────────────────────────
  const totalUsed = fotos.reduce((s, f) => s + (f.size || 0), 0) + videos.reduce((s, v) => s + (v.size || 0), 0)
  const totalPct  = Math.min(100, (totalUsed / TOTAL_MAX) * 100)

  return (
    <div className="space-y-8">

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-rl-red/10 border border-rl-red/20 rounded-xl px-4 py-3 text-rl-red text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 text-rl-red/60 hover:text-rl-red"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── 1. Identidade da Marca ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-rl-purple/10 flex items-center justify-center">
            <Palette className="w-4 h-4 text-rl-purple" />
          </div>
          <h3 className="text-sm font-bold text-rl-text">Identidade da Marca</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Logotipo */}
          <div className="glass-card p-4 space-y-3">
            <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider">Logotipo</p>
            <div
              onClick={() => logoInputRef.current?.click()}
              className="relative group cursor-pointer w-full aspect-video rounded-xl border-2 border-dashed border-rl-border hover:border-rl-purple/50 bg-rl-surface flex items-center justify-center overflow-hidden transition-all"
            >
              {logoSrc ? (
                <>
                  <img src={logoSrc} alt="Logo" className="w-full h-full object-contain p-3" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <Camera className="w-6 h-6 text-rl-muted mx-auto mb-1" />
                  <p className="text-xs text-rl-muted">Clique para adicionar</p>
                </div>
              )}
            </div>
            {logoSrc && (
              <button
                onClick={() => saveKit({ logo: null })}
                className="w-full text-xs text-rl-red/70 hover:text-rl-red transition-colors"
              >
                Remover logo
              </button>
            )}
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
          </div>

          {/* Paleta de Cores */}
          <div className="glass-card p-4 space-y-3">
            <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider">Paleta de Cores</p>
            <div className="space-y-2">
              {(kit.cores || []).map((c) => (
                <ColorChip key={c.id} color={c} onDelete={() => deleteColor(c.id)} />
              ))}
            </div>

            {showAddColor ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newColor.hex}
                    onChange={(e) => setNewColor((p) => ({ ...p, hex: e.target.value }))}
                    className="w-8 h-8 rounded-lg border border-rl-border cursor-pointer bg-rl-surface p-0.5"
                  />
                  <input
                    type="text"
                    value={newColor.hex}
                    onChange={(e) => setNewColor((p) => ({ ...p, hex: e.target.value }))}
                    placeholder="#000000"
                    className="input-field flex-1 py-1.5 text-xs font-mono"
                  />
                </div>
                <input
                  type="text"
                  value={newColor.nome}
                  onChange={(e) => setNewColor((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Nome (ex: Azul Primário)"
                  className="input-field w-full py-1.5 text-xs"
                />
                <div className="flex gap-2">
                  <button onClick={addColor} className="btn-primary flex-1 py-1.5 text-xs">Adicionar</button>
                  <button onClick={() => setShowAddColor(false)} className="btn-secondary flex-1 py-1.5 text-xs">Cancelar</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddColor(true)}
                className="flex items-center gap-1.5 text-xs text-rl-purple hover:text-rl-purple/80 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar cor
              </button>
            )}
          </div>

          {/* Tipografia */}
          <div className="glass-card p-4 space-y-3">
            <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5" /> Tipografia
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-rl-muted mb-1 block">Fonte Principal</label>
                <input
                  type="text"
                  value={kit.fontePrincipal || ''}
                  onChange={(e) => saveKit({ fontePrincipal: e.target.value })}
                  placeholder="Ex: Montserrat, Poppins..."
                  className="input-field w-full py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] text-rl-muted mb-1 block">Fonte Secundária</label>
                <input
                  type="text"
                  value={kit.fonteSecundaria || ''}
                  onChange={(e) => saveKit({ fonteSecundaria: e.target.value })}
                  placeholder="Ex: Inter, Open Sans..."
                  className="input-field w-full py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] text-rl-muted mb-1 block">Observações da tipografia</label>
                <textarea
                  value={kit.fonteObs || ''}
                  onChange={(e) => saveKit({ fonteObs: e.target.value })}
                  placeholder="Ex: Nunca usar em bold, apenas regular e medium..."
                  rows={3}
                  className="input-field w-full py-2 text-sm resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Banco de Fotos ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rl-blue/10 flex items-center justify-center">
              <Image className="w-4 h-4 text-rl-blue" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rl-text">Banco de Fotos</h3>
              {fotos.length > 0 && <p className="text-[11px] text-rl-muted">{fotos.length} foto{fotos.length !== 1 ? 's' : ''}</p>}
            </div>
          </div>
        </div>

        <UploadZone
          accept="image/*"
          label="Adicionar fotos da marca"
          sublabel={`PNG, JPG, WebP · Máx. ${PHOTO_MAX_MB} MB por foto`}
          onFiles={handlePhotos}
          inputRef={photoInputRef}
        />

        {fotos.length > 0 && (
          <div className="mt-4">
            <PhotoGrid fotos={fotos} onDelete={deletePhoto} />
          </div>
        )}
      </section>

      {/* ── 3. Banco de Vídeos ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rl-purple/10 flex items-center justify-center">
              <Film className="w-4 h-4 text-rl-purple" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rl-text">Banco de Vídeos</h3>
              {videos.length > 0 && <p className="text-[11px] text-rl-muted">{videos.length} vídeo{videos.length !== 1 ? 's' : ''}</p>}
            </div>
          </div>
        </div>

        <UploadZone
          accept="video/*"
          label="Adicionar vídeos da marca"
          sublabel={`MP4, MOV, WebM · Máx. ${VIDEO_MAX_MB} MB por vídeo`}
          onFiles={handleVideos}
          inputRef={videoInputRef}
        />

        {videos.length > 0 && (
          <div className="mt-4">
            <VideoList videos={videos} onDelete={deleteVideo} />
          </div>
        )}
      </section>

      {/* ── 4. Observações / O que evitar ──────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-rl-red/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-rl-red" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rl-text">O Que Evitar</h3>
            <p className="text-[11px] text-rl-muted">Orientações de marca, proibições e restrições de uso</p>
          </div>
        </div>
        <div className="glass-card p-4">
          <textarea
            value={kit.observacoes || ''}
            onChange={(e) => saveKit({ observacoes: e.target.value })}
            placeholder={`Ex:\n• Nunca usar o logo sobre fundos escuros sem a versão branca\n• Não distorcer proporções do logotipo\n• Evitar o uso da cor vermelha em campanhas\n• Não usar fonte diferente da identidade visual\n• Fotos com filtros pesados estão proibidas`}
            rows={7}
            className="input-field w-full text-sm resize-none"
          />
        </div>
      </section>

      {/* ── Storage bar ────────────────────────────────────────────────────── */}
      {(fotos.length > 0 || videos.length > 0) && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between text-xs text-rl-muted mb-2">
            <span>Armazenamento utilizado</span>
            <span className={totalPct > 80 ? 'text-rl-gold font-semibold' : ''}>
              {fmtSize(totalUsed)} / {TOTAL_MAX_MB} MB
            </span>
          </div>
          <div className="h-1.5 bg-rl-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${totalPct > 80 ? 'bg-rl-gold' : 'bg-gradient-rl'}`}
              style={{ width: `${totalPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
