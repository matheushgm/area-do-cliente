// Estrutura das etapas do webinar. A Etapa 01 (Abertura) é totalmente
// definida em dados (blocos → campos) pra render genérico; as demais etapas
// ficam como placeholder até serem detalhadas.

export const ETAPAS = [
  { id: 'abertura',           num: 1, label: 'Abertura',                 emoji: '🎬', built: true },
  { id: 'historia',           num: 2, label: 'História',                 emoji: '📖', built: true },
  { id: 'conteudo',           num: 3, label: 'Conteúdo',                 emoji: '🎓', built: true },
  { id: 'oferta_agendamento', num: 4, label: 'Oferta para Agendamento',  emoji: '📅', built: true },
  { id: 'oferta_direta',      num: 4, label: 'Oferta direta ao produto', emoji: '🛒', built: false },
]

// Tipos de campo:
//  - 'text'    : input curto
//  - 'area'    : textarea
//  - 'choice'  : grupo de sub-inputs rotulados (preenche o que se aplica)
//  - 'preview' : bloco computado a partir de outros campos (read-only)
//  - 'alert'   : aviso fixo (sem campo)
export const ABERTURA_BLOCOS = [
  {
    id: 'b1',
    title: 'BLOCO 1: Promessa Magnética',
    subtitle: 'Slide 1 · 30-60 segundos · Construa sua chamada principal',
    fields: [
      { id: 'b1_resultado', type: 'area', label: '1.1 Qual é o RESULTADO que seu avatar mais deseja alcançar?', example: 'Falar inglês fluentemente' },
      { id: 'b1_obstaculo', type: 'area', label: '1.2 Qual é a MAIOR COISA que atrapalha/impede ele de conseguir isso?', example: 'Sem precisar colocar os pés em um cursinho' },
      { id: 'b1_tempo',     type: 'text', label: '1.3 Em quanto tempo é possível alcançar esse resultado? (realista, mas atraente)', example: 'Em 6 meses' },
      {
        id: 'b1_preview', type: 'preview', label: '💡 Sua promessa fica assim:',
        compute: (v) => `"Como ${v.b1_resultado || '[RESULTADO]'} em ${v.b1_tempo || '[TEMPO]'} sem ${v.b1_obstaculo || '[OBSTÁCULO]'}"`,
      },
    ],
  },
  {
    id: 'b2',
    title: 'BLOCO 2: Método Diferenciado',
    subtitle: 'Slide 1 (continuação)',
    fields: [
      { id: 'b2_metodo', type: 'area', label: '2.1 O que seu método tem de ÚNICO/DIFERENTE que o torna especial?', example: 'Aprenda inglês enquanto assiste suas séries favoritas na Netflix' },
      {
        id: 'b2_prova', type: 'choice',
        label: '2.2 Que PROVA ou RESULTADO você tem para validar isso? (preencha o que se aplica)',
        example: 'O mesmo método que fez 180 alunos ficarem fluentes em 6 meses',
        options: [
          { id: 'b2_prova_alunos',    label: 'Número de alunos/clientes com resultado' },
          { id: 'b2_prova_proprio',   label: 'Seu próprio resultado extraordinário' },
          { id: 'b2_prova_beneficio', label: 'Benefício adicional surpreendente' },
        ],
      },
      {
        id: 'b2_preview', type: 'preview', label: 'Seu método fica assim:',
        compute: (v) => {
          const prova = v.b2_prova_alunos || v.b2_prova_proprio || v.b2_prova_beneficio || '[PROVA]'
          return `"Vou te ajudar a ${v.b1_resultado || '[RESULTADO]'} mostrando ${v.b2_metodo || '[MÉTODO]'}" + ${prova}`
        },
      },
    ],
  },
  {
    id: 'b3',
    title: 'BLOCO 3: Apresentação Pessoal',
    subtitle: 'Slide 2',
    fields: [
      { id: 'b3_nome', type: 'text', label: '3.1 Qual é seu nome?' },
      {
        id: 'b3_credencial', type: 'choice',
        label: '3.2 Qual é sua CREDENCIAL principal? (preencha o que melhor se aplica)',
        options: [
          { id: 'b3_cred_expert',    label: 'Especialista/Expert em' },
          { id: 'b3_cred_tempo',     label: 'Estudo/trabalho com isso há (anos)' },
          { id: 'b3_cred_formacao',  label: 'Formação/certificação em' },
          { id: 'b3_cred_cargo',     label: 'Ex-cargo em empresa relevante' },
        ],
      },
      { id: 'b3_apresentacao', type: 'area', label: '3.3 Como você GOSTARIA de ser apresentado num palco para 1000 clientes ideais?', example: 'Especialista em marketing digital, criador do Método Funil 10X' },
      { id: 'b3_cred1', type: 'text', label: '3.4 Credencial verificável 1 (números, resultados, criações)', example: 'Criador do método X' },
      { id: 'b3_cred2', type: 'text', label: '3.4 Credencial verificável 2' },
      { id: 'b3_cred3', type: 'text', label: '3.4 Credencial verificável 3' },
      { id: 'b3_alert', type: 'alert', text: 'ALERTA BALELA: só use "reconhecido como" ou "considerado" se puder dizer POR QUEM!' },
    ],
  },
  {
    id: 'b4',
    title: 'BLOCO 4: O Que Você Vai Aprender',
    subtitle: 'Slide 3 · Liste 3-5 coisas que você vai ensinar',
    helper: [
      'Fórmula A: Como fazer [RESULTADO] sem [OBSTÁCULO]',
      'Fórmula B: Como fazer [RESULTADO] e ainda [BENEFÍCIO EXTRA]',
      'Fórmula C: O segredo nº 1 para [RESULTADO ESPECÍFICO]',
      'Fórmula D: Os X erros que impedem você de [RESULTADO]',
    ],
    fields: [
      { id: 'b4_item1', type: 'area', label: 'Item 1' },
      { id: 'b4_item2', type: 'area', label: 'Item 2' },
      { id: 'b4_item3', type: 'area', label: 'Item 3' },
      { id: 'b4_item4', type: 'area', label: 'Item 4 (opcional)' },
      { id: 'b4_item5', type: 'area', label: 'Item 5 (opcional)' },
    ],
  },
  {
    id: 'b5',
    title: 'BLOCO 5: Por Que Agora?',
    subtitle: 'Slide 4 · Razões de urgência para assistir AGORA',
    fields: [
      { id: 'b5_objecao',      type: 'area', label: '5.1 Qual OBJEÇÃO/CRENÇA LIMITANTE ele tem que você precisa quebrar?', example: 'A maioria dos métodos não funciona se você tem mais de 25 anos' },
      { id: 'b5_tendencia',    type: 'area', label: '5.2 Qual TENDÊNCIA DE MERCADO está acontecendo no nicho dele?', example: 'Nos próximos 5 anos, quem não fala inglês perderá empregos' },
      { id: 'b5_pedra',        type: 'area', label: '5.3 Qual PEDRA NO SAPATO está piorando/ficando mais cara?', example: 'Contratar professor particular está cada vez mais caro' },
      { id: 'b5_constrangedor', type: 'area', label: '5.4 O que é CONSTRANGEDOR/FRUSTRANTE na situação atual dele?', example: 'Nada é mais constrangedor que aprender com 200 pessoas te observando' },
    ],
  },
  {
    id: 'b6',
    title: 'BLOCO 6: Isso É Para Você?',
    subtitle: 'Slide 5 · Crie 3-4 frases de identificação',
    fields: [
      { id: 'b6_frase1', type: 'area', label: 'Frase 1 — Se você é [ESPECIFICAÇÃO] e não conseguiu [RESULTADO] porque [FRUSTRAÇÃO]...', example: 'Se você é profissional de tecnologia e não consegue deslanchar porque não fala inglês...' },
      { id: 'b6_frase2', type: 'area', label: 'Frase 2 — Se você é [ESPECIFICAÇÃO] e quer [DESEJO/BENEFÍCIO]...', example: 'Se você é universitário e quer estudar no exterior...' },
      { id: 'b6_frase3', type: 'area', label: 'Frase 3 — Se você está cansado de [FRUSTRAÇÃO DIÁRIA]...', example: 'Se você está cansado de ser o único da turma que não fala outro idioma...' },
      { id: 'b6_frase4', type: 'area', label: 'Frase 4 — Se você tem medo de [MEDO ESPECÍFICO]...', example: 'Se você tem medo de perder seu emprego por não falar inglês...' },
    ],
  },
  {
    id: 'b7',
    title: 'BLOCO 7: Regras Importantes',
    subtitle: 'Slide 6 · Diferencie-se e afaste clientes errados',
    fields: [
      { id: 'b7_promessa',    type: 'area', prefix: 'NÃO é', label: '7.1 Que PROMESSA ABSURDA do mercado você precisa quebrar?', example: 'Isso NÃO é um daqueles cursos que falam que você aprende dormindo...' },
      { id: 'b7_abordagem',   type: 'area', prefix: 'NÃO vai', label: '7.2 Que ABORDAGEM TÉCNICA/CHATA você NÃO vai usar?', example: 'Você NÃO vai aprender gramática complicada aqui...' },
      { id: 'b7_expectativa', type: 'area', prefix: 'NÃO vai', label: '7.3 Que EXPECTATIVA IRREAL você precisa corrigir?', example: 'Você NÃO vai ficar fluente da noite pro dia. Vai precisar estudar...' },
      { id: 'b7_afastar',     type: 'area', prefix: 'Se você', label: '7.4 Quem NÃO deve continuar assistindo? (afaste o cliente errado)', example: 'Se você procura resultado sem esforço, pode sair agora...' },
    ],
  },
]

// ─── ETAPA 2: História ────────────────────────────────────────────────────────
export const HISTORIA_REGRAS = {
  fazer: [
    'História CURTA (5-10 minutos máximo)',
    'História VERDADEIRA (ou personagem fictício declarado)',
    'Conectada ao CONTEÚDO do webinar',
    'Gera VALOR para a audiência',
    'Foca em criar CONEXÃO, não em parecer bom',
  ],
  naoFazer: [
    'História de 30-50 minutos sobre sua vida',
    'Inventar histórias falsas sobre você',
    'Contar história não relacionada ao problema',
    'Fazer você parecer o herói perfeito',
  ],
}

export const HISTORIA_TIPOS = [
  {
    id: 'A',
    label: 'Avatar Transformado',
    desc: 'Você ERA exatamente como seu cliente É hoje. Já passou pelo mesmo problema, viveu as frustrações, superou e agora ajuda outros.',
    example: 'Eu também trabalhava numa multinacional e via todos sendo promovidos menos eu, porque não falava inglês',
  },
  {
    id: 'B',
    label: 'Socorrista',
    desc: 'Você NUNCA teve o problema, mas decidiu ajudar quem tem. Percebeu que muitos precisavam de ajuda, estudou e se tornou especialista.',
    example: 'Vi meu pai ser demitido por não falar inglês. Decidi me especializar para que isso não acontecesse com outras pessoas',
  },
]

export const HISTORIA_TRANSICOES = [
  {
    id: '1',
    title: 'Transição 1: "Isso Aconteceu Comigo Também"',
    hint: 'Use quando você é Avatar Transformado',
    field: { id: 't1_situacao', type: 'area', label: '2.1 Qual SITUAÇÃO específica seu cliente vive hoje que VOCÊ também viveu?', example: 'Se você já perdeu uma promoção porque não fala inglês...' },
    compute: (v) => `"Se ${v.t1_situacao || '[SITUAÇÃO]'}, eu quero dizer que já aconteceu EXATAMENTE a mesma coisa comigo. Deixa eu te contar uma história..."`,
  },
  {
    id: '2',
    title: 'Transição 2: "Eu Sei Como Você Se Sente"',
    hint: 'Avatar Transformado — mais emocional',
    field: { id: 't2_sentimento', type: 'area', label: '2.2 Que SENTIMENTO/FRUSTRAÇÃO seu cliente está tendo agora que você também teve?', example: 'Se você se sente frustrado achando que nunca vai aprender inglês...' },
    compute: (v) => `"Se ${v.t2_sentimento || '[SENTIMENTO]'}, eu sei EXATAMENTE como você se sente. Eu costumava me sentir do mesmo jeito. Na verdade, acho que temos mais coisas em comum do que você imagina. Deixa eu te contar..."`,
  },
  {
    id: '3',
    title: 'Transição 3: "O Segredo Por Trás" ⭐ Recomendada',
    hint: 'Transforma história em conteúdo — funciona para ambos os tipos',
    field: { id: 't3_caracteristica', type: 'area', label: '2.3 Qual é a CARACTERÍSTICA PRINCIPAL do seu método/produto?', example: 'Reúne as 3 melhores estratégias de venda da internet' },
    compute: (v) => `"Agora deixa eu te contar o SEGREDO por trás desse método. O segredo é ${v.t3_caracteristica || '[CARACTERÍSTICA]'}. E vou te explicar como eu descobri isso... [HISTÓRIA]"`,
  },
]

// Estrutura 3A — Avatar Transformado
export const HISTORIA_3A_BLOCOS = [
  {
    id: 'a1', title: 'BLOCO 1: O Início', subtitle: 'Onde ele está hoje',
    fields: [
      { id: 'a_inicio_momento', type: 'area', label: '3A.1 Em que MOMENTO da sua vida você estava EXATAMENTE onde seu cliente está agora?', example: 'Há 5 anos, trabalhava numa multinacional há 3 anos...' },
      { id: 'a_inicio_problema', type: 'area', label: '3A.2 Qual era o PROBLEMA ESPECÍFICO que você enfrentava (igual ao dele)?', example: '...percebi que não ia subir na carreira porque não falava inglês' },
    ],
  },
  {
    id: 'a2', title: 'BLOCO 2: Dramatização', subtitle: 'Conecta emocionalmente',
    fields: [
      { id: 'a_dram_sit1', type: 'area', label: '3A.3 Situação 1 que mostrava esse problema', example: 'Me lembro quando uma vaga abriu e outra pessoa menos qualificada conseguiu...' },
      { id: 'a_dram_sit2', type: 'area', label: '3A.3 Situação 2' },
      { id: 'a_dram_sentimentos', type: 'area', label: '3A.4 Que SENTIMENTOS você tinha nessas situações?', example: 'Isso me irritava profundamente. Me sentia incapaz, frustrado...' },
      { id: 'a_dram_impacto', type: 'area', label: '3A.5 Como isso IMPACTAVA negativamente sua vida?', example: 'Não conseguia pagar as contas, via amigos progredindo...' },
    ],
  },
  {
    id: 'a3', title: 'BLOCO 3: Invalidação de Outras Soluções', subtitle: 'Liste 2-3 soluções que NÃO funcionaram',
    fields: [
      { id: 'a_sol1',        type: 'text', label: 'Solução 1 que tentei' },
      { id: 'a_sol1_porque', type: 'area', label: 'Por que NÃO funcionou' },
      { id: 'a_sol2',        type: 'text', label: 'Solução 2 que tentei' },
      { id: 'a_sol2_porque', type: 'area', label: 'Por que NÃO funcionou' },
    ],
  },
  {
    id: 'a4', title: 'BLOCO 4: Momento da Virada',
    fields: [
      { id: 'a_virada',     type: 'area', label: '3A.7 Qual foi o momento/situação que te fez DECIDIR mudar?', example: 'Até que percebi que não dava mais para continuar assim. Comecei a pesquisar...' },
      { id: 'a_descoberta', type: 'area', label: '3A.8 COMO você descobriu o método/solução? (seja breve)', example: 'Descobri que missionários usavam séries de TV para aprender idiomas...' },
    ],
  },
  {
    id: 'a5', title: 'BLOCO 5: Introdução do Método',
    fields: [
      { id: 'a_metodo', type: 'area', label: '3A.9 Descreva RESUMIDAMENTE como o método funciona (sem detalhes ainda)', example: 'Comecei a assistir seriados com legendas de forma estratégica...' },
    ],
  },
  {
    id: 'a6', title: 'BLOCO 6: Resultado & Transformação',
    fields: [
      { id: 'a_prazo',         type: 'text', label: '3A.10 Quanto tempo levou para ter resultado?', example: 'Em 6 meses...' },
      { id: 'a_resultado',     type: 'area', label: '3A.11 Qual foi o RESULTADO que você alcançou?', example: '...estava falando inglês fluentemente' },
      { id: 'a_transformacao', type: 'area', label: '3A.12 Como sua VIDA mudou depois disso?', example: 'Consegui a promoção, ultrapassei colegas, hoje tenho meu negócio...' },
    ],
  },
  {
    id: 'a7', title: 'BLOCO 7: Transição para Conteúdo',
    fields: [
      { id: 'a7_info', type: 'info', label: 'Sua frase final', text: '"Agora eu vou mostrar para você como você pode usar esse [método/produto] para [PROMESSA DA ABERTURA] também!"' },
    ],
  },
]

// Estrutura 3B — Socorrista
export const HISTORIA_3B_BLOCOS = [
  {
    id: 'b1', title: 'BLOCO 1: O Cruzamento', subtitle: 'Onde o problema entrou na sua vida',
    fields: [
      { id: 'b_cruz_momento', type: 'area', label: '3B.1 Em que MOMENTO você descobriu/percebeu esse problema pela primeira vez?', example: 'Quando estava no ensino médio, vi meu pai ser demitido...' },
      { id: 'b_cruz_oque',    type: 'area', label: '3B.2 O que ESPECIFICAMENTE aconteceu que te mostrou a gravidade do problema?', example: '...simplesmente porque não falava inglês, mesmo sendo competente' },
      { id: 'b_cruz_impacto', type: 'area', label: '3B.3 Como isso te IMPACTOU emocionalmente?', example: 'Aquilo me marcou. Vi um homem competente ser substituído injustamente...' },
    ],
  },
  {
    id: 'b2', title: 'BLOCO 2: A Decisão de Ajudar',
    fields: [
      {
        id: 'b_decisao_tipo', type: 'radio', label: '3B.4 O que te fez DECIDIR ajudar pessoas com esse problema?',
        options: [
          { value: 'proximo',  label: 'Vi alguém próximo sofrer com isso' },
          { value: 'paixao',   label: 'Me apaixonei pelo assunto' },
          { value: 'dom',      label: 'Percebi minha facilidade/dom para aquilo' },
        ],
      },
      { id: 'b_decisao', type: 'area', label: 'Descreva sua decisão', example: 'Decidi que ia aprender e ajudar pessoas a nunca passarem por isso' },
    ],
  },
  {
    id: 'b3', title: 'BLOCO 3: O Caminho Até Especialista', subtitle: 'Liste cronologicamente o que você fez',
    fields: [
      { id: 'b_passo1', type: 'text', label: 'Passo 1', example: 'Entrei na faculdade de Letras' },
      { id: 'b_passo2', type: 'text', label: 'Passo 2', example: 'Fiz intercâmbio por 2 anos' },
      { id: 'b_passo3', type: 'text', label: 'Passo 3', example: 'Estudei métodos de ensino por 5 anos' },
      { id: 'b_passo4', type: 'text', label: 'Passo 4 (opcional)' },
    ],
  },
  {
    id: 'b4', title: 'BLOCO 4: Descoberta do Método',
    fields: [
      { id: 'b_metodo', type: 'area', label: '3B.6 Como você descobriu/criou o método que ensina?', example: 'Pesquisei técnicas militares de aprendizado acelerado e adaptei...' },
    ],
  },
  {
    id: 'b5', title: 'BLOCO 5: Primeiros Resultados',
    fields: [
      { id: 'b_resultados', type: 'area', label: '3B.7 Com quem você testou primeiro? Que resultados obteve?', example: 'Comecei ajudando parentes. Em 6 meses, 3 deles estavam fluentes...' },
    ],
  },
  {
    id: 'b6', title: 'BLOCO 6: Missão Atual',
    fields: [
      { id: 'b_missao', type: 'area', label: '3B.8 Qual é sua MISSÃO hoje? Por que você faz isso?', example: 'Minha missão é fazer com que cada pessoa interessada consiga falar inglês em 6 meses' },
    ],
  },
  {
    id: 'b7', title: 'BLOCO 7: Transição para Conteúdo',
    fields: [
      { id: 'b7_info', type: 'info', label: 'Sua frase final', text: '"E é isso que eu vou mostrar para você agora. Estou muito feliz de ter você aqui porque vou te ajudar a alcançar esse resultado também!"' },
    ],
  },
]

// ─── ETAPA 3: Conteúdo ────────────────────────────────────────────────────────
export const CONTEUDO_NIVEIS = [
  { nivel: 1, label: 'Fraco',     tone: 'red',   text: '"Confie em mim, eu posso te ajudar" — apenas sua palavra dizendo que é bom.' },
  { nivel: 2, label: 'Médio',     tone: 'gold',  text: 'Depoimentos e recomendações — outras pessoas dizendo que você ajuda.' },
  { nivel: 3, label: 'Forte ⭐',  tone: 'green', text: 'Demonstrar ajudando DE FATO — você PROVA que pode ajudar AJUDANDO agora. Seu conteúdo precisa estar AQUI!' },
]

export const CONTEUDO_REGRAS = {
  fazer: [
    'Conteúdo PRÁTICO que dá resultado',
    'A pessoa precisa se VER fazendo isso',
    'Criar NECESSIDADE que o produto vai suprir',
    'Ensinar O QUÊ fazer (estratégia)',
    'Deixar LOOPS ABERTOS para o produto',
    'Mostrar POTENCIAL de transformação',
  ],
  naoFazer: [
    'Detalhes técnicos que cansam',
    'Teorias abstratas sem aplicação',
    'Ensinar COMO fazer em detalhes',
    'Conteúdo muito avançado/básico',
    'Fechar todos os loops',
  ],
}

// Etapa 1 — extrai do Avatar Blueprint
export const CONTEUDO_ETAPA1 = [
  {
    id: 'c1a', title: 'ETAPA 1: Problemas do avatar', subtitle: 'Volte ao Avatar Blueprint — os 3-5 maiores problemas',
    fields: [
      { id: 'c_prob1', type: 'area', label: 'Problema 1' },
      { id: 'c_prob2', type: 'area', label: 'Problema 2' },
      { id: 'c_prob3', type: 'area', label: 'Problema 3' },
      { id: 'c_prob4', type: 'area', label: 'Problema 4 (opcional)' },
      { id: 'c_prob5', type: 'area', label: 'Problema 5 (opcional)' },
    ],
  },
  {
    id: 'c1b', title: 'ETAPA 1: Soluções/técnicas', subtitle: 'O que você tem pra cada problema (coluna direita do Blueprint)',
    fields: [
      { id: 'c_sol1', type: 'area', label: 'Solução para Problema 1' },
      { id: 'c_sol2', type: 'area', label: 'Solução para Problema 2' },
      { id: 'c_sol3', type: 'area', label: 'Solução para Problema 3' },
      { id: 'c_sol4', type: 'area', label: 'Solução para Problema 4' },
      { id: 'c_sol5', type: 'area', label: 'Solução para Problema 5' },
    ],
  },
]

// Etapa 2 — tema da aula (A/B/C)
export const CONTEUDO_TEMAS = [
  {
    id: 'A', label: 'Os X Pilares/Princípios', desc: 'Divide o método em partes fundamentais.',
    fields: [
      { id: 'tA_qtd',    type: 'text', label: '2A.1 Quantos pilares/princípios principais tem seu método?', example: 'Os 3 pilares da fluência em inglês' },
      { id: 'tA_pilar1', type: 'text', label: 'Pilar 1' },
      { id: 'tA_pilar2', type: 'text', label: 'Pilar 2' },
      { id: 'tA_pilar3', type: 'text', label: 'Pilar 3' },
      { id: 'tA_pilar4', type: 'text', label: 'Pilar 4 (opcional)' },
      { id: 'tA_pilar5', type: 'text', label: 'Pilar 5 (opcional)' },
    ],
  },
  {
    id: 'B', label: 'Como Alcançar [Resultado] Fazendo [Método Único]', desc: 'Foca num método diferenciado.',
    fields: [
      { id: 'tB_resultado', type: 'area', label: '2B.1 Qual resultado específico você vai ensinar a alcançar?', example: 'Como aumentar seu vocabulário em inglês' },
      { id: 'tB_metodo',    type: 'area', label: '2B.2 Qual é o método/forma DIFERENTE de fazer isso?', example: '...assistindo séries da Netflix' },
    ],
  },
  {
    id: 'C', label: 'Os X Segredos/Estratégias Para [Resultado]', desc: 'Revela "segredos" práticos.',
    fields: [
      { id: 'tC_qtd',  type: 'text', label: '2C.1 Quantos segredos/estratégias você vai revelar? (3-5 ideal)' },
      { id: 'tC_seg1', type: 'text', label: 'Segredo 1' },
      { id: 'tC_seg2', type: 'text', label: 'Segredo 2' },
      { id: 'tC_seg3', type: 'text', label: 'Segredo 3' },
      { id: 'tC_seg4', type: 'text', label: 'Segredo 4 (opcional)' },
      { id: 'tC_seg5', type: 'text', label: 'Segredo 5 (opcional)' },
    ],
  },
]

// Etapa 3 — validação (guia)
export const CONTEUDO_VALIDACAO = [
  'É PRÁTICO? A pessoa consegue aplicar isso? (se não, reformule)',
  'Faz SENTIDO para o nível do avatar? Ele consegue acompanhar? (se não, simplifique)',
  'Ele consegue se VER fazendo isso? (se não, torne mais tangível)',
  'É conteúdo técnico demais que vai CANSAR? (se sim, remova detalhes)',
]

// Etapa 4 — O QUÊ vs COMO
export const CONTEUDO_ETAPA4 = [
  {
    id: 'c4a', title: 'ETAPA 4: No webinar → ensine O QUÊ fazer', subtitle: 'A técnica mais poderosa pra criar necessidade do produto',
    fields: [
      { id: 'c_oque',        type: 'area', label: '4.1 O QUE seu avatar precisa fazer para resolver o problema?', example: 'Você precisa construir um funil de webinar perpétuo' },
      { id: 'c_componentes', type: 'area', label: '4.2 QUAIS são os componentes/etapas principais? (conceito, não execução)', example: 'O funil tem 3 partes: captura, webinar automatizado, sequência de vendas' },
      { id: 'c_porque',      type: 'area', label: '4.3 POR QUE isso funciona? (lógica/estratégia)', example: 'Funciona porque combina escassez do lançamento com automação do evergreen' },
    ],
  },
  {
    id: 'c4b', title: 'No produto → ensine COMO fazer', subtitle: 'Detalhes técnicos que NÃO entram no webinar (ficam pro produto)',
    fields: [
      { id: 'c_tec1', type: 'text', label: 'Detalhe técnico 1', example: 'Como configurar a ferramenta de email marketing' },
      { id: 'c_tec2', type: 'text', label: 'Detalhe técnico 2', example: 'Como criar a landing page código por código' },
      { id: 'c_tec3', type: 'text', label: 'Detalhe técnico 3', example: 'Configurações do gateway de pagamento' },
      { id: 'c_tec4', type: 'text', label: 'Detalhe técnico 4 (opcional)' },
    ],
  },
]

// Etapa 5 — loops abertos
export const CONTEUDO_ETAPA5 = [
  {
    id: 'c5', title: 'ETAPA 5: Criando Loops Abertos', subtitle: 'Coisas que você menciona mas não resolve totalmente',
    fields: [
      { id: 'c_loop1', type: 'area', label: 'Loop Aberto 1', example: 'Tem muito mais detalhes sobre estruturar o copy perfeito, mas não dá pra ver agora...' },
      { id: 'c_loop2', type: 'area', label: 'Loop Aberto 2' },
      { id: 'c_loop3', type: 'area', label: 'Loop Aberto 3' },
      { id: 'c_loop4', type: 'area', label: 'Loop Aberto 4 (opcional)' },
      {
        id: 'c_loop_frases', type: 'checks',
        label: '5.2 Como você vai EVIDENCIAR que tem mais conteúdo? (marque as frases que vai usar)',
        options: [
          'Tem muito mais para falar sobre isso, mas vamos passar pro próximo...',
          'Isso aqui é só uma pincelada, o método completo tem mais X passos...',
          'Daqui a pouco eu explico melhor isso no [seu produto]...',
          'Esse é só o conceito básico, a execução completa envolve mais detalhes...',
        ],
      },
    ],
  },
]

// Etapa 6 — potencial de transformação
export const CONTEUDO_ETAPA6 = [
  {
    id: 'c6', title: 'ETAPA 6: Potencial de Transformação', subtitle: 'Em cada ponto, mostre o impacto na vida dele',
    fields: [
      { id: 'c_topico6',  type: 'text', label: 'Tópico principal' },
      { id: 'c_muda',     type: 'area', label: '6.1 O que isso VAI MUDAR na vida dele?', example: 'Quando você fizer isso, vai conseguir subir na carreira...' },
      { id: 'c_resolve6', type: 'area', label: '6.2 Que PROBLEMA isso resolve especificamente?', example: 'Isso vai acabar com aquela vergonha de falar errado em reuniões...' },
      { id: 'c_beneficio', type: 'area', label: '6.3 Que BENEFÍCIO EXTRA isso traz?', example: 'Além disso, você vai impressionar os colegas...' },
    ],
  },
]

// Etapa 7 — roteiro (condicional ao tema)
export const CONTEUDO_ROTEIRO_ABERTURA = {
  id: 'c_rot_abertura', type: 'area',
  label: 'Abertura do conteúdo', example: 'Agora vou te mostrar [O QUE você prometeu na abertura]...',
}
export const CONTEUDO_ROTEIRO_PILARES = [1, 2, 3].map((n) => ({
  id: `cpA${n}`, title: `Pilar ${n}`,
  fields: [
    { id: `cpA${n}_nome`,   type: 'text', label: 'Nome do pilar' },
    { id: `cpA${n}_oque`,   type: 'area', label: 'O que é' },
    { id: `cpA${n}_func`,   type: 'area', label: 'Como funciona (conceito)' },
    { id: `cpA${n}_imp`,    type: 'area', label: 'Por que é importante' },
    { id: `cpA${n}_transf`, type: 'area', label: 'Transformação que gera' },
  ],
}))
export const CONTEUDO_ROTEIRO_PONTOS = [1, 2, 3].map((n) => ({
  id: `cpt${n}`, title: `Ponto ${n}`,
  fields: [
    { id: `cpt${n}_nome`,   type: 'text', label: 'Nome do ponto' },
    { id: `cpt${n}_concep`, type: 'area', label: 'Explicação do conceito' },
    { id: `cpt${n}_func`,   type: 'area', label: 'Por que funciona' },
    { id: `cpt${n}_muda`,   type: 'area', label: 'O que muda na vida dele' },
    { id: `cpt${n}_loop`,   type: 'area', label: 'Loop aberto' },
  ],
}))

// Etapa 8 — tipos de slides (guia)
export const CONTEUDO_SLIDES = [
  { tipo: 'Tipo 1: Conceito/Estratégia', bom: '"O funil tem 3 etapas: captura → webinar → vendas"', ruim: '"Agora vou abrir a ferramenta e criar o formulário..."' },
  { tipo: 'Tipo 2: Lista de Passos/Elementos', bom: '"Os 3 pilares da conversão: copywriting, design, escassez"', ruim: '"Agora vou escrever cada palavra do copy com vocês..."' },
  { tipo: 'Tipo 3: Comparação/Diferenciação', bom: '"Método tradicional: gramática. Meu método: conversação prática"', ruim: '"Vamos fazer 50 exercícios de gramática agora..."' },
]

// Etapa 9 — criando necessidade
export const CONTEUDO_ETAPA9 = [
  {
    id: 'c9', title: 'ETAPA 9: Criando a Necessidade do Produto', subtitle: 'Resolve um problema e cria um novo — que o produto resolve',
    fields: [
      { id: 'c_resolve_prob', type: 'area', label: '9.1 Qual problema você RESOLVE no conteúdo?', example: 'Agora você sabe O QUÊ fazer: construir esse funil' },
      { id: 'c_cria_prob',    type: 'area', label: '9.1 Qual novo problema você CRIA? (que o produto resolve)', example: 'Mas COMO configurar tudo isso tecnicamente? Como criar os emails perfeitos?' },
      {
        id: 'c_need_frases', type: 'checks',
        label: '9.3 Frases para criar necessidade (marque as que vai usar)',
        options: [
          'Você viu o método. Agora precisa da execução completa...',
          'Isso funciona, mas tem detalhes técnicos que precisam estar perfeitos...',
          'O conceito você entendeu. Mas e na prática, como fazer exatamente?',
          'Mostrei o mapa. Quem quiser o GPS completo passo a passo...',
        ],
      },
    ],
  },
]

// Etapa 10 — transição para oferta
export const CONTEUDO_TRANSICOES = [
  { id: '1', titulo: 'Opção 1: Problema → Solução', texto: '"Você viu o método completo. Mas sei que você deve estar se perguntando: Como eu faço isso tudo na prática? É exatamente isso que eu vou te mostrar agora..."' },
  { id: '2', titulo: 'Opção 2: Valor → Mais Valor', texto: '"Isso que você viu já é muito poderoso. Mas imagine se você tivesse acesso ao método COMPLETO, com todos os detalhes técnicos. É isso que eu preparei..."' },
  { id: '3', titulo: 'Opção 3: Recapitulação → Oportunidade', texto: '"Então recapitulando: você viu [X, Y, Z]. Agora quero te fazer um convite especial para quem está aqui ao vivo..."' },
]

export const CONTEUDO_CHECKLIST = [
  'Conteúdo é PRÁTICO (não teórico)',
  'Avatar consegue se VER fazendo',
  'Ensina O QUÊ fazer (não COMO em detalhes)',
  'NÃO entrei em detalhes técnicos demais',
  'Criei NECESSIDADE que o produto resolve',
  'Deixei LOOPS ABERTOS evidentes',
  'Mostrei POTENCIAL de transformação em cada ponto',
  'Tenho transição clara para a oferta',
  'Conteúdo dura 15-25 minutos (não mais)',
  'O cara vai sair pensando: "Preciso de mais!"',
]

// ─── ETAPA 4: Oferta de Agendamento ───────────────────────────────────────────
export const OA_ETAPAS_LISTA = [
  'Transição (conteúdo → oportunidade)',
  'O que vou fazer na reunião',
  'Como funciona o agendamento',
  'Chamada para ação + formulário',
  'Incentivo para quem agendar AGORA',
  'Recapitulação',
  'Urgência de vagas',
  'Abrir para perguntas/objeções',
  'Responder objeções enquanto reforça CTA',
  'Fechamento',
]

// Etapas 1-8 como blocos data-driven
export const OA_BLOCOS = [
  {
    id: 'oa1', title: 'ETAPA 1: Transição', subtitle: 'Conteúdo → oportunidade',
    fields: [
      { id: 'oa1_info', type: 'info', label: 'Modelo recomendado', text: '"Sei que você deve estar pensando: Ok, entendi o conceito. Mas como implemento isso NO MEU negócio? É impossível responder isso aqui para todo mundo porque cada negócio é diferente. Por isso vou fazer o seguinte..."' },
      { id: 'oa_transicao', type: 'area', label: 'Sua versão da transição' },
    ],
  },
  {
    id: 'oa2', title: 'ETAPA 2: O Que Vou Fazer na Reunião',
    fields: [
      { id: 'oa_nome_reuniao', type: 'text', label: '2.1 Nome da reunião', example: 'Reunião de Implementação Individual' },
      { id: 'oa_duracao',      type: 'text', label: '2.2 Duração', example: '45 minutos' },
      { id: 'oa_acao1', type: 'area', label: '2.3 Ação 1 (o que você vai fazer)', example: 'Analisar seu funil e identificar onde você perde oportunidades' },
      { id: 'oa_acao2', type: 'area', label: 'Ação 2', example: 'Calcular quantas reuniões você precisa por mês' },
      { id: 'oa_acao3', type: 'area', label: 'Ação 3', example: 'Montar um plano de 30 dias personalizado' },
      { id: 'oa2_script', type: 'info', label: 'Script', text: '"Vou abrir vagas para [nome] de [duração] onde vou: → Ação 1 → Ação 2 → Ação 3. Você sai com um plano claro do que fazer."' },
    ],
  },
  {
    id: 'oa3', title: 'ETAPA 3: Como Funciona o Agendamento',
    fields: [
      { id: 'oa3_proc', type: 'info', label: 'Processo simples', text: 'Passo 1: clica no botão/link · Passo 2: preenche formulário rápido · Passo 3: escolhe melhor horário · Passo 4: recebe confirmação' },
      { id: 'oa_vagas', type: 'text', label: '3.2 Vagas disponíveis', example: 'Tenho 8 vagas esta semana' },
      { id: 'oa3_script', type: 'info', label: 'Script', text: '"Simples: [processo]. [vagas disponíveis]."' },
    ],
  },
  {
    id: 'oa4', title: 'ETAPA 4: Chamada para Ação + Formulário',
    fields: [
      { id: 'oa_cta_onde', type: 'checks', label: '4.1 Onde aparece o link?', options: ['Botão na tela', 'Link no chat', 'Slide com QR code'] },
      { id: 'oa_cta_texto', type: 'text', label: '4.2 Texto do botão', example: 'QUERO AGENDAR MINHA REUNIÃO' },
      { id: 'oa_cta_url',   type: 'text', label: '4.3 URL do agendamento' },
      { id: 'oa4_script', type: 'info', label: 'Script', text: '"[Onde aparece] está o link. Clica AGORA para garantir sua vaga."' },
    ],
  },
  {
    id: 'oa5', title: 'ETAPA 5: Incentivo para quem agendar AGORA', subtitle: 'É incentivo, NÃO é o produto',
    fields: [
      { id: 'oa_inc_limite', type: 'checks', label: '5.1 Limite', options: ['Primeiros X que agendarem', 'Apenas durante esta aula', 'Primeiras 24h'] },
      { id: 'oa_inc_nome',   type: 'text', label: '5.2 Nome do incentivo', example: 'Kit de Implementação Rápida' },
      { id: 'oa_inc_oque',   type: 'area', label: 'O que é', example: 'Planilha + checklist para usar antes da reunião' },
      { id: 'oa_inc_porque', type: 'area', label: 'Por que é útil', example: 'Você já chega preparado e aproveitamos melhor o tempo' },
      { id: 'oa5_script', type: 'info', label: 'Script', text: '"[Limite]: quem agendar AGORA recebe [incentivo] para já ir preparado."' },
    ],
  },
  {
    id: 'oa6', title: 'ETAPA 6: Recapitulação',
    fields: [
      { id: 'oa6_script', type: 'info', label: 'Script', text: '"Recapitulando: ✓ Reunião de [duração] individual comigo ✓ [3 ações principais] ✓ [Incentivo] se agendar agora ✓ 100% gratuito, sem compromisso. Clica no link e agenda."' },
    ],
  },
  {
    id: 'oa7', title: 'ETAPA 7: Urgência de Vagas', subtitle: 'Escassez real',
    fields: [
      { id: 'oa_escassez_tipo', type: 'radio', label: '7.1 Tipo de escassez', options: [
        { value: 'vagas', label: 'Apenas X vagas esta semana' },
        { value: 'tempo', label: 'Fecha em X horas' },
      ] },
      { id: 'oa_escassez_porque', type: 'area', label: 'Por quê? (justifique a escassez de forma real)' },
      { id: 'oa7_script', type: 'info', label: 'Script', text: '"[Escassez]. Se não agendar agora, [consequência]."' },
    ],
  },
  {
    id: 'oa8', title: 'ETAPA 8: Abrir para Perguntas/Objeções',
    fields: [
      { id: 'oa8_script', type: 'info', label: 'Script', text: '"Sei que você pode ter dúvidas. Vou responder as principais perguntas que sempre me fazem. E enquanto respondo, se você quiser agendar, [indicar onde está o link]."' },
    ],
  },
]

// Etapa 9 — objeções: 7 fixas + 3 personalizadas
export const OA_OBJECOES_FIXAS = [
  { n: 1, pergunta: 'Isso funciona para meu negócio/nicho?',          cta: 'Se você quer descobrir como aplicar no SEU caso, agenda agora: [link]' },
  { n: 2, pergunta: 'Não tenho tempo para implementar isso agora',     cta: 'Na reunião eu te mostro como fazer isso em [tempo]. Agenda: [link]' },
  { n: 3, pergunta: 'Preciso de grana para investir em tráfego',       cta: 'Vou te mostrar como começar com o que você tem. Agenda: [link]' },
  { n: 4, pergunta: 'Meu negócio é muito baseado em indicação',        cta: 'Perfeito. Vou mostrar como criar demanda paralela. Agenda: [link]' },
  { n: 5, pergunta: 'Não sei se meu time está preparado',              cta: 'Na reunião montamos o plano considerando seu time atual. Agenda: [link]' },
  { n: 6, pergunta: 'Preciso organizar a casa primeiro',               cta: 'Essa reunião VAI te ajudar a organizar. Agenda: [link]' },
  { n: 7, pergunta: 'Já tentei de tudo e não funcionou',               cta: 'Vou te mostrar O QUE você testou errado. Agenda: [link]' },
]

// Etapa 10 — fechamento
export const OA_FECHAMENTO = [
  {
    id: 'oa10', title: 'ETAPA 10: Fechamento',
    fields: [
      { id: 'oa10_ultima', type: 'info', label: '10.1 Última chamada', text: '"Se você ficou até aqui, é porque você QUER [resultado principal]. A única diferença entre quem consegue e quem não consegue é AÇÃO. [Vagas/tempo restante]. Clica AGORA: [link]"' },
      { id: 'oa10_enc',    type: 'info', label: '10.2 Encerramento', text: 'Pra quem agendou: "Quem já agendou, parabéns. Vou me preparar para te ajudar ao máximo." · Pra quem não agendou: "Se não agendou, sem problema. Mas saiba que essa chance não volta tão cedo." · Despedida: "Nos vemos em breve!"' },
    ],
  },
]

export function blankWebinar(nome = 'Novo webinar') {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    nome,
    etapas: {},
    createdAt: now,
    updatedAt: now,
  }
}

// Conta campos preenchidos da abertura pra mostrar progresso
export function aberturaProgress(aberturaData = {}) {
  let total = 0
  let filled = 0
  for (const bloco of ABERTURA_BLOCOS) {
    for (const f of bloco.fields) {
      if (f.type === 'preview' || f.type === 'alert') continue
      if (f.type === 'choice') {
        for (const opt of f.options) {
          total += 1
          if ((aberturaData[opt.id] || '').trim()) filled += 1
        }
      } else {
        total += 1
        if ((aberturaData[f.id] || '').trim()) filled += 1
      }
    }
  }
  return { total, filled, percent: total ? Math.round((filled / total) * 100) : 0 }
}
