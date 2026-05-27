/**
 * propostaComercial.js — estrutura do roteiro da Proposta Comercial.
 *
 * Fonte única de verdade compartilhada entre o formulário
 * (`PropostaComercialModule.jsx`) e o PDF (`exportPropostaComercialPDF` em
 * `utils/exportPDF.js`), pra manter títulos, ordem e badges sempre sincronizados.
 *
 * `tipo` de cada seção:
 *  - 'MOMENTO' = fala/condução, NÃO vira slide
 *  - 'SLIDE'   = conteúdo que vira um slide na apresentação
 *
 * Cada campo: { id, label, tipo: 'text' | 'textarea', rows?, hint? }
 */

export const PROPOSTA_SECTIONS = [
  {
    n: 1,
    titulo: 'Introdução',
    tipo: 'MOMENTO',
    descricao: 'Não é um slide. É o momento de recepção e quebra de gelo, antes da apresentação.',
    campos: [
      {
        id: 'recepcao',
        label: 'Recepção',
        tipo: 'textarea',
        rows: 4,
        hint: 'Alinhe expectativas e mostre que você está ali pra ajudar, não pra vender.',
      },
      {
        id: 'quebraGeloPerguntas',
        label: 'Quebra de gelo — perguntas',
        tipo: 'textarea',
        rows: 4,
        hint: 'Onde mora, como vai o negócio e as maiores dificuldades do dia a dia.',
      },
      {
        id: 'problemaMapeado',
        label: 'Problema mapeado previamente',
        tipo: 'text',
        hint: 'Use pra conectar as dificuldades que ele citar a um problema que você já conhece.',
      },
      {
        id: 'pontosEmComum',
        label: 'Pontos em comum a buscar',
        tipo: 'textarea',
        rows: 2,
      },
    ],
  },
  {
    n: 2,
    titulo: 'Pacto Inicial',
    tipo: 'SLIDE',
    campos: [
      { id: 'pactoInicialFalas', label: 'Falas do pacto inicial', tipo: 'textarea', rows: 9 },
      { id: 'tresIntencoes', label: 'As 3 intenções a alinhar', tipo: 'textarea', rows: 4 },
    ],
  },
  {
    n: 3,
    titulo: 'Perguntas SPIN',
    tipo: 'MOMENTO',
    descricao: 'Conduza a investigação na ordem: situação, problema, implicação e necessidade.',
    campos: [
      { id: 'spinSituacao', label: 'Situação', tipo: 'textarea', rows: 3, hint: 'Começa a investigar a real situação.' },
      { id: 'spinProblema', label: 'Problema', tipo: 'textarea', rows: 3, hint: 'Identifica o problema-chave.' },
      { id: 'spinImplicacao', label: 'Implicação', tipo: 'textarea', rows: 3, hint: 'Aprofunda o problema.' },
      { id: 'spinNecessidade', label: 'Necessidade', tipo: 'textarea', rows: 3, hint: 'Mostra como seria a vida dele através de perguntas.' },
    ],
  },
  {
    n: 4,
    titulo: 'Pacto / Transição',
    tipo: 'MOMENTO',
    campos: [
      { id: 'objetivoCliente', label: 'Objetivo mencionado pelo cliente', tipo: 'text', hint: 'Vai entrar na fala de transição.' },
      { id: 'pactoTransicao', label: 'Fala de transição', tipo: 'textarea', rows: 3 },
    ],
  },
  {
    n: 5,
    titulo: 'Apresentação do Método',
    tipo: 'SLIDE',
    campos: [
      { id: 'metodoNome', label: 'Nome do método', tipo: 'text' },
      { id: 'metodoPassos', label: 'Como funciona / passos', tipo: 'textarea', rows: 5 },
    ],
  },
  {
    n: 6,
    titulo: 'Apresentação do Produto',
    tipo: 'SLIDE',
    campos: [
      { id: 'produtoIncluido', label: 'O que está incluído / entregáveis', tipo: 'textarea', rows: 5 },
      { id: 'produtoDiferenciais', label: 'Diferenciais', tipo: 'textarea', rows: 3 },
    ],
  },
  {
    n: 7,
    titulo: 'Slide de Dúvidas',
    tipo: 'SLIDE',
    campos: [
      { id: 'slideDuvidas', label: 'Perguntas de fechamento de dúvidas', tipo: 'textarea', rows: 4 },
    ],
  },
  {
    n: 8,
    titulo: 'Ancoragem de Preço',
    tipo: 'SLIDE',
    campos: [
      { id: 'valorTabela', label: 'Valor de tabela', tipo: 'text' },
      { id: 'ancoragemJustificativa', label: 'O que compõe / justificativa do valor', tipo: 'textarea', rows: 4 },
    ],
  },
  {
    n: 9,
    titulo: 'Valor Real',
    tipo: 'SLIDE',
    campos: [
      { id: 'valorReal', label: 'Valor real', tipo: 'text' },
      { id: 'valorRealCondicoes', label: 'Condições', tipo: 'textarea', rows: 3 },
    ],
  },
  {
    n: 10,
    titulo: 'Valor para Fechar em Call',
    tipo: 'SLIDE',
    campos: [
      { id: 'valorCall', label: 'Valor de fechamento na call', tipo: 'text' },
      { id: 'valorCallGatilho', label: 'Bônus / gatilho de urgência pra fechar agora', tipo: 'textarea', rows: 3 },
    ],
  },
]

/**
 * Falas-modelo pré-preenchidas (editáveis). Só os campos abaixo têm default;
 * os demais começam vazios. Usadas apenas quando o campo nunca foi salvo.
 */
export const PROPOSTA_DEFAULTS = {
  recepcao:
    'Seja muito bem-vindo(a)! Antes de começar, quero alinhar o objetivo dessa conversa: eu não estou aqui pra te empurrar nada. Meu papel hoje é entender o seu momento e avaliar, com honestidade, se a gente consegue te ajudar de verdade.',
  quebraGeloPerguntas:
    '- De onde você fala? Onde fica o negócio?\n- Me conta um pouco da empresa: como vêm sendo os últimos meses?\n- Quais são as maiores dificuldades do dia a dia hoje?',
  pactoInicialFalas:
    'Eu quero entender primeiro o seu negócio.\nE aqui meu objetivo é avaliar se eu consigo encaixar seus desafios em alguma de nossas soluções.\nEntão eu queria alinhar 3 intenções com você e deixá-las bem claras.\nEu não estou aqui para te vender nada. Estou aqui para te ajudar.\nEu quero entender primeiro o que você precisa para avaliar se faz sentido integrarmos nossa solução na sua empresa.\nQuero que você entenda o nosso trabalho para ver se faz sentido você estar com a gente.\nEntão... alinhando essas intenções...\nMe conta um pouquinho do seu negócio... como vem sendo a empresa nos últimos meses e os desafios no atendimento.',
  tresIntencoes:
    '1) Entender o seu negócio e seus desafios\n2) Te mostrar como a gente trabalha\n3) Avaliar juntos se faz sentido seguir',
  spinSituacao:
    'Ex: Como funciona hoje o seu processo de vendas/atendimento? Quantos leads/clientes você atende por mês? Que ferramentas usa hoje?',
  spinProblema:
    'Ex: O que mais te incomoda nesse processo hoje? Onde você sente que mais perde tempo, dinheiro ou clientes?',
  spinImplicacao:
    'Ex: Se isso continuar assim nos próximos meses, o que acontece? Quanto isso já te custou? Como afeta o faturamento e a equipe?',
  spinNecessidade:
    'Ex: Se você resolvesse isso, o que mudaria pra você? Quanto valeria atingir esse resultado? Como seria o seu dia a dia sem esse problema?',
  pactoTransicao:
    'Pelo que você me contou, acho que a gente consegue te ajudar sim. Deixa eu te mostrar aqui como podemos chegar no seu [objetivo mencionado].',
  slideDuvidas:
    '- O que você mais gostou do que viu até aqui?\n- De 0 a 10, quanto você acha que precisa disso aqui hoje no seu negócio?\n- Tirando a parte de valor, você estaria dentro desse programa/solução?',
}
