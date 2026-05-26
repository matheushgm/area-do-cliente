import { useState } from 'react'
import { fmtMoney } from '../../lib/dashboardData'

// ─────────────────────────────────────────────────────────────────────────────
// Modais do dashboard: preview de anúncio, vínculo com PROJETO da Área do
// Cliente, override de pasta ClickUp e mensagem semanal. Todos usam os estilos
// escopados em dashboard.css. Fecham ao clicar no overlay ou no ✕.
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
          {isVideo && <video src={url} controls style={{ width: '100%', borderRadius: 8, border: '1px solid #D8E0F0', maxHeight: 400 }} />}
          {!isImage && !isVideo && <div className="preview-info">💡 Prévia não disponível para este tipo de link — clique abaixo para abrir.</div>}
          <div className="preview-url">{url}</div>
          <a href={url} target="_blank" rel="noopener noreferrer" className="preview-open-btn">🔗 Abrir Anúncio</a>
        </div>
      </div>
    </div>
  )
}

// ─── Vínculo Conta → Projeto da Área do Cliente ───────────────────────────────
// Ao vincular um projeto, squad/ClickUp/CPL passam a derivar dele.
export function MappingModal({ dashName, projectsList, cplTargets, currentProjectId, onSave, onClose }) {
  const [selected, setSelected] = useState(currentProjectId || '')
  const project = projectsList.find(p => p.id === selected)
  const cpl = project ? cplTargets[project.company_name] : null

  return (
    <div className="map-overlay" onClick={onClose}>
      <div className="map-modal" onClick={e => e.stopPropagation()}>
        <div className="map-head">
          <h3>🔗 Vincular à Área do Cliente</h3>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="map-body">
          <div className="map-field">
            <label>Conta no Dashboard</label>
            <div className="map-val">{dashName}</div>
          </div>
          <div className="map-field">
            <label>Projeto na Área do Cliente</label>
            <select className="map-select" value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">— sem vínculo —</option>
              {projectsList.map(p => (
                <option key={p.id} value={p.id}>{p.company_name}{p.squad_name ? ` · ${p.squad_name}` : ''}</option>
              ))}
            </select>
            <div className="map-cpl-preview">
              {project && (
                <>
                  Squad: <b>{project.squad_name || '—'}</b>
                  {cpl != null ? <> · CPL alvo: <b>{fmtMoney(cpl)}</b></> : <span style={{ color: '#B45309' }}> · sem CPL calculado</span>}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="map-footer">
          {currentProjectId && (
            <button className="btn" style={{ background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.30)', color: '#DC2626' }} onClick={() => { onSave(dashName, null); onClose() }}>
              Remover vínculo
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn" style={{ background: '#164496', borderColor: '#164496', color: '#fff' }} onClick={() => { onSave(dashName, selected || null); onClose() }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Override de pasta ClickUp (ID manual) ────────────────────────────────────
// Normalmente a pasta vem do projeto vinculado; este override cobre contas sem
// projeto ou casos em que a pasta do projeto está incorreta.
export function ClickupMapModal({ dashName, currentFolderId, onSave, onClose }) {
  const [folderId, setFolderId] = useState(currentFolderId || '')

  return (
    <div className="cu-map-overlay" onClick={onClose}>
      <div className="cu-map-modal" onClick={e => e.stopPropagation()}>
        <div className="map-head">
          <h3>🔗 Pasta ClickUp (override)</h3>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="map-body">
          <div className="map-field">
            <label>Conta no Dashboard</label>
            <div className="map-val">{dashName}</div>
          </div>
          <div className="map-field">
            <label>ID da pasta no ClickUp</label>
            <input
              className="map-select"
              value={folderId}
              onChange={e => setFolderId(e.target.value.trim())}
              placeholder="ex: 901318063989"
            />
            <div className="map-cpl-preview">
              Deixe vazio para usar a pasta do projeto vinculado. O ID fica no fim da URL da pasta no ClickUp.
            </div>
          </div>
        </div>
        <div className="map-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn" style={{ background: '#164496', borderColor: '#164496', color: '#fff' }} onClick={() => { onSave(dashName, folderId || null); onClose() }}>
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
          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>
            Edite à vontade antes de copiar. Período usado: <b>{periodLabel}</b>
          </div>
          <textarea className="weekly-msg-text" spellCheck={false} value={text} onChange={e => setText(e.target.value)} />
        </div>
        <div className="map-footer">
          <button className="btn" onClick={onClose}>Fechar</button>
          <button className="btn" style={{ background: '#059669', borderColor: '#059669', color: '#fff' }} onClick={copy}>
            📋 Copiar
          </button>
        </div>
      </div>
    </div>
  )
}
