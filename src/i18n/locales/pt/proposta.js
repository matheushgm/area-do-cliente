// Proposta Comercial (Ferramentas da página do cliente) e o PDF dela.
export default {
  titulo: 'Proposta Comercial',
  descricaoAntes: 'Preencha o roteiro seção por seção e exporte o PDF pra montar sua apresentação. Cada bloco vira uma página no PDF, marcada como ',
  momento: 'Momento',
  descricaoMeio: ' (fala) ou ',
  slide: 'Slide',
  descricaoDepois: '.',
  exportarPdf: 'Exportar PDF',
  secoes: {
    s1: {
      titulo: 'Introdução',
      descricao: 'Não é um slide. É o momento de recepção e quebra de gelo, antes da apresentação.'
    },
    s2: {
      titulo: 'Pacto Inicial'
    },
    s3: {
      titulo: 'Perguntas SPIN',
      descricao: 'Conduza a investigação na ordem: situação, problema, implicação e necessidade.'
    },
    s4: {
      titulo: 'Pacto / Transição'
    },
    s5: {
      titulo: 'Apresentação do Método'
    },
    s6: {
      titulo: 'Apresentação do Produto'
    },
    s7: {
      titulo: 'Slide de Dúvidas'
    },
    s8: {
      titulo: 'Ancoragem de Preço'
    },
    s9: {
      titulo: 'Valor Real'
    },
    s10: {
      titulo: 'Valor para Fechar em Call'
    }
  },
  campos: {
    recepcao: {
      label: 'Recepção',
      hint: 'Alinhe expectativas e mostre que você está ali pra ajudar, não pra vender.'
    },
    quebraGeloPerguntas: {
      label: 'Quebra de gelo — perguntas',
      hint: 'Onde mora, como vai o negócio e as maiores dificuldades do dia a dia.'
    },
    problemaMapeado: {
      label: 'Problema mapeado previamente',
      hint: 'Use pra conectar as dificuldades que ele citar a um problema que você já conhece.'
    },
    pontosEmComum: {
      label: 'Pontos em comum a buscar'
    },
    pactoInicialFalas: {
      label: 'Falas do pacto inicial'
    },
    tresIntencoes: {
      label: 'As 3 intenções a alinhar'
    },
    spinSituacao: {
      label: 'Situação',
      hint: 'Começa a investigar a real situação.'
    },
    spinProblema: {
      label: 'Problema',
      hint: 'Identifica o problema-chave.'
    },
    spinImplicacao: {
      label: 'Implicação',
      hint: 'Aprofunda o problema.'
    },
    spinNecessidade: {
      label: 'Necessidade',
      hint: 'Mostra como seria a vida dele através de perguntas.'
    },
    objetivoCliente: {
      label: 'Objetivo mencionado pelo cliente',
      hint: 'Vai entrar na fala de transição.'
    },
    pactoTransicao: {
      label: 'Fala de transição'
    },
    metodoNome: {
      label: 'Nome do método'
    },
    metodoPassos: {
      label: 'Como funciona / passos'
    },
    produtoIncluido: {
      label: 'O que está incluído / entregáveis'
    },
    produtoDiferenciais: {
      label: 'Diferenciais'
    },
    slideDuvidas: {
      label: 'Perguntas de fechamento de dúvidas'
    },
    valorTabela: {
      label: 'Valor de tabela'
    },
    ancoragemJustificativa: {
      label: 'O que compõe / justificativa do valor'
    },
    valorReal: {
      label: 'Valor real'
    },
    valorRealCondicoes: {
      label: 'Condições'
    },
    valorCall: {
      label: 'Valor de fechamento na call'
    },
    valorCallGatilho: {
      label: 'Bônus / gatilho de urgência pra fechar agora'
    }
  },
  padroes: {
    recepcao: 'Seja muito bem-vindo(a)! Antes de começar, quero alinhar o objetivo dessa conversa: eu não estou aqui pra te empurrar nada. Meu papel hoje é entender o seu momento e avaliar, com honestidade, se a gente consegue te ajudar de verdade.',
    quebraGeloPerguntas: '- De onde você fala? Onde fica o negócio?\n- Me conta um pouco da empresa: como vêm sendo os últimos meses?\n- Quais são as maiores dificuldades do dia a dia hoje?',
    pactoInicialFalas: 'Eu quero entender primeiro o seu negócio.\nE aqui meu objetivo é avaliar se eu consigo encaixar seus desafios em alguma de nossas soluções.\nEntão eu queria alinhar 3 intenções com você e deixá-las bem claras.\nEu não estou aqui para te vender nada. Estou aqui para te ajudar.\nEu quero entender primeiro o que você precisa para avaliar se faz sentido integrarmos nossa solução na sua empresa.\nQuero que você entenda o nosso trabalho para ver se faz sentido você estar com a gente.\nEntão... alinhando essas intenções...\nMe conta um pouquinho do seu negócio... como vem sendo a empresa nos últimos meses e os desafios no atendimento.',
    tresIntencoes: '1) Entender o seu negócio e seus desafios\n2) Te mostrar como a gente trabalha\n3) Avaliar juntos se faz sentido seguir',
    spinSituacao: 'Ex: Como funciona hoje o seu processo de vendas/atendimento? Quantos leads/clientes você atende por mês? Que ferramentas usa hoje?',
    spinProblema: 'Ex: O que mais te incomoda nesse processo hoje? Onde você sente que mais perde tempo, dinheiro ou clientes?',
    spinImplicacao: 'Ex: Se isso continuar assim nos próximos meses, o que acontece? Quanto isso já te custou? Como afeta o faturamento e a equipe?',
    spinNecessidade: 'Ex: Se você resolvesse isso, o que mudaria pra você? Quanto valeria atingir esse resultado? Como seria o seu dia a dia sem esse problema?',
    pactoTransicao: 'Pelo que você me contou, acho que a gente consegue te ajudar sim. Deixa eu te mostrar aqui como podemos chegar no seu [objetivo mencionado].',
    slideDuvidas: '- O que você mais gostou do que viu até aqui?\n- De 0 a 10, quanto você acha que precisa disso aqui hoje no seu negócio?\n- Tirando a parte de valor, você estaria dentro desse programa/solução?'
  }
}
