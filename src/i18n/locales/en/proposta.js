export default {
  titulo: 'Sales Proposal',
  descricaoAntes: 'Fill in the script section by section and export the PDF to build your presentation. Each block becomes a page in the PDF, labeled as a ',
  momento: 'Moment',
  descricaoMeio: ' (talk track) or a ',
  slide: 'Slide',
  descricaoDepois: '.',
  exportarPdf: 'Export PDF',
  secoes: {
    s1: {
      titulo: 'Introduction',
      descricao: 'Not a slide. This is the welcome and icebreaker before the presentation.'
    },
    s2: {
      titulo: 'Opening Agreement'
    },
    s3: {
      titulo: 'SPIN Questions',
      descricao: 'Run the discovery in order: situation, problem, implication and need-payoff.'
    },
    s4: {
      titulo: 'Agreement / Transition'
    },
    s5: {
      titulo: 'Method Presentation'
    },
    s6: {
      titulo: 'Product Presentation'
    },
    s7: {
      titulo: 'Questions Slide'
    },
    s8: {
      titulo: 'Price Anchoring'
    },
    s9: {
      titulo: 'Actual Price'
    },
    s10: {
      titulo: 'On-Call Closing Price'
    }
  },
  campos: {
    recepcao: {
      label: 'Welcome',
      hint: 'Set expectations and show you’re there to help, not to sell.'
    },
    quebraGeloPerguntas: {
      label: 'Icebreaker — questions',
      hint: 'Where they’re based, how the business is going and their biggest day-to-day challenges.'
    },
    problemaMapeado: {
      label: 'Problem mapped beforehand',
      hint: 'Use it to connect the challenges they mention to a problem you already know.'
    },
    pontosEmComum: {
      label: 'Common ground to look for'
    },
    pactoInicialFalas: {
      label: 'Opening agreement talk track'
    },
    tresIntencoes: {
      label: 'The 3 intentions to align on'
    },
    spinSituacao: {
      label: 'Situation',
      hint: 'Start uncovering their real situation.'
    },
    spinProblema: {
      label: 'Problem',
      hint: 'Pin down the key problem.'
    },
    spinImplicacao: {
      label: 'Implication',
      hint: 'Dig deeper into the problem.'
    },
    spinNecessidade: {
      label: 'Need-payoff',
      hint: 'Use questions to show what their life would look like.'
    },
    objetivoCliente: {
      label: 'Goal the client mentioned',
      hint: 'Goes into the transition talk track.'
    },
    pactoTransicao: {
      label: 'Transition talk track'
    },
    metodoNome: {
      label: 'Method name'
    },
    metodoPassos: {
      label: 'How it works / steps'
    },
    produtoIncluido: {
      label: 'What’s included / deliverables'
    },
    produtoDiferenciais: {
      label: 'Differentiators'
    },
    slideDuvidas: {
      label: 'Questions to clear up doubts'
    },
    valorTabela: {
      label: 'List price'
    },
    ancoragemJustificativa: {
      label: 'What’s included / price rationale'
    },
    valorReal: {
      label: 'Actual price'
    },
    valorRealCondicoes: {
      label: 'Terms'
    },
    valorCall: {
      label: 'Closing price on the call'
    },
    valorCallGatilho: {
      label: 'Bonus / urgency trigger to close now'
    }
  },
  padroes: {
    recepcao: 'Welcome, it’s great to have you here! Before we start, I want to be clear about the goal of this conversation: I’m not here to push anything on you. My job today is to understand where you are right now and assess, honestly, whether we can really help you.',
    quebraGeloPerguntas: '- Where are you joining from? Where is the business based?\n- Tell me a bit about the company: how have the last few months been?\n- What are your biggest day-to-day challenges right now?',
    pactoInicialFalas: 'First, I want to understand your business.\nMy goal here is to see whether your challenges fit any of our solutions.\nSo I’d like to align on 3 intentions with you and make them very clear.\nI’m not here to sell you anything. I’m here to help you.\nFirst, I want to understand what you need, so we can assess whether it makes sense to bring our solution into your company.\nI want you to understand how we work, so you can see whether it makes sense for you to work with us.\nSo... with those intentions aligned...\nTell me a bit about your business... how the company has been doing over the last few months and your challenges with customer service.',
    tresIntencoes: '1) Understand your business and your challenges\n2) Show you how we work\n3) Decide together whether it makes sense to move forward',
    spinSituacao: 'E.g. How does your sales/customer service process work today? How many leads/customers do you handle per month? What tools do you use today?',
    spinProblema: 'E.g. What bothers you most about this process today? Where do you feel you lose the most time, money or customers?',
    spinImplicacao: 'E.g. If this keeps going like this for the next few months, what happens? How much has it already cost you? How does it affect revenue and the team?',
    spinNecessidade: 'E.g. If you solved this, what would change for you? How much would hitting that result be worth? What would your day-to-day look like without this problem?',
    pactoTransicao: 'From what you’ve told me, I think we can definitely help. Let me show you how we can get you to your [goal mentioned].',
    slideDuvidas: '- What did you like most about what you’ve seen so far?\n- From 0 to 10, how much do you think your business needs this today?\n- Price aside, would you be in on this program/solution?'
  }
}
