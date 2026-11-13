// Webinar em inglês: mesma estrutura de webinarData.js, linha a linha.
// Mexeu no português, mexa aqui na mesma posição. Ids de etapa, bloco e campo, e os
// `value` dos radios, são os mesmos do português (são as chaves gravadas).
//
// Campos 'checks': o que se grava é o texto da opção, então `options` continua com o
// texto em português (valor gravado) e `labels` traz o rótulo exibido, na mesma ordem.
//
// Este arquivo não importa nada do português de propósito (evita import circular:
// é o webinarData.js que importa daqui).

export const ETAPAS = [
  { id: 'abertura',           num: 1, label: 'Opening',                emoji: '🎬', built: true },
  { id: 'historia',           num: 2, label: 'Story',                  emoji: '📖', built: true },
  { id: 'conteudo',           num: 3, label: 'Content',                emoji: '🎓', built: true },
  { id: 'oferta_agendamento', num: 4, label: 'Booking Offer',          emoji: '📅', built: true },
  { id: 'oferta_direta',      num: 4, label: 'Direct product offer',   emoji: '🛒', built: false },
]

export const ABERTURA_BLOCOS = [
  {
    id: 'b1',
    title: 'BLOCK 1: Magnetic Promise',
    subtitle: 'Slide 1 · 30-60 seconds · Build your main hook',
    fields: [
      { id: 'b1_resultado', type: 'area', label: '1.1 What RESULT does your avatar want most?', example: 'Speak English fluently' },
      { id: 'b1_obstaculo', type: 'area', label: '1.2 What is the BIGGEST THING getting in the way of that?', example: 'Without ever setting foot in a language school' },
      { id: 'b1_tempo',     type: 'text', label: '1.3 How long does it take to get that result? (realistic, but attractive)', example: 'In 6 months' },
      {
        id: 'b1_preview', type: 'preview', label: '💡 Your promise reads:',
        compute: (v) => `"How to ${v.b1_resultado || '[RESULT]'} in ${v.b1_tempo || '[TIME]'} without ${v.b1_obstaculo || '[OBSTACLE]'}"`,
      },
    ],
  },
  {
    id: 'b2',
    title: 'BLOCK 2: Unique Method',
    subtitle: 'Slide 1 (continued)',
    fields: [
      { id: 'b2_metodo', type: 'area', label: '2.1 What makes your method UNIQUE/DIFFERENT?', example: 'Learn English while you watch your favorite shows on Netflix' },
      {
        id: 'b2_prova', type: 'choice',
        label: '2.2 What PROOF or RESULT do you have to back it up? (fill in what applies)',
        example: 'The same method that got 180 students fluent in 6 months',
        options: [
          { id: 'b2_prova_alunos',    label: 'Number of students/clients with results' },
          { id: 'b2_prova_proprio',   label: 'Your own extraordinary result' },
          { id: 'b2_prova_beneficio', label: 'A surprising extra benefit' },
        ],
      },
      {
        id: 'b2_preview', type: 'preview', label: 'Your method reads:',
        compute: (v) => {
          const prova = v.b2_prova_alunos || v.b2_prova_proprio || v.b2_prova_beneficio || '[PROOF]'
          return `"I'm going to help you ${v.b1_resultado || '[RESULT]'} by showing you ${v.b2_metodo || '[METHOD]'}" + ${prova}`
        },
      },
    ],
  },
  {
    id: 'b3',
    title: 'BLOCK 3: Personal Introduction',
    subtitle: 'Slide 2',
    fields: [
      { id: 'b3_nome', type: 'text', label: '3.1 What is your name?' },
      {
        id: 'b3_credencial', type: 'choice',
        label: '3.2 What is your main CREDENTIAL? (fill in what fits best)',
        options: [
          { id: 'b3_cred_expert',    label: 'Specialist/Expert in' },
          { id: 'b3_cred_tempo',     label: 'Studying/working with this for (years)' },
          { id: 'b3_cred_formacao',  label: 'Degree/certification in' },
          { id: 'b3_cred_cargo',     label: 'Former role at a well-known company' },
        ],
      },
      { id: 'b3_apresentacao', type: 'area', label: '3.3 How would you LIKE to be introduced on stage to 1,000 ideal clients?', example: 'Digital marketing specialist, creator of the 10X Funnel Method' },
      { id: 'b3_cred1', type: 'text', label: '3.4 Verifiable credential 1 (numbers, results, creations)', example: 'Creator of method X' },
      { id: 'b3_cred2', type: 'text', label: '3.4 Verifiable credential 2' },
      { id: 'b3_cred3', type: 'text', label: '3.4 Verifiable credential 3' },
      { id: 'b3_alert', type: 'alert', text: 'FLUFF ALERT: only say "recognized as" or "considered" if you can say BY WHOM!' },
    ],
  },
  {
    id: 'b4',
    title: 'BLOCK 4: What You\'ll Learn',
    subtitle: 'Slide 3 · List 3-5 things you\'ll teach',
    helper: [
      'Formula A: How to [RESULT] without [OBSTACLE]',
      'Formula B: How to [RESULT] and also [EXTRA BENEFIT]',
      'Formula C: The #1 secret to [SPECIFIC RESULT]',
      'Formula D: The X mistakes that keep you from [RESULT]',
    ],
    fields: [
      { id: 'b4_item1', type: 'area', label: 'Item 1' },
      { id: 'b4_item2', type: 'area', label: 'Item 2' },
      { id: 'b4_item3', type: 'area', label: 'Item 3' },
      { id: 'b4_item4', type: 'area', label: 'Item 4 (optional)' },
      { id: 'b4_item5', type: 'area', label: 'Item 5 (optional)' },
    ],
  },
  {
    id: 'b5',
    title: 'BLOCK 5: Why Now?',
    subtitle: 'Slide 4 · Urgent reasons to watch NOW',
    fields: [
      { id: 'b5_objecao',      type: 'area', label: '5.1 What OBJECTION/LIMITING BELIEF do they have that you need to break?', example: 'Most methods don\'t work if you\'re over 25' },
      { id: 'b5_tendencia',    type: 'area', label: '5.2 What MARKET TREND is happening in their niche?', example: 'In the next 5 years, people who don\'t speak English will lose jobs' },
      { id: 'b5_pedra',        type: 'area', label: '5.3 What PAIN POINT is getting worse/more expensive?', example: 'Hiring a private tutor keeps getting more expensive' },
      { id: 'b5_constrangedor', type: 'area', label: '5.4 What is EMBARRASSING/FRUSTRATING about their current situation?', example: 'Nothing is more embarrassing than learning with 200 people watching you' },
    ],
  },
  {
    id: 'b6',
    title: 'BLOCK 6: Is This for You?',
    subtitle: 'Slide 5 · Write 3-4 identification statements',
    fields: [
      { id: 'b6_frase1', type: 'area', label: 'Statement 1 — If you\'re [SPECIFICS] and haven\'t managed to [RESULT] because [FRUSTRATION]...', example: 'If you work in tech and can\'t move up because you don\'t speak English...' },
      { id: 'b6_frase2', type: 'area', label: 'Statement 2 — If you\'re [SPECIFICS] and want [DESIRE/BENEFIT]...', example: 'If you\'re a college student and want to study abroad...' },
      { id: 'b6_frase3', type: 'area', label: 'Statement 3 — If you\'re tired of [DAILY FRUSTRATION]...', example: 'If you\'re tired of being the only one in class who doesn\'t speak another language...' },
      { id: 'b6_frase4', type: 'area', label: 'Statement 4 — If you\'re afraid of [SPECIFIC FEAR]...', example: 'If you\'re afraid of losing your job because you don\'t speak English...' },
    ],
  },
  {
    id: 'b7',
    title: 'BLOCK 7: Ground Rules',
    subtitle: 'Slide 6 · Stand out and push away the wrong clients',
    fields: [
      { id: 'b7_promessa',    type: 'area', prefix: 'This is NOT', label: '7.1 What ABSURD market PROMISE do you need to break?', example: 'This is NOT one of those courses that claim you learn while you sleep...' },
      { id: 'b7_abordagem',   type: 'area', prefix: 'You will NOT', label: '7.2 What TECHNICAL/BORING APPROACH will you NOT use?', example: 'You will NOT learn complicated grammar here...' },
      { id: 'b7_expectativa', type: 'area', prefix: 'You will NOT', label: '7.3 What UNREALISTIC EXPECTATION do you need to correct?', example: 'You will NOT become fluent overnight. You\'ll need to study...' },
      { id: 'b7_afastar',     type: 'area', prefix: 'If you', label: '7.4 Who should NOT keep watching? (push away the wrong client)', example: 'If you want results without effort, you can leave now...' },
    ],
  },
]

// ─── ETAPA 2: História ────────────────────────────────────────────────────────
export const HISTORIA_REGRAS = {
  fazer: [
    'SHORT story (5-10 minutes max)',
    'TRUE story (or a fictional character, stated as such)',
    'Connected to the webinar CONTENT',
    'Delivers VALUE to the audience',
    'Focused on building CONNECTION, not on looking good',
  ],
  naoFazer: [
    'A 30-50 minute story about your life',
    'Making up false stories about yourself',
    'Telling a story unrelated to the problem',
    'Making yourself look like the perfect hero',
  ],
}

export const HISTORIA_TIPOS = [
  {
    id: 'A',
    label: 'Transformed Avatar',
    desc: 'You WERE exactly where your client IS today. You had the same problem, lived the frustrations, got past them and now help others.',
    example: 'I also worked at a multinational and watched everyone get promoted except me, because I didn\'t speak English',
  },
  {
    id: 'B',
    label: 'Rescuer',
    desc: 'You NEVER had the problem, but decided to help those who do. You saw many people needed help, studied and became a specialist.',
    example: 'I watched my father get fired for not speaking English. I decided to specialize so it wouldn\'t happen to other people',
  },
]

export const HISTORIA_TRANSICOES = [
  {
    id: '1',
    title: 'Transition 1: "This Happened to Me Too"',
    hint: 'Use when you are a Transformed Avatar',
    field: { id: 't1_situacao', type: 'area', label: '2.1 What specific SITUATION is your client living today that YOU also lived?', example: 'If you\'ve ever lost a promotion because you don\'t speak English...' },
    compute: (v) => `"If ${v.t1_situacao || '[SITUATION]'}, I want you to know the EXACT same thing happened to me. Let me tell you a story..."`,
  },
  {
    id: '2',
    title: 'Transition 2: "I Know How You Feel"',
    hint: 'Transformed Avatar — more emotional',
    field: { id: 't2_sentimento', type: 'area', label: '2.2 What FEELING/FRUSTRATION is your client having right now that you also had?', example: 'If you feel frustrated thinking you\'ll never learn English...' },
    compute: (v) => `"If ${v.t2_sentimento || '[FEELING]'}, I know EXACTLY how you feel. I used to feel the same way. In fact, I think we have more in common than you imagine. Let me tell you..."`,
  },
  {
    id: '3',
    title: 'Transition 3: "The Secret Behind It" ⭐ Recommended',
    hint: 'Turns the story into content — works for both types',
    field: { id: 't3_caracteristica', type: 'area', label: '2.3 What is the MAIN FEATURE of your method/product?', example: 'It brings together the 3 best sales strategies on the internet' },
    compute: (v) => `"Now let me tell you the SECRET behind this method. The secret is ${v.t3_caracteristica || '[FEATURE]'}. And I'll explain how I discovered it... [STORY]"`,
  },
]

// Estrutura 3A — Avatar Transformado
export const HISTORIA_3A_BLOCOS = [
  {
    id: 'a1', title: 'BLOCK 1: The Beginning', subtitle: 'Where they are today',
    fields: [
      { id: 'a_inicio_momento', type: 'area', label: '3A.1 At what MOMENT in your life were you EXACTLY where your client is now?', example: '5 years ago, I had been working at a multinational for 3 years...' },
      { id: 'a_inicio_problema', type: 'area', label: '3A.2 What SPECIFIC PROBLEM were you facing (the same as theirs)?', example: '...I realized I wasn\'t going to move up in my career because I didn\'t speak English' },
    ],
  },
  {
    id: 'a2', title: 'BLOCK 2: Dramatization', subtitle: 'Builds an emotional connection',
    fields: [
      { id: 'a_dram_sit1', type: 'area', label: '3A.3 Situation 1 that showed this problem', example: 'I remember when a position opened up and someone less qualified got it...' },
      { id: 'a_dram_sit2', type: 'area', label: '3A.3 Situation 2' },
      { id: 'a_dram_sentimentos', type: 'area', label: '3A.4 What FEELINGS did you have in those situations?', example: 'It made me deeply angry. I felt incapable, frustrated...' },
      { id: 'a_dram_impacto', type: 'area', label: '3A.5 How did it IMPACT your life negatively?', example: 'I couldn\'t pay the bills, I watched friends get ahead...' },
    ],
  },
  {
    id: 'a3', title: 'BLOCK 3: Ruling Out Other Solutions', subtitle: 'List 2-3 solutions that did NOT work',
    fields: [
      { id: 'a_sol1',        type: 'text', label: 'Solution 1 I tried' },
      { id: 'a_sol1_porque', type: 'area', label: 'Why it did NOT work' },
      { id: 'a_sol2',        type: 'text', label: 'Solution 2 I tried' },
      { id: 'a_sol2_porque', type: 'area', label: 'Why it did NOT work' },
    ],
  },
  {
    id: 'a4', title: 'BLOCK 4: The Turning Point',
    fields: [
      { id: 'a_virada',     type: 'area', label: '3A.7 What moment/situation made you DECIDE to change?', example: 'Until I realized I couldn\'t go on like that. I started researching...' },
      { id: 'a_descoberta', type: 'area', label: '3A.8 HOW did you discover the method/solution? (keep it brief)', example: 'I found out missionaries used TV shows to learn languages...' },
    ],
  },
  {
    id: 'a5', title: 'BLOCK 5: Introducing the Method',
    fields: [
      { id: 'a_metodo', type: 'area', label: '3A.9 Describe BRIEFLY how the method works (no details yet)', example: 'I started watching shows with subtitles in a strategic way...' },
    ],
  },
  {
    id: 'a6', title: 'BLOCK 6: Result & Transformation',
    fields: [
      { id: 'a_prazo',         type: 'text', label: '3A.10 How long did it take to see results?', example: 'In 6 months...' },
      { id: 'a_resultado',     type: 'area', label: '3A.11 What RESULT did you achieve?', example: '...I was speaking English fluently' },
      { id: 'a_transformacao', type: 'area', label: '3A.12 How did your LIFE change after that?', example: 'I got the promotion, passed my colleagues, and today I run my own business...' },
    ],
  },
  {
    id: 'a7', title: 'BLOCK 7: Transition to Content',
    fields: [
      { id: 'a7_info', type: 'info', label: 'Your closing line', text: '"Now I\'m going to show you how you can use this [method/product] to [OPENING PROMISE] too!"' },
    ],
  },
]

// Estrutura 3B — Socorrista
export const HISTORIA_3B_BLOCOS = [
  {
    id: 'b1', title: 'BLOCK 1: The Crossing', subtitle: 'Where the problem came into your life',
    fields: [
      { id: 'b_cruz_momento', type: 'area', label: '3B.1 At what MOMENT did you first discover/notice this problem?', example: 'When I was in high school, I watched my father get fired...' },
      { id: 'b_cruz_oque',    type: 'area', label: '3B.2 What SPECIFICALLY happened that showed you how serious the problem is?', example: '...simply because he didn\'t speak English, even though he was competent' },
      { id: 'b_cruz_impacto', type: 'area', label: '3B.3 How did it IMPACT you emotionally?', example: 'It stuck with me. I watched a competent man get unfairly replaced...' },
    ],
  },
  {
    id: 'b2', title: 'BLOCK 2: The Decision to Help',
    fields: [
      {
        id: 'b_decisao_tipo', type: 'radio', label: '3B.4 What made you DECIDE to help people with this problem?',
        options: [
          { value: 'proximo',  label: 'I saw someone close to me suffer from it' },
          { value: 'paixao',   label: 'I fell in love with the subject' },
          { value: 'dom',      label: 'I realized I had a knack/gift for it' },
        ],
      },
      { id: 'b_decisao', type: 'area', label: 'Describe your decision', example: 'I decided I would learn it and help people never go through that' },
    ],
  },
  {
    id: 'b3', title: 'BLOCK 3: The Path to Specialist', subtitle: 'List what you did, in chronological order',
    fields: [
      { id: 'b_passo1', type: 'text', label: 'Step 1', example: 'I went to college for Languages' },
      { id: 'b_passo2', type: 'text', label: 'Step 2', example: 'I did a 2-year exchange program' },
      { id: 'b_passo3', type: 'text', label: 'Step 3', example: 'I studied teaching methods for 5 years' },
      { id: 'b_passo4', type: 'text', label: 'Step 4 (optional)' },
    ],
  },
  {
    id: 'b4', title: 'BLOCK 4: Discovering the Method',
    fields: [
      { id: 'b_metodo', type: 'area', label: '3B.6 How did you discover/create the method you teach?', example: 'I researched military accelerated-learning techniques and adapted them...' },
    ],
  },
  {
    id: 'b5', title: 'BLOCK 5: First Results',
    fields: [
      { id: 'b_resultados', type: 'area', label: '3B.7 Who did you test it with first? What results did you get?', example: 'I started by helping relatives. In 6 months, 3 of them were fluent...' },
    ],
  },
  {
    id: 'b6', title: 'BLOCK 6: Current Mission',
    fields: [
      { id: 'b_missao', type: 'area', label: '3B.8 What is your MISSION today? Why do you do this?', example: 'My mission is to get every interested person speaking English in 6 months' },
    ],
  },
  {
    id: 'b7', title: 'BLOCK 7: Transition to Content',
    fields: [
      { id: 'b7_info', type: 'info', label: 'Your closing line', text: '"And that\'s what I\'m going to show you now. I\'m really glad you\'re here, because I\'m going to help you reach this result too!"' },
    ],
  },
]

// ─── ETAPA 3: Conteúdo ────────────────────────────────────────────────────────
export const CONTEUDO_NIVEIS = [
  { nivel: 1, label: 'Weak',      tone: 'red',   text: '"Trust me, I can help you" — just your word saying it\'s good.' },
  { nivel: 2, label: 'Medium',    tone: 'gold',  text: 'Testimonials and recommendations — other people saying you help.' },
  { nivel: 3, label: 'Strong ⭐', tone: 'green', text: 'Show it by ACTUALLY helping — you PROVE you can help BY HELPING right now. Your content needs to be HERE!' },
]

export const CONTEUDO_REGRAS = {
  fazer: [
    'PRACTICAL content that gets results',
    'People need to SEE themselves doing it',
    'Create a NEED the product will fill',
    'Teach WHAT to do (strategy)',
    'Leave OPEN LOOPS for the product',
    'Show the POTENTIAL for transformation',
  ],
  naoFazer: [
    'Tiring technical details',
    'Abstract theory with no application',
    'Teaching HOW to do it in detail',
    'Content that is too advanced/too basic',
    'Closing every loop',
  ],
}

// Etapa 1 — extrai do Avatar Blueprint
export const CONTEUDO_ETAPA1 = [
  {
    id: 'c1a', title: 'STEP 1: Avatar problems', subtitle: 'Go back to the Avatar Blueprint — the 3-5 biggest problems',
    fields: [
      { id: 'c_prob1', type: 'area', label: 'Problem 1' },
      { id: 'c_prob2', type: 'area', label: 'Problem 2' },
      { id: 'c_prob3', type: 'area', label: 'Problem 3' },
      { id: 'c_prob4', type: 'area', label: 'Problem 4 (optional)' },
      { id: 'c_prob5', type: 'area', label: 'Problem 5 (optional)' },
    ],
  },
  {
    id: 'c1b', title: 'STEP 1: Solutions/techniques', subtitle: 'What you have for each problem (right column of the Blueprint)',
    fields: [
      { id: 'c_sol1', type: 'area', label: 'Solution to Problem 1' },
      { id: 'c_sol2', type: 'area', label: 'Solution to Problem 2' },
      { id: 'c_sol3', type: 'area', label: 'Solution to Problem 3' },
      { id: 'c_sol4', type: 'area', label: 'Solution to Problem 4' },
      { id: 'c_sol5', type: 'area', label: 'Solution to Problem 5' },
    ],
  },
]

// Etapa 2 — tema da aula (A/B/C)
export const CONTEUDO_TEMAS = [
  {
    id: 'A', label: 'The X Pillars/Principles', desc: 'Breaks the method into its core parts.',
    fields: [
      { id: 'tA_qtd',    type: 'text', label: '2A.1 How many main pillars/principles does your method have?', example: 'The 3 pillars of English fluency' },
      { id: 'tA_pilar1', type: 'text', label: 'Pillar 1' },
      { id: 'tA_pilar2', type: 'text', label: 'Pillar 2' },
      { id: 'tA_pilar3', type: 'text', label: 'Pillar 3' },
      { id: 'tA_pilar4', type: 'text', label: 'Pillar 4 (optional)' },
      { id: 'tA_pilar5', type: 'text', label: 'Pillar 5 (optional)' },
    ],
  },
  {
    id: 'B', label: 'How to Achieve [Result] by Doing [Unique Method]', desc: 'Focuses on a differentiated method.',
    fields: [
      { id: 'tB_resultado', type: 'area', label: '2B.1 What specific result will you teach people to achieve?', example: 'How to grow your English vocabulary' },
      { id: 'tB_metodo',    type: 'area', label: '2B.2 What is the DIFFERENT method/way of doing it?', example: '...by watching Netflix shows' },
    ],
  },
  {
    id: 'C', label: 'The X Secrets/Strategies for [Result]', desc: 'Reveals practical "secrets".',
    fields: [
      { id: 'tC_qtd',  type: 'text', label: '2C.1 How many secrets/strategies will you reveal? (3-5 is ideal)' },
      { id: 'tC_seg1', type: 'text', label: 'Secret 1' },
      { id: 'tC_seg2', type: 'text', label: 'Secret 2' },
      { id: 'tC_seg3', type: 'text', label: 'Secret 3' },
      { id: 'tC_seg4', type: 'text', label: 'Secret 4 (optional)' },
      { id: 'tC_seg5', type: 'text', label: 'Secret 5 (optional)' },
    ],
  },
]

// Etapa 3 — validação (guia)
export const CONTEUDO_VALIDACAO = [
  'Is it PRACTICAL? Can people apply it? (if not, rework it)',
  'Does it make SENSE for the avatar\'s level? Can they keep up? (if not, simplify)',
  'Can they SEE themselves doing it? (if not, make it more tangible)',
  'Is it so technical it will WEAR people out? (if so, cut details)',
]

// Etapa 4 — O QUÊ vs COMO
export const CONTEUDO_ETAPA4 = [
  {
    id: 'c4a', title: 'STEP 4: In the webinar → teach WHAT to do', subtitle: 'The most powerful technique for creating a need for the product',
    fields: [
      { id: 'c_oque',        type: 'area', label: '4.1 WHAT does your avatar need to do to solve the problem?', example: 'You need to build an evergreen webinar funnel' },
      { id: 'c_componentes', type: 'area', label: '4.2 WHAT are the main components/steps? (concept, not execution)', example: 'The funnel has 3 parts: capture, automated webinar, sales sequence' },
      { id: 'c_porque',      type: 'area', label: '4.3 WHY does it work? (logic/strategy)', example: 'It works because it combines launch scarcity with evergreen automation' },
    ],
  },
  {
    id: 'c4b', title: 'In the product → teach HOW to do it', subtitle: 'Technical details that do NOT go in the webinar (they stay in the product)',
    fields: [
      { id: 'c_tec1', type: 'text', label: 'Technical detail 1', example: 'How to set up the email marketing tool' },
      { id: 'c_tec2', type: 'text', label: 'Technical detail 2', example: 'How to build the landing page line by line' },
      { id: 'c_tec3', type: 'text', label: 'Technical detail 3', example: 'Payment gateway settings' },
      { id: 'c_tec4', type: 'text', label: 'Technical detail 4 (optional)' },
    ],
  },
]

// Etapa 5 — loops abertos
export const CONTEUDO_ETAPA5 = [
  {
    id: 'c5', title: 'STEP 5: Creating Open Loops', subtitle: 'Things you mention but don\'t fully resolve',
    fields: [
      { id: 'c_loop1', type: 'area', label: 'Open Loop 1', example: 'There\'s a lot more detail on structuring the perfect copy, but we can\'t cover it now...' },
      { id: 'c_loop2', type: 'area', label: 'Open Loop 2' },
      { id: 'c_loop3', type: 'area', label: 'Open Loop 3' },
      { id: 'c_loop4', type: 'area', label: 'Open Loop 4 (optional)' },
      {
        id: 'c_loop_frases', type: 'checks',
        label: '5.2 How will you SHOW there is more content? (check the lines you\'ll use)',
        options: [
          'Tem muito mais para falar sobre isso, mas vamos passar pro próximo...',
          'Isso aqui é só uma pincelada, o método completo tem mais X passos...',
          'Daqui a pouco eu explico melhor isso no [seu produto]...',
          'Esse é só o conceito básico, a execução completa envolve mais detalhes...',
        ],
        labels: [
          'There\'s a lot more to say about this, but let\'s move on to the next one...',
          'This is just a taste, the full method has X more steps...',
          'In a bit I\'ll explain this better in [your product]...',
          'This is just the basic concept, the full execution involves more details...',
        ],
      },
    ],
  },
]

// Etapa 6 — potencial de transformação
export const CONTEUDO_ETAPA6 = [
  {
    id: 'c6', title: 'STEP 6: Transformation Potential', subtitle: 'At each point, show the impact on their life',
    fields: [
      { id: 'c_topico6',  type: 'text', label: 'Main topic' },
      { id: 'c_muda',     type: 'area', label: '6.1 What WILL THIS CHANGE in their life?', example: 'When you do this, you\'ll be able to move up in your career...' },
      { id: 'c_resolve6', type: 'area', label: '6.2 What PROBLEM does this solve specifically?', example: 'This will put an end to that embarrassment of saying things wrong in meetings...' },
      { id: 'c_beneficio', type: 'area', label: '6.3 What EXTRA BENEFIT does it bring?', example: 'On top of that, you\'ll impress your colleagues...' },
    ],
  },
]

// Etapa 7 — roteiro (condicional ao tema)
export const CONTEUDO_ROTEIRO_ABERTURA = {
  id: 'c_rot_abertura', type: 'area',
  label: 'Content opening', example: 'Now I\'m going to show you [WHAT you promised in the opening]...',
}
export const CONTEUDO_ROTEIRO_PILARES = [1, 2, 3].map((n) => ({
  id: `cpA${n}`, title: `Pillar ${n}`,
  fields: [
    { id: `cpA${n}_nome`,   type: 'text', label: 'Pillar name' },
    { id: `cpA${n}_oque`,   type: 'area', label: 'What it is' },
    { id: `cpA${n}_func`,   type: 'area', label: 'How it works (concept)' },
    { id: `cpA${n}_imp`,    type: 'area', label: 'Why it matters' },
    { id: `cpA${n}_transf`, type: 'area', label: 'Transformation it creates' },
  ],
}))
export const CONTEUDO_ROTEIRO_PONTOS = [1, 2, 3].map((n) => ({
  id: `cpt${n}`, title: `Point ${n}`,
  fields: [
    { id: `cpt${n}_nome`,   type: 'text', label: 'Point name' },
    { id: `cpt${n}_concep`, type: 'area', label: 'Concept explanation' },
    { id: `cpt${n}_func`,   type: 'area', label: 'Why it works' },
    { id: `cpt${n}_muda`,   type: 'area', label: 'What changes in their life' },
    { id: `cpt${n}_loop`,   type: 'area', label: 'Open loop' },
  ],
}))

// Etapa 8 — tipos de slides (guia)
export const CONTEUDO_SLIDES = [
  { tipo: 'Type 1: Concept/Strategy', bom: '"The funnel has 3 stages: capture → webinar → sales"', ruim: '"Now I\'ll open the tool and build the form..."' },
  { tipo: 'Type 2: List of Steps/Elements', bom: '"The 3 pillars of conversion: copywriting, design, scarcity"', ruim: '"Now I\'ll write every word of the copy with you..."' },
  { tipo: 'Type 3: Comparison/Differentiation', bom: '"Traditional method: grammar. My method: practical conversation"', ruim: '"Let\'s do 50 grammar exercises now..."' },
]

// Etapa 9 — criando necessidade
export const CONTEUDO_ETAPA9 = [
  {
    id: 'c9', title: 'STEP 9: Creating the Need for the Product', subtitle: 'Solve one problem and create a new one — which the product solves',
    fields: [
      { id: 'c_resolve_prob', type: 'area', label: '9.1 What problem do you SOLVE in the content?', example: 'Now you know WHAT to do: build this funnel' },
      { id: 'c_cria_prob',    type: 'area', label: '9.1 What new problem do you CREATE? (that the product solves)', example: 'But HOW do you set all this up technically? How do you write the perfect emails?' },
      {
        id: 'c_need_frases', type: 'checks',
        label: '9.3 Lines to create the need (check the ones you\'ll use)',
        options: [
          'Você viu o método. Agora precisa da execução completa...',
          'Isso funciona, mas tem detalhes técnicos que precisam estar perfeitos...',
          'O conceito você entendeu. Mas e na prática, como fazer exatamente?',
          'Mostrei o mapa. Quem quiser o GPS completo passo a passo...',
        ],
        labels: [
          'You\'ve seen the method. Now you need the full execution...',
          'This works, but there are technical details that need to be perfect...',
          'You get the concept. But in practice, how exactly do you do it?',
          'I showed you the map. For those who want the full step-by-step GPS...',
        ],
      },
    ],
  },
]

// Etapa 10 — transição para oferta
export const CONTEUDO_TRANSICOES = [
  { id: '1', titulo: 'Option 1: Problem → Solution', texto: '"You\'ve seen the complete method. But I know you must be wondering: How do I do all this in practice? That\'s exactly what I\'m going to show you now..."' },
  { id: '2', titulo: 'Option 2: Value → More Value', texto: '"What you\'ve seen is already very powerful. But imagine if you had access to the COMPLETE method, with every technical detail. That\'s what I\'ve prepared..."' },
  { id: '3', titulo: 'Option 3: Recap → Opportunity', texto: '"So to recap: you saw [X, Y, Z]. Now I want to make a special invitation to everyone here live..."' },
]

export const CONTEUDO_CHECKLIST = [
  'Content is PRACTICAL (not theoretical)',
  'The avatar can SEE themselves doing it',
  'Teaches WHAT to do (not HOW in detail)',
  'I did NOT go too deep into technical details',
  'I created a NEED the product solves',
  'I left clear OPEN LOOPS',
  'I showed the POTENTIAL for transformation at every point',
  'I have a clear transition to the offer',
  'Content runs 15-25 minutes (no longer)',
  'They\'ll walk away thinking: "I need more!"',
]

// ─── ETAPA 4: Oferta de Agendamento ───────────────────────────────────────────
export const OA_ETAPAS_LISTA = [
  'Transition (content → opportunity)',
  'What I\'ll do in the meeting',
  'How booking works',
  'Call to action + form',
  'Incentive for booking NOW',
  'Recap',
  'Spot urgency',
  'Open the floor to questions/objections',
  'Answer objections while reinforcing the CTA',
  'Close',
]

// Etapas 1-8 como blocos data-driven
export const OA_BLOCOS = [
  {
    id: 'oa1', title: 'STEP 1: Transition', subtitle: 'Content → opportunity',
    fields: [
      { id: 'oa1_info', type: 'info', label: 'Recommended template', text: '"I know you must be thinking: OK, I get the concept. But how do I implement this IN MY business? It\'s impossible to answer that here for everyone because every business is different. So here\'s what I\'m going to do..."' },
      { id: 'oa_transicao', type: 'area', label: 'Your version of the transition' },
    ],
  },
  {
    id: 'oa2', title: 'STEP 2: What I\'ll Do in the Meeting',
    fields: [
      { id: 'oa_nome_reuniao', type: 'text', label: '2.1 Meeting name', example: 'One-on-One Implementation Meeting' },
      { id: 'oa_duracao',      type: 'text', label: '2.2 Length', example: '45 minutes' },
      { id: 'oa_acao1', type: 'area', label: '2.3 Action 1 (what you\'ll do)', example: 'Review your funnel and spot where you\'re losing opportunities' },
      { id: 'oa_acao2', type: 'area', label: 'Action 2', example: 'Work out how many meetings you need per month' },
      { id: 'oa_acao3', type: 'area', label: 'Action 3', example: 'Put together a personalized 30-day plan' },
      { id: 'oa2_script', type: 'info', label: 'Script', text: '"I\'m opening spots for [name], [length] long, where I\'ll: → Action 1 → Action 2 → Action 3. You walk away with a clear plan of what to do."' },
    ],
  },
  {
    id: 'oa3', title: 'STEP 3: How Booking Works',
    fields: [
      { id: 'oa3_proc', type: 'info', label: 'Simple process', text: 'Step 1: click the button/link · Step 2: fill out a quick form · Step 3: pick the best time · Step 4: get a confirmation' },
      { id: 'oa_vagas', type: 'text', label: '3.2 Available spots', example: 'I have 8 spots this week' },
      { id: 'oa3_script', type: 'info', label: 'Script', text: '"Simple: [process]. [available spots]."' },
    ],
  },
  {
    id: 'oa4', title: 'STEP 4: Call to Action + Form',
    fields: [
      {
        id: 'oa_cta_onde', type: 'checks', label: '4.1 Where does the link show up?',
        options: ['Botão na tela', 'Link no chat', 'Slide com QR code'],
        labels: ['On-screen button', 'Link in the chat', 'Slide with a QR code'],
      },
      { id: 'oa_cta_texto', type: 'text', label: '4.2 Button text', example: 'I WANT TO BOOK MY MEETING' },
      { id: 'oa_cta_url',   type: 'text', label: '4.3 Booking URL' },
      { id: 'oa4_script', type: 'info', label: 'Script', text: '"[Where it shows up] is the link. Click NOW to secure your spot."' },
    ],
  },
  {
    id: 'oa5', title: 'STEP 5: Incentive for Booking NOW', subtitle: 'It\'s an incentive, NOT the product',
    fields: [
      {
        id: 'oa_inc_limite', type: 'checks', label: '5.1 Limit',
        options: ['Primeiros X que agendarem', 'Apenas durante esta aula', 'Primeiras 24h'],
        labels: ['First X people to book', 'Only during this session', 'First 24 hours'],
      },
      { id: 'oa_inc_nome',   type: 'text', label: '5.2 Incentive name', example: 'Quick Implementation Kit' },
      { id: 'oa_inc_oque',   type: 'area', label: 'What it is', example: 'Spreadsheet + checklist to use before the meeting' },
      { id: 'oa_inc_porque', type: 'area', label: 'Why it\'s useful', example: 'You show up prepared and we make better use of the time' },
      { id: 'oa5_script', type: 'info', label: 'Script', text: '"[Limit]: anyone who books NOW gets [incentive] to come prepared."' },
    ],
  },
  {
    id: 'oa6', title: 'STEP 6: Recap',
    fields: [
      { id: 'oa6_script', type: 'info', label: 'Script', text: '"To recap: ✓ A one-on-one [length] meeting with me ✓ [3 main actions] ✓ [Incentive] if you book now ✓ 100% free, no strings attached. Click the link and book."' },
    ],
  },
  {
    id: 'oa7', title: 'STEP 7: Spot Urgency', subtitle: 'Real scarcity',
    fields: [
      { id: 'oa_escassez_tipo', type: 'radio', label: '7.1 Type of scarcity', options: [
        { value: 'vagas', label: 'Only X spots this week' },
        { value: 'tempo', label: 'Closes in X hours' },
      ] },
      { id: 'oa_escassez_porque', type: 'area', label: 'Why? (justify the scarcity honestly)' },
      { id: 'oa7_script', type: 'info', label: 'Script', text: '"[Scarcity]. If you don\'t book now, [consequence]."' },
    ],
  },
  {
    id: 'oa8', title: 'STEP 8: Open the Floor to Questions/Objections',
    fields: [
      { id: 'oa8_script', type: 'info', label: 'Script', text: '"I know you may have questions. I\'ll answer the main ones people always ask me. And while I answer, if you want to book, [point to where the link is]."' },
    ],
  },
]

// Etapa 9 — objeções: 7 fixas + 3 personalizadas
export const OA_OBJECOES_FIXAS = [
  { n: 1, pergunta: 'Does this work for my business/niche?',            cta: 'If you want to find out how to apply it to YOUR case, book now: [link]' },
  { n: 2, pergunta: 'I don\'t have time to implement this right now',   cta: 'In the meeting I\'ll show you how to do it in [time]. Book: [link]' },
  { n: 3, pergunta: 'I need money to invest in paid traffic',           cta: 'I\'ll show you how to start with what you have. Book: [link]' },
  { n: 4, pergunta: 'My business runs mostly on referrals',             cta: 'Perfect. I\'ll show you how to build demand alongside that. Book: [link]' },
  { n: 5, pergunta: 'I\'m not sure my team is ready',                   cta: 'In the meeting we build the plan around your current team. Book: [link]' },
  { n: 6, pergunta: 'I need to get my house in order first',            cta: 'This meeting WILL help you get organized. Book: [link]' },
  { n: 7, pergunta: 'I\'ve tried everything and nothing worked',        cta: 'I\'ll show you WHAT you tested wrong. Book: [link]' },
]

// Etapa 10 — fechamento
export const OA_FECHAMENTO = [
  {
    id: 'oa10', title: 'STEP 10: Close',
    fields: [
      { id: 'oa10_ultima', type: 'info', label: '10.1 Last call', text: '"If you stayed this long, it\'s because you WANT [main result]. The only difference between those who make it and those who don\'t is ACTION. [Spots/time left]. Click NOW: [link]"' },
      { id: 'oa10_enc',    type: 'info', label: '10.2 Wrap-up', text: 'For those who booked: "If you already booked, congrats. I\'ll prepare to help you as much as I can." · For those who didn\'t: "If you didn\'t book, no problem. But know this chance won\'t come back anytime soon." · Goodbye: "See you soon!"' },
    ],
  },
]
