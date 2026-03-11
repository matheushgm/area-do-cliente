export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'rl': {
          'bg':       '#EEF2F9',      // branco gelo — fundo geral da página
          'surface':  '#FFFFFF',      // branco puro — sidebar, inputs, elementos
          'card':     '#FFFFFF',      // branco — cards elevados
          'border':   '#D8E0F0',      // borda azul-acinzentada sutil
          'purple':   '#164496',      // azul da marca (mantém chave 'purple' por compatibilidade)
          'blue':     '#2563EB',      // azul secundário / brilhante
          'cyan':     '#0284C7',      // ciano para destaques informativos
          'gold':     '#D97706',      // âmbar / alertas
          'green':    '#059669',      // verde / sucesso
          'red':      '#DC2626',      // vermelho / erro
          'text':     '#0F172A',      // texto principal (quase preto)
          'subtle':   '#334155',      // texto secundário (labels, subtítulos)
          'muted':    '#94A3B8',      // texto terciário (placeholders, hints)
        }
      },
      backgroundImage: {
        'gradient-rl':   'linear-gradient(135deg, #164496 0%, #1B5DD6 100%)',
        'gradient-gold': 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
        'gradient-dark': 'linear-gradient(180deg, #EEF2F9 0%, #E4EAF7 100%)',
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
