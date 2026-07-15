import { useState, useMemo } from 'react'
import { Download, Image as ImageIcon, LayoutTemplate } from 'lucide-react'
import { AD_WIREFRAMES, AD_FORMATS } from './adWireframes'
import { parseCreativeForFields } from '../../lib/criativoTemplate'
import { downloadBlob, slugify } from '../../lib/htmlToJpg'
import { useToast } from '../../hooks/useToast'
import Toast from '../UI/Toast'

// Escala da preview por formato (largura do iframe é sempre 1080 nativo).
const PREVIEW_SCALE = { feed: 0.5, story: 0.28 }

export default function AdWireframePanel({ project }) {
  const { toast, showToast } = useToast()
  const [selectedCreativeId, setSelectedCreativeId] = useState('')
  const [wireframeId, setWireframeId] = useState(AD_WIREFRAMES[0].id)
  const [format, setFormat] = useState('feed')
  const [values, setValues] = useState({ cta: 'Saiba mais' })

  const wireframe = AD_WIREFRAMES.find((w) => w.id === wireframeId) || AD_WIREFRAMES[0]

  // Copies geradas na aba Copy (qualquer tipo; as mais recentes na frente)
  const allCreatives = Array.isArray(project?.creatives) ? project.creatives : []
  const creatives = allCreatives
    .filter((c) => c.content)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  // Ao escolher uma copy, pré-preenche os slots de texto
  function handleSelectCreative(e) {
    const id = e.target.value
    setSelectedCreativeId(id)
    const creative = creatives.find((c) => c.id === id)
    if (!creative) return
    const fields = parseCreativeForFields(creative)
    setValues((v) => ({
      ...v,
      ...(fields.headline    ? { title: fields.headline } : {}),
      ...(fields.subheadline ? { sub: fields.subheadline } : {}),
      ...(fields.cta         ? { cta: fields.cta } : {}),
    }))
  }

  // Valores efetivos: estado + defaults de marca do wireframe + nome da empresa
  const mergedValues = useMemo(() => {
    const merged = { ...values, companyName: project?.companyName || '' }
    wireframe.brandFields.forEach((f) => {
      if (!merged[f.key]) merged[f.key] = f.default
    })
    return merged
  }, [values, wireframe, project?.companyName])

  const previewHtml = useMemo(
    () => wireframe.buildHtml({ format, values: mergedValues }),
    [wireframe, format, mergedValues]
  )

  const setField = (key) => (e) => {
    const val = e.target.value
    setValues((v) => ({ ...v, [key]: val }))
  }

  function downloadHtml(fmt) {
    const html = wireframe.buildHtml({ format: fmt, values: mergedValues })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const name = `${slugify(project?.companyName || 'cliente')}-${wireframe.id}-${fmt}.html`
    downloadBlob(blob, name)
  }

  function handleDownloadCurrent() {
    downloadHtml(format)
    showToast('HTML baixado!')
  }

  function handleDownloadBoth() {
    AD_FORMATS.forEach((f) => downloadHtml(f.id))
    showToast('HTML dos 2 formatos baixados!')
  }

  const fmtCfg = AD_FORMATS.find((f) => f.id === format) || AD_FORMATS[0]
  const scale = PREVIEW_SCALE[format] || 0.5

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-rl-text flex items-center gap-2">
          <LayoutTemplate className="w-4 h-4 text-rl-purple" />
          Wireframes de anúncio (Feed + Story)
        </h3>
        <p className="text-xs text-rl-muted mt-0.5">
          Aplique uma copy gerada num layout de anúncio com o design system do cliente e baixe o HTML em 1080×1080 e 1080×1920.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna 1: configuração */}
        <div className="space-y-4">
          {/* Selecionar copy */}
          <div>
            <label className="label-field">Copy gerada (opcional)</label>
            <select
              value={selectedCreativeId}
              onChange={handleSelectCreative}
              className="input-field w-full"
            >
              <option value="">— Escolha uma copy gerada —</option>
              {creatives.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.id}{c.createdAt ? ` · ${new Date(c.createdAt).toLocaleDateString('pt-BR')}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-rl-muted mt-1">
              Ao escolher, título, subheadline e CTA são pré-preenchidos. Você pode editar tudo abaixo.
            </p>
          </div>

          {/* Wireframes disponíveis */}
          <div>
            <label className="label-field">Wireframe</label>
            <div className="grid grid-cols-2 gap-2">
              {AD_WIREFRAMES.map((w) => {
                const active = wireframeId === w.id
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setWireframeId(w.id)}
                    className={`group rounded-xl border overflow-hidden transition-all text-left ${
                      active
                        ? 'border-rl-purple ring-2 ring-rl-purple/30 shadow-glow'
                        : 'border-rl-border hover:border-rl-purple/40'
                    }`}
                  >
                    <div className="aspect-square bg-rl-surface">
                      <img src={w.thumbnail} alt={w.name} className="w-full h-full block" />
                    </div>
                    <div className="px-2 py-1.5 bg-rl-surface">
                      <p className={`text-[11px] font-semibold ${active ? 'text-rl-purple' : 'text-rl-text'}`}>{w.name}</p>
                      <p className="text-[9px] text-rl-muted line-clamp-2">{w.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Campos de texto do wireframe */}
          {wireframe.fields.map((f) => (
            <div key={f.key}>
              <label className="label-field">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea
                  value={values[f.key] || ''}
                  onChange={setField(f.key)}
                  placeholder={f.placeholder}
                  className="input-field w-full resize-none"
                  rows={2}
                  maxLength={f.max}
                />
              ) : (
                <input
                  type="text"
                  value={values[f.key] || ''}
                  onChange={setField(f.key)}
                  placeholder={f.placeholder}
                  className="input-field w-full"
                  maxLength={f.max}
                />
              )}
              {f.hint && <p className="text-[10px] text-rl-muted mt-1">{f.hint}</p>}
            </div>
          ))}

          {/* Mídia (logo/fotos) */}
          <div className="grid grid-cols-1 gap-3 pt-1">
            {wireframe.mediaFields.map((f) => (
              <div key={f.key}>
                <label className="label-field flex items-center gap-1.5">
                  <ImageIcon className="w-3 h-3" />{f.label}
                </label>
                <input
                  type="text"
                  value={values[f.key] || ''}
                  onChange={setField(f.key)}
                  placeholder={f.placeholder}
                  className="input-field w-full text-xs"
                />
              </div>
            ))}
          </div>

          {/* Cores do design system */}
          <div>
            <label className="label-field">Design system do cliente</label>
            <div className="grid grid-cols-3 gap-2">
              {wireframe.brandFields.map((f) => (
                <div key={f.key}>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={values[f.key] || f.default}
                      onChange={setField(f.key)}
                      className="w-9 h-9 rounded-lg border border-rl-border cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={values[f.key] || f.default}
                      onChange={setField(f.key)}
                      className="input-field w-full font-mono text-[11px] uppercase px-2"
                      maxLength={7}
                    />
                  </div>
                  <p className="text-[9px] text-rl-muted mt-1">{f.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={handleDownloadCurrent}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
            >
              <Download className="w-4 h-4" />
              Baixar HTML ({format === 'feed' ? 'Feed' : 'Story'})
            </button>
            <button
              onClick={handleDownloadBoth}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30 transition-all"
            >
              <Download className="w-4 h-4" />
              Baixar os 2 formatos
            </button>
          </div>
        </div>

        {/* Coluna 2: preview */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label-field mb-0">Preview</label>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-rl-surface border border-rl-border">
              {AD_FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    format === f.id
                      ? 'bg-rl-purple text-white shadow-sm'
                      : 'text-rl-muted hover:text-rl-text'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-rl-border bg-rl-surface/30 p-4 flex items-center justify-center">
            <div
              className="rounded-lg overflow-hidden shadow-md"
              style={{ width: fmtCfg.width * scale, height: fmtCfg.height * scale }}
            >
              <iframe
                title="preview-wireframe"
                srcDoc={previewHtml}
                style={{
                  width: fmtCfg.width,
                  height: fmtCfg.height,
                  border: 'none',
                  transform: `scale(${scale})`,
                  transformOrigin: '0 0',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>
          <p className="text-[10px] text-rl-muted mt-2 text-center">
            Preview em escala {Math.round(scale * 100)}% (tamanho real: {fmtCfg.width}×{fmtCfg.height})
          </p>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
