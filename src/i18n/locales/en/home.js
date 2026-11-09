export default {
  verta: 'Verta',
  abrirMenu: 'Open navigation menu',
  titulo: 'Overview',
  escopoAdmin: 'Admin · all squads',
  escopoAdminDica: "You're an admin: you see clients from every squad",
  escopoMembro: 'Your squads',
  escopoMembroDica: "You see clients from the squads you're on",
  dashboardSquads: 'Squads Dashboard',
  dashboardSquadsDica: 'Open the per-squad report',
  novoCliente: 'New client',

  listas: {
    clientes: 'Clients',
    churn: 'Churn',
    novos: 'New Clients (last {dias} days)',
    onboarding: 'In Onboarding',
    ativos: 'Active Profiles',
    doMembro: "{nome}'s clients",
  },

  kpi: {
    mrr: 'MRR',
    contratoCheio: 'Full contract',
    clientesAtivos: 'Active clients',
    ticketMedio: 'Average ticket',
    porMes: '/mo',
    semValorContrato: 'No contract value',
    ltvMedio: 'Average LTV',
    ltvMedioDica: 'Average LTV of clients with a signing date, active and churned',
    ltvClientes: { one: '{count} client, active and churned', other: '{count} clients, active and churned' },
    netMrr: 'Net MRR · {mes}',
    verCrescimento: 'View growth',
  },

  filtros: {
    grupo: 'List filters',
    squad: 'Squad',
    todosSquads: 'All squads',
    modelo: 'Model',
    risco: 'Risk',
    momento: 'Stage',
    limparFiltro: 'Clear {rotulo} filter',
    novos: 'New ({dias}d)',
    novosDica: 'Clients who joined in the last {dias} days',
    churn: 'Churn',
    churnDica: 'Clients who churned',
    limparFiltros: 'Clear filters',
    limparFiltrosN: 'Clear filters ({count})',
    buscarPlaceholder: 'Search by name...',
    buscarAria: 'Search clients',
    limparBusca: 'Clear search',
  },

  risco: {
    em_risco: 'At Risk',
    neutro: 'Neutral',
    saudavel: 'Healthy',
    semRisco: 'No Risk Set',
  },

  momento: {
    onboarding: 'Onboarding',
    aceleracao: 'Acceleration',
    voo_de_cruzeiro: 'Cruising',
    churn: 'Churn',
  },

  squad: {
    pessoas: { one: '{count} person', other: '{count} people' },
    semMembros: 'No members in this squad.',
    papel: {
      accountManager: 'Account Manager',
      gestorTrafego: 'Media Buyer',
      designer: 'Designer',
    },
  },

  colunas: {
    empresa: 'Company',
    squad: 'Squad',
    conv7d: 'Conversions 7d',
    risco: 'Risk',
    momento: 'Stage',
    ltv: 'LTV',
    lt: 'LT',
    ltDica: 'Lifetime: active contract time, in months and days (until today or until churn)',
    contrato: 'Contract',
    criadoEm: 'Created',
    acoes: 'Actions',
  },

  lt: {
    dias: '{d}d',
    meses: '{m}mo',
    mesesDias: '{m}mo {d}d',
  },
  convNovo: 'new',

  linha: {
    excluirAria: 'Delete {nome}',
    excluirDica: 'Delete project',
  },

  grupo: {
    clientes: { one: '{count} client', other: '{count} clients' },
    contratoCheio: 'Full contract',
    mrr: 'MRR',
  },

  excluir: {
    titulo: 'Delete client',
    aviso: 'This action is permanent and cannot be undone.',
    alvo: 'Client to be deleted',
    digite: 'Type',
    paraConfirmar: 'to confirm:',
    botao: 'Delete client',
  },

  vazio: {
    titulo: 'No clients yet',
    texto: 'Add your first client to start managing your portfolio.',
    botao: 'New Client',
  },
  carregandoNuvem: 'Loading projects from the cloud...',
  semFiltrados: 'No clients match these filters',
  semFiltradosDica: 'Remove a filter or clear them all.',
  semResultado: 'No results for "{busca}"',
  semResultadoDica: 'Try another name or owner.',

  otimizacoes: {
    calculando: "Calculating today's optimizations…",
    resumo: '{otimizacoes} awaiting a decision across {clientes}',
    otimizacoes: { one: '{count} playbook optimization', other: '{count} playbook optimizations' },
    clientes: { one: '{count} client', other: '{count} clients' },
    urgentes: { one: '{count} urgent', other: '{count} urgent' },
  },

  atas: {
    cliente: 'Client',
    titulo: 'New meeting minutes',
    texto: 'There are new meeting minutes for you to sign.',
  },
}
