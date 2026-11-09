// ─── Webinar / Reunião estratégica — slots do wireframe ───────────────────────
// Estrutura espelhada na LP de referência: hero (2 colunas) → dores & soluções →
// sem × com → autoridade + cases → o que recebe na reunião (passos) → objeções →
// formulário/CTA final.

export const WEBINAR_WIREFRAME = {
  id: 'webinar',
  name: 'Webinar',
  description: 'Página de captação para reunião/webinar. Hero, dores, comparação, autoridade, método e formulário.',

  emptyContent: {
    // HERO
    heroBadge: '',
    headline: '',
    heroBullets: ['', '', ''],
    heroCta: '',
    heroGuarantee: '',
    heroTags: ['', '', ''],
    heroMetricLabel: '',
    heroMetricValue: '',
    heroMetricSub: '',
    // DORES & SOLUÇÕES
    painsTitle: '',
    painsSubtitle: '',
    pains: [
      { pain: '', solution: '' },
      { pain: '', solution: '' },
      { pain: '', solution: '' },
    ],
    // SEM × COM
    comparisonTitle: '',
    withoutTitle: '',
    without: ['', '', '', '', ''],
    withTitle: '',
    with: ['', '', '', '', ''],
    // AUTORIDADE & PROVA
    authorityTitle: '',
    authorityText: '',
    authorityCaption: '',
    resultsTitle: '',
    results: [
      { value: '', desc: '' },
      { value: '', desc: '' },
      { value: '', desc: '' },
    ],
    // O QUE RECEBE NA REUNIÃO (passos)
    methodTitle: '',
    methodSubtitle: '',
    steps: [
      { tag: '', title: '', desc: '' },
      { tag: '', title: '', desc: '' },
      { tag: '', title: '', desc: '' },
      { tag: '', title: '', desc: '' },
    ],
    // OBJEÇÕES
    objectionsTitle: '',
    objections: [
      { objection: '', rebuttal: '' },
      { objection: '', rebuttal: '' },
      { objection: '', rebuttal: '' },
    ],
    // CTA FINAL / FORMULÁRIO
    ctaTitle: '',
    ctaSubtitle: '',
    formCta: '',
    footerNote: '',
  },

  // Textos-guia de cada slot vazio: src/i18n/locales/{pt,en}/wireframes.js (webinar.ph).
}
