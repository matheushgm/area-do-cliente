export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Os tokens 'rl-*' são dirigidos por CSS custom properties (canais RGB)
        // definidos em src/index.css → :root (claro) e .dark (escuro). O formato
        // "rgb(var(--x) / <alpha-value>)" preserva os modificadores de opacidade
        // do Tailwind (ex.: rl-purple/15, border-rl-border/50).
        'rl': {
          'bg':       'rgb(var(--rl-bg) / <alpha-value>)',       // fundo geral da página
          'surface':  'rgb(var(--rl-surface) / <alpha-value>)',  // sidebar, inputs, elementos
          'card':     'rgb(var(--rl-card) / <alpha-value>)',     // cards elevados
          'border':   'rgb(var(--rl-border) / <alpha-value>)',   // borda sutil
          'purple':   'rgb(var(--rl-purple) / <alpha-value>)',   // azul da marca
          'blue':     'rgb(var(--rl-blue) / <alpha-value>)',     // azul secundário
          'cyan':     'rgb(var(--rl-cyan) / <alpha-value>)',     // ciano informativo
          'gold':     'rgb(var(--rl-gold) / <alpha-value>)',     // âmbar / alertas
          'green':    'rgb(var(--rl-green) / <alpha-value>)',    // sucesso
          'red':      'rgb(var(--rl-red) / <alpha-value>)',      // erro
          'text':     'rgb(var(--rl-text) / <alpha-value>)',     // texto principal
          'subtle':   'rgb(var(--rl-subtle) / <alpha-value>)',   // texto secundário
          'muted':    'rgb(var(--rl-muted) / <alpha-value>)',    // texto terciário
        },
        // Tokens do módulo Atividades (visual do Linear), escopados em `.ln` no
        // src/index.css. Valores medidos no app do Linear (dark) e no CSS
        // oficial ([data-theme=light]). `ln-ink` é branco no escuro e preto no
        // claro: serve para os hovers translúcidos (bg-ln-ink/5).
        'ln': {
          'bg':      'rgb(var(--ln-bg) / <alpha-value>)',
          'panel':   'rgb(var(--ln-panel) / <alpha-value>)',
          'card':    'rgb(var(--ln-card) / <alpha-value>)',
          'level2':  'rgb(var(--ln-level2) / <alpha-value>)',
          'level3':  'rgb(var(--ln-level3) / <alpha-value>)',
          'ink':     'rgb(var(--ln-ink) / <alpha-value>)',
          'line':    'rgb(var(--ln-line) / <alpha-value>)',
          'border':  'rgb(var(--ln-border) / <alpha-value>)',
          't1':      'rgb(var(--ln-t1) / <alpha-value>)',
          't2':      'rgb(var(--ln-t2) / <alpha-value>)',
          't3':      'rgb(var(--ln-t3) / <alpha-value>)',
          't4':      'rgb(var(--ln-t4) / <alpha-value>)',
          'accent':  'rgb(var(--ln-accent) / <alpha-value>)',
          'brand':   'rgb(var(--ln-brand) / <alpha-value>)',
          'green':   'rgb(var(--ln-green) / <alpha-value>)',
          'yellow':  'rgb(var(--ln-yellow) / <alpha-value>)',
          'red':     'rgb(var(--ln-red) / <alpha-value>)',
          'orange':  'rgb(var(--ln-orange) / <alpha-value>)',
          'blue':    'rgb(var(--ln-blue) / <alpha-value>)',
          'teal':    'rgb(var(--ln-teal) / <alpha-value>)',
        }
      },
      backgroundImage: {
        'gradient-rl':   'linear-gradient(135deg, #164496 0%, #1B5DD6 100%)',
        'gradient-gold': 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
        'gradient-dark': 'linear-gradient(180deg, rgb(var(--rl-grad-from)) 0%, rgb(var(--rl-grad-to)) 100%)',
      },
      animation: {
        'slide-up':   'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'slide-in':   'slideIn 0.35s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':    'fadeIn 0.3s ease',
        'xp-pop':     'xpPop 0.6s cubic-bezier(0.16,1,0.3,1)',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'float':      'float 3s ease-in-out infinite',
      },
      keyframes: {
        slideUp:   { from: { opacity: 0, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn:   { from: { opacity: 0, transform: 'translateX(30px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        xpPop:     { '0%': { opacity: 0, transform: 'scale(0.5) translateY(0)' }, '60%': { opacity: 1, transform: 'scale(1.2) translateY(-20px)' }, '100%': { opacity: 0, transform: 'scale(1) translateY(-40px)' } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 8px rgba(22,68,150,0.18)' }, '50%': { boxShadow: '0 0 24px rgba(22,68,150,0.42)' } },
        float:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      boxShadow: {
        'card':   '0 1px 3px rgba(15,23,42,0.06), 0 6px 20px rgba(15,23,42,0.05), 0 0 0 1px rgba(22,68,150,0.05)',
        'glow':   '0 0 24px rgba(22,68,150,0.20)',
        'gold':   '0 0 20px rgba(217,119,6,0.25)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
