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

  placeholders: {
    heroBadge: 'Selo/etiqueta de método (ex: Metodologia de agendamento)',
    headline: 'Headline do hero (use **negrito** para destacar a promessa)',
    heroBullet: 'Bullet de benefício/objeção (ex: Sem depender de indicação)',
    heroCta: 'Botão principal do hero',
    heroGuarantee: 'Selo de garantia (ex: Garantia blindada)',
    heroTag: 'Tag curta (ex: Previsível)',
    heroMetricLabel: 'Rótulo do card de métrica (ex: Reuniões qualificadas)',
    heroMetricValue: 'Número de destaque (ex: +4x na agenda)',
    heroMetricSub: 'Complemento do número (ex: em menos de 60 dias)',
    painsTitle: 'Título da seção de dores',
    painsSubtitle: 'Subtítulo da seção de dores',
    painPain: 'A dor em forma de pergunta',
    painSolution: 'A solução para essa dor',
    comparisonTitle: 'Título do comparativo (sem × com)',
    withoutTitle: 'Título da coluna negativa (ex: Sua empresa sem método)',
    withoutItem: 'Ponto negativo (a dor de hoje)',
    withTitle: 'Título da coluna positiva (ex: Com a metodologia)',
    withItem: 'Ponto positivo (o resultado)',
    authorityTitle: 'Título de autoridade',
    authorityText: 'Parágrafo de autoridade / posicionamento',
    authorityCaption: 'Legenda da imagem (ex: Estratégia, processos e tecnologia)',
    resultsTitle: 'Título dos cases (ex: Resultados reais que entregamos)',
    resultValue: 'Número do case (ex: R$100k → R$500k)',
    resultDesc: 'Descrição do case',
    methodTitle: 'Título do método / o que recebe na reunião',
    methodSubtitle: 'Subtítulo do método',
    stepTag: 'Etiqueta do passo (ex: Na reunião)',
    stepTitle: 'Título do passo',
    stepDesc: 'Descrição do passo',
    objectionsTitle: 'Título da seção de objeções',
    objectionObjection: 'A objeção entre aspas',
    objectionRebuttal: 'A quebra da objeção',
    ctaTitle: 'Título do formulário final',
    ctaSubtitle: 'Subtítulo do formulário (critério de qualificação)',
    formCta: 'Botão de envio do formulário',
    footerNote: 'Texto do rodapé',
  },
}
