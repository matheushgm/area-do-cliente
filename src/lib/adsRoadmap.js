// ADS Roadmap: o que dá pra montar de campanha com cada faixa de verba.
//
// Fonte de verdade editorial: página "Roadmap Ads" do Playbook Operacional no
// ClickUp + "[Protocolo] Gestão de tráfego". Este arquivo é a versão
// estruturada pra tela: mexeu lá, mexe aqui.
//
// Cada faixa tem:
//  - rows:      a tabela explicativa (Parâmetro | B2C | B2B)
//  - estrutura: as campanhas desenhadas (B2C e B2B), que a tela renderiza como
//               árvore campanha → conjunto → anúncios
//
// Convenções da estrutura:
//  campanha  { nome, tipo: 'CBO'|'ABO'|'', verba, sub, opcional, nota, conjuntos[] }
//  conjunto  { nome, sub, opcional, ads[], nota }
//  ads       string[] (rótulos dos anúncios; "…" vira reticências)

export const LINKS = {
  roadmapClickUp: 'https://app.clickup.com/9009170774/docs/8cfu2ap-40333/8cfu2ap-33313',
  labClickUp: 'https://app.clickup.com/9009170774/v/dc/8cfu2ap-40333/8cfu2ap-18273',
}

// ─── Regras que valem em toda faixa ──────────────────────────────────────────
export const REGRAS = [
  {
    id: 'otimizacao',
    titulo: 'Regra de otimização (quem decide é o Meta)',
    itens: [
      'Todos os criativos do mês ficam ativos ao mesmo tempo no conjunto (sobe 3 por semana, até 12 no mês). Deixar sempre 6 criativos de gaveta.',
      'O Meta escolhe em quais concentrar a entrega. Normalmente 1 ou 2 anúncios levam quase toda a verba; os outros ficam ativos quase sem gasto.',
      'O gestor só olha os anúncios que estão recebendo entrega. Se um deles passa de 2× o custo ideal (CPL, CPA ou custo por conversa) com o gasto mínimo atingido, é desligado e marcado como testado.',
      'Ao desligar, o Meta redistribui a verba pros anúncios que já estavam ativos sem entrega. Eles passam a ser testados sem o gestor subir nada.',
      'Nunca desligar anúncio que o Meta não priorizou (ele não foi testado, só não teve entrega). Nunca reativar um marcado como testado no mesmo conjunto.',
    ],
  },
  {
    id: 'desligar',
    titulo: 'Quando desligar um anúncio',
    itens: [
      'Só anúncio que está recebendo entrega.',
      'Condição: gasto no anúncio ≥ 2× a meta e (0 conversões ou custo ≥ 2× a meta).',
      'Nunca antes de 72h de entrega. Em B2B a janela de avaliação é de 7 a 10 dias.',
      'Saturação: frequência ≥ 3,5 nos últimos 7 dias (≥ 5 em público quente) com CTR caindo.',
      'Sempre com a marcação de testado: sufixo _TESTADO no nome do anúncio + registro no ClickUp com gasto, conversões e custo. Anúncio desligado sem marcação não conta como otimização feita.',
    ],
  },
  {
    id: 'escalar',
    titulo: 'Quando escalar',
    itens: [
      '+20% no conjunto quando o custo fica ≤ meta estável por 3 dias, até o teto da faixa.',
      'Reduzir: -20% no conjunto com custo acima da meta.',
      'Passou do teto da faixa = proposta de subir a faixa pro cliente, nunca escalar por conta.',
      'Verba pode migrar entre campanhas da mesma faixa (ex.: quente saturou, volta pro frio) sem passar do total diário.',
    ],
  },
  {
    id: 'verba-minima',
    titulo: 'Verba mínima por conjunto',
    itens: [
      'Cada conjunto precisa de ≥ 2× o custo ideal por dia de verba. Se não atingir, o conjunto some e a verba vai pro conjunto principal.',
      'É essa regra que decide se a faixa cabe no cliente: com CPL ideal de R$ 40, um conjunto de R$ 30/dia não fecha.',
      'Metas (CPL/CPA ideal, ticket, ROI) vêm da Área do Cliente (calculadora de ROI do projeto). Sem meta cadastrada, não sobe campanha.',
    ],
  },
  {
    id: 'canais',
    titulo: 'Meta ou Google',
    itens: [
      'Padrão é Meta. Google Search entra só quando (1) as pessoas já pesquisam o produto no Google e (2) o CPC estimado permite ≥ 10 cliques por dia com a verba disponível (CPC ≤ verba diária ÷ 10).',
      'Até R$ 3.000 o Google substitui o Meta, nunca roda junto. A partir de R$ 4.000 pode rodar em paralelo, com verba tirada do fundo frio ou do topo.',
      'Em B2B com busca ativa (software, fornecedor, consultoria) o Google costuma ganhar.',
    ],
  },
  {
    id: 'lab',
    titulo: 'Laboratório (processo de teste)',
    itens: [
      'Até R$ 5.000 o Laboratório não é campanha separada: é o processo de teste dentro do conjunto principal do fundo (ou do meio, no B2B com material rico).',
      '1 hipótese por semana, 3 variações sobem juntas, todas ativas. O Meta escolhe, o gestor documenta no ClickUp o que ganhou e por quê (gasto, conversões, custo).',
      'Sequência sugerida: semana 1 criativos (ângulo/formato), semana 2 ganchos (3 primeiros segundos) do vencedor, semana 3 headlines, semana 4 nova leva de criativos.',
      'Critério de vencedor: gasto ≥ 2× a meta e custo abaixo da meta. Sem isso não é vencedor, é "sem dado".',
      'Campanha de Lab separada, com teste A/B nativo do Meta, só acima de R$ 5.000.',
    ],
  },
]

// ─── Benchmarks por etapa (Protocolo Gestão de Tráfego) ──────────────────────
export const BENCHMARKS = [
  {
    etapa: 'Topo',
    objetivo: 'Visitas ao perfil, video view, engajamento',
    metricas: [
      ['CPM', 'menor possível; média por nicho'],
      ['Tempo médio de reprodução', '> 10 segundos'],
      ['Taxa de gancho (3s)', '> 30%'],
      ['Custo por visita ao perfil', 'média da conta'],
    ],
    otimizacao: 'A cada 7 dias: renovar criativos, desligar os ruins, feedback ao cliente do que está gerando qualidade.',
  },
  {
    etapa: 'Meio',
    objetivo: 'Lead de material rico ou inscrição em webinar',
    metricas: [
      ['CTR no link', '> 1% (ideal > 2%)'],
      ['Taxa de conversão da LP', '20% a 50%'],
      ['Taxa de gancho', '> 30%'],
      ['Custo por lead', '≤ 1/3 do CPL de fundo'],
      ['MQL e custo por MQL', 'meta do projeto'],
    ],
    otimizacao: 'Olhar diário, otimizar entre 3 e 7 dias. Abaixo de 20% de conversão o problema é a LP, não o anúncio.',
  },
  {
    etapa: 'Fundo',
    objetivo: 'Lead, mensagem ou venda',
    metricas: [
      ['CTR no link', '> 1%'],
      ['Taxa de conversão da LP', '5% a 20%'],
      ['Taxa de gancho', '> 30%'],
      ['Custo por lead / CPA', 'CPL ou CPA ideal do projeto'],
      ['Taxa de venda (e-com/info)', '≥ 3%'],
      ['CAC', 'cruzar com ticket médio'],
    ],
    otimizacao: 'Regra de otimização pelo Meta priorizar + regra de desligar (acima).',
  },
]

export const NOMENCLATURA = [
  ['Campanha', 'Etapa do Funil_Tipo de Orçamento_Objetivo_Breve descrição', 'FUNDO_CBO_Leads_Financiamento'],
  ['Conjunto', 'Hierarquia_Temperatura_Plataforma_Detalhamento do Público', '01_Frio_Meta_Amplo'],
  ['Anúncio', 'Data_Breve descrição (+ _TESTADO ao desligar)', '2026-09-17_Video_Depoimento'],
]

export const VISUALIZACOES = [
  {
    nome: 'Topo de funil',
    colunas: 'Veiculação | Valor usado | CPM | Visitas ao perfil do Instagram | Resultado | Custo por resultado | Seguidores no Instagram | Tempo médio de reprodução de vídeo | Taxa de reproduções por no mínimo 3 segundos | Alcance | Frequência | Orçamento | Cliques no link | CPC | Cliques | CTR | Reproduções 25% | 50% | 75% | 100%',
  },
  {
    nome: 'Meio de funil',
    colunas: 'Veiculação | Valor usado | CPM | Lead | Custo por Lead | Taxa de conversão | Alcance | Frequência | Orçamento | Cliques no link | CPC | CTR link | MQL | CpMQL | Taxa de gancho',
  },
  {
    nome: 'Fundo de funil (B2B)',
    colunas: 'Veiculação | Valor usado | Orçamento | CPM | Lead | Custo por Lead | Resultado | Custo por resultado | Taxa de conversão | MQL | Custo por MQL | Alcance | Frequência | Cliques no link | CPC | CTR',
  },
  {
    nome: 'Fundo de funil (B2C)',
    colunas: 'Veiculação | Valor usado | CPM | Lead | Custo por Lead | Resultado | Custo por resultado | Taxa de conversão | Alcance | Frequência | Orçamento | Cliques no link | CPC | CTR | Mensagem | Custo por mensagem',
  },
]

// ─── Benchmark interno (portfólio Revenue Lab) ───────────────────────────────
// Números reais das contas no dashboard (dash_insights), 30 dias fechados.
// Atualizar todo mês: rodar a consulta e trocar os valores aqui + o periodo.
// Classificação B2B/B2C pelo tipo de negócio do cliente. Só contas com mais de
// R$ 300 investidos no período.
export const BENCHMARK_INTERNO = {
  periodo: '20/08 a 18/09/2026',
  atualizadoEm: '2026-09-19',
  fonte: 'Dashboard da Área do Cliente (Meta + Google), 30 dias fechados, contas com mais de R$ 300 investidos.',
  comoUsar: 'A mediana é a conta típica do portfólio. Conta abaixo da mediana do seu segmento pede diagnóstico; acima da mediana é candidata a escalar.',
  definicoes: [
    ['CTR (Meta)', 'cliques no link ÷ impressões'],
    ['Tx. conv (Meta)', 'Conversões (evento de otimização da campanha) ÷ cliques no link'],
    ['Custo/conv fundo (Meta)', 'investido ÷ conversões só das campanhas com "fundo" no nome'],
    ['CPC / CTR / Tx. conv / Custo/conv (Google)', 'gasto ÷ cliques · cliques ÷ impressões · conversões ÷ cliques · gasto ÷ conversões'],
  ],
  // Referência rápida: mediana das contas de cada segmento
  mediana: {
    meta: {
      cols: ['CTR (link)', 'CPM', 'Tx. conv', 'Custo/conv fundo'],
      b2b: ['1,85%', 'R$ 34,26', '7,8%', 'R$ 68,04'],
      b2c: ['1,00%', 'R$ 12,09', '11,8%', 'R$ 8,08'],
    },
    google: {
      cols: ['CPC', 'CTR', 'Tx. conv', 'Custo/conv'],
      b2b: ['R$ 4,52', '9,1%', '4,7%', 'R$ 108,20'],
      b2c: ['R$ 1,55', '4,6%', '18,7%', 'R$ 9,35'],
    },
  },
  // Média ponderada (total do segmento ÷ total), pra comparação
  ponderada: {
    meta: {
      b2b: ['1,95%', 'R$ 25,97', '15,0%', 'R$ 9,89'],
      b2c: ['1,12%', 'R$ 11,14', '17,1%', 'R$ 4,70'],
    },
    google: {
      b2b: ['R$ 1,31', '4,4%', '7,0%', 'R$ 18,55'],
      b2c: ['R$ 1,12', '4,1%', '21,9%', 'R$ 5,13'],
    },
  },
  // Conta a conta. Meta: [conta, investido, CTR, CPM, tx. conv, custo/conv fundo]
  meta: {
    cols: ['Conta', 'Investido', 'CTR', 'CPM', 'Tx. conv', 'Custo/conv fundo'],
    b2b: [
      ['NectarCRM', 'R$ 11.779', '0,53%', 'R$ 35,82', '10,5%', 'R$ 64,02'],
      ['Bio Cosméticos', 'R$ 9.115', '2,91%', 'R$ 17,96', '28,1%', 'R$ 2,08'],
      ['Nomus', 'R$ 6.773', '1,70%', 'R$ 20,96', '1,3%', 'R$ 85,46'],
      ['Medicalsys', 'R$ 5.396', '3,76%', 'R$ 74,05', '2,2%', 'R$ 88,29'],
      ['BuzzLead', 'R$ 5.297', '1,65%', 'R$ 87,23', '14,1%', 'R$ 53,12'],
      ['Grupo AJ', 'R$ 5.000', '1,53%', 'R$ 12,84', '6,4%', 'R$ 16,00'],
      ['GoVendas', 'R$ 4.227', '1,27%', 'R$ 32,69', '2,3%', 'R$ 181,31'],
      ['Data LP (Alldaya)', 'R$ 3.321', '2,27%', 'R$ 27,44', '9,2%', 'R$ 131,56'],
      ['Multichat360', 'R$ 2.417', '0,51%', 'R$ 56,70', '26,9%', 'R$ 41,67'],
      ['2Com', 'R$ 1.980', '2,24%', 'R$ 9,25', '0,04%', '–'],
      ['Escribo', 'R$ 1.907', '3,12%', 'R$ 15,93', '41,2%', '–'],
      ['Matheus Business', 'R$ 1.837', '2,69%', 'R$ 42,53', '3,5%', '–'],
      ['BPYOU', 'R$ 1.701', '2,01%', 'R$ 139,26', '10,2%', 'R$ 68,04'],
      ['TudoMed Saúde', 'R$ 1.151', '1,17%', 'R$ 62,10', '6,5%', 'R$ 82,21'],
    ],
    b2c: [
      ['Nacional Kart', 'R$ 17.715', '1,33%', 'R$ 7,55', '24,1%', 'R$ 2,35'],
      ['Óticas Brasil 01', 'R$ 9.847', '1,00%', 'R$ 7,78', '4,8%', 'R$ 6,98'],
      ['Boa Noite Colchões', 'R$ 9.240', '0,86%', 'R$ 22,86', '41,0%', 'R$ 7,95'],
      ['Cical Honda Goiânia', 'R$ 7.957', '0,83%', 'R$ 8,90', '37,3%', 'R$ 2,96'],
      ['Vital Clínica', 'R$ 7.165', '0,59%', 'R$ 9,19', '26,4%', 'R$ 5,91'],
      ['Dr. Ulyscélio', 'R$ 5.375', '1,59%', 'R$ 16,73', '6,6%', 'R$ 9,34'],
      ['Colégio Cordeiro', 'R$ 4.814', '2,36%', 'R$ 19,75', '6,4%', 'R$ 10,66'],
      ['Sempre Chevrolet', 'R$ 4.731', '0,75%', 'R$ 11,49', '11,8%', '–'],
      ['WJK Travel', 'R$ 3.762', '3,62%', 'R$ 64,44', '2,8%', 'R$ 63,76'],
      ['Neuroexperts', 'R$ 3.144', '0,93%', 'R$ 14,31', '4,2%', 'R$ 22,41'],
      ['AzFit Suplementos', 'R$ 2.631', '1,37%', 'R$ 11,65', '7,3%', 'R$ 7,92'],
      ['Cical Honda Dream', 'R$ 2.581', '1,25%', 'R$ 15,40', '23,5%', 'R$ 4,95'],
      ['Boa Vida Stays', 'R$ 2.533', '2,87%', 'R$ 35,68', '5,7%', 'R$ 21,09'],
      ['Fabulla Animal', 'R$ 2.461', '1,25%', 'R$ 15,00', '2,1%', 'R$ 53,12'],
      ['Cical Nissan UDI', 'R$ 2.445', '0,84%', 'R$ 12,09', '12,0%', 'R$ 10,13'],
      ['Empório Kids', 'R$ 2.425', '0,98%', 'R$ 15,00', '37,0%', 'R$ 4,02'],
      ['Cical Chevrolet Itumbiara', 'R$ 2.000', '0,49%', 'R$ 10,62', '14,1%', 'R$ 13,26'],
      ['RGM Portas e Janelas', 'R$ 1.974', '0,74%', 'R$ 32,13', '52,2%', 'R$ 8,08'],
      ['Vision Center', 'R$ 1.796', '2,09%', 'R$ 10,13', '1,9%', 'R$ 13,35'],
      ['Universo Park', 'R$ 1.743', '3,39%', 'R$ 15,90', '5,0%', 'R$ 6,95'],
      ['Dr. Eduardo Moura', 'R$ 1.713', '1,75%', 'R$ 15,83', '7,9%', 'R$ 10,23'],
      ['PVB Óticas Brasil', 'R$ 1.445', '0,56%', 'R$ 10,12', '15,3%', '–'],
      ['Nikoniko Kids', 'R$ 1.267', '1,43%', 'R$ 17,55', '11,6%', 'R$ 8,26'],
      ['Cical Honda Trindade', 'R$ 1.246', '0,26%', 'R$ 7,34', '48,5%', 'R$ 5,07'],
      ['Cical Honda Garavelo', 'R$ 1.237', '0,36%', 'R$ 6,08', '43,5%', 'R$ 3,14'],
      ['Sempre Seminovos', 'R$ 1.170', '0,23%', 'R$ 7,87', '40,8%', 'R$ 6,80'],
      ['Agropop Coimbra', 'R$ 1.146', '1,14%', 'R$ 16,11', '10,3%', 'R$ 11,83'],
      ['Dr. Jorge Pinho', 'R$ 1.017', '0,99%', 'R$ 11,63', '16,7%', 'R$ 5,48'],
      ['Flash Car', 'R$ 809', '1,18%', 'R$ 4,88', '4,5%', 'R$ 8,18'],
    ],
  },
  // Google: [conta, investido, CPC, CTR, tx. conv, custo/conv]
  google: {
    cols: ['Conta', 'Investido', 'CPC', 'CTR', 'Tx. conv', 'Custo/conv'],
    b2b: [
      ['Nomus', 'R$ 72.350', 'R$ 1,44', '3,67%', '0,9%', 'R$ 152,57'],
      ['Bio Cosméticos Distribuidora', 'R$ 4.914', 'R$ 0,49', '23,47%', '0,8%', 'R$ 63,82'],
      ['Tetralite', 'R$ 4.529', 'R$ 6,51', '9,73%', '12,6%', 'R$ 51,47'],
      ['Data LP (Alldaya)', 'R$ 3.792', 'R$ 22,98', '6,29%', '6,1%', 'R$ 379,20'],
      ['NectarCRM', 'R$ 3.568', 'R$ 8,68', '33,47%', '3,4%', 'R$ 254,86'],
      ['BuzzLead', 'R$ 3.414', 'R$ 0,27', '4,35%', '36,1%', 'R$ 0,75'],
      ['Grupo AJ', 'R$ 2.752', 'R$ 6,97', '12,55%', '17,2%', 'R$ 40,47'],
      ['REVO360', 'R$ 1.565', 'R$ 4,97', '3,75%', '2,2%', 'R$ 223,57'],
      ['Medicalsys', 'R$ 709', 'R$ 4,07', '10,32%', '1,7%', 'R$ 236,33'],
      ['Distribuidora Oeste', 'R$ 412', 'R$ 3,17', '8,45%', '12,3%', 'R$ 25,75'],
    ],
    b2c: [
      ['Óticas Brasil', 'R$ 4.337', 'R$ 1,31', '3,52%', '23,5%', 'R$ 5,57'],
      ['Nacional Kart Goiânia', 'R$ 1.908', 'R$ 1,40', '7,54%', '32,2%', 'R$ 4,37'],
      ['Nacional Kart São Paulo', 'R$ 1.860', 'R$ 0,32', '3,54%', '29,1%', 'R$ 1,09'],
      ['WJK Travel', 'R$ 1.488', 'R$ 13,65', '3,63%', '1,8%', 'R$ 744,00'],
      ['Agropop Coimbra', 'R$ 1.466', 'R$ 0,81', '4,33%', '22,2%', 'R$ 3,62'],
      ['Boa Noite Colchões', 'R$ 1.277', 'R$ 0,66', '4,64%', '11,7%', 'R$ 5,63'],
      ['Cical Honda Garavelo', 'R$ 1.255', 'R$ 1,55', '8,20%', '11,8%', 'R$ 13,07'],
      ['Tudo Móvel', 'R$ 1.192', 'R$ 3,02', '3,88%', '11,4%', 'R$ 26,49'],
      ['Sempre Seminovos', 'R$ 1.002', 'R$ 0,87', '3,07%', '0,6%', 'R$ 143,14'],
      ['NeuroExperts', 'R$ 985', 'R$ 2,50', '7,55%', '31,0%', 'R$ 8,07'],
      ['Dr. Jorge Pinho', 'R$ 894', 'R$ 1,95', '10,42%', '32,0%', 'R$ 6,08'],
      ['Cical Chevrolet Itumbiara', 'R$ 874', 'R$ 5,30', '3,08%', '32,1%', 'R$ 16,49'],
      ['Colégio Cordeiro', 'R$ 773', 'R$ 3,75', '5,81%', '1,9%', 'R$ 193,25'],
      ['Cical Honda Goiânia', 'R$ 725', 'R$ 1,32', '8,33%', '12,8%', 'R$ 10,36'],
      ['Cical Honda Trindade', 'R$ 710', 'R$ 1,89', '7,63%', '16,5%', 'R$ 11,45'],
      ['Futura AT', 'R$ 606', 'R$ 0,93', '2,94%', '21,2%', 'R$ 4,39'],
      ['Dr. Ulyscélio', 'R$ 601', 'R$ 3,11', '5,96%', '18,7%', 'R$ 16,69'],
      ['Flash Car', 'R$ 525', 'R$ 1,07', '2,66%', '20,0%', 'R$ 5,36'],
      ['Pet Klinic', 'R$ 514', 'R$ 1,72', '6,63%', '18,5%', 'R$ 9,35'],
    ],
  },
  ressalvas: [
    'Conversão não é a mesma coisa em toda conta. No Meta, "Conversões" é o evento de otimização de cada campanha (conversa de WhatsApp, lead de formulário, compra). Conta de WhatsApp (Cical, Boa Noite, RGM) mostra taxa de 40 a 50% porque o clique já vira conversa; conta de LP com formulário fica em 2 a 10%.',
    'BuzzLead (Google, R$ 0,75 por conversão), Nacional Kart SP (Google) e Bio Cosméticos (Meta, R$ 2,08) contam ação leve como conversão. Pra benchmark de lead de verdade, ignorar essas linhas.',
    'Nomus representa 74% de todo o investimento Google do portfólio. Por isso a média ponderada B2B do Google é praticamente a Nomus. Usar a mediana.',
    'Custo por conversão no fundo (Meta) só existe pra conta que nomeia campanha com "fundo" (nomenclatura do Protocolo). Sempre Chevrolet, Escribo, Matheus Business e PVB não seguem o padrão e ficaram sem o valor.',
    'CTR do Google em conta com Display/PMax (Bio Cosméticos 23%, NectarCRM 33%) sai inflado porque a coluna de impressões só cobre Search/Shopping.',
  ],
}

// ─── Faixas de verba ─────────────────────────────────────────────────────────
const NAO_FAZ = 'Não faz'

export const FAIXAS = [
  // ── até R$ 1.000 ──────────────────────────────────────────────────────────
  {
    id: '1k',
    label: 'Até R$ 1.000',
    verbaMensal: 1000,
    verbaDia: 33,
    resumo: 'Uma campanha só, de fundo, pra gerar venda o mais rápido possível. B2B não faz nessa faixa.',
    rows: [
      ['Verba diária', 'R$ 33', NAO_FAZ],
      ['Tipo de funil de captação', '• Funil de WhatsApp', NAO_FAZ],
      ['Estrutura', 'Campanha 1: Fundo (R$ 33/dia, 100%).\nSem topo nessa faixa: toda a verba vai pra gerar venda o mais rápido possível.', NAO_FAZ],
      ['Canais', 'Padrão: só Meta.\nTroca o Meta pelo Google Search apenas quando as duas condições valem: (1) as pessoas já pesquisam o produto no Google e (2) o CPC estimado da palavra permite pelo menos 10 cliques por dia com R$ 33 (CPC de até R$ 3,30).\nNessa faixa isso é raro, então quase sempre é Meta.', NAO_FAZ],
      ['Orçamento', 'CBO', NAO_FAZ],
      ['Conjuntos', '1 só. Com R$ 33/dia não dá pra dividir sem pulverizar a verba.', NAO_FAZ],
      ['Públicos', 'Amplo Advantage+.\nSem lookalike, remarketing nem interesses nessa faixa.', NAO_FAZ],
      ['Objetivo', 'Vendas via WhatsApp (conversas)', NAO_FAZ],
      ['Criativos ativos por conjunto', 'Todos os criativos do mês ficam ativos ao mesmo tempo (sobe 3 por semana, até 12 ativos no mês). O Meta escolhe em quais concentrar a entrega.\nRegra de otimização: desliga o anúncio que passar de 2× o custo por conversa ideal com gasto mínimo atingido, marca como testado e o Meta redistribui a verba. Nunca desligar anúncio que o Meta não priorizou e nunca reativar um marcado como testado no mesmo conjunto.', NAO_FAZ],
      ['Novos criativos por mês', '3 por semana, até 12/mês, subidos já ativos (mistura de estático e vídeo/reels)', NAO_FAZ],
      ['Marcação de testado', 'Obrigatória ao desligar: sufixo _TESTADO no nome do anúncio + registro no ClickUp.', NAO_FAZ],
      ['Destino', 'WhatsApp', NAO_FAZ],
      ['Rotina', 'Diária (10 min): gasto vs. teto, anomalias, e quais anúncios o Meta está priorizando hoje e o custo de cada um.\nSemanal: subir os 3 criativos novos, registro no ClickUp.', NAO_FAZ],
      ['Métrica de corte', 'Custo por conversa iniciada', NAO_FAZ],
      ['Desligar', 'Só anúncio que está recebendo entrega. Condição: gasto no anúncio ≥ 2× a meta e (0 conversas ou custo ≥ 2× a meta). Saturação: frequência ≥ 3,5 nos últimos 7 dias.', NAO_FAZ],
      ['Escalar', 'Não escala dentro da faixa: o teto é R$ 33/dia. Se o custo por conversa fica ≤ meta por 7 dias seguidos, vira proposta de subir o cliente pra faixa de R$ 2.000.', NAO_FAZ],
      ['Expectativa', 'R$ 1.000 ÷ custo por conversa ideal. Ex.: R$ 25 por conversa → ~40 conversas/mês', NAO_FAZ],
      ['Report ao cliente', 'Resumo semanal por WhatsApp + relatório mensal', NAO_FAZ],
    ],
    estrutura: {
      b2c: [
        {
          nome: 'Campanha 1', tipo: 'CBO', verba: 'R$ 33/dia', sub: 'Fundo',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Amplo Advantage+', ads: ['AD 01', 'AD 02', 'AD 03'], nota: '3 por semana · WhatsApp' },
          ],
        },
      ],
      b2b: null,
      // Mapa "Meta OU Google": nessa faixa o Google substitui o Meta, nunca roda junto.
      google: {
        titulo: 'Estrutura Google',
        ou: true,
        campanhas: [
          {
            nome: 'Campanha', tipo: '', verba: 'R$ 33/dia', sub: 'Search',
            conjuntos: [
              { nome: 'Conjunto 01', sub: 'produto', ads: ['AD 01'] },
              { nome: 'Conjunto 02', sub: 'branding', ads: ['AD 02'] },
            ],
          },
        ],
        nota: 'Só entra se já existe busca pelo produto. Nunca junto com o Meta nessa faixa.',
      },
      // Pontos que aparecem embaixo de cada estrutura no mapa (treinamento).
      // Item pode ser string ou { t, sub: [] } pra lista aninhada.
      pontos: {
        b2c: [
          'Testa 3 criativos por semana no máximo',
          'CPL: R$ 5 a R$ 15',
          '2 a 6 mensagens por dia',
          'Não tem público quente',
          'Apenas um funil: WhatsApp',
          'A otimização é apenas desligar o criativo que está com o CPL 2× acima do CPL alvo e ligar um criativo que não foi testado',
          'Assim que um criativo é desligado ele é marcado como "_Fadigado" ou "_Ruim"',
          { t: 'Quando escalar?', sub: ['1) Quando o ROAS calculado estiver acima de 3', '2) Quando o CPL estiver abaixo do CPL alvo'] },
          'Aumente em 20% por dia o valor para não fazer o CPM estourar',
        ],
        google: [
          'Testa 2 campanhas no máximo',
          'CPC: R$ 1 a R$ 5',
          'CPL: R$ 9 a R$ 108',
          'Até 3 conversões por dia',
          'Apenas uma campanha para tentar não perder lances no leilão',
          { t: 'A otimização aqui é:', sub: ['negativar palavras-chave', 'mudar headlines', 'mudar anúncios'] },
          { t: 'Quando escalar?', sub: ['1) Quando o ROAS calculado estiver acima de 3', '2) Quando o CPL estiver abaixo do CPL alvo'] },
          'Aumente em 20% por dia o valor para não fazer o CPM estourar',
        ],
      },
      notas: {
        b2c: ['Sem topo, sem lookalike, sem remarketing.', 'Não escala dentro da faixa: 7 dias abaixo da meta = proposta de subir pra R$ 2.000.'],
        b2b: ['B2B não roda nem Meta nem Google nessa faixa: o CPL de B2B não fecha com R$ 33/dia. Começa em R$ 2.000.'],
      },
    },
  },

  // ── R$ 2.000 ──────────────────────────────────────────────────────────────
  {
    id: '2k',
    label: 'R$ 2.000',
    verbaMensal: 2000,
    verbaDia: 66,
    resumo: 'Fundo em CBO com tudo ativo. B2C ganha um topo pequeno se o cliente tiver conteúdo. B2B entra, 100% no fundo.',
    rows: [
      ['Verba diária', 'R$ 66', 'R$ 66'],
      ['Tipo de funil de captação', '• Funil de WhatsApp ou\n• Funil de LP curta', '• Funil de LP com formulário ou\n• Funil de formulário nativo (Meta)'],
      ['Estrutura', 'Campanha 1: Fundo (R$ 50/dia, 75%).\nCampanha 2: Topo Visitas ao Perfil ou Video View (R$ 16/dia, 25%), só se o cliente tiver conteúdo/vídeo pra rodar. Se ele não tiver é 100% fundo.', 'Campanha 1: Fundo com LP ou formulário nativo (R$ 66/dia, 100%). Sem topo nessa faixa.'],
      ['Canais', 'Padrão: só Meta. Com essa verba não divide em dois canais.\nGoogle Search no lugar do Meta quando (1) as pessoas já pesquisam o produto no Google e (2) o CPC estimado permite ≥ 10 cliques/dia com R$ 66 (CPC de até R$ 6,60).', 'Padrão: só um canal, Meta ou Google Search. Mesmas duas condições pra escolher o Google.\nEm B2B com busca ativa (ex.: "software de X", "fornecedor de Y") o Google costuma ganhar.'],
      ['Orçamento', 'CBO na campanha de fundo', 'CBO'],
      ['Conjuntos', '1 a 2 no fundo (amplo + 1 público de lookalike). Cada conjunto precisa de ≥ 2× CPL ideal por dia de verba, senão vira 1 só.', '1 conjunto'],
      ['Públicos', 'Amplo Advantage+ como padrão.\nLookalike só com base ≥ 1.000 eventos ou lista de clientes.', 'Amplo com sinal de cargo/segmento, ou lookalike da base de clientes se existir.'],
      ['Objetivo', 'Vendas (site ou WhatsApp) + audiência/seguidor no topo', 'Leads (formulário ou LP)'],
      ['Criativos ativos por conjunto', 'Todos os criativos do mês ficam ativos ao mesmo tempo (sobe 3 por semana, até 12 ativos no mês). O Meta escolhe em quais concentrar a entrega. Regra de otimização: desliga o anúncio que passar de 2× o CPL ideal com gasto mínimo atingido, marca como testado e o Meta redistribui a verba. Nunca desligar anúncio que o Meta não priorizou e nunca reativar um marcado como testado no mesmo conjunto.', 'Mesma regra. Sobe 4 a 6 criativos no mês. Janela de avaliação de 7 dias.'],
      ['Novos criativos por mês', '3 por semana, até 12/mês (mistura de estático e vídeo/reels)', '6 a 12/mês (mistura de estático e vídeo)'],
      ['Marcação de testado', 'Obrigatória ao desligar: sufixo _TESTADO no nome do anúncio + registro no ClickUp.', 'Igual'],
      ['Destino', 'WhatsApp ou LP curta', 'LP com formulário, ou formulário nativo do Meta se não houver LP'],
      ['Rotina', 'Diária (15 min): gasto vs. teto, anomalias, e quais anúncios o Meta está priorizando e o custo de cada um.\nSemanal: subir os 3 criativos novos, ajuste de verba, registro no ClickUp.', 'Diária: igual. Semanal: subir 1 a 2 criativos novos, ajuste de verba, registro.'],
      ['Métrica de corte', 'Venda: CPA ou ROAS. WhatsApp: custo por conversa', 'CPL'],
      ['Desligar', 'Só anúncio que está recebendo entrega. Condição: gasto ≥ 2× a meta e (0 conversões ou custo ≥ 2× a meta). Nunca antes de 72h de entrega. Saturação: frequência ≥ 3,5 com CTR caindo. Sempre com marcação de testado.', 'Igual, com CPL e janela de 10 a 14 dias.'],
      ['Escalar', '+20% no conjunto quando custo ≤ meta estável por 3 dias, até o teto de R$ 66/dia. Passou do teto = proposta de subir a faixa pro cliente.', 'Igual'],
      ['Expectativa', 'R$ 2.000 ÷ CPA ideal. Ex.: CPA R$ 80 → ~25 vendas ou conversas', 'R$ 2.000 ÷ CPL ideal. Ex.: CPL R$ 60 → ~33 leads'],
      ['Report ao cliente', 'Resumo semanal por WhatsApp + relatório mensal', 'Igual'],
    ],
    estrutura: {
      b2c: [
        {
          nome: 'Campanha 1', tipo: 'CBO', verba: 'R$ 50/dia', sub: 'Fundo',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Amplo Advantage+', ads: ['AD 01', 'AD 02', 'AD 03', '…', 'AD 12'], nota: 'todos ativos, sobe 3/semana (até 12)' },
            { nome: 'Conjunto 02', sub: 'Lookalike (opcional)', opcional: true, ads: ['AD 01', 'AD 02', 'AD 03'], nota: 'só com base ≥ 1.000 eventos ou lista' },
          ],
        },
        {
          nome: 'Campanha 2', tipo: '', verba: 'R$ 16/dia', sub: 'Topo (opcional)', opcional: true,
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Visitas ao perfil / Video View', opcional: true, ads: ['AD 01', 'AD 02', 'AD 03'], nota: 'só se o cliente tiver conteúdo' },
          ],
        },
      ],
      b2b: [
        {
          nome: 'Campanha 1', tipo: 'CBO', verba: 'R$ 66/dia', sub: 'Fundo · 100%',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Amplo + sinal de cargo', ads: ['AD 01', 'AD 02', 'AD 03', '…', 'AD 12'], nota: 'todos ativos, 6 a 12 testes no mês' },
          ],
        },
      ],
      google: {
        titulo: 'Se o Google Search substituir o Meta',
        campanhas: [
          {
            nome: 'Campanha Search', tipo: '', verba: 'R$ 66/dia', sub: 'CPC ≤ R$ 6,60',
            conjuntos: [
              { nome: 'Grupo 01', sub: 'grupo de anúncios', ads: ['AD 01', 'AD 02'] },
              { nome: 'Grupo 02', sub: 'grupo de anúncios', ads: ['AD 01', 'AD 02'] },
              { nome: 'Grupo 03', sub: 'grupo de anúncios', ads: ['AD 01', 'AD 02'] },
            ],
          },
        ],
        nota: 'Só entra se já existe busca pelo produto. Nunca junto com o Meta nessa faixa.',
      },
      notas: {
        b2c: ['Tracejado = opcional. Sem conteúdo pra topo, 100% da verba vai pro fundo.'],
        b2b: ['Sem topo nessa faixa. Destino: LP com formulário ou formulário nativo.'],
      },
    },
  },

  // ── R$ 3.000 ──────────────────────────────────────────────────────────────
  {
    id: '3k',
    label: 'R$ 3.000',
    verbaMensal: 3000,
    verbaDia: 100,
    resumo: 'Fundo em CBO com dois conjuntos (quente e frio). O Laboratório roda dentro do fundo, sem campanha separada.',
    rows: [
      ['Verba diária', 'R$ 100', 'R$ 100'],
      ['Divisão da verba', '• Fundo: R$ 84/dia (R$ 2.520/mês)\n• Topo: R$ 16/dia (R$ 480/mês)', '• Fundo: R$ 100/dia (R$ 3.000/mês)\n• Sem topo'],
      ['Tipo de funil de captação', '• Funil de WhatsApp ou\n• Funil de LP curta', '• Funil de LP com formulário ou\n• Funil de formulário nativo (Meta)'],
      ['Estrutura', 'Campanha 1: Fundo CBO (R$ 84/dia)\nConjunto 1: Público Quente\nConjunto 2: Público Frio\nCampanha 2: Topo Visitas ao perfil ou Video View (R$ 16/dia), só se o cliente tiver conteúdo/vídeo pra rodar. Se não tiver, 100% fundo.', 'Campanha 1: Fundo CBO com LP ou formulário nativo (R$ 100/dia).\nConjunto 1: Público Quente\nConjunto 2: Público Frio\nSem topo nessa faixa.'],
      ['Canais', 'Padrão: Meta.\nGoogle Search substitui o fundo apenas quando (1) as pessoas já pesquisam o produto no Google e (2) o CPC estimado permite ≥ 10 cliques/dia com R$ 84 (CPC de até R$ 8,40).', 'Padrão: só um canal, Meta ou Google Search.\nMesmas duas condições (CPC de até R$ 10,00 com R$ 100/dia). Em B2B com busca ativa o Google costuma ganhar.'],
      ['Orçamento', 'CBO nas duas campanhas', 'CBO'],
      ['Conjuntos', 'Conjunto 1 amplo (o Lab roda aqui).\nConjunto 2 de remarketing ou lookalike, com os vencedores do 1. Cada conjunto precisa de ≥ 2× CPL ideal por dia de verba.', 'Conjunto 1 amplo com sinal de cargo/segmento.\nConjunto 2 de remarketing ou lookalike, pela mesma regra.'],
      ['Públicos', 'Amplo Advantage+ como padrão.\nRemarketing se houver base de engajamento/pixel; senão lookalike (≥ 1.000 eventos ou lista); senão fica só o conjunto 1 até ter base.', 'Amplo com cargo/segmento.\nRemarketing ou lookalike da base de clientes, pela mesma regra.'],
      ['Objetivo', 'Fundo: vendas (WhatsApp ou LP). Topo: audiência + seguidor.', 'Leads (formulário ou LP) e MQL'],
      ['Laboratório (processo dentro do Fundo)', 'Testar 3 criativos por semana, 12 no mês, no Conjunto 1.\nDeixar sempre 6 criativos de gaveta pra substituir na hora quem parar de performar.\nCritério de vencedor: gasto ≥ 2× a meta e custo abaixo da meta.', 'Igual, com CPL. Ciclos de 7 a 10 dias por hipótese porque a conversão B2B é mais lenta.'],
      ['Criativos ativos por conjunto', 'Todos os criativos do mês ficam ativos ao mesmo tempo (3 por semana, até 12 no mês). O Meta escolhe em quais concentrar a entrega.\nRegra de otimização: desliga o anúncio que passar de 2× o CPA ideal com gasto mínimo atingido, marca como testado e o Meta redistribui a verba.\nNunca desligar anúncio que o Meta não priorizou e nunca reativar um marcado como testado no mesmo conjunto.', 'Mesma regra, com CPL. Até 12 no mês.'],
      ['Novos criativos por mês', '3 por semana, até 12/mês, seguindo a sequência do Laboratório (criativo → gancho → headline → criativo)', 'Igual'],
      ['Marcação de testado', 'Obrigatória ao desligar: sufixo _TESTADO no nome do anúncio + registro no ClickUp com o resultado (gasto, conversões, custo).', 'Igual'],
      ['Destino', 'WhatsApp ou LP curta', 'LP com formulário, ou formulário nativo'],
      ['Rotina', 'Diária (15 min): gasto vs. teto por campanha, anomalias, e quais anúncios o Meta está priorizando e o custo de cada um.\nSemanal: fechar a hipótese da semana (documentar vencedor no ClickUp), subir as 3 variações da próxima, ajuste de verba.', 'Igual'],
      ['Métrica de corte', 'Fundo: CPA ou custo por conversa. Sem conversão no período, CTR no link (ganchos: retenção 3s + CTR).', 'CPL. Sem conversão no período, CTR no link. Se gastar 2× o CPL ideal, desliga o criativo.'],
      ['Desligar', 'Só anúncio que está recebendo entrega. Condição: gasto ≥ 2× a meta e (0 conversões ou custo ≥ 2× a meta). Nunca antes de 72h de entrega. Saturação: frequência ≥ 3,5 nos últimos 7 dias. Sempre com marcação de testado.', 'Igual, com CPL e janela de 7 a 10 dias.'],
      ['Escalar', '+20% no conjunto quando custo ≤ meta estável por 3 dias, até o teto de R$ 84/dia (B2B: R$ 100). Passou do teto = proposta de subir a faixa pro cliente.', 'Igual'],
      ['Expectativa', 'R$ 2.520 do Fundo ÷ CPA ideal. Ex.: CPA R$ 80 → ~31 vendas ou conversas', 'R$ 3.000 ÷ CPL ideal. Ex.: CPL R$ 60 → ~50 leads'],
      ['Report ao cliente', 'Resumo semanal por WhatsApp com o vencedor da hipótese da semana + relatório mensal do Laboratório com o kit validado (criativo, gancho, headline) e o critério de cada vencedor.', 'Igual'],
    ],
    estrutura: {
      b2c: [
        {
          nome: 'Campanha 1', tipo: 'CBO', verba: 'R$ 84/dia', sub: 'Fundo · o Laboratório roda aqui',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Amplo Advantage+', ads: ['AD 01 · 02 · 03  (sem. 1: 3 criativos)', 'AD 04 · 05 · 06  (sem. 2: 3 ganchos)', 'AD 07 · 08 · 09  (sem. 3: 3 headlines)', 'AD 10 · 11 · 12  (sem. 4: 3 criativos)'], nota: 'todos ativos · o Meta escolhe · o gestor documenta o vencedor' },
            { nome: 'Conjunto 02', sub: 'Remarketing ou Lookalike', ads: ['Vencedor 01', 'Vencedor 02', 'Vencedor 03'], nota: 'só os vencedores do Conjunto 01' },
          ],
        },
        {
          nome: 'Campanha 2', tipo: '', verba: 'R$ 16/dia', sub: 'Topo',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Visitas ao perfil / Video View', ads: ['AD 01', 'AD 02', 'AD 03'], nota: 'só se o cliente tiver conteúdo' },
          ],
        },
      ],
      b2b: [
        {
          nome: 'Campanha 1', tipo: 'CBO', verba: 'R$ 100/dia', sub: 'Fundo · o Laboratório roda aqui',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Amplo + cargo', ads: ['AD 01 · 02 · 03  (sem. 1)', 'AD 04 · 05 · 06  (sem. 2)', 'AD 07 · 08 · 09  (sem. 3)', 'AD 10 · 11 · 12  (sem. 4)'], nota: 'mesma sequência semanal do B2C' },
            { nome: 'Conjunto 02', sub: 'Remarketing ou Lookalike', ads: ['Vencedor 01', 'Vencedor 02', 'Vencedor 03'], nota: 'só os vencedores do Conjunto 01' },
          ],
        },
      ],
      notas: {
        b2c: ['Sem campanha de Lab: o teste é o processo dentro do Conjunto 01.'],
        b2b: ['Sem topo. Destino: LP com formulário ou formulário nativo.'],
      },
    },
  },

  // ── R$ 4.000 ──────────────────────────────────────────────────────────────
  {
    id: '4k',
    label: 'R$ 4.000',
    verbaMensal: 4000,
    verbaDia: 133,
    resumo: 'Frio e quente viram campanhas separadas em ABO, cada conjunto com verba fixa. No CBO o Meta joga quase tudo no frio e o remarketing fica sem entrega.',
    rows: [
      ['Verba diária', 'R$ 133', 'R$ 133'],
      ['Divisão da verba', '• Fundo Frio: R$ 80/dia (R$ 2.400/mês)\n• Fundo Quente: R$ 30/dia (R$ 900/mês)\n• Topo: R$ 23/dia (R$ 700/mês)', '• Fundo Frio: R$ 100/dia (R$ 3.000/mês)\n• Fundo Quente: R$ 33/dia (R$ 1.000/mês)\n• Sem topo'],
      ['Tipo de funil de captação', '• Funil de WhatsApp ou\n• Funil de LP curta', '• Funil de LP com formulário ou\n• Funil de formulário nativo (Meta)'],
      ['Estrutura', 'Campanha 1: Fundo Frio ABO (R$ 80/dia)\nConjunto 1: Amplo Advantage+ (R$ 50/dia), o Lab roda aqui\nConjunto 2: Lookalike ou interesses (R$ 30/dia)\nCampanha 2: Fundo Quente ABO (R$ 30/dia)\nConjunto 1: Remarketing engajamento IG/FB 30 a 90 dias + visitantes do site/LP + quem iniciou conversa e não comprou\nCampanha 3: Topo Visitas ao perfil ou Video View (R$ 23/dia), só se o cliente tiver conteúdo. Se não tiver, a verba vai pro Fundo Frio', 'Campanha 1: Fundo Frio ABO (R$ 100/dia)\nConjunto 1: Amplo com sinal de cargo/segmento (R$ 60/dia), o Lab roda aqui\nConjunto 2: Lookalike de clientes/leads ou interesses do setor (R$ 40/dia)\nCampanha 2: Fundo Quente ABO (R$ 33/dia)\nConjunto 1: Remarketing engajamento + visitantes da LP + leads que não viraram MQL\nSem topo nessa faixa'],
      ['Canais', 'Padrão: Meta. Google Search entra como canal paralelo (não substitui) só se já existe busca pelo produto e o CPC permite ≥ 10 cliques/dia com R$ 30 (CPC até R$ 3,00). Nesse caso sai a Campanha 3 (Topo) e entra o Google com os R$ 23 + R$ 7 do Frio', 'Padrão: Meta. Google Search paralelo pela mesma regra, usando R$ 33/dia do Fundo Frio (CPC até R$ 3,30). Em B2B com busca ativa, vale'],
      ['Orçamento', 'ABO nas campanhas de fundo (verba fixa por conjunto pra garantir entrega no quente). Topo em CBO', 'ABO no fundo'],
      ['Conjuntos', 'Fundo Frio: 2. Fundo Quente: 1. Topo: 1.\nRegra: cada conjunto precisa de ≥ 2× CPL ideal por dia de verba; se o Conjunto 2 do Frio não atingir, ele some e a verba vai pro Conjunto 1', 'Fundo Frio: 2. Fundo Quente: 1. Mesma regra'],
      ['Públicos', 'Frio: Amplo Advantage+ + Lookalike (base ≥ 1.000 eventos ou lista) ou interesses.\nQuente: engajamento IG/FB 30 a 90 dias, visitantes site/LP 30 dias, iniciou conversa no WhatsApp 30 dias. Excluir compradores do quente', 'Frio: amplo com cargo/segmento + lookalike de clientes ou interesses do setor.\nQuente: engajamento, visitantes LP, leads sem MQL. Excluir MQLs e clientes'],
      ['Objetivo', 'Fundo: vendas (WhatsApp ou LP). Topo: audiência + seguidor', 'Leads (formulário ou LP) e MQL'],
      ['Laboratório (dentro do Fundo Frio, Conjunto 1)', 'Testar 3 criativos por semana, 12 no mês, sempre no Conjunto 1 do Frio.\nDeixar sempre 6 criativos de gaveta pra substituir na hora quem parar de performar.\nCritério de vencedor: gasto ≥ 2× a meta e custo abaixo da meta.\nVencedor do Frio é replicado no Conjunto 2 do Frio e no Quente. O Quente não testa criativo: só roda vencedor, com copy ajustada pra quem já conhece (oferta, prova, urgência)', 'Igual, com CPL. Vencedor vai pro Conjunto 2 do Frio e pro Quente com copy de reencontro (case, prova, chamada pra reunião)'],
      ['Criativos ativos por conjunto', 'Frio Conjunto 1: todos os do mês ativos (até 12), o Meta escolhe. Frio Conjunto 2 e Quente: 3 a 4 vencedores.\nRegra de otimização: desliga o anúncio que passar de 2× o CPA ideal com gasto mínimo atingido, marca como testado e sobe um da gaveta.\nNunca desligar anúncio que o Meta não priorizou e nunca reativar um marcado como testado no mesmo conjunto', 'Igual, com CPL'],
      ['Novos criativos por mês', '3 por semana, até 12/mês, mais os 6 de gaveta prontos (mistura de estático e vídeo/reels)', 'Igual'],
      ['Marcação de testado', 'Obrigatória ao desligar: sufixo _TESTADO no nome do anúncio + registro no ClickUp com o resultado (gasto, conversões, custo)', 'Igual'],
      ['Destino', 'WhatsApp ou LP curta', 'LP com formulário, ou formulário nativo'],
      ['Rotina', 'Diária (20 min): gasto vs. teto por campanha e por conjunto (ABO exige olhar conjunto a conjunto), anomalias, quem o Meta prioriza no Frio, frequência do Quente.\nSemanal: fechar a hipótese da semana no ClickUp, subir os 3 criativos novos no Frio, replicar vencedor no Quente, repor gaveta', 'Igual'],
      ['Métrica de corte', 'Frio: CPA ou custo por conversa. Quente: CPA, com frequência como alarme (≥ 5 em 7 dias = trocar criativo). Sem conversão no período, CTR no link', 'CPL e custo por MQL. Quente: frequência ≥ 5 em 7 dias = trocar criativo'],
      ['Desligar', 'Só anúncio recebendo entrega. Gasto ≥ 2× a meta e (0 conversões ou custo ≥ 2× a meta). Nunca antes de 72h. Saturação: frequência ≥ 3,5 no Frio e ≥ 5 no Quente nos últimos 7 dias. Sempre com marcação de testado', 'Igual, com CPL e janela de 7 a 10 dias'],
      ['Escalar', '+20% no conjunto quando custo ≤ meta estável por 3 dias, até o teto da campanha. Verba pode migrar entre Frio e Quente (ex.: quente saturou → volta pro frio), sem passar de R$ 133/dia no total. Passou do teto = proposta de subir a faixa', 'Igual'],
      ['Report ao cliente', 'Resumo semanal por WhatsApp com vencedor da semana + relatório mensal com resultado separado Frio vs. Quente (custo por conversão de cada um) e o kit validado', 'Igual'],
      ['Condição de entrada', 'A regra de verba mínima por conjunto (≥ 2× CPL ideal/dia) precisa fechar no Quente e no Lookalike com R$ 30/dia: só cabe se o CPL ideal for de até R$ 15. Acima disso, usar a estrutura de R$ 3.000 com mais verba.', 'Igual, com R$ 33/dia no Quente (CPL ideal de até R$ 16).'],
    ],
    estrutura: {
      b2c: [
        {
          nome: 'Campanha 1', tipo: 'ABO', verba: 'R$ 80/dia', sub: 'Fundo Frio',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Amplo Advantage+ · R$ 50/dia', ads: ['AD 01-03 · sem. 1', 'AD 04-06 · sem. 2', 'AD 07-12 · sem. 3-4'], nota: 'Lab roda aqui · todos ativos · 6 de gaveta' },
            { nome: 'Conjunto 02', sub: 'Lookalike / interesses · R$ 30/dia', ads: ['Vencedor 01', 'Vencedor 02'] },
          ],
        },
        {
          nome: 'Campanha 2', tipo: 'ABO', verba: 'R$ 30/dia', sub: 'Fundo Quente',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Engajamento + site + conversa aberta', ads: ['Vencedor 01', 'Vencedor 02', 'Vencedor 03'], nota: 'copy de reencontro · frequência ≥ 5 em 7 dias = trocar criativo' },
          ],
        },
        {
          nome: 'Campanha 3', tipo: '', verba: 'R$ 23/dia', sub: 'Topo',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Visitas ao perfil / Video View', ads: ['AD 01', 'AD 02', 'AD 03'], nota: 'só se o cliente tiver conteúdo' },
          ],
        },
      ],
      b2b: [
        {
          nome: 'Campanha 1', tipo: 'ABO', verba: 'R$ 100/dia', sub: 'Fundo Frio',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Amplo + cargo · R$ 60/dia', ads: ['AD 01-03 · sem. 1', 'AD 04-06 · sem. 2', 'AD 07-12 · sem. 3-4'], nota: 'Lab roda aqui · todos ativos · 6 de gaveta' },
            { nome: 'Conjunto 02', sub: 'Lookalike / interesses · R$ 40/dia', ads: ['Vencedor 01', 'Vencedor 02'] },
          ],
        },
        {
          nome: 'Campanha 2', tipo: 'ABO', verba: 'R$ 33/dia', sub: 'Fundo Quente',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Engajamento + LP + leads sem MQL', ads: ['Vencedor 01', 'Vencedor 02', 'Vencedor 03'], nota: 'copy de reencontro · frequência ≥ 5 em 7 dias = trocar criativo' },
          ],
        },
      ],
      notas: {
        b2c: ['Vencedor do Conjunto 01 do Frio é replicado no Conjunto 02 e no Quente.', 'Topo só se o cliente tiver conteúdo; senão a verba vai pro Fundo Frio.'],
        b2b: ['Sem topo. Quente exclui MQLs e clientes. Objetivo: leads e MQL.'],
      },
    },
  },

  // ── R$ 5.000 ──────────────────────────────────────────────────────────────
  {
    id: '5k',
    label: 'R$ 5.000',
    verbaMensal: 5000,
    verbaDia: 166,
    resumo: 'No B2B entra o meio de funil (material rico ou webinar) alimentando um quente mais qualificado. No B2C a estrutura de R$ 4.000 ganha verba e o Google cabe em paralelo.',
    rows: [
      ['Verba diária', 'R$ 166', 'R$ 166'],
      ['Divisão da verba', '• Fundo Frio: R$ 100/dia (R$ 3.000/mês)\n• Fundo Quente: R$ 36/dia (R$ 1.080/mês)\n• Topo: R$ 30/dia (R$ 900/mês)', '• Meio de funil: R$ 66/dia (R$ 2.000/mês)\n• Fundo Frio: R$ 60/dia (R$ 1.800/mês)\n• Fundo Quente: R$ 40/dia (R$ 1.200/mês)\n• Sem topo'],
      ['Tipo de funil de captação', '• Funil de WhatsApp ou\n• Funil de LP curta', '• Funil de material rico (e-book, checklist, planilha, diagnóstico) ou\n• Funil de webinar (1 por mês)\n+ Funil de LP com formulário no fundo'],
      ['Estrutura', 'Campanha 1: Fundo Frio ABO (R$ 100/dia)\nConjunto 1: Amplo Advantage+ (R$ 60/dia), o Lab roda aqui\nConjunto 2: Lookalike ou interesses (R$ 40/dia)\nCampanha 2: Fundo Quente ABO (R$ 36/dia)\nConjunto 1: engajamento 30 a 90 dias + visitantes site/LP + conversa aberta sem compra\nCampanha 3: Topo Visitas ao perfil ou Video View (R$ 30/dia), só com conteúdo', 'Campanha 1: Meio de funil ABO (R$ 66/dia), objetivo Leads\nConjunto 1: Amplo com cargo/segmento (R$ 40/dia), o Lab roda aqui\nConjunto 2: Lookalike de clientes/leads ou interesses do setor (R$ 26/dia)\nDestino: LP de captura do material ou LP de inscrição do webinar\nCampanha 2: Fundo Frio ABO (R$ 60/dia)\nConjunto 1: Amplo com cargo/segmento, LP de aplicação direta / formulário\nCampanha 3: Fundo Quente ABO (R$ 40/dia)\nConjunto 1: quem baixou o material ou se inscreveu no webinar (30 a 60 dias) + engajamento + visitantes LP + leads sem MQL. Destino: LP de reunião/diagnóstico ou WhatsApp comercial'],
      ['Meio de funil (B2B)', 'Não faz. Em B2C o "meio" é o topo com conteúdo', 'Material rico: roda contínuo. Vale só se ≥ 10% dos leads de material viram MQL em 30 dias; abaixo disso, desliga e a verba volta pro Fundo Frio.\nWebinar: 1 por mês. Campanha de inscrição roda 10 a 14 dias antes com os R$ 66/dia; nos 3 dias antes do evento, R$ 20/dia viram lembrete pro público de inscritos; após o evento, 7 dias de replay + oferta no Quente.\nMeta de custo: CPL de meio ≤ 1/3 do CPL de fundo. Ex.: CPL fundo R$ 60 → material/inscrição até R$ 20'],
      ['Canais', 'Meta + Google Search em paralelo, se já existe busca pelo produto. O Google usa até R$ 30/dia tirados do Frio (Conjunto 2), CPC até R$ 3,00. Topo continua', 'Meta + Google Search em paralelo pela mesma regra, com até R$ 30/dia do Fundo Frio. Em B2B com busca ativa (software, fornecedor, consultoria), o Google entra por padrão'],
      ['Orçamento', 'ABO nas campanhas de fundo. Topo em CBO', 'ABO nas três campanhas'],
      ['Conjuntos', 'Fundo Frio: 2. Quente: 1. Topo: 1.\nRegra: cada conjunto ≥ 2× CPL ideal por dia; o que não atingir some e a verba vai pro Conjunto 1 do Frio', 'Meio: 2. Fundo Frio: 1. Quente: 1.\nMesma regra (no meio, a referência é o CPL de material/inscrição)'],
      ['Públicos', 'Frio: Amplo Advantage+ + Lookalike (base ≥ 1.000 eventos ou lista) ou interesses.\nQuente: engajamento, visitantes, conversa aberta. Excluir compradores', 'Meio e Frio: amplo com cargo/segmento + lookalike de clientes ou interesses do setor.\nQuente: leads de material/webinar + engajamento + visitantes LP + leads sem MQL. Excluir MQLs e clientes de tudo'],
      ['Objetivo', 'Fundo: vendas (WhatsApp ou LP). Topo: audiência + seguidor', 'Meio: leads de material/inscritos. Fundo: leads, MQL e reunião'],
      ['Laboratório', 'Testar 3 criativos por semana, 12 no mês, no Conjunto 1 do Frio. 6 de gaveta.\nCritério de vencedor: gasto ≥ 2× a meta e custo abaixo da meta.\nVencedor replicado no Conjunto 2 e no Quente com copy de reencontro', 'Lab roda no Conjunto 1 do Meio (é onde tem mais volume de conversão). 3 criativos/semana, 6 de gaveta, mesmo critério.\nVencedor de ângulo é adaptado pro Fundo Frio (mesma promessa, CTA de reunião) e pro Quente (copy de reencontro: "você baixou o material, agora...").\nWebinar: 3 criativos de inscrição por edição, testados nos primeiros 4 dias'],
      ['Criativos ativos por conjunto', 'Frio Conjunto 1: até 12 ativos, o Meta escolhe. Conjunto 2 e Quente: 3 a 4 vencedores.\nRegra de otimização: desliga o que passar de 2× o CPA ideal com gasto mínimo, marca testado, sobe um da gaveta.\nNunca desligar o que o Meta não priorizou', 'Meio Conjunto 1: até 12 ativos. Meio Conjunto 2, Fundo Frio e Quente: 3 a 4 vencedores. Mesma regra, com CPL'],
      ['Novos criativos por mês', '3 por semana, até 12/mês + 6 de gaveta', '3 por semana, até 12/mês + 6 de gaveta, + 3 de inscrição por webinar'],
      ['Marcação de testado', 'Obrigatória ao desligar: sufixo _TESTADO + registro no ClickUp com o resultado', 'Igual'],
      ['Destino', 'WhatsApp ou LP curta', 'Meio: LP de captura ou inscrição (com pixel de Lead). Fundo: LP com formulário. Quente: LP de reunião/diagnóstico ou WhatsApp comercial'],
      ['Rotina', 'Diária (20 min): gasto por campanha e conjunto, anomalias, quem o Meta prioriza no Frio, frequência do Quente.\nSemanal: hipótese da semana, 3 criativos novos, replicar vencedor, repor gaveta', 'Igual + semanal: taxa lead de meio → MQL (do CRM ou Área do Cliente), pra decidir se o meio continua.\nWebinar: calendário de 30 dias (inscrição → lembrete → evento → replay)'],
      ['Métrica de corte', 'Frio: CPA ou custo por conversa. Quente: CPA + frequência ≥ 5 em 7 dias = trocar. Sem conversão, CTR no link', 'Meio: CPL de material/inscrição e taxa de conversão da LP (20 a 50%; abaixo de 20% o problema é a LP, não o anúncio).\nFundo: CPL e custo por MQL. Quente: custo por reunião + frequência ≥ 5'],
      ['Desligar', 'Só anúncio recebendo entrega. Gasto ≥ 2× a meta e (0 conversões ou custo ≥ 2× a meta). Nunca antes de 72h. Frequência ≥ 3,5 no Frio, ≥ 5 no Quente', 'Igual. No Meio a meta é o CPL de material; no Fundo, o CPL/MQL; janela de 7 a 10 dias'],
      ['Escalar', '+20% no conjunto com custo ≤ meta estável por 3 dias, até o teto da campanha. Verba migra entre Frio, Quente e Google sem passar de R$ 166/dia', 'Igual. Se o meio entrega MQL mais barato que o fundo por 2 semanas, migra verba do Fundo Frio pro Meio (até 50/50). Se o contrário, o meio encolhe até R$ 40/dia ou desliga'],
      ['Expectativa', 'R$ 3.000 do Frio ÷ CPA ideal + o que o Quente converter. Ex.: CPA R$ 80 → ~37 vendas do frio', 'Meio: R$ 2.000 ÷ R$ 20 = ~100 leads de material/inscritos, 10% em MQL = ~10 MQL.\nFundo: R$ 1.800 ÷ R$ 60 = ~30 leads.\nQuente: reuniões com custo abaixo do fundo'],
      ['Report ao cliente', 'Resumo semanal por WhatsApp + relatório mensal com Frio vs. Quente vs. Google e o kit validado', 'Igual + o funil completo: leads de meio → MQL → reunião, com custo por etapa. Webinar: inscritos, presença, reuniões geradas'],
      ['Condição de entrada', '', 'O cliente precisa ter o material rico pronto (ou capacidade de fazer 1 webinar/mês) e o time comercial fazendo follow-up dos leads de meio em até 24h. Sem isso, o meio só gera lead barato que ninguém trabalha, e a estrutura certa é a de R$ 4.000 com mais verba'],
    ],
    estrutura: {
      b2c: [
        {
          nome: 'Campanha 1', tipo: 'ABO', verba: 'R$ 100/dia', sub: 'Fundo Frio',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Amplo Advantage+ · R$ 60/dia', ads: ['AD 01-03 · sem. 1', 'AD 04-06 · sem. 2', 'AD 07-12 · sem. 3-4'], nota: 'Lab roda aqui · todos ativos · 6 de gaveta' },
            { nome: 'Conjunto 02', sub: 'Lookalike · R$ 40/dia', ads: ['Vencedor 01', 'Vencedor 02'] },
          ],
        },
        {
          nome: 'Campanha 2', tipo: 'ABO', verba: 'R$ 36/dia', sub: 'Fundo Quente',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Engajamento + site + conversa', ads: ['Vencedor 01', 'Vencedor 02', 'Vencedor 03'], nota: 'copy de reencontro · frequência ≥ 5 em 7 dias = trocar' },
          ],
        },
        {
          nome: 'Campanha 3', tipo: '', verba: 'R$ 30/dia', sub: 'Topo',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Visitas ao perfil / Video View', ads: ['AD 01', 'AD 02', 'AD 03'] },
          ],
        },
        {
          nome: 'Google Search', tipo: '', verba: 'até R$ 30/dia', sub: 'paralelo (opcional)', opcional: true,
          conjuntos: [
            { nome: 'Grupos de anúncio', sub: 'só se já existe busca pelo produto', opcional: true, ads: ['AD 01', 'AD 02'], nota: 'verba sai do Conjunto 02 do Frio' },
          ],
        },
      ],
      b2b: [
        {
          nome: 'Campanha 1', tipo: 'ABO', verba: 'R$ 66/dia', sub: 'Meio · Leads',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Amplo + cargo · R$ 40/dia', ads: ['AD 01-03 · sem. 1', 'AD 04-06 · sem. 2', 'AD 07-12 · sem. 3-4'], nota: 'Lab roda aqui · LP de material rico ou inscrição no webinar' },
            { nome: 'Conjunto 02', sub: 'Lookalike · R$ 26/dia', ads: ['Vencedor 01', 'Vencedor 02'] },
          ],
        },
        {
          nome: 'Campanha 2', tipo: 'ABO', verba: 'R$ 60/dia', sub: 'Fundo Frio',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Amplo + cargo', ads: ['Vencedor 01', 'Vencedor 02', 'Vencedor 03'], nota: 'mesma promessa do meio, CTA de reunião · LP de aplicação' },
          ],
        },
        {
          nome: 'Campanha 3', tipo: 'ABO', verba: 'R$ 40/dia', sub: 'Fundo Quente',
          conjuntos: [
            { nome: 'Conjunto 01', sub: 'Leads do meio + engajamento + LP', ads: ['Vencedor 01', 'Vencedor 02', 'Vencedor 03'], nota: 'copy de reencontro · LP de reunião ou WhatsApp comercial' },
          ],
        },
      ],
      notas: {
        b2c: ['Vencedor do Conjunto 01 do Frio é replicado no Conjunto 02 e no Quente.'],
        b2b: ['Quem converteu no Meio (baixou material / inscreveu no webinar) vira público do Quente.', 'Sem topo. Meio só continua se ≥ 10% dos leads viram MQL em 30 dias.'],
      },
    },
  },
]
