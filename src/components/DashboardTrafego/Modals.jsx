import { useState } from 'react'
import { fmtMoney, CU_FOLDERS, getClickupFolder } from '../../lib/dashboardData'

// ─────────────────────────────────────────────────────────────────────────────
// Modais do dashboard: preview de anúncio, vínculo com a Área do Cliente,
// vínculo de pasta ClickUp e mensagem semanal. Todos usam os estilos escopados
// em dashboard.css. Fecham ao clicar no overlay ou no ✕.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Preview de anúncio (imagem / vídeo / link) ──────────────────────────────
export function PreviewModal({ url, name, onClose }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)
  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url)
  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={e => e.stopPropagation()}>
        <div className="preview-head">
          <h3>{name}</h3>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="preview-body">
          {isImage && <img className="preview-img" src={url} alt={name} onError={e => { e.currentTarget.style.display = 'none' }} />}
          {isVideo && <video src={url} controls style={{ width: '100%', borderRadius: 8, border: '1px solid #30363d', maxHeight: 400 }} />}
          {!isImage && !isVideo && <div className="preview-info">💡 Prévia não disponível para este tipo de link — clique abaixo para abrir.</div>}
          <div className="preview-url">{url}</div>
          <a href={url} target="_blank" rel="noopener noreferrer" className="preview-open-btn">🔗 Abrir Anúncio</a>
        </div>
      </div>
    </div>
  )
}

// ─── Vínculo Dashboard → empresa da Área do Cliente ───────────────────────────
export function MappingModal({ dashName, acCompanyList, cplTargets, currentAcName, onSave, onRemove, onClose }) {
  const [selected, setSelected] = useState(currentAcName || '')
  const cpl = selected ? cplTargets[selected] : null

  return (
    <div className="map-overlay" onClick={onClose}>
      <div className="map-modal" onClick={e => e.stopPropagation()}>
        <div className="map-head">
          <h3>🔗 Vincular à Área do Cliente</h3>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="map-body">
          <div className="map-field">
            <label>Cliente no Dashboard</label>
            <div className="map-val">{dashName}</div>
          </div>
          <div className="map-field">
            <label>Empresa na Área do Cliente</label>
            <select className="map-select" value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">— sem vínculo —</option>
              {acCompanyList.map(n => (
                <option key={n} value={n}>{n}{cplTargets[n] != null ? ` (CPL: ${fmtMoney(cplTargets[n])})` : ''}</option>
              ))}
            </select>
            <div className="map-cpl-preview">
              {selected && (cpl != null
                ? <>CPL alvo vinculado: <b>{fmtMoney(cpl)}</b></>
                : <span style={{ color: '#e3b341' }}>⚠️ Esse projeto não tem CPL calculado na Área do Cliente.</span>)}
            </div>
          </div>
        </div>
        <div className="map-footer">
          {currentAcName && (
            <button className="btn" style={{ background: '#2d1515', borderColor: '#f8514444', color: '#f85149' }} onClick={() => { onRemove(dashName); onClose() }}>
              Remover vínculo
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn" style={{ background: '#1f3858', borderColor: '#388bfd55', color: '#58a6ff' }} onClick={() => { onSave(dashName, selected); onClose() }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Vínculo de pasta ClickUp ─────────────────────────────────────────────────
export function ClickupMapModal({ dashName, currentFolderId, onSave, onClose }) {
  const initial = currentFolderId || getClickupFolder(dashName, {}) || ''
  const [folderId, setFolderId] = useState(initial)

  return (
    <div className="cu-map-overlay" onClick={onClose}>
      <div className="cu-map-modal" onClick={e => e.stopPropagation()}>
        <div className="map-head">
          <h3>🔗 Vincular Pasta ClickUp</h3>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="map-body">
          <div className="map-field">
            <label>Cliente no Dashboard</label>
            <div className="map-val">{dashName}</div>
          </div>
          <div className="map-field">
            <label>Pasta no ClickUp (espaço Clientes)</label>
            <select className="map-select" value={folderId} onChange={e => setFolderId(e.target.value)}>
              <option value="">— sem vínculo —</option>
              {CU_FOLDERS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>
        <div className="map-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn" style={{ background: '#1f3858', borderColor: '#388bfd55', color: '#58a6ff' }} onClick={() => { onSave(dashName, folderId || null); onClose() }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Mensagem semanal (texto editável + copiar) ───────────────────────────────
export function WeeklyMessageModal({ client, periodLabel, initialText, onClose, onToast }) {
  const [text, setText] = useState(initialText)

  const copy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => { onToast('📋 Mensagem copiada'); onClose() })
        .catch(() => onToast('⚠️ Selecione o texto e Ctrl+C'))
    } else {
      onToast('⚠️ Selecione o texto e Ctrl+C')
    }
  }

  return (
    <div className="weekly-msg-overlay" onClick={onClose}>
      <div className="weekly-msg-modal" onClick={e => e.stopPropagation()}>
        <div className="map-head">
          <h3>📋 Mensagem Semanal — <span>{client}</span></h3>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="map-body">
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 10 }}>
            Edite à vontade antes de copiar. Período usado: <b>{periodLabel}</b>
          </div>
          <textarea className="weekly-msg-text" spellCheck={false} value={text} onChange={e => setText(e.target.value)} />
        </div>
        <div className="map-footer">
          <button className="btn" onClick={onClose}>Fechar</button>
          <button className="btn" style={{ background: '#0d2118', borderColor: '#3fb95066', color: '#3fb950' }} onClick={copy}>
            📋 Copiar
          </button>
        </div>
      </div>
    </div>
  )
}
