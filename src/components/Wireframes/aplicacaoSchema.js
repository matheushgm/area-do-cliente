// ─── Aplicação direta — slots do wireframe ────────────────────────────────────
// Mesma estrutura da LP de referência (lab/index.html): hero (2 colunas) → dores
// & soluções → sem × com → autoridade + cases → o que recebe na reunião (passos) →
// objeções → formulário/CTA final. DIFERENÇA para o Webinar: a coluna direita do
// hero é um FORMULÁRIO (nome, e-mail, telefone) — captação direta na primeira dobra.

export const APLICACAO_WIREFRAME = {
  id: 'aplicacao',
  name: 'Aplicação direta',
  description: 'Página de aplicação direta com formulário na primeira dobra. Hero com form (nome/e-mail/telefone), dores, comparação, autoridade, método e CTA final.',

  emptyContent: {
    // HERO (esquerda: promessa · direita: formulário)
    heroBadge: '',
    headline: '',
    heroBullets: ['', '', ''],
    heroGuarantee: '',
    heroTags: ['', '', ''],
    heroFormTitle: '',
    heroFormCta: '',
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
    // O SISTEMA (pilares + núcleo)
    systemTitle: '',
    systemSubtitle: '',
    systemPillars: [
      { tag: '', title: '', desc: '' },
      { tag: '', title: '', desc: '' },
      { tag: '', title: '', desc: '' },
      { tag: '', title: '', desc: '' },
    ],
    systemCoreBadge: '',
    systemCoreTitle: '',
    systemCoreText: '',
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

  // Textos-guia de cada slot vazio: src/i18n/locales/{pt,en}/wireframes.js (aplicacao.ph).
}
