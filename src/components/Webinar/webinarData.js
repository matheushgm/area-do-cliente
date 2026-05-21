// Estrutura das etapas do webinar. A Etapa 01 (Abertura) é totalmente
// definida em dados (blocos → campos) pra render genérico; as demais etapas
// ficam como placeholder até serem detalhadas.

export const ETAPAS = [
  { id: 'abertura',           num: 1, label: 'Abertura',                 emoji: '🎬', built: true },
  { id: 'historia',           num: 2, label: 'História',                 emoji: '📖', built: false },
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
