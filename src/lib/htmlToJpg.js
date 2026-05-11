// Converte um elemento DOM em Blob JPG usando html2canvas.
// Usado pelo CriativoVisualPanel para gerar JPGs 1080×1080 baixáveis.
import html2canvas from 'html2canvas'

/**
 * Renderiza o elemento em canvas e retorna Blob JPG.
 * @param {HTMLElement} el  - elemento DOM a renderizar
 * @param {object} opts
 * @param {number} [opts.width=1080]
 * @param {number} [opts.height=1080]
 * @param {number} [opts.quality=0.92] - 0..1
 * @param {string} [opts.backgroundColor='#FFFFFF']
 */
export async function elementToJpgBlob(el, opts = {}) {
  const {
    width = 1080,
    height = 1080,
    quality = 0.92,
    backgroundColor = '#FFFFFF',
  } = opts
  const canvas = await html2canvas(el, {
    width, height,
    windowWidth: width,
    windowHeight: height,
    scale: 1,
    useCORS: true,
    allowTaint: true,
    backgroundColor,
    logging: false,
  })
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  })
}

/** Helper de download: dispara o save-as no navegador. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Slug seguro pra nome de arquivo (acentos viram ascii, espaços viram -). */
export function slugify(str) {
  return String(str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'criativo'
}
