// Template "Tweet" — post estilo Twitter/X com avatar, nome verificado
// e body multi-parágrafo. Suporta **negrito**, *itálico* e quebras de
// linha (\n) no HEADLINE/SUBHEADLINE/CTA via renderRich em
// criativoTemplate.applyTemplatePlaceholders.
//
// Layout: 1080×1080 quadrado. Avatar gradient com {{INITIALS}} no topo;
// {{COMPANY_NAME}} + checkmark colorido (BRAND_COLOR); @{{HANDLE}}.
// Body em texto serifa-clean estilo tweet, com line-height generoso.

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
    color: #0F141A;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .stage {
    width: 1080px; height: 1080px;
    padding: 88px 96px 100px 96px;
    display: flex; flex-direction: column;
  }
  /* Header com avatar + nome + handle */
  .author {
    display: flex; align-items: center; gap: 24px;
    margin-bottom: 56px;
  }
  .avatar {
    width: 96px; height: 96px;
    border-radius: 50%;
    background: linear-gradient(135deg, {{BRAND_COLOR}} 0%, #111111 100%);
    display: flex; align-items: center; justify-content: center;
    color: #FFFFFF;
    font-size: 34px; font-weight: 800;
    letter-spacing: -0.02em;
    flex-shrink: 0;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  }
  .author-info { display: flex; flex-direction: column; min-width: 0; }
  .name-row {
    display: flex; align-items: center; gap: 10px;
    line-height: 1;
  }
  .name {
    font-size: 32px; font-weight: 800;
    color: #0F141A; letter-spacing: -0.025em;
  }
  .check {
    width: 30px; height: 30px;
    color: {{BRAND_COLOR}};
    flex-shrink: 0;
  }
  .handle {
    font-size: 24px; font-weight: 500;
    color: #6B7280;
    margin-top: 6px;
    letter-spacing: -0.01em;
  }
  /* Corpo do tweet */
  .body {
    flex: 1;
    font-size: 40px;
    line-height: 1.4;
    color: #0F141A;
    letter-spacing: -0.015em;
    font-weight: 400;
  }
  .body .lead {
    margin-bottom: 36px;
    font-weight: 500;
  }
  .body .main {
    margin-bottom: 0;
  }
  /* "negrito" inline (via **texto** convertido em <strong>) */
  .body strong { font-weight: 800; color: #0F141A; }
  .body em     { font-style: italic; color: #0F141A; }
  /* CTA final no rodapé */
  .cta {
    margin-top: auto;
    padding-top: 36px;
    font-size: 38px;
    line-height: 1.35;
    color: #0F141A;
    font-weight: 500;
    letter-spacing: -0.015em;
    display: flex; align-items: flex-start; gap: 14px;
  }
  .cta-arrow {
    font-size: 44px; line-height: 1;
    flex-shrink: 0;
  }
</style>
</head>
<body>
<div class="stage">
  <div class="author">
    <div class="avatar">{{INITIALS}}</div>
    <div class="author-info">
      <div class="name-row">
        <span class="name">{{COMPANY_NAME}}</span>
        <!-- Checkmark verificado estilo X/Twitter (forma estrelada com check) -->
        <svg class="check" viewBox="0 0 22 22" fill="currentColor">
          <path d="M20.396 11c0-.78-.44-1.46-1.09-1.81.32-.69.32-1.49-.07-2.19-.39-.7-1.09-1.16-1.84-1.16-.18-.81-.66-1.51-1.36-1.93-.81-.43-1.71-.32-2.46.14-.42-.71-1.18-1.16-2.04-1.16s-1.62.45-2.04 1.16c-.75-.46-1.65-.57-2.46-.14-.7.42-1.18 1.12-1.36 1.93-.75 0-1.45.46-1.84 1.16-.39.7-.39 1.5-.07 2.19-.65.35-1.09 1.03-1.09 1.81 0 .78.44 1.46 1.09 1.81-.32.69-.32 1.49.07 2.19.39.7 1.09 1.16 1.84 1.16.18.81.66 1.51 1.36 1.93.81.43 1.71.32 2.46-.14.42.71 1.18 1.16 2.04 1.16s1.62-.45 2.04-1.16c.75.46 1.65.57 2.46.14.7-.42 1.18-1.12 1.36-1.93.75 0 1.45-.46 1.84-1.16.39-.7.39-1.5.07-2.19.65-.35 1.09-1.03 1.09-1.81zm-5.3-1.71l-4.4 4.4c-.2.2-.46.29-.71.29-.25 0-.51-.1-.71-.29l-2.07-2.07c-.39-.39-.39-1.02 0-1.41.39-.39 1.02-.39 1.41 0l1.37 1.37 3.69-3.69c.39-.39 1.02-.39 1.41 0 .39.38.39 1.01.01 1.4z"/>
        </svg>
      </div>
      <div class="handle">@{{HANDLE}}</div>
    </div>
  </div>

  <div class="body">
    <div class="lead">{{HEADLINE}}</div>
    <div class="main">{{SUBHEADLINE}}</div>
  </div>

  <div class="cta">
    <span class="cta-arrow">👇</span>
    <span>{{CTA}}</span>
  </div>
</div>
</body>
</html>`

const thumbnail = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
  <rect width='200' height='200' fill='#FFFFFF' stroke='#E5E7EB' stroke-width='1'/>
  <defs>
    <linearGradient id='av' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#7C3AED'/>
      <stop offset='100%' stop-color='#111111'/>
    </linearGradient>
  </defs>
  <circle cx='30' cy='30' r='16' fill='url(#av)'/>
  <text x='30' y='35' text-anchor='middle' fill='#FFFFFF' font-family='Inter,sans-serif' font-weight='800' font-size='12'>MM</text>
  <rect x='54' y='22' width='44' height='6' fill='#0F141A'/>
  <circle cx='105' cy='25' r='3' fill='#1DA1F2'/>
  <rect x='54' y='34' width='32' height='4' fill='#6B7280'/>
  <rect x='18' y='66' width='150' height='6' fill='#0F141A'/>
  <rect x='18' y='76' width='110' height='6' fill='#0F141A'/>
  <rect x='18' y='100' width='12' height='4' fill='#0F141A'/>
  <rect x='32' y='100' width='130' height='4' fill='#0F141A'/>
  <rect x='18' y='110' width='160' height='4' fill='#0F141A'/>
  <rect x='18' y='120' width='100' height='4' fill='#0F141A'/>
  <rect x='18' y='140' width='14' height='4' fill='#0F141A'/>
  <rect x='34' y='140' width='110' height='4' fill='#0F141A'/>
  <rect x='18' y='150' width='150' height='4' fill='#0F141A'/>
  <rect x='18' y='160' width='120' height='4' fill='#0F141A'/>
  <text x='18' y='185' font-family='Inter,sans-serif' font-size='10' fill='#0F141A'>👇</text>
  <rect x='32' y='180' width='130' height='5' fill='#0F141A'/>
</svg>`)}`

export default {
  id: 'tweet',
  name: 'Tweet',
  description: 'Post estilo X/Twitter com avatar, checkmark verificado e body em paragrafos',
  thumbnail,
  html,
}
