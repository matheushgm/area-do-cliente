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

/**
 * Renderiza o elemento em canvas no TAMANHO NATURAL (largura/altura próprias) e
 * retorna Blob PNG. Usado para baixar wireframes de landing page — elementos
 * altos cuja dimensão não é fixa. `scale` aumenta a nitidez (retina).
 * @param {HTMLElement} el
 * @param {object} opts
 * @param {number} [opts.scale=2]
 * @param {string} [opts.backgroundColor='#FFFFFF']
 */
export async function elementToPngBlob(el, opts = {}) {
  const { scale = 2, backgroundColor = '#FFFFFF' } = opts
  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor,
    logging: false,
  })
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })
}

export { downloadBlob, slugify } from './utils'
