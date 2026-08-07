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

  placeholders: {
    navLink: 'Item do menu (ex: Recursos)',
    navCta: 'Botão do menu (ex: Teste grátis)',
    heroBadge: 'Selo do produto (ex: Sistema de gestão para clínicas)',
    headline: 'Headline do hero (use **negrito** para destacar a promessa)',
    heroSubheadline: 'Subheadline: o que o produto faz e para quem',
    heroFormPlaceholder: 'Placeholder do campo (ex: Digite seu e-mail)',
    heroCta: 'Botão do hero (ex: Começar grátis)',
    heroImageCaption: 'Legenda do print do produto (ex: Painel da clínica)',
    featuresEyebrow: 'Etiqueta da seção (ex: DIFERENCIAIS)',
    featuresTitle: 'Título dos diferenciais (use **negrito** num trecho)',
    featuresSubtitle: 'Subtítulo dos diferenciais',
    featureTitle: 'Nome do diferencial',
    featureDesc: 'O que ele resolve na prática',
    howEyebrow: 'Etiqueta da seção (ex: COMO FUNCIONA)',
    howTitle: 'Título dos recursos (use **negrito** num trecho)',
    howSubtitle: 'Subtítulo dos recursos',
    howItemTitle: 'Nome do recurso',
    howItemDesc: 'O resultado que o recurso entrega',
    proofEyebrow: 'Etiqueta da seção (ex: DEPOIMENTOS)',
    proofTitle: 'Título da prova social',
    proofSubtitle: 'Subtítulo da prova social',
    testimonialMetric: 'Número em destaque (ex: 36 meses)',
    testimonialMetricLabel: 'O que o número significa (ex: de permanência média)',
    testimonialQuote: 'Depoimento do cliente',
    testimonialName: 'Nome de quem falou',
    testimonialRole: 'Cargo e empresa',
    midCtaTitle: 'Título do CTA intermediário',
    midCtaText: 'Texto de apoio do CTA intermediário',
    midCtaButton: 'Botão do CTA intermediário',
    faqEyebrow: 'Etiqueta da seção (ex: DÚVIDAS)',
    faqTitle: 'Título do FAQ (ex: Perguntas e respostas)',
    faqQ: 'A pergunta que trava a decisão',
    faqA: 'A resposta que destrava',
    finalCtaTitle: 'Título do CTA final',
    finalCtaSubtitle: 'Subtítulo do CTA final (use prova/número)',
    finalCtaButton: 'Botão do CTA final',
    footerTitle: 'Chamada do rodapé (ex: Quer conhecer de perto?)',
    footerCta: 'Botão do rodapé (ex: Falar com o time)',
  },
}
