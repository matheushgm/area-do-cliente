import { useState, useEffect } from 'react'
import { Instagram, Globe, HardDrive, Link2, Plus, X, ExternalLink, CheckCircle2, Eye, EyeOff } from 'lucide-react'

const BTN = 'flex items-center justify-center w-10 rounded-xl bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all'

// ─── Link field row ────────────────────────────────────────────────────────────
function LinkField({ icon: Icon, iconColor, label, value, onChange, placeholder, hidden, onToggleHidden }) {
  return (
    <div>
      <label className="label-field flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field flex-1"
        />
        {value && (
          <>
            <button
              type="button"
              onClick={onToggleHidden}
              title={hidden ? 'Mostrar na header' : 'Ocultar da header'}
              className={BTN}
            >
              {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <a
              href={value.startsWith('http') ? value : `https://${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className={BTN}
              title="Abrir link"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LinksModule({ project, onSave }) {
  const saved = project.links || {}

  const [instagram,        setInstagram]        = useState(saved.instagram        || '')
  const [website,          setWebsite]          = useState(saved.website          || '')
  const [googleDrive,      setGoogleDrive]      = useState(saved.googleDrive      || '')
  const [outros,           setOutros]           = useState(
    Array.isArray(saved.outros) && saved.outros.length > 0 ? saved.outros : []
  )
  const [hiddenFromHeader, setHiddenFromHeader] = useState(
    Array.isArray(saved.hiddenFromHeader) ? saved.hiddenFromHeader : []
  )

  // Sincroniza estado local quando project.links muda externamente (ex: header)
  useEffect(() => {
    const s = project.links || {}
    setInstagram(s.instagram      || '')
    setWebsite(s.website          || '')
    setGoogleDrive(s.googleDrive  || '')
    setOutros(Array.isArray(s.outros) && s.outros.length > 0 ? s.outros : [])
    setHiddenFromHeader(Array.isArray(s.hiddenFromHeader) ? s.hiddenFromHeader : [])
  }, [project.links])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function buildPayload({ ovHidden = hiddenFromHeader, ovOutros = outros } = {}) {
    return {
      instagram,
      website,
      googleDrive,
      hiddenFromHeader: ovHidden,
      outros: ovOutros.filter((o) => o.url.trim()),
    }
  }

  function toggleHidden(key) {
    const next = hiddenFromHeader.includes(key)
      ? hiddenFromHeader.filter((k) => k !== key)
      : [...hiddenFromHeader, key]
    setHiddenFromHeader(next)
    if (onSave) onSave(buildPayload({ ovHidden: next }))
  }

  function addOutro() {
    setOutros((prev) => [...prev, { label: '', url: '', hidden: false }])
  }

  function updateOutro(i, field, value) {
    setOutros((prev) => prev.map((o, idx) => idx === i ? { ...o, [field]: value } : o))
  }

  function removeOutro(i) {
    setOutros((prev) => prev.filter((_, idx) => idx !== i))
  }

  function toggleOutroHidden(i) {
    const next = outros.map((o, idx) => idx === i ? { ...o, hidden: !o.hidden } : o)
    setOutros(next)
    if (onSave) onSave(buildPayload({ ovOutros: next }))
  }

  function handleSave() {
    onSave(buildPayload())
  }

  const totalLinks = [instagram, website, googleDrive, ...outros.map((o) => o.url)]
    .filter(Boolean).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <Link2 className="w-5 h-5 text-rl-cyan" />
            Links Importantes
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            Centralize os links essenciais do cliente para acesso rápido
          </p>
        </div>
        {totalLinks > 0 && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rl-cyan/10 text-rl-cyan border border-rl-cyan/20">
            {totalLinks} link{totalLinks !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Fixed fields */}
      <div className="glass-card p-5 space-y-4">
        <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-1">
          Redes & Plataformas
        </p>

        <LinkField
          icon={Instagram}
          iconColor="text-pink-400"
          label="Instagram"
          value={instagram}
          onChange={setInstagram}
          placeholder="https://instagram.com/empresa"
          hidden={hiddenFromHeader.includes('instagram')}
          onToggleHidden={() => toggleHidden('instagram')}
        />

        <LinkField
          icon={Globe}
          iconColor="text-rl-blue"
          label="Website"
          value={website}
          onChange={setWebsite}
          placeholder="https://www.empresa.com.br"
          hidden={hiddenFromHeader.includes('website')}
          onToggleHidden={() => toggleHidden('website')}
        />

        <LinkField
          icon={HardDrive}
          iconColor="text-rl-green"
          label="Google Drive"
          value={googleDrive}
          onChange={setGoogleDrive}
          placeholder="https://drive.google.com/drive/folders/..."
          hidden={hiddenFromHeader.includes('googleDrive')}
          onToggleHidden={() => toggleHidden('googleDrive')}
        />
      </div>

      {/* Custom links */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider">
            Outros Links
          </p>
          <button
            onClick={addOutro}
            className="flex items-center gap-1.5 text-xs text-rl-purple hover:text-rl-purple/80 font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar link
          </button>
        </div>

        {outros.length === 0 && (
          <div
            onClick={addOutro}
            className="glass-card p-5 border-dashed flex items-center justify-center gap-2 text-rl-muted text-sm cursor-pointer hover:border-rl-purple/40 hover:text-rl-text transition-all"
          >
            <Plus className="w-4 h-4" />
            Clique para adicionar um link personalizado
          </div>
        )}

        {outros.map((outro, i) => (
          <div key={i} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-rl-muted font-medium">Link {i + 1}</p>
              <button
                onClick={() => removeOutro(i)}
                className="p-1 rounded text-rl-muted/50 hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label-field">Descrição</label>
                <input
                  type="text"
                  value={outro.label}
                  onChange={(e) => updateOutro(i, 'label', e.target.value)}
                  placeholder="Ex: Notion, Trello, CRM..."
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field">URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={outro.url}
                    onChange={(e) => updateOutro(i, 'url', e.target.value)}
                    placeholder="https://..."
                    className="input-field flex-1"
                  />
                  {outro.url && (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleOutroHidden(i)}
                        title={outro.hidden ? 'Mostrar na header' : 'Ocultar da header'}
                        className={BTN}
                      >
                        {outro.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <a
                        href={outro.url.startsWith('http') ? outro.url : `https://${outro.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={BTN}
                        title="Abrir link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save */}
      {onSave && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Salvar Links
          </button>
        </div>
      )}
    </div>
  )
}
