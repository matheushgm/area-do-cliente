// Template "Clean" — minimalista branco, foco no headline.
// Renderizado em iframe de 1080×1080 antes da exportação JPG.

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 1080px; height: 1080px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    background: #FFFFFF;
    color: #000000;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .stage {
    width: 1080px; height: 1080px;
    padding: 80px 90px;
    display: flex; flex-direction: column; justify-content: space-between;
    position: relative;
  }
  .topbar {
    display: flex; align-items: center; gap: 12px;
    font-size: 20px; font-weight: 600;
    color: {{BRAND_COLOR}};
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .topbar .dot {
    width: 12px; height: 12px; border-radius: 50%;
    background: {{BRAND_COLOR}};
  }
  .content {
    margin-top: 60px; flex: 1;
    display: flex; flex-direction: column; justify-content: center;
  }
  .headline {
    font-size: 92px; font-weight: 900;
    line-height: 1.02; letter-spacing: -0.025em;
    color: #000000;
    max-width: 900px;
  }
  .subheadline {
    font-size: 30px; font-weight: 400;
    line-height: 1.35; color: #444444;
    margin-top: 32px; max-width: 800px;
  }
  .cta {
    display: inline-flex; align-items: center; gap: 14px;
    background: {{BRAND_COLOR}};
    color: #FFFFFF;
    font-size: 28px; font-weight: 700;
    padding: 24px 52px;
    border-radius: 9999px;
    align-self: flex-start;
  }
  .cta .arrow {
    font-size: 24px; line-height: 1;
  }
</style>
</head>
<body>
<div class="stage">
  <div class="topbar">
    <span class="dot"></span>
    <span>{{COMPANY_NAME}}</span>
  </div>

  <div class="content">
    <h1 class="headline">{{HEADLINE}}</h1>
    <p class="subheadline">{{SUBHEADLINE}}</p>
  </div>

  <div class="cta">
    <span>{{CTA}}</span>
    <span class="arrow">→</span>
  </div>
</div>
</body>
</html>`

// Thumbnail SVG inline — versão simplificada do layout em 200×200
const thumbnail = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
  <rect width='200' height='200' fill='#FFFFFF' stroke='#E5E7EB' stroke-width='1'/>
  <circle cx='22' cy='22' r='3' fill='#000000'/>
  <rect x='30' y='19' width='40' height='6' fill='#000000' opacity='0.4'/>
  <rect x='18' y='70' width='160' height='14' fill='#000000'/>
  <rect x='18' y='90' width='130' height='14' fill='#000000'/>
  <rect x='18' y='110' width='100' height='14' fill='#000000'/>
  <rect x='18' y='135' width='100' height='5' fill='#000000' opacity='0.4'/>
  <rect x='18' y='145' width='80' height='5' fill='#000000' opacity='0.4'/>
  <rect x='18' y='170' width='70' height='14' rx='7' fill='#000000'/>
</svg>`)}`

export default {
  id: 'clean',
  name: 'Clean',
  description: 'Minimalista branco, headline grande em preto, CTA pill colorido',
  thumbnail,
  html,
}
