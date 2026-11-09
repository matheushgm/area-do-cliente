// Criador de Persona (módulo da página do cliente; as perguntas também aparecem no portal)
export default {
  titulo: 'Criador de Persona',
  subtitulo: 'Defina o cliente ideal e gere um perfil psicológico profundo com IA',
  exportarPdf: 'Exportar PDF',
  nova: 'Nova Persona',
  video: 'Como preencher o módulo de Personas',
  nomePadrao: 'Persona {n}',
  persona: 'Persona',
  remover: 'Remover persona',
  nome: 'Nome da Persona',
  nomePlaceholder: 'Ex: Ana, empreendedora 35-45 anos...',
  respostaPlaceholder: 'Digite uma resposta...',
  removerResposta: 'Remover resposta',
  adicionarResposta: 'Adicionar resposta',
  gerarComIa: 'Gerar com IA',
  gerarDescricao: 'Preencha as perguntas e clique em gerar para criar o perfil psicológico completo da persona.',
  gerando: 'Gerando persona...',
  gerar: 'Gerar Persona com IA',
  perfilGerado: '{nome} — Perfil Gerado',
  vazio: 'Preencha as perguntas e clique em "Gerar Persona com IA" para criar o perfil detalhado.',
  concluir: 'Concluir Criação de Personas',
  perguntas: {
    sonhos: {
      label: 'Quais são OS SONHOS do seu cliente que sua empresa consegue realizar?',
      hint: 'Essa pergunta é sobre o resultado emocional e de vida que o cliente espera quando contrata você. Aqui vai além de métricas, pense em algo pessoal.',
    },
    resultado: {
      label: 'Qual é o resultado percebido após usar o produto ou serviço?',
      hint: 'Conte como é a vida do seu cliente depois que ele usa de fato seu produto / serviço. Uma ideia é trazer comentários que os clientes fazem após o seu produto/serviço ser implementado.',
    },
    acoes: {
      label: 'O que ele PRECISA FAZER para alcançar o resultado?',
      hint: 'O que o seu cliente precisa ter/fazer para que o resultado que ele queira seja alcançado.',
    },
    tempo: {
      label: 'Em quanto tempo o cliente consegue alcançar o resultado?',
      hint: 'O ideal é trazer em quanto tempo ele tem o primeiro resultado e também quanto tempo para ter a transformação real.',
    },
    objecoes: {
      label: 'Quais são as objeções que eles usam como justificativa para não fazer o que é necessário?',
    },
    erros: {
      label: 'Quais são ERROS que seu cliente comete e que afasta ele do resultado sonhado?',
      hint: 'Esses erros são cometidos antes de ele te contratar ou comprar o seu produto.',
    },
    medos: {
      label: 'Quais são OS MEDOS do seu cliente que podem se tornar realidade?',
      hint: 'Aqui são medos pessoais mesmo, mais intrínsecos ao dia-a-dia como ser humano.',
    },
    sinais: {
      label: 'Seu cliente VÊ SINAIS DO PROBLEMA. Quais sinais são esse?',
      hint: 'Quais são os problemas que ele percebe que começam a fazer com que ele busque uma solução / ajuda.',
    },
    habitos: {
      label: 'Hábitos do seu cliente',
      hint: 'Quais são os hábitos dentro e fora do trabalho.',
    },
  },
}
