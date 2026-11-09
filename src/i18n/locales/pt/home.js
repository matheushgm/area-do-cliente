// Home `/` (src/pages/Dashboard.jsx): lista de clientes, filtros, indicadores, atalho de Otimizações e popups de atas.
export default {
  verta: 'Verta',
  abrirMenu: 'Abrir menu de navegação',
  titulo: 'Visão geral',
  escopoAdmin: 'Admin · todos os squads',
  escopoAdminDica: 'Você é admin: vê os clientes de todos os squads',
  escopoMembro: 'Seus squads',
  escopoMembroDica: 'Você vê os clientes dos squads de que faz parte',
  dashboardSquads: 'Dashboard de Squads',
  dashboardSquadsDica: 'Abrir relatório por squad',
  novoCliente: 'Novo cliente',

  listas: {
    clientes: 'Clientes',
    churn: 'Churn',
    novos: 'Novos Clientes (últimos {dias} dias)',
    onboarding: 'Em Onboarding',
    ativos: 'Perfis Ativos',
    doMembro: 'Clientes de {nome}',
  },

  kpi: {
    mrr: 'MRR',
    contratoCheio: 'Contrato cheio',
    clientesAtivos: 'Clientes ativos',
    ticketMedio: 'Ticket médio',
    porMes: '/mês',
    semValorContrato: 'Sem valor de contrato',
    ltvMedio: 'LTV médio',
    ltvMedioDica: 'Média do LTV dos clientes com data de assinatura, ativos e churn',
    ltvClientes: { one: '{count} cliente, ativos e churn', other: '{count} clientes, ativos e churn' },
    netMrr: 'Net MRR · {mes}',
    verCrescimento: 'Ver crescimento',
  },

  filtros: {
    grupo: 'Filtros da lista',
    squad: 'Squad',
    todosSquads: 'Todos os squads',
    modelo: 'Modelo',
    risco: 'Risco',
    momento: 'Momento',
    limparFiltro: 'Limpar filtro {rotulo}',
    novos: 'Novos ({dias}d)',
    novosDica: 'Clientes que entraram nos últimos {dias} dias',
    churn: 'Churn',
    churnDica: 'Clientes que deram churn',
    limparFiltros: 'Limpar filtros',
    limparFiltrosN: 'Limpar filtros ({count})',
    buscarPlaceholder: 'Buscar por nome...',
    buscarAria: 'Buscar cliente',
    limparBusca: 'Limpar busca',
  },

  risco: {
    em_risco: 'Em Risco',
    neutro: 'Neutro',
    saudavel: 'Saudável',
    semRisco: 'Sem Risco',
  },

  momento: {
    onboarding: 'Onboarding',
    aceleracao: 'Aceleração',
    voo_de_cruzeiro: 'Voo de cruzeiro',
    churn: 'Churn',
  },

  squad: {
    pessoas: { one: '{count} pessoa', other: '{count} pessoas' },
    semMembros: 'Nenhum membro no squad.',
    papel: {
      accountManager: 'Account Manager',
      gestorTrafego: 'Gestor de Tráfego',
      designer: 'Designer',
    },
  },

  colunas: {
    empresa: 'Empresa',
    squad: 'Squad',
    conv7d: 'Conversões 7d',
    risco: 'Risco',
    momento: 'Momento',
    ltv: 'LTV',
    lt: 'LT',
    ltDica: 'Lifetime: tempo de contrato ativo, em meses e dias (até hoje ou até o churn)',
    contrato: 'Contrato',
    criadoEm: 'Criado em',
    acoes: 'Ações',
  },

  lt: {
    dias: '{d}d',
    meses: '{m}m',
    mesesDias: '{m}m {d}d',
  },
  convNovo: 'novo',

  linha: {
    excluirAria: 'Excluir {nome}',
    excluirDica: 'Excluir projeto',
  },

  grupo: {
    clientes: { one: '{count} cliente', other: '{count} clientes' },
    contratoCheio: 'Contrato cheio',
    mrr: 'MRR',
  },

  excluir: {
    titulo: 'Excluir cliente',
    aviso: 'Esta ação é permanente e não pode ser desfeita.',
    alvo: 'Cliente a ser excluído',
    digite: 'Digite',
    paraConfirmar: 'para confirmar:',
    botao: 'Excluir cliente',
  },

  vazio: {
    titulo: 'Nenhum cliente ainda',
    texto: 'Adicione seu primeiro cliente para começar a gerenciar sua carteira.',
    botao: 'Novo Cliente',
  },
  carregandoNuvem: 'Carregando projetos da nuvem...',
  semFiltrados: 'Nenhum cliente com esses filtros',
  semFiltradosDica: 'Tire um filtro ou limpe todos.',
  semResultado: 'Nenhum resultado para "{busca}"',
  semResultadoDica: 'Tente outro nome ou responsável.',

  otimizacoes: {
    calculando: 'Calculando as otimizações do dia…',
    resumo: '{otimizacoes} aguardando decisão em {clientes}',
    otimizacoes: { one: '{count} otimização do playbook', other: '{count} otimizações do playbook' },
    clientes: { one: '{count} cliente', other: '{count} clientes' },
    urgentes: { one: '{count} urgente', other: '{count} urgentes' },
  },

  atas: {
    cliente: 'Cliente',
    titulo: 'Nova ata de reunião',
    texto: 'Existe uma nova ata de reunião pra você assinar.',
  },
}
