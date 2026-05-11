// Template "Bold" — gradient escuro, headline gigante em uppercase.

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 1080px; height: 1080px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    background: #050505;
    color: #FFFFFF;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .stage {
    width: 1080px; height: 1080px;
    padding: 80px 80px;
    background: linear-gradient(135deg, {{BRAND_COLOR}} 0%, #050505 75%);
    display: flex; flex-direction: column; justify-content: space-between;
    position: relative;
  }
  .stage::before {
    content: ''; position: absolute;
    top: -200px; right: -200px;
    width: 600px; height: 600px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    filter: blur(2px);
  }
  .topbar {
    display: flex; align-items: center; gap: 16px;
    font-size: 22px; font-weight: 700;
    color: rgba(255,255,255,0.95);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    position: relative; z-index: 1;
  }
  .topbar .badge {
    background: rgba(255,255,255,0.15);
    backdrop-filter: blur(10px);
    padding: 8px 16px;
    border-radius: 9999px;
    border: 1px solid rgba(255,255,255,0.2);
    font-size: 16px;
  }
  .content {
    flex: 1;
    display: flex; flex-direction: column; justify-content: center;
    position: relative; z-index: 1;
  }
  .headline {
    font-size: 116px; font-weight: 900;
    line-height: 0.95; letter-spacing: -0.035em;
    color: #FFFFFF;
    text-transform: uppercase;
    max-width: 940px;
  }
  .subheadline {
    font-size: 28px; font-weight: 400;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.72);
    margin-top: 32px; max-width: 760px;
  }
  .cta {
    display: inline-flex; align-items: center; gap: 14px;
    background: #FFFFFF;
    color: #050505;
    font-size: 28px; font-weight: 800;
    padding: 24px 52px;
    border-radius: 9999px;
    align-self: flex-start;
    position: relative; z-index: 1;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
</style>
</head>
<body>
<div class="stage">
  <div class="topbar">
    <span class="badge">{{COMPANY_NAME}}</span>
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
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#7C3AED'/>
      <stop offset='75%' stop-color='#050505'/>
    </linearGradient>
  </defs>
  <rect width='200' height='200' fill='url(#g)'/>
  <rect x='18' y='15' width='60' height='12' rx='6' fill='rgba(255,255,255,0.18)' stroke='rgba(255,255,255,0.25)' stroke-width='0.5'/>
  <rect x='18' y='70' width='160' height='16' fill='#FFFFFF'/>
  <rect x='18' y='92' width='150' height='16' fill='#FFFFFF'/>
  <rect x='18' y='114' width='100' height='16' fill='#FFFFFF'/>
  <rect x='18' y='140' width='100' height='5' fill='#FFFFFF' opacity='0.55'/>
  <rect x='18' y='150' width='80' height='5' fill='#FFFFFF' opacity='0.55'/>
  <rect x='18' y='170' width='90' height='14' rx='7' fill='#FFFFFF'/>
</svg>`)}`

export default {
  id: 'bold',
  name: 'Bold',
  description: 'Fundo gradient escuro, headline uppercase gigante, CTA branco contrastado',
  thumbnail,
  html,
}
