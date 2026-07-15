// ─── Wireframe "Destaque + 2 Fotos" ───────────────────────────────────────────
// Layout: logo no topo → título gigante → subheadline com trecho na cor de
// destaque → selo glass com ícone → duas fotos lado a lado → CTA.
// No feed (1080×1080) o CTA fica sobreposto na emenda das fotos; no story
// (1080×1920) ele ganha respiro próprio com glow entre o selo e as fotos.

import { escapeHtml, rich, slot, hexToRgba, photoBlock, logoBlock } from './shared'

const FIELDS = [
  {
    key: 'title',
    label: 'Título',
    placeholder: 'Centro médico',
    hint: 'Curto e gigante — segmento, promessa ou chamada principal',
    max: 60,
  },
  {
    key: 'sub',
    label: 'Subheadline',
    type: 'textarea',
    placeholder: 'O seu caixa enxerga a **diferença de margem** entre convênio e particular?',
    hint: 'Use **trecho** pra pintar o trecho na cor de destaque',
    max: 220,
  },
  {
    key: 'badgeBold',
    label: 'Selo — frase em destaque',
    placeholder: 'Gestão financeira especializada em saúde,',
    max: 90,
  },
  {
    key: 'badgeText',
    label: 'Selo — complemento',
    placeholder: 'do faturamento ao repasse dos médicos.',
    max: 90,
  },
  {
    key: 'cta',
    label: 'CTA',
    placeholder: 'Saiba mais',
    max: 30,
  },
]

const MEDIA_FIELDS = [
  { key: 'logoUrl', label: 'Logo (URL da imagem)', placeholder: 'https://… (vazio = nome da empresa)' },
  { key: 'photo1', label: 'Foto 1 (URL)', placeholder: 'https://… (vazio = placeholder)' },
  { key: 'photo2', label: 'Foto 2 (URL)', placeholder: 'https://… (vazio = placeholder)' },
]

const BRAND_FIELDS = [
  { key: 'accent', label: 'Cor de destaque', default: '#2BD98A' },
  { key: 'bg1', label: 'Fundo — base', default: '#081C30' },
  { key: 'bg2', label: 'Fundo — gradiente', default: '#14405C' },
]

// Dimensões e escalas por formato. Tudo que muda entre feed e story vive aqui.
const FORMAT_CONFIG = {
  feed: {
    width: 1080,
    height: 1080,
    stagePadding: '56px 72px 72px',
    logoHeight: 44,
    logoGap: 44,
    titleSize: 100,
    titleGap: 30,
    subSize: 42,
    subGap: 40,
    badgeGap: 44,
    ctaOverlay: true,
  },
  story: {
    width: 1080,
    height: 1920,
    stagePadding: '116px 72px 96px',
    logoHeight: 52,
    logoGap: 72,
    titleSize: 112,
    titleGap: 44,
    subSize: 50,
    subGap: 60,
    badgeGap: 64,
    ctaOverlay: false,
  },
}

function buildHtml({ format = 'feed', values = {} }) {
  const cfg = FORMAT_CONFIG[format] || FORMAT_CONFIG.feed
  const accent = values.accent || '#2BD98A'
  const bg1 = values.bg1 || '#081C30'
  const bg2 = values.bg2 || '#14405C'

  const title = slot(values.title, 'Título principal')
  const sub = slot(values.sub, 'Subheadline com **trecho em destaque** na cor da marca')
  const badgeBold = values.badgeBold?.trim()
    ? `<b>${rich(values.badgeBold)}</b>`
    : `<b class="ph">Frase em destaque do selo,</b>`
  const badgeText = values.badgeText?.trim()
    ? rich(values.badgeText)
    : `<span class="ph">complemento do selo.</span>`
  const cta = values.cta?.trim() ? escapeHtml(values.cta) : 'Saiba mais'

  const ctaHtml = `<div class="cta">${cta}</div>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
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
    padding: ${cfg.stagePadding};
    background:
      radial-gradient(120% 85% at 88% -10%, ${bg2} 0%, rgba(0,0,0,0) 60%),
      radial-gradient(90% 70% at -15% 110%, ${hexToRgba(accent, 0.14)} 0%, rgba(0,0,0,0) 55%),
      linear-gradient(160deg, ${bg1} 0%, ${bg2} 130%);
    display: flex; flex-direction: column; align-items: center;
    position: relative; overflow: hidden;
  }
  .logo-img { height: ${cfg.logoHeight}px; margin-bottom: ${cfg.logoGap}px; object-fit: contain; }
  .logo-text {
    height: ${cfg.logoHeight}px; margin-bottom: ${cfg.logoGap}px;
    display: flex; align-items: center;
    font-size: ${Math.round(cfg.logoHeight * 0.62)}px; font-weight: 800;
    letter-spacing: 0.14em; text-transform: uppercase;
  }
  .title {
    font-size: ${cfg.titleSize}px; font-weight: 800;
    line-height: 1.02; letter-spacing: -0.03em;
    text-align: center;
    margin-bottom: ${cfg.titleGap}px;
    max-width: 940px;
  }
  .sub {
    font-size: ${cfg.subSize}px; font-weight: 400;
    line-height: 1.32; text-align: center;
    color: rgba(255,255,255,0.94);
    margin-bottom: ${cfg.subGap}px;
    max-width: 880px;
  }
  .sub strong { color: ${accent}; font-weight: 700; }
  .badge {
    display: flex; align-items: center; gap: 26px;
    background: linear-gradient(90deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 24px;
    padding: 24px 34px;
    max-width: 880px;
    margin-bottom: ${cfg.badgeGap}px;
  }
  .badge-icon {
    width: 76px; height: 76px; flex-shrink: 0;
    border-radius: 20px;
    background: linear-gradient(135deg, ${hexToRgba(accent, 0.95)} 0%, ${hexToRgba(accent, 0.55)} 100%);
    display: flex; align-items: center; justify-content: center;
  }
  .badge-icon svg { width: 44px; height: 44px; stroke: ${bg1}; }
  .badge-txt { font-size: 30px; line-height: 1.35; color: rgba(255,255,255,0.78); }
  .badge-txt b { color: #FFFFFF; font-weight: 700; }
  .cta {
    background: ${accent};
    color: ${bg1};
    font-size: 34px; font-weight: 800;
    letter-spacing: 0.05em; text-transform: uppercase;
    padding: 28px 62px;
    border-radius: 22px;
    white-space: nowrap;
  }
  ${cfg.ctaOverlay ? `
  .photos .cta {
    position: absolute;
    left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
    box-shadow: 0 18px 50px rgba(0,0,0,0.45);
  }` : `
  .cta-row {
    margin-bottom: ${cfg.badgeGap}px;
    position: relative;
  }
  .cta-row::before {
    content: '';
    position: absolute; inset: -30px -50px;
    background: radial-gradient(50% 50% at 50% 50%, ${hexToRgba(accent, 0.4)} 0%, rgba(0,0,0,0) 70%);
    z-index: 0;
  }
  .cta-row .cta { position: relative; z-index: 1; }`}
  .photos {
    display: flex; gap: 28px;
    width: 100%; flex: 1; min-height: 0;
    position: relative;
  }
  .photo {
    flex: 1; min-width: 0;
    border-radius: 28px;
    overflow: hidden;
  }
  .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo-ph {
    border: 2px dashed rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.05);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 12px; padding: 24px; text-align: center;
  }
  .photo-ph svg { width: 60px; height: 60px; color: rgba(255,255,255,0.4); }
  .photo-label { font-size: 26px; font-weight: 700; color: rgba(255,255,255,0.72); }
  .photo-hint { font-size: 20px; color: rgba(255,255,255,0.45); max-width: 320px; }
</style>
</head>
<body>
<div class="stage">
  ${logoBlock(values.logoUrl, values.companyName)}
  <h1 class="title">${title}</h1>
  <p class="sub">${sub}</p>
  <div class="badge">
    <div class="badge-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round">
        <circle cx="12" cy="12" r="9.2"/>
        <path d="M14.8 9.3c-.5-1-1.5-1.5-2.8-1.5-1.6 0-2.8.8-2.8 2.1 0 2.9 5.9 1.3 5.9 4.2 0 1.3-1.3 2.1-3.1 2.1-1.5 0-2.6-.6-3.1-1.7M12 6.2v11.6"/>
      </svg>
    </div>
    <div class="badge-txt">${badgeBold} ${badgeText}</div>
  </div>
  ${cfg.ctaOverlay ? '' : `<div class="cta-row">${ctaHtml}</div>`}
  <div class="photos">
    ${photoBlock(values.photo1, 'FOTO 1', 'ex: equipe, ambiente, pessoas em contexto')}
    ${photoBlock(values.photo2, 'FOTO 2', 'ex: detalhe do serviço, mãos em ação')}
    ${cfg.ctaOverlay ? ctaHtml : ''}
  </div>
</div>
</body>
</html>`
}

const thumbnail = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
  <defs>
    <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#14405C'/>
      <stop offset='60%' stop-color='#081C30'/>
    </linearGradient>
  </defs>
  <rect width='200' height='200' fill='url(#bg)'/>
  <rect x='80' y='12' width='40' height='8' rx='4' fill='rgba(255,255,255,0.35)'/>
  <rect x='30' y='34' width='140' height='18' rx='3' fill='#FFFFFF'/>
  <rect x='45' y='60' width='110' height='6' rx='3' fill='rgba(255,255,255,0.7)'/>
  <rect x='55' y='70' width='60' height='6' rx='3' fill='#2BD98A'/>
  <rect x='117' y='70' width='28' height='6' rx='3' fill='rgba(255,255,255,0.7)'/>
  <rect x='35' y='88' width='130' height='26' rx='7' fill='rgba(255,255,255,0.12)' stroke='rgba(255,255,255,0.2)' stroke-width='0.5'/>
  <rect x='41' y='94' width='14' height='14' rx='4' fill='#2BD98A'/>
  <rect x='62' y='95' width='90' height='4' rx='2' fill='rgba(255,255,255,0.85)'/>
  <rect x='62' y='103' width='70' height='4' rx='2' fill='rgba(255,255,255,0.5)'/>
  <rect x='18' y='124' width='78' height='62' rx='8' fill='rgba(255,255,255,0.1)' stroke='rgba(255,255,255,0.3)' stroke-width='1' stroke-dasharray='4 3'/>
  <rect x='104' y='124' width='78' height='62' rx='8' fill='rgba(255,255,255,0.1)' stroke='rgba(255,255,255,0.3)' stroke-width='1' stroke-dasharray='4 3'/>
  <rect x='64' y='146' width='72' height='18' rx='5' fill='#2BD98A'/>
</svg>`)}`

export default {
  id: 'destaque-duas-fotos',
  name: 'Destaque + 2 Fotos',
  description:
    'Logo no topo, título gigante, subheadline com trecho em destaque, selo com ícone, duas fotos e CTA.',
  ready: true,
  thumbnail,
  fields: FIELDS,
  mediaFields: MEDIA_FIELDS,
  brandFields: BRAND_FIELDS,
  buildHtml,
}
