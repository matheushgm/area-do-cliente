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

  placeholders: {
    heroBadge: 'Selo/etiqueta de método (ex: Metodologia de agendamento)',
    headline: 'Headline do hero (use **negrito** para destacar a promessa)',
    heroBullet: 'Bullet de benefício/objeção (ex: Sem depender de indicação)',
    heroGuarantee: 'Selo de garantia (ex: Garantia blindada)',
    heroTag: 'Tag curta (ex: Previsível)',
    heroFormTitle: 'Título do formulário do hero (ex: Preencha para agendar sua reunião)',
    heroFormCta: 'Botão do formulário do hero',
    painsTitle: 'Título da seção de dores',
    painsSubtitle: 'Subtítulo da seção de dores',
    painPain: 'A dor em forma de pergunta',
    painSolution: 'A solução para essa dor',
    comparisonTitle: 'Título do comparativo (sem × com)',
    withoutTitle: 'Título da coluna negativa (ex: Sua empresa sem método)',
    withoutItem: 'Ponto negativo (a dor de hoje)',
    withTitle: 'Título da coluna positiva (ex: Com a metodologia)',
    withItem: 'Ponto positivo (o resultado)',
    systemTitle: 'Título da seção do sistema (use **negrito** num trecho)',
    systemSubtitle: 'Subtítulo do sistema (o todo integrado)',
    pillarTag: 'Etiqueta do pilar (ex: ESCALA)',
    pillarTitle: 'Nome do pilar/recurso',
    pillarDesc: 'O que o pilar faz e por que importa',
    systemCoreBadge: 'Selo do núcleo (ex: O coração do sistema)',
    systemCoreTitle: 'Título do mecanismo central',
    systemCoreText: 'Explicação do mecanismo central (use **negrito** num trecho)',
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
    formCta: 'Botão de envio do formulário final',
    footerNote: 'Texto do rodapé',
  },
}
