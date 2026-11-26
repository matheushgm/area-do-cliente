// Formulário de briefing do cliente (página pública /client/:token, src/pages/ClientForm.jsx) e os PDFs dele.
// As perguntas de Produto / Serviço vêm do namespace `produto` (as mesmas do módulo interno).
export default {
  carregando: 'Carregando formulário...',
  erroCarregar: 'Erro ao carregar formulário.',
  linkInvalido: 'Link inválido',
  cabecalho: 'Formulário de Briefing',
  comoPreencher: 'Como preencher',
  comoPreencherTexto: 'Preencha as informações abaixo com o máximo de detalhes possível. Quanto mais completas forem as respostas, melhores serão as estratégias desenvolvidas para o seu negócio. As informações são salvas automaticamente conforme você digita.',
  abaProduto: 'Produto / Serviço',
  abaPersonas: 'Personas',
  editarResposta: 'Editar resposta',
  perguntaDe: 'Pergunta {n} de {total}',
  concluidoPct: '{pct}% concluído',
  respondaParaAvancar: 'Responda esta pergunta para avançar.',
  avancar: 'Avançar →',
  concluirProduto: 'Concluir Produto / Serviço',
  concluirPersonas: 'Concluir Personas',
  produtoConcluido: 'Produto / Serviço concluído!',
  personasConcluidas: 'Personas concluídas!',
  podeEditar: 'Você pode editar qualquer resposta clicando no ícone de lápis acima.',
  nomePersona: 'Nome desta Persona',
  nomePersonaPlaceholder: 'Ex: Empreendedor Digital, Gerente de Marketing...',
  respostaPersonaPlaceholder: 'Digite sua resposta (uma por linha para múltiplas)...',
  rodape: 'As informações são salvas automaticamente conforme você preenche.',
  persona: {
    resultado: {
      label: 'Qual é o resultado que seu cliente percebe após usar seu produto ou serviço?',
      hint: 'Descreva como é a vida do seu cliente depois que ele usa de fato seu produto / serviço.',
    },
    acoes: {
      label: 'O que seu cliente precisa FAZER para alcançar esse resultado?',
      hint: 'Descreva as ações, comportamentos e responsabilidades do cliente no processo.',
    },
    tempo: {
      label: 'Em quanto tempo o cliente consegue alcançar o resultado?',
      hint: 'Tempo para o primeiro resultado visível e para a transformação real.',
    },
    objecoes: {
      label: 'Quais são as principais objeções que seu cliente usa para não comprar?',
      hint: 'As justificativas e desculpas mais comuns que ele dá.',
    },
    sonhos: {
      label: 'Quais são os sonhos do seu cliente que sua empresa consegue realizar?',
      hint: 'O resultado emocional e de vida que ele deseja.',
    },
    erros: {
      label: 'Quais erros seu cliente comete que o afastam do resultado desejado?',
      hint: 'Erros cometidos antes ou durante o uso do seu produto.',
    },
    medos: {
      label: 'Quais são os maiores medos do seu cliente?',
      hint: 'Medos pessoais e profissionais que podem se tornar realidade.',
    },
    sinais: {
      label: 'Quais sinais o cliente percebe que indicam que ele tem um problema a resolver?',
      hint: 'O que faz com que ele comece a buscar uma solução.',
    },
    habitos: {
      label: 'Quais são os hábitos do seu cliente ideal?',
      hint: 'Hábitos de consumo, comportamento, rotina — dentro e fora do trabalho.',
    },
  },
  pdf: {
    aviso: 'Este PDF é uma cópia de segurança das suas respostas. As informações também foram salvas automaticamente no sistema.',
    produto: 'Produto',
    persona: 'Persona',
    nenhumaResposta: 'Nenhuma pergunta respondida.',
    tituloProduto: 'Produto / Serviço — {empresa}',
    tituloPersonas: 'Personas — {empresa}',
  },
}
