// Template "Quote" — estilo depoimento/aspas, fundo claro com aspas
// decorativas gigantes em SVG; headline em itálico.

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 1080px; height: 1080px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    background: #F8F8F6;
    color: #1A1A1A;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .stage {
    width: 1080px; height: 1080px;
    padding: 100px 100px;
    display: flex; flex-direction: column; justify-content: space-between;
    position: relative;
    background:
      radial-gradient(circle at 100% 100%, rgba(0,0,0,0.04), transparent 60%),
      #F8F8F6;
  }
  .quote-mark {
    position: absolute;
    top: 40px; left: 60px;
    font-family: 'Georgia', serif;
    font-size: 320px;
    line-height: 1;
    color: {{BRAND_COLOR}};
    opacity: 0.18;
    user-select: none;
  }
  .topbar {
    display: flex; align-items: center; gap: 12px;
    font-size: 18px; font-weight: 600;
    color: {{BRAND_COLOR}};
    letter-spacing: 0.12em;
    text-transform: uppercase;
    position: relative; z-index: 1;
  }
  .topbar .line {
    width: 50px; height: 2px; background: {{BRAND_COLOR}};
  }
  .content {
    flex: 1;
    display: flex; flex-direction: column; justify-content: center;
    position: relative; z-index: 1;
    padding-left: 16px;
  }
  .headline {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-style: italic;
    font-size: 74px; font-weight: 400;
    line-height: 1.15; letter-spacing: -0.015em;
    color: #1A1A1A;
    max-width: 900px;
  }
  .subheadline {
    font-size: 24px; font-weight: 500;
    line-height: 1.4;
    color: #555555;
    margin-top: 40px;
    padding-left: 36px;
    border-left: 3px solid {{BRAND_COLOR}};
    max-width: 700px;
  }
  .cta {
    display: inline-flex; align-items: center; gap: 12px;
    color: {{BRAND_COLOR}};
    font-size: 24px; font-weight: 700;
    align-self: flex-start;
    position: relative; z-index: 1;
    border-bottom: 2px solid {{BRAND_COLOR}};
    padding-bottom: 6px;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
</style>
</head>
<body>
<div class="stage">
  <div class="quote-mark">"</div>

  <div class="topbar">
    <span class="line"></span>
    <span>{{COMPANY_NAME}}</span>
  </div>

  <div class="content">
    <h1 class="headline">{{HEADLINE}}</h1>
    <p class="subheadline">{{SUBHEADLINE}}</p>
  </div>

  <div class="cta">
    <span>{{CTA}}</span>
    <span>→</span>
  </div>
</div>
</body>
</html>`

const thumbnail = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
  <rect width='200' height='200' fill='#F8F8F6' stroke='#E5E7EB' stroke-width='1'/>
  <text x='12' y='80' font-family='Georgia, serif' font-size='110' fill='#7C3AED' opacity='0.18'>"</text>
  <rect x='18' y='30' width='30' height='3' fill='#7C3AED'/>
  <rect x='50' y='29' width='30' height='5' fill='#7C3AED'/>
  <rect x='28' y='80' width='150' height='12' fill='#1A1A1A' opacity='0.85'/>
  <rect x='28' y='98' width='130' height='12' fill='#1A1A1A' opacity='0.85'/>
  <rect x='28' y='116' width='100' height='12' fill='#1A1A1A' opacity='0.85'/>
  <rect x='28' y='148' width='2' height='14' fill='#7C3AED'/>
  <rect x='34' y='148' width='90' height='4' fill='#555555'/>
  <rect x='34' y='156' width='70' height='4' fill='#555555'/>
  <rect x='18' y='180' width='60' height='3' fill='#7C3AED'/>
</svg>`)}`

export default {
  id: 'quote',
  name: 'Quote',
  description: 'Estilo depoimento com aspas decorativas, headline em itálico serif',
  thumbnail,
  html,
}
