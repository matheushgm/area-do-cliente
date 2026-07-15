// ─── Wireframe "Texto Lateral + Imagem" ───────────────────────────────────────
// Layout: imagem de fundo full-bleed (com overlay escuro pra legibilidade) e
// texto empilhado à esquerda — headline gigante em caixa alta com trechos na
// cor de destaque, bloco de apoio com borda lateral e CTA outlined.
// Referência: anúncio dark com foto de empresário e headline em branco/laranja.

import { escapeHtml, slot, hexToRgba } from './shared'

const FIELDS = [
  {
    key: 'headline',
    label: 'Headline',
    type: 'textarea',
    placeholder: 'Tem empresário que fatura **R$500 mil** e vive pior do que quem fatura **R$50 mil.**',
    hint: 'Use **trecho** pra pintar números/palavras na cor de destaque. Tudo vira caixa alta.',
    max: 220,
  },
  {
    key: 'apoio',
    label: 'Bloco de apoio (borda lateral)',
    type: 'textarea',
    placeholder: 'Pare de ser escravo **da empresa que você mesmo construiu.**',
    hint: 'Use **trecho** pra pintar a parte final na cor de destaque',
    max: 160,
  },
  {
    key: 'cta',
    label: 'CTA',
    placeholder: 'Aprenda a virar o jogo',
    max: 40,
  },
]

const MEDIA_FIELDS = [
  { key: 'bgImage', label: 'Imagem de fundo (URL)', placeholder: 'https://… (vazio = placeholder)' },
]

const BRAND_FIELDS = [
  { key: 'accent', label: 'Cor de destaque', default: '#FF7A1A' },
  { key: 'bg1', label: 'Fundo / overlay', default: '#0B0906' },
]

// Dimensões e escalas por formato.
const FORMAT_CONFIG = {
  feed: {
    width: 1080,
    height: 1080,
    stagePadding: '84px 80px 84px',
    headlineSize: 82,
    headlineMax: 800,
    apoioSize: 34,
    apoioGap: 44,
    ctaSize: 27,
  },
  story: {
    width: 1080,
    height: 1920,
    stagePadding: '150px 80px 170px',
    headlineSize: 116,
    headlineMax: 800,
    apoioSize: 42,
    apoioGap: 56,
    ctaSize: 31,
  },
}

function bgLayer(bgImage) {
  const u = String(bgImage || '').trim()
  if (u) {
    return `<img class="bg-img" src="${escapeHtml(u)}" alt="">`
  }
  return `<div class="bg-ph">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="M21 15l-5-5-9 9"/>
    </svg>
    <span>IMAGEM DE FUNDO<br>ex: pessoa em contexto, lado direito livre</span>
  </div>`
}

function buildHtml({ format = 'feed', values = {} }) {
  const cfg = FORMAT_CONFIG[format] || FORMAT_CONFIG.feed
  const accent = values.accent || '#FF7A1A'
  const bg1 = values.bg1 || '#0B0906'

  const headline = slot(values.headline, 'Headline forte com **trechos em destaque** na cor da marca')
  const apoio = slot(values.apoio, 'Frase de apoio **com fechamento em destaque.**')
  const cta = values.cta?.trim() ? escapeHtml(values.cta) : 'Saiba mais'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800;900&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${cfg.width}px; height: ${cfg.height}px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    background: ${bg1};
    color: #FFFFFF;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .ph { opacity: 0.42; }
  .stage {
    width: ${cfg.width}px; height: ${cfg.height}px;
    position: relative; overflow: hidden;
    background: ${bg1};
  }
  .bg-img {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
  }
  .bg-ph {
    position: absolute; inset: 0;
    z-index: 1;
    background:
      radial-gradient(75% 60% at 78% 55%, ${hexToRgba(accent, 0.12)} 0%, rgba(0,0,0,0) 60%),
      linear-gradient(205deg, #201a12 0%, ${bg1} 70%);
    display: flex; flex-direction: column;
    align-items: flex-end; justify-content: flex-end;
    gap: 14px; padding: 60px; text-align: right;
    color: rgba(255,255,255,0.45);
  }
  .bg-ph svg { width: 64px; height: 64px; }
  .bg-ph span { font-size: 22px; font-weight: 600; line-height: 1.4; max-width: 340px; }
  .overlay {
    position: absolute; inset: 0;
    background:
      linear-gradient(90deg, ${hexToRgba(bg1, 0.94)} 0%, ${hexToRgba(bg1, 0.72)} 42%, ${hexToRgba(bg1, 0.1)} 100%),
      linear-gradient(0deg, ${hexToRgba(bg1, 0.85)} 0%, rgba(0,0,0,0) 32%);
  }
  .content {
    position: absolute; inset: 0;
    z-index: 2;
    padding: ${cfg.stagePadding};
    display: flex; flex-direction: column;
    align-items: flex-start;
  }
  .headline {
    font-size: ${cfg.headlineSize}px; font-weight: 900;
    line-height: 1.08; letter-spacing: -0.01em;
    text-transform: uppercase;
    max-width: ${cfg.headlineMax}px;
    text-shadow: 0 4px 30px rgba(0,0,0,0.55);
  }
  .headline strong { color: ${accent}; font-weight: 900; }
  .spacer { flex: 1; }
  .apoio {
    border-left: 8px solid ${accent};
    padding-left: 30px;
    font-size: ${cfg.apoioSize}px; font-weight: 800;
    line-height: 1.32; text-transform: uppercase;
    max-width: ${cfg.headlineMax - 60}px;
    margin-bottom: ${cfg.apoioGap}px;
    text-shadow: 0 3px 20px rgba(0,0,0,0.55);
  }
  .apoio strong { color: ${accent}; font-weight: 800; }
  .cta {
    display: inline-flex; align-items: center; gap: 20px;
    border: 3px solid ${accent};
    background: ${hexToRgba(bg1, 0.55)};
    padding: 24px 42px;
    font-size: ${cfg.ctaSize}px; font-weight: 800;
    letter-spacing: 0.1em; text-transform: uppercase;
  }
  .cta .arrows {
    color: ${accent}; font-weight: 900;
    letter-spacing: -0.05em;
  }
</style>
</head>
<body>
<div class="stage">
  ${bgLayer(values.bgImage)}
  <div class="overlay"></div>
  <div class="content">
    <h1 class="headline">${headline}</h1>
    <div class="spacer"></div>
    <p class="apoio">${apoio}</p>
    <div class="cta"><span class="arrows">&raquo;</span><span>${cta}</span></div>
  </div>
</div>
</body>
</html>`
}

const thumbnail = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
  <defs>
    <linearGradient id='ov' x1='0' y1='0' x2='1' y2='0'>
      <stop offset='0%' stop-color='#0B0906'/>
      <stop offset='55%' stop-color='#0B0906' stop-opacity='0.75'/>
      <stop offset='100%' stop-color='#241c11'/>
    </linearGradient>
  </defs>
  <rect width='200' height='200' fill='#151009'/>
  <circle cx='150' cy='95' r='45' fill='#2b2115'/>
  <rect width='200' height='200' fill='url(#ov)'/>
  <rect x='18' y='28' width='105' height='13' rx='2' fill='#FFFFFF'/>
  <rect x='18' y='47' width='80' height='13' rx='2' fill='#FF7A1A'/>
  <rect x='18' y='66' width='100' height='13' rx='2' fill='#FFFFFF'/>
  <rect x='18' y='85' width='62' height='13' rx='2' fill='#FF7A1A'/>
  <rect x='18' y='128' width='4' height='26' fill='#FF7A1A'/>
  <rect x='28' y='130' width='78' height='7' rx='2' fill='#FFFFFF'/>
  <rect x='28' y='142' width='64' height='7' rx='2' fill='#FF7A1A'/>
  <rect x='18' y='166' width='92' height='20' rx='2' fill='none' stroke='#FF7A1A' stroke-width='2'/>
  <rect x='26' y='173' width='10' height='6' rx='1' fill='#FF7A1A'/>
  <rect x='42' y='173' width='58' height='6' rx='2' fill='#FFFFFF'/>
</svg>`)}`

export default {
  id: 'texto-lateral-imagem',
  name: 'Texto Lateral + Imagem',
  description:
    'Imagem de fundo full-bleed com overlay escuro, headline gigante à esquerda com trechos em destaque, bloco de apoio com borda lateral e CTA outlined.',
  ready: true,
  thumbnail,
  fields: FIELDS,
  mediaFields: MEDIA_FIELDS,
  brandFields: BRAND_FIELDS,
  buildHtml,
}
