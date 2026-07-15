// ─── Helpers compartilhados dos wireframes de anúncio ─────────────────────────
// Funções puras usadas pelos builders de HTML dos wireframes (escape, rich text,
// blocos de mídia com placeholder). Cada wireframe gera um HTML standalone —
// nada aqui depende de React.

export const AD_FORMATS = [
  { id: 'feed', label: 'Feed — 1080×1080', width: 1080, height: 1080 },
  { id: 'story', label: 'Story — 1080×1920', width: 1080, height: 1920 },
]

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Escape + **negrito** → <strong> (estilizado com a cor de destaque no CSS
// do wireframe) + quebras de linha → <br>.
export function rich(s) {
  let out = escapeHtml(s)
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/\n/g, '<br>')
  return out
}

// Valor do slot ou texto-guia dimmed quando vazio (comportamento de wireframe).
export function slot(value, guide) {
  const v = String(value || '').trim()
  if (v) return rich(v)
  return `<span class="ph">${rich(guide)}</span>`
}

// Converte #RRGGBB em rgba() com alpha — usado pra glows na cor de destaque.
export function hexToRgba(hex, alpha = 1) {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m) return `rgba(43, 217, 138, ${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// Bloco de foto: imagem real (URL) ou placeholder tracejado com rótulo-guia.
export function photoBlock(url, label, hint) {
  const u = String(url || '').trim()
  if (u) {
    return `<div class="photo"><img src="${escapeHtml(u)}" alt=""></div>`
  }
  return `<div class="photo photo-ph">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="M21 15l-5-5-9 9"/>
    </svg>
    <span class="photo-label">${escapeHtml(label)}</span>
    <span class="photo-hint">${escapeHtml(hint)}</span>
  </div>`
}

// Logo: imagem (URL) ou nome da empresa como marca tipográfica.
export function logoBlock(logoUrl, companyName) {
  const u = String(logoUrl || '').trim()
  if (u) return `<img class="logo-img" src="${escapeHtml(u)}" alt="logo">`
  const name = String(companyName || '').trim() || 'SUA MARCA'
  return `<div class="logo-text">${escapeHtml(name)}</div>`
}
