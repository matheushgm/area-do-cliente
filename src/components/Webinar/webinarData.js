// Estrutura das etapas do webinar. A Etapa 01 (Abertura) é totalmente
// definida em dados (blocos → campos) pra render genérico; as demais etapas
// ficam como placeholder até serem detalhadas.

export const ETAPAS = [
  { id: 'abertura',           num: 1, label: 'Abertura',                 emoji: '🎬', built: true },
  { id: 'historia',           num: 2, label: 'História',                 emoji: '📖', built: true },
  { id: 'conteudo',           num: 3, label: 'Conteúdo',                 emoji: '🎓', built: false },
  { id: 'oferta_agendamento', num: 4, label: 'Oferta para Agendamento',  emoji: '📅', built: false },
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
