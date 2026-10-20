import { useCallback, useRef, useState } from 'react'

// Larguras de coluna redimensionáveis (arrastar a borda do cabeçalho), salvas
// em localStorage por `storageKey` — cada pessoa/navegador guarda as suas.
// `defaults` = { [colKey]: px }. Duplo clique na alça volta ao padrão.
//
// Uso: const { widths, startResize, reset, total } = useColumnWidths(key, defaults)
//   <table style={{ width: total, minWidth: '100%', tableLayout: 'fixed' }}>
//   <col style={{ width: widths[k] }} />  +  <ResizeHandle onPointerDown={(e) => startResize(k, e)} />

export const MIN_COL = 70
export const MAX_COL = 1200

function ler(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {} } catch { return {} }
}

export function useColumnWidths(storageKey, defaults) {
  const [saved, setSaved] = useState(() => (storageKey ? ler(storageKey) : {}))
  const [keyAtual, setKeyAtual] = useState(storageKey)
  const drag = useRef(null)

  // Trocou de tabela (outro banco/link): relê as larguras dela durante o render.
  if (keyAtual !== storageKey) {
    setKeyAtual(storageKey)
    setSaved(storageKey ? ler(storageKey) : {})
  }

  const persist = useCallback((next) => {
    if (!storageKey) return
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* modo privado */ }
  }, [storageKey])

  const widths = {}
  for (const k of Object.keys(defaults)) widths[k] = saved[k] || defaults[k]
  const total = Object.values(widths).reduce((s, w) => s + w, 0)

  const startResize = useCallback((col, e) => {
    e.preventDefault()
    e.stopPropagation()
    const th = e.currentTarget.closest('th')
    const startW = th ? th.getBoundingClientRect().width : (saved[col] || defaults[col] || 150)
    drag.current = { col, startX: e.clientX, startW }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const move = (ev) => {
      const d = drag.current
      if (!d) return
      const w = Math.round(Math.min(MAX_COL, Math.max(MIN_COL, d.startW + ev.clientX - d.startX)))
      setSaved((prev) => (prev[d.col] === w ? prev : { ...prev, [d.col]: w }))
    }
    const up = () => {
      drag.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setSaved((prev) => { persist(prev); return prev })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [saved, defaults, persist])

  const resetCol = useCallback((col) => {
    setSaved((prev) => { const next = { ...prev }; delete next[col]; persist(next); return next })
  }, [persist])

  const reset = useCallback(() => { setSaved({}); persist({}) }, [persist])

  const customizado = Object.keys(saved).some((k) => k in defaults)

  return { widths, total, startResize, resetCol, reset, customizado }
}

// Largura inicial por tipo de campo do Banco de dados.
export function larguraPadrao(campo) {
  const k = campo.key || ''
  if (k.startsWith('utm_')) return 150
  switch (campo.type) {
    case 'email':  return 220
    case 'phone':  return 150
    case 'url':    return 260
    case 'number': return 110
    case 'date':   return 130
    case 'select': return 160
    default:       return 180
  }
}
