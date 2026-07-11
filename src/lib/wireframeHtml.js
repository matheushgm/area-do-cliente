// Serializa um elemento DOM (wireframe renderizado) em um arquivo HTML
// standalone: clona o nó e converte os estilos computados em estilos inline,
// então o arquivo abre em qualquer navegador sem depender do Tailwind do app.
// Usado pelo LandingPageModule no botão "Baixar HTML".

const SVG_NS = 'http://www.w3.org/2000/svg'

// Propriedades tratadas manualmente (fora do diff) — ver regras em inlineStyles().
const MANUAL_PROPS = new Set(['width', 'height', 'inline-size', 'block-size'])

// Tags cujo tamanho vem do conteúdo substituído — sempre fixar width/height.
const REPLACED_TAGS = new Set(['img', 'video', 'iframe', 'canvas', 'hr'])

// Bordas são interdependentes (style solid + width 0 = invisível; inlinar só o
// style ressuscita a largura default "medium") — sai do diff e é tratada
// manualmente por lado em inlineStyles(). Radius fica no diff (independente).
const BORDER_SIDE_RE = /^border-(top|right|bottom|left|block|inline)(?!.*radius)/

// ─── Baseline: estilos default do navegador (iframe sem CSS) ──────────────────
// O diff é feito contra um documento SEM stylesheet (nem o preflight do
// Tailwind), porque é assim que o arquivo baixado vai ser renderizado.
let baselineDoc = null
function getBaselineDoc() {
  if (baselineDoc) return baselineDoc
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  doc.open()
  doc.write('<!doctype html><html><head></head><body></body></html>')
  doc.close()
  baselineDoc = doc
  return doc
}

const baselineCache = new Map()
function baselineStyles(tagName, isSvg) {
  const key = (isSvg ? 'svg:' : '') + tagName
  if (baselineCache.has(key)) return baselineCache.get(key)
  const doc = getBaselineDoc()
  const el = isSvg ? doc.createElementNS(SVG_NS, tagName) : doc.createElement(tagName)
  doc.body.appendChild(el)
  const cs = doc.defaultView.getComputedStyle(el)
  const snap = {}
  for (let i = 0; i < cs.length; i++) {
    const prop = cs[i]
    snap[prop] = cs.getPropertyValue(prop)
  }
  doc.body.removeChild(el)
  baselineCache.set(key, snap)
  return snap
}

// ─── Inline dos estilos de UM elemento (orig → copy) ─────────────────────────
function inlineStyles(orig, copy) {
  const tag = orig.tagName.toLowerCase()
  const isSvg = orig.namespaceURI === SVG_NS

  // Descendentes de <svg> (path, circle…): os atributos já carregam a aparência
  // e stroke/fill herdam via currentColor do pai — não precisa de estilo inline.
  if (isSvg && tag !== 'svg') {
    copy.removeAttribute('class')
    return
  }

  const cs = getComputedStyle(orig)
  const base = baselineStyles(tag, isSvg)
  const decls = []
  for (let i = 0; i < cs.length; i++) {
    const prop = cs[i]
    if (MANUAL_PROPS.has(prop) || prop.startsWith('--') || BORDER_SIDE_RE.test(prop)) continue
    const val = cs.getPropertyValue(prop)
    if (val !== base[prop]) decls.push(`${prop}:${val}`)
  }

  // Bordas: só os lados realmente visíveis (style ≠ none E width > 0).
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const w = cs.getPropertyValue(`border-${side}-width`)
    const s = cs.getPropertyValue(`border-${side}-style`)
    if (s !== 'none' && parseFloat(w) > 0) {
      decls.push(`border-${side}:${w} ${s} ${cs.getPropertyValue(`border-${side}-color`)}`)
    }
  }

  // width: sempre fixado — garante colunas/flex idênticos ao preview.
  decls.push(`width:${cs.getPropertyValue('width')}`)

  // height: só quando o tamanho não vem do fluxo do conteúdo — elementos
  // decorativos vazios (barras de skeleton), mídia substituída e o próprio
  // <svg> (classes w-*/h-* sobrescrevem os atributos width/height do ícone).
  // Em blocos com texto a altura fica auto: se a fonte de fallback variar,
  // o conteúdo cresce em vez de ser cortado.
  const isEmpty = orig.childElementCount === 0 && !orig.textContent.trim()
  if (isEmpty || isSvg || REPLACED_TAGS.has(tag)) {
    decls.push(`height:${cs.getPropertyValue('height')}`)
  }

  copy.setAttribute('style', decls.join(';'))
  copy.removeAttribute('class')
}

/**
 * Converte o elemento renderizado em Blob HTML standalone.
 * @param {HTMLElement} el - raiz do wireframe renderizado
 * @param {object} opts
 * @param {string} [opts.title='Wireframe'] - <title> do documento
 */
export function elementToHtmlBlob(el, opts = {}) {
  const { title = 'Wireframe' } = opts
  const clone = el.cloneNode(true)

  // Percorre original e clone em paralelo (mesma ordem de querySelectorAll).
  const origEls = [el, ...el.querySelectorAll('*')]
  const cloneEls = [clone, ...clone.querySelectorAll('*')]
  origEls.forEach((orig, i) => inlineStyles(orig, cloneEls[i]))

  // Centraliza o wireframe num fundo neutro, na largura em que foi capturado.
  clone.style.margin = '0 auto'
  clone.style.maxWidth = '100%'

  const safeTitle = String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const html = [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>Wireframe — ${safeTitle}</title>`,
    // Mesma fonte do app; sem internet degrada para o fallback system-ui.
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">',
    '</head>',
    '<body style="margin:0;padding:24px;background:#f1f5f9">',
    clone.outerHTML,
    '</body>',
    '</html>',
  ].join('\n')

  return new Blob([html], { type: 'text/html;charset=utf-8' })
}
