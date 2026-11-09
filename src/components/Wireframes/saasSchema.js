// ─── SaaS / Produto — slots do wireframe ──────────────────────────────────────
// Estrutura inspirada em templates modernos de SaaS (referência: Pluggo/Webflow):
// hero centralizado com captura de e-mail + screenshot do produto → 3 diferenciais
// → recursos do produto → prova com métrica → CTA intermediário → FAQ → CTA final.
// DIFERENÇA para Aplicação/Webinar: não vende reunião, vende o PRODUTO. A conversão
// é teste grátis / cadastro, com um único campo no hero e o print da tela como prova.

export const SAAS_WIREFRAME = {
  id: 'saas',
  name: 'SaaS / Produto',
  description: 'Página de produto SaaS com captura de e-mail no hero e screenshot da ferramenta. Diferenciais, recursos, prova com métrica, FAQ e CTA final.',

  emptyContent: {
    // NAV
    navLinks: ['', '', '', ''],
    navCta: '',
    // HERO (centralizado: selo → headline → sub → form de 1 campo → print do produto)
    heroBadge: '',
    headline: '',
    heroSubheadline: '',
    heroFormPlaceholder: '',
    heroCta: '',
    heroImageCaption: '',
    // DIFERENCIAIS (3 cards com ícone)
    featuresEyebrow: '',
    featuresTitle: '',
    featuresSubtitle: '',
    features: [
      { title: '', desc: '' },
      { title: '', desc: '' },
      { title: '', desc: '' },
    ],
    // RECURSOS DO PRODUTO (5 blocos com print)
    howEyebrow: '',
    howTitle: '',
    howSubtitle: '',
    howItems: [
      { title: '', desc: '' },
      { title: '', desc: '' },
      { title: '', desc: '' },
      { title: '', desc: '' },
      { title: '', desc: '' },
    ],
    // PROVA (depoimento com métrica em destaque)
    proofEyebrow: '',
    proofTitle: '',
    proofSubtitle: '',
    testimonials: [
      { metric: '', metricLabel: '', quote: '', name: '', role: '' },
      { metric: '', metricLabel: '', quote: '', name: '', role: '' },
    ],
    // CTA INTERMEDIÁRIO
    midCtaTitle: '',
    midCtaText: '',
    midCtaButton: '',
    // FAQ
    faqEyebrow: '',
    faqTitle: '',
    faqs: [
      { q: '', a: '' },
      { q: '', a: '' },
      { q: '', a: '' },
      { q: '', a: '' },
      { q: '', a: '' },
    ],
    // CTA FINAL
    finalCtaTitle: '',
    finalCtaSubtitle: '',
    finalCtaButton: '',
    // RODAPÉ
    footerTitle: '',
    footerCta: '',
  },

  // Textos-guia de cada slot vazio: src/i18n/locales/{pt,en}/wireframes.js (saas.ph).
}
