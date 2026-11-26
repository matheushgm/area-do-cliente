// Moldura das ferramentas públicas (links enviados ao cliente, sem login):
// /oferta/:token, /mecanismo/:token, /matriz-objecao/:token, /precificacao/:token, /webinar/:token.
// O conteúdo dos wizards e módulos vem dos namespaces deles (oferta, mecanismo, precificacao, webinar).
export default {
  salvando: 'Salvando...',
  salvo: 'Salvo',
  erroSalvar: 'Erro ao salvar',
  carregando: 'Carregando...',
  linkInvalido: 'Link inválido',
  linkExpirado: 'Link inválido ou expirado.',
  erroCarregar: 'Erro ao carregar.',
  erroCarregarForm: 'Não foi possível carregar o formulário. Tente novamente.',
  comoFunciona: 'Como funciona',
  comoPreencher: 'Como preencher',
  salvoAuto: 'Os dados são salvos automaticamente conforme você preenche.',
  copyright: 'Revenue Lab © {ano}',
  baixarRespostas: 'Baixar minhas respostas (PDF)',
  continuarEditando: 'Continuar editando',
  tudoPronto: 'Tudo pronto?',
  enviarRevenueLab: 'Enviar para a Revenue Lab',
  baixarCopia: 'Baixar cópia em PDF',
  preenchidosAntes: 'Você preencheu ',
  preenchidos: '{feitos} de {total} passos',

  oferta: {
    eyebrow: 'Construtor de Oferta Matadora',
    enviado: 'Oferta enviada com sucesso! 🎉',
    enviadoTexto: 'O time da Revenue Lab vai revisar o que você construiu e transformar em versões finais da sua oferta. Você pode baixar uma cópia em PDF das suas respostas.',
    video: 'Assista antes de começar: como construir sua Oferta Matadora',
    instrucao: 'Este é o passo-a-passo para construir a oferta irresistível do seu negócio (metodologia $100M Offers). Avance um passo por vez — cada tela tem exemplos pra te guiar. As respostas são salvas automaticamente; você pode parar e voltar depois pelo mesmo link.',
    finalDepois: '. Revise o que quiser na trilha acima e, quando estiver pronto, envie para a Revenue Lab — nosso time vai lapidar e gerar as versões finais da sua oferta.',
  },

  mecanismo: {
    eyebrow: 'Construtor de Mecanismo Único',
    enviado: 'Mecanismo enviado com sucesso! 🎉',
    enviadoTexto: 'O time da Revenue Lab vai revisar o que você construiu e lapidar o pitch final. Você pode baixar uma cópia em PDF das suas respostas.',
    video: 'Assista antes de começar: como construir seu Mecanismo Único',
    instrucao: 'Este é o passo-a-passo para descobrir o “por que ISSO vai funcionar pra mim” que separa você de todos os concorrentes. Avance um passo por vez, cada tela tem exemplos pra te guiar. As respostas são salvas automaticamente: você pode parar e voltar depois pelo mesmo link.',
    finalDepois: '. Revise o que quiser na trilha acima e, quando estiver pronto, envie para a Revenue Lab: nosso time vai lapidar e gerar a versão final.',
  },

  matriz: {
    eyebrow: 'Matriz de objeção',
    instrucao: 'Liste as principais objeções que aparecem nas suas vendas. Pra cada uma, descreva como antecipá-la, a causa provável e a melhor resposta. Os dados são salvos automaticamente.',
    removerLinha: 'Remover linha',
    adicionar: 'Adicionar objeção',
    // Mesmas chaves das linhas gravadas (tipo, antecipar, causa, resposta).
    colunas: {
      tipo: { label: 'Tipo de objeção', placeholder: 'Ex: "Está caro"' },
      antecipar: { label: 'Como antecipar a objeção', placeholder: 'Ex: mostrar ROI antes do preço' },
      causa: { label: 'Causa provável', placeholder: 'Ex: não enxergou o valor' },
      resposta: { label: 'Resposta para a objeção', placeholder: 'Ex: "Quanto custa NÃO resolver?"' },
    },
  },

  precificacao: {
    eyebrow: 'Precificação',
    instrucao: 'Cadastre cada produto ou serviço com seus custos, impostos e a margem de lucro que você quer ganhar de fato. A ferramenta calcula o preço de venda ideal na hora. Os dados são salvos automaticamente conforme você preenche.',
    abas: { servicos: 'Serviços', produtos: 'Produtos', saas: 'SaaS' },
    contagem: {
      servicos: { one: '{count} serviço precificado', other: '{count} serviços precificados' },
      produtos: { one: '{count} produto precificado', other: '{count} produtos precificados' },
      saas: { one: '{count} SaaS precificado', other: '{count} SaaS precificados' },
    },
    novo: { servicos: 'Novo serviço', produtos: 'Novo produto', saas: 'Novo SaaS' },
    vazio: { servicos: 'Nenhum serviço precificado ainda.', produtos: 'Nenhum produto precificado ainda.', saas: 'Nenhum SaaS precificado ainda.' },
    vazioTexto: 'Adicione o primeiro item pra ver o preço de venda recomendado considerando custos, impostos e a margem desejada.',
    vazioTextoSaas: 'Cadastre o primeiro plano pra calcular mensalidade, implantação e LTV considerando custos, impostos e a margem desejada.',
    primeiro: { servicos: 'Adicionar primeiro serviço', produtos: 'Adicionar primeiro produto', saas: 'Adicionar primeiro SaaS' },
  },

  webinar: {
    eyebrow: 'Criação de webinar',
    instrucaoAntes: 'Clique em ',
    instrucaoBotao: '“Novo webinar”',
    instrucaoDepois: ' pra começar do zero. Depois preencha as etapas na ordem: Abertura, História, Conteúdo e Oferta para Agendamento. Não precisa terminar de uma vez, dá pra voltar neste link quando quiser. Tudo é salvo automaticamente e aparece na sua conta com a gente.',
  },
}
