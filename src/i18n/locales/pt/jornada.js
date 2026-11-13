// Jornada (módulo da página do cliente: fases do projeto, status de cada módulo e progresso)
export default {
  titulo: 'Jornada',
  descricao: 'Visão completa do projeto de {cliente} em 4 fases. Use a Jornada como ponto de partida pra saber o que falta atacar.',
  clientePadrao: 'Cliente',
  progressoGeral: 'Progresso geral',
  etapasConcluidas: { one: '{done} de {count} etapa concluída', other: '{done} de {count} etapas concluídas' },
  emAndamentoQtd: '· {n} em andamento',
  proxima: 'Próxima:',
  tudoPronto: 'tudo pronto 🎉',
  fase: 'Fase 0{n}: {titulo}',
  concluidasFase: '{done}/{total} concluídas',
  status: {
    concluido: 'Concluído',
    andamento: 'Em andamento',
    pendente: 'Pendente',
  },
  fases: {
    preparacao: {
      titulo: 'Preparação',
      desc: 'Conheça o negócio, o público e o objetivo — a base de tudo.',
      selo: 'Base universal',
      modulos: {
        dados: { rotulo: 'Dados do Cliente', desc: 'Informações cadastrais, contratuais e do negócio.' },
        produtos: { rotulo: 'Produto / Serviço', desc: 'O que o cliente vende, ICP por linha de receita.' },
        icp: { rotulo: 'Personas', desc: 'Sonhos, dores, objeções e hábitos do cliente ideal.' },
        kickoff: { rotulo: 'Kickoff', desc: 'Diagnóstico inicial em 9 pilares e veredito de oferta matadora.' },
        roi: { rotulo: 'Calculadora de ROI', desc: 'Leads, MQLs, SQLs e vendas necessários pra atingir o ROI alvo.' },
      },
    },
    criacao: {
      titulo: 'Criação',
      desc: 'Construa os ativos que vão gerar demanda.',
      selo: 'Ativos',
      modulos: {
        mecanismo_unico: { rotulo: 'Mecanismo Único', desc: 'Playbook de diferenciação em 6 seções + posicionamento com IA.' },
        oferta: { rotulo: 'Oferta Matadora', desc: 'Estrutura de oferta com bônus, garantia e gatilhos.' },
        promessa: { rotulo: 'Criação de Promessa', desc: 'Estrutura a grande promessa do produto/serviço.' },
        campaign: { rotulo: 'Campanha', desc: 'Planejamento de campanhas por canal e estágio do funil.' },
        estrategiav2: { rotulo: 'Estratégia', desc: 'Mapa de concorrência e oportunidades de diferenciação.' },
        criativos: { rotulo: 'Criação de anúncios', desc: 'Geração de criativos estáticos e roteiros de vídeo.' },
        landingpage: { rotulo: 'Criação de landing page', desc: 'Estrutura de landing page dobra a dobra com IA.' },
        metalab: { rotulo: 'Laboratório de Meta Ads', desc: 'Protocolo de testes em 3 fases (criativos, públicos, ganchos).' },
        googleads: { rotulo: 'Google Ads com IA', desc: 'Grupos de palavras-chave + geração de copy de anúncio.' },
      },
    },
    no_ar: {
      titulo: 'Campanhas no ar',
      desc: 'Execução, controle e acompanhamento em tempo real.',
      selo: 'Execução',
      modulos: {
        debriefing: { rotulo: 'Central de anúncios', desc: 'Rastreamento dos criativos no ar + status por anúncio.' },
        resultados: { rotulo: 'Resultados', desc: 'Performance B2B / B2C com link pro cliente preencher.' },
      },
    },
    primeiros_resultados: {
      titulo: 'Primeiros resultados',
      desc: 'Valide a satisfação e o resultado percebido pelo cliente.',
      selo: 'Validação',
      modulos: {
        nps: { rotulo: 'NPS', desc: 'Pesquisa de satisfação por marco do contrato.' },
      },
    },
  },
}
