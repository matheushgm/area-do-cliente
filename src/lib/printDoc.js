// Scaffold único dos documentos "Salvar como PDF": monta o HTML, injeta o CSS
// base (reset, tipografia, cabeçalho, botão de imprimir) e abre a janela de
// impressão. Cada gerador só escreve o corpo e o CSS específico dele.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { escapeHtml } from './utils'

export const PRINT_BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px; color: #1a1a2e; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #164496; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #164496; }
  .doc-title { font-size: 22px; font-weight: 800; color: #0F172A; margin-bottom: 2px; }
  .doc-subtitle { font-size: 13px; color: #64748B; }
  .doc-date { font-size: 11px; color: #94A3B8; text-align: right; margin-top: 4px; }
  .print-btn {
    position: fixed; bottom: 24px; right: 24px; z-index: 999;
    background: #164496; color: white; border: none; border-radius: 10px;
    padding: 12px 24px; font-size: 14px; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 14px rgba(22,68,150,0.35); display: flex; align-items: center; gap: 8px;
  }
  .print-btn:hover { background: #0F3380; }
  @media print { .print-btn { display: none !important; } }
`

// Página "clássica": corpo centralizado com margem (onboarding, kickoff, mecanismo…).
export const PAGE_CSS = `
  body { padding: 32px 40px; max-width: 900px; margin: 0 auto; }
  @media print { body { padding: 20px 24px; } }
`

export function todayLong() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Cabeçalho padrão: marca · título · subtítulo · "Gerado em".
export function docHeader({ logo = 'Revenue Lab', title, subtitle = '', date = todayLong() }) {
  return `
  <div class="header">
    <div>
      <div class="logo">${escapeHtml(logo)}</div>
      <div class="doc-title">${escapeHtml(title)}</div>
      ${subtitle ? `<div class="doc-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <div class="doc-date">Gerado em ${escapeHtml(date)}</div>
  </div>`
}

// Markdown gerado pela IA → HTML estático (mesmo renderizador das telas).
export function markdownToHtml(md) {
  if (!md) return ''
  return renderToStaticMarkup(createElement(ReactMarkdown, null, String(md)))
}

export function openPrintWindow(html, { width = 1000, height = 800 } = {}) {
  const win = window.open('', '_blank', `width=${width},height=${height}`)
  if (!win) { alert('Permita pop-ups para exportar o PDF.'); return false }
  win.document.write(html)
  win.document.close()
  return true
}

// Documento completo. `title` vira o nome sugerido do PDF; `head` permite
// links extras (fontes). O botão de imprimir some na impressão.
export function printDocument({ title, css = '', body, head = '', width = 1000, height = 800 }) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  ${head}
  <style>${PRINT_BASE_CSS}${css}</style>
</head>
<body>
${body}
  <button class="print-btn" onclick="window.print()">🖨️ Salvar como PDF</button>
</body>
</html>`
  return openPrintWindow(html, { width, height })
}
