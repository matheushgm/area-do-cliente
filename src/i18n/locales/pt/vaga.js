// Página pública /vaga/:cargo (src/pages/VagaPublica.jsx). Título, local, introdução e perguntas da
// vaga vêm de src/lib/triagemVaga.js (conteúdo do time) e não se traduzem; os rótulos dos dados de
// contato (CAMPOS_CONTATO) e as mensagens de validarRespostas são traduzidos aqui, pelo campo.
export default {
  tituloPagina: 'Vaga · Verta',
  marca: 'Processo seletivo Verta',
  progresso: '{ok} de {total}',
  naoExiste: 'Esta vaga não existe ou já foi encerrada.',
  enviadoTitulo: 'Respostas enviadas',
  enviadoTexto: 'Obrigado. Agora é só avisar no WhatsApp que você respondeu. Se o seu perfil seguir para a próxima etapa, a gente marca uma conversa.',
  enviadoTextoNome: 'Obrigado, {nome}. Agora é só avisar no WhatsApp que você respondeu. Se o seu perfil seguir para a próxima etapa, a gente marca uma conversa.',
  jaRespondeu: 'Você já respondeu este formulário. Se enviar de novo, ficam valendo as respostas novas.',
  seusDados: 'Seus dados',
  suaExperiencia: 'Sua experiência',
  maisDeUma: 'Pode marcar mais de uma.',
  enviar: 'Enviar respostas',
  privacidade: 'Seus dados são usados só neste processo seletivo da Verta.',
  naoEnviou: 'Não consegui enviar agora. Tente de novo.',
  semConexao: 'Sem conexão. Confira a internet e tente de novo.',
  campos: {
    nome: 'Nome completo',
    email: 'E-mail',
    telefone: 'WhatsApp',
    cidade: 'Cidade onde mora',
    linkedin: 'LinkedIn ou portfólio',
    opcional: 'Opcional',
  },
  erros: {
    preencha: 'Preencha este campo.',
    email: 'E-mail inválido.',
    telefone: 'Informe o WhatsApp com DDD.',
    nome: 'Informe nome e sobrenome.',
    escolhaUma: 'Escolha pelo menos uma.',
    responda: 'Responda esta pergunta.',
    minimo: 'Escreva um pouco mais (mínimo de {min} caracteres).',
  },
}
