// Kickoff: perguntas do diagnóstico, pilares, estágios e próximos passos (KickoffQuestions.js; também no portal)
export default {
  pilares: {
    margem_lucro: {
      label: 'Margem de lucro',
      short: 'Margem',
    },
    oferta_entrada: {
      label: 'Oferta de entrada',
      short: 'Oferta entrada',
    },
    conjunto_ofertas: {
      label: 'Conjunto de ofertas',
      short: 'Recompra',
    },
    grande_promessa: {
      label: 'Grande promessa',
      short: 'Promessa',
    },
    posicionamento: {
      label: 'Posicionamento',
      short: 'Posicionamento',
    },
    autoridade: {
      label: 'Autoridade no mercado',
      short: 'Autoridade',
    },
    processo_comercial: {
      label: 'Processo comercial',
      short: 'Comercial',
    },
    funil_previsivel: {
      label: 'Funil previsível',
      short: 'Funil',
    },
    empilhamento_canais: {
      label: 'Empilhamento de canais',
      short: 'Canais',
    },
  },
  estagios: {
    '0': {
      label: 'Caos',
      desc: 'Negócio sem fundação estruturada — várias frentes simultâneas a atacar.',
    },
    '1': {
      label: 'Validação',
      desc: 'Tem produto e algumas vendas, mas sem previsibilidade nem processos.',
    },
    '2': {
      label: 'Estruturação',
      desc: 'Bases comerciais existem; falta padronizar e empilhar canais.',
    },
    '3': {
      label: 'Aceleração',
      desc: 'Pronto para escalar — funis previsíveis, oferta validada.',
    },
    '4': {
      label: 'Escala',
      desc: 'Negócio maduro, com canais empilhados e ofertas estruturadas.',
    },
  },
  perguntas: {
    modelo_produto: {
      label: 'Qual é o modelo do produto/serviço?',
      hint: 'Vai ajudar a definir quais tipos de funil fazem mais sentido pra esse cliente.',
      opcoes: {
        ecommerce: 'E-commerce / produto físico online',
        whatsapp: 'Venda via WhatsApp',
        saas: 'SaaS / Software como serviço',
        servicos: 'Prestador de serviços',
        consultoria: 'Consultoria / Assessoria',
        infoproduto: 'Infoproduto / curso online',
        coach: 'Coach / Mentor',
        outro: 'Outro',
      },
    },
    grande_promessa: {
      label: 'Qual é a grande promessa do seu produto/serviço?',
      hint: 'Idealmente específica, mensurável e com prazo. Ex: "Triplicamos o ROI do seu tráfego em 90 dias".',
    },
    porque_voce: {
      label: 'Por que o cliente deve escolher a sua empresa e não a do concorrente?',
      hint: 'Liste os diferenciais concretos — experiência, metodologia, resultados, especialização, garantia, tecnologia, etc. Quanto mais específico e múltiplos motivos, melhor.',
    },
    concorrentes: {
      label: 'Quem são seus 3 principais concorrentes?',
      hint: 'Um por linha. Quanto mais específico, melhor.',
    },
    cliente_ideal_qualificado: {
      label: 'Quem é o cliente ideal e o que valida claramente que geramos um lead qualificado?',
      hint: 'Descreva o perfil (cargo, segmento, tamanho/faturamento, dor principal) + os critérios objetivos que tornam um lead pronto pra venda. Ex.: "Gestor de tráfego de e-commerce com R$50k+/mês de faturamento, que já investe em Meta Ads e quer escalar — qualificado se tem cargo decisor e budget mínimo de R$10k/mês".',
    },
    margem_bruta: {
      label: 'Qual a margem bruta média por venda/contrato?',
      hint: 'Margem BRUTA = (Receita - Custo direto do produto/serviço) / Receita. Considera só o que é diretamente atribuível à entrega (ex: matéria-prima, mão de obra de execução, taxa de plataforma). NÃO subtrai custos administrativos, salários fixos, aluguel ou marketing — isso é margem LÍQUIDA. Queremos a BRUTA porque é ela que define quanto sobra pra investir em aquisição (marketing/tráfego).',
      unknownLabel: 'Não sei calcular',
    },
    ticket_medio: {
      label: 'Qual o ticket médio das suas vendas?',
      hint: 'Valor médio por venda/contrato fechado.',
    },
    faturamento_mensal: {
      label: 'Qual foi o faturamento do último mês?',
      hint: 'Receita total no mês anterior — soma de todas as vendas/contratos.',
    },
    cac_ltv: {
      label: 'Qual o CAC máximo que você está disposto a pagar por cliente?',
      hint: 'CAC máximo aceitável = o teto de quanto custar uma aquisição mantendo o negócio saudável (regra prática: CAC < 1/3 do LTV). Esse número é o que define a previsibilidade do funil — sem ele, a cada real investido em tráfego você não sabe se ainda está no positivo. É ele que estabelece o teto de CPL em cada canal e o ponto em que escalar deixa de ser rentável. Se não tiver esse número, deixe em branco e priorize calcular antes da próxima rodada de investimento.',
    },
    conteudo: {
      label: 'Você produz conteúdo orgânico regularmente?',
      opcoes: {
        forte: 'Sim, semanalmente em 2+ canais',
        medio: 'Sim, esporadicamente em 1 canal',
        nenhum: 'Não produzo',
      },
    },
    lead_magnet: {
      label: 'Você tem isca digital / lead magnet (eBook, webinar, kit, amostra)?',
      descriptionLabel: 'Descreva a isca atual',
      descriptionPlaceholder: 'Ex: eBook sobre tráfego pago captado via formulário no site...',
      opcoes: {
        sim: 'Sim',
        nao: 'Não',
      },
    },
    investimento_passado: {
      label: 'Quanto investiu em tráfego no mês passado?',
      hint: 'Some Meta + Google + outras plataformas no mês anterior.',
    },
    investimento_futuro: {
      label: 'Quanto pretende investir em tráfego por mês conosco?',
      hint: 'Budget mensal estimado de mídia paga / aquisição daqui pra frente.',
    },
    canais_ativos: {
      label: 'Quais canais de aquisição você usa hoje? (marque todos)',
      opcoes: {
        meta: 'Meta Ads',
        google: 'Google Ads',
        tiktok: 'TikTok Ads',
        linkedin: 'LinkedIn Ads',
        youtube: 'YouTube Ads',
        organico: 'Orgânico (IG/TT/YT)',
        email: 'Email marketing',
        whatsapp: 'WhatsApp / SMS',
        indicacao: 'Indicação',
        outbound: 'Outbound / cold',
        eventos: 'Eventos',
        influencia: 'Influenciadores',
      },
    },
    oferta_entrada: {
      label: 'Você tem alguma oferta de entrada, garantia ou bônus diferenciado pra captar a primeira venda?',
      hint: 'Conta como oferta de entrada: preço promocional, kit/combo, trial/demo, garantia incondicional, bônus exclusivo na primeira compra, frete grátis, etc.',
      descriptionLabel: 'Descreva a oferta de entrada',
      descriptionPlaceholder: 'Ex: 30% off na primeira compra + frete grátis + garantia de 7 dias...',
      opcoes: {
        sim_testada: 'Sim, estruturada e testada',
        sim: 'Sim, mas não testada',
        nao: 'Não tenho',
      },
    },
    b2b_demanda: {
      label: 'Como você gera demanda hoje? (processo atual, marque todos)',
      opcoes: {
        outbound: 'Outbound / Cold call',
        inbound: 'Inbound (orgânico + ads)',
        eventos: 'Eventos / palestras',
        parceria: 'Parcerias / canais',
        indicacao: 'Indicação',
        nenhum: 'Não tenho processo',
      },
    },
    b2b_clientes_base: {
      label: 'Quantos clientes ativos tem na base hoje?',
    },
    b2b_recompra: {
      label: 'Seu modelo de negócio tem recompra ou recorrência?',
      opcoes: {
        recorrente: 'Recorrência mensal/anual (SaaS, contrato)',
        recompra: 'Recompra natural (consumível)',
        unica: 'Compra única',
      },
    },
    b2b_precificacao: {
      label: 'Como você precifica seu produto/serviço hoje?',
      opcoes: {
        valor: 'Baseado em valor entregue (ROI)',
        hora: 'Baseado em hora/projeto',
        mercado: 'Cópia da concorrência',
        unknown: 'Não sei bem',
      },
    },
    b2b_crm: {
      label: 'Onde você gerencia sua base de clientes hoje?',
      opcoes: {
        crm: 'CRM dedicado (RD, Pipedrive, HubSpot, Salesforce)',
        planilha: 'Planilha estruturada',
        whats: 'WhatsApp / email / memória',
      },
    },
    b2b_ciclo_venda: {
      label: 'Qual o ciclo médio de venda em dias?',
      hint: 'Da entrada do lead ao fechamento.',
    },
    b2b_processo_comercial: {
      label: 'Qual seu processo comercial após o lead entrar?',
      opcoes: {
        sdr_closer: 'SDR qualifica, closer fecha, etapas no CRM',
        unico: 'Vendedor único cuida do ciclo todo',
        nenhum: 'Não tenho processo definido',
      },
    },
    b2b_taxas_conversao: {
      label: 'Você conhece as taxas de conversão do seu funil (lead→MQL→SQL→venda)?',
      descriptionLabel: 'Informe as taxas atuais (em %)',
      opcoes: {
        sim: 'Sim',
        nao: 'Não',
      },
      sub: {
        lead_mql: {
          label: 'Lead → MQL',
          placeholder: 'Ex: 30',
        },
        mql_sql: {
          label: 'MQL → SQL',
          placeholder: 'Ex: 50',
        },
        sql_venda: {
          label: 'SQL → Venda',
          placeholder: 'Ex: 25',
        },
      },
    },
    b2c_demanda: {
      label: 'Como você gera demanda hoje? (marque todos)',
      opcoes: {
        meta: 'Meta Ads',
        google: 'Google Shopping',
        influencia: 'Influenciadores',
        email: 'Email / WhatsApp',
        indicacao: 'Indicação',
        fisica: 'Loja física',
        nenhum: 'Não tenho processo',
      },
    },
    b2c_clientes_base: {
      label: 'Quantos clientes ativos tem na base?',
    },
    b2c_atendimento: {
      label: 'Qual seu processo de atendimento ao cliente?',
      opcoes: {
        dedicado: 'Equipe dedicada com SLA + script',
        proprio: 'Atendimento próprio sem padrão',
        reativo: 'Reativo, conforme aparece',
      },
    },
    b2c_recompra: {
      label: 'Seu produto permite recompra? Como você estimula isso hoje?',
      opcoes: {
        fidelidade: 'Sim, com programa de fidelidade/recorrência',
        email: 'Sim, com email/WhatsApp pós-venda',
        passivo: 'Sim, mas não estimulo',
        nao_permite: 'Não permite recompra',
      },
    },
    b2c_upsell: {
      label: 'Você tem ofertas de upsell/cross-sell no checkout ou pós-venda?',
      descriptionLabel: 'Quais ofertas?',
      descriptionPlaceholder: 'Ex: Cross-sell de acessórios no checkout, email com produto complementar 7 dias após compra...',
      opcoes: {
        sim: 'Sim',
        nao: 'Não',
      },
    },
    b2c_frequencia_recompra: {
      label: 'Qual sua frequência média de recompra (em dias)?',
      hint: 'Deixe em branco se não permite recompra.',
    },
  },
  proximosPassos: {
    margem_lucro: {
      b2b: 'Mapear CAC e LTV por canal nos próximos 30 dias; revisar precificação baseada em valor entregue.',
      b2c: 'Calcular margem por SKU, identificar produtos âncora vs sangradores e reprecificar o portfólio.',
      hibrido: 'Mapear margem por linha de receita e CAC/LTV por canal; reprecificar com base em valor entregue.',
    },
    oferta_entrada: {
      b2b: 'Estruturar uma oferta de entrada (POC, projeto-piloto ou trial 14d) com escopo, prazo e garantia.',
      b2c: 'Lançar uma oferta de entrada testável (kit/desconto/garantia) e validar com 2 anúncios em A/B por 14 dias.',
      hibrido: 'Criar duas ofertas de entrada (uma B2B, uma B2C) com gatilho de urgência e teste A/B em 30 dias.',
    },
    conjunto_ofertas: {
      b2b: 'Estruturar plano de upsell/cross-sell e pacotes recorrentes; implementar QBR pra retenção.',
      b2c: 'Implementar fluxo de pós-venda (email + WhatsApp) com upsell, programa de fidelidade e cross-sell no checkout.',
      hibrido: 'Mapear oportunidades de recompra em ambas as linhas e lançar 1 upsell por linha nos próximos 60 dias.',
    },
    grande_promessa: {
      b2b: 'Reescrever a promessa com métrica + prazo + garantia; validar com 5 clientes atuais.',
      b2c: 'Reescrever a promessa com benefício específico + prazo + prova social; testar em 2 criativos.',
      hibrido: 'Definir uma promessa única por linha de negócio e padronizar em site, ads e materiais comerciais.',
    },
    posicionamento: {
      b2b: 'Definir nicho de atuação e ICP (Ideal Customer Profile); mapear 3 concorrentes e diferenciais claros.',
      b2c: 'Construir narrativa de marca e diferenciais visuais/verbais; auditar concorrência diretamente.',
      hibrido: 'Posicionar cada linha com proposta única; mapear ICP B2B e persona B2C separadamente.',
    },
    autoridade: {
      b2b: 'Plano editorial de 12 semanas no LinkedIn + 1 isca digital (eBook ou webinar) lançado em 30 dias.',
      b2c: 'Calendário de conteúdo orgânico (IG/TikTok) 3x por semana + 1 lead magnet (kit, amostra) em 30 dias.',
      hibrido: 'Plano editorial duplo: LinkedIn pro B2B, IG/TT pro B2C; 1 lead magnet por linha em 45 dias.',
    },
    processo_comercial: {
      b2b: 'Implementar CRM, definir etapas do funil, criar SLA SDR↔Closer e dashboard semanal de pipeline.',
      b2c: 'Padronizar atendimento com script, SLA de resposta (<5 min) e ferramenta única (WhatsApp Business + planilha).',
      hibrido: 'CRM unificado com pipelines separados; processo comercial por linha + dashboard mensal de conversão.',
    },
    funil_previsivel: {
      b2b: 'Investir em mídia paga (Meta + LinkedIn) com R$15k+/mês e medir CAC por canal nos próximos 90 dias.',
      b2c: 'Aumentar investimento em Meta + Google Shopping; medir ROAS por anúncio e por SKU semanalmente.',
      hibrido: 'Distribuir budget entre canais B2B e B2C; tracking de funil com origem por canal em 30 dias.',
    },
    empilhamento_canais: {
      b2b: 'Adicionar 2 canais (ex: LinkedIn Ads + Email outbound) e testar por 60 dias com tracking dedicado.',
      b2c: 'Adicionar 2 canais (ex: TikTok + Email + Influência) e validar performance por 60 dias.',
      hibrido: 'Empilhar canais por linha: B2B (LinkedIn, Outbound, Eventos) + B2C (Meta, TikTok, Influência).',
    },
  },
  // Oferta Matadora do Kickoff (KickoffOfertaMatadora.js)
  om: {
    pilares: {
      dor_latente: {
        label: 'Dor latente do lead',
        short: 'Dor latente',
        desc: 'A dor que seu produto resolve precisa ser sentida no dia a dia — não algo que o lead descobre só quando o vendedor explica.',
      },
      poder_compra: {
        label: 'Poder de compra do público',
        short: 'Poder de compra',
        desc: 'Sem capacidade financeira, a melhor oferta do mundo não converte.',
      },
      encontrar_online: {
        label: 'Facilidade de encontrar o público online',
        short: 'Segmentável',
        desc: 'Se Meta/Google/LinkedIn não conseguem segmentar bem o público, escalar é caro demais.',
      },
      mercado_expansao: {
        label: 'Mercado em expansão',
        short: 'Mercado',
        desc: 'Mercados crescendo permitem entrada agressiva; em mercados estagnados, ofertas matadoras canibalizam concorrentes — muito mais difícil.',
      },
      consciencia_autoridade: {
        label: 'Baixa consciência + baixa autoridade',
        short: 'Consciência/Autoridade',
        desc: 'Oferta matadora brilha quando o público ainda não sabe da solução E a marca não é referência. Em mercados maduros com marcas líderes, o jogo muda.',
      },
    },
    vereditos: {
      cabe: {
        label: 'Cabe! Oferta matadora é a estratégia certa',
        short: 'Cabe',
        desc: 'O cenário do cliente bate em todos os pilares. Estruture uma oferta agressiva com garantia, prazo e prova social — vai vender.',
      },
      talvez: {
        label: 'Talvez — funciona com ajustes',
        short: 'Talvez',
        desc: 'Existem brechas em pelo menos um pilar. Vale testar uma oferta matadora num público mais nichado, ou corrigir os pontos fracos antes de escalar.',
      },
      nao_cabe: {
        label: 'Outras estratégias funcionam melhor',
        short: 'Não cabe',
        desc: 'O contexto não favorece oferta matadora. Foque em construção de autoridade, conteúdo educativo, prova social e mid-funnel antes de tentar a oferta agressiva.',
      },
    },
    perguntas: {
      om_dor_latente: {
        label: 'Quão latente é a dor que o produto/serviço resolve?',
        hint: 'Latente = o lead já reclama dela hoje, sem precisar de ninguém apontar.',
        opcoes: {
          aguda: 'Dor aguda — tira o sono do lead, ele busca solução ativamente',
          percebida: 'Percebida — o lead reclama disso quando provocado',
          media: 'Média — o lead concorda quando explicada, mas não busca',
          baixa: 'Baixa — precisa de muita educação pra o lead reconhecer',
          inexistente: 'Inexistente — produto resolve algo que ninguém pede',
        },
      },
      om_poder_compra: {
        label: 'Qual o poder de compra típico do público-alvo?',
        opcoes: {
          alto_b2b: 'B2B — empresa com R$1M+ de faturamento anual',
          alto_b2c: 'B2C classe A/AA — compra valor sem pestanejar',
          medio_b2b: 'B2B — empresa menor, compara investimento com cuidado',
          medio_b2c: 'B2C classe B — compara preço, parcelamento ajuda',
          baixo_b2c: 'B2C classe C/D — sensível a preço, ticket baixo',
          desconhecido: 'Difícil precificar / poder variável',
        },
      },
      om_encontrar_online: {
        label: 'Quão facilmente o público é encontrado/segmentado online?',
        hint: 'Pense em interesses no Meta, palavras-chave no Google, cargos no LinkedIn.',
        opcoes: {
          super: 'Super segmentável — interesses, cargos ou keywords claras',
          bom: 'Razoável — alguns sinais de comportamento, dá pra mirar',
          fraco: 'Fraco — público disperso, sem sinal claro de intenção',
          invisivel: 'Quase invisível — só por indicação ou offline',
        },
      },
      om_mercado_expansao: {
        label: 'Em que momento o mercado está?',
        opcoes: {
          forte_expansao: 'Forte expansão — surgindo novos players, demanda crescente',
          moderada: 'Crescimento moderado — mercado saudável, sem boom',
          estavel: 'Estável — sem grandes mudanças nos últimos anos',
          retracao_leve: 'Em retração leve',
          retracao_forte: 'Em retração forte / setor em declínio',
        },
      },
      om_consciencia: {
        label: 'Qual o nível de consciência do público sobre o problema/solução?',
        hint: 'Oferta matadora brilha quando o público AINDA NÃO sabe da solução — você cria a urgência.',
        opcoes: {
          inconsciente: 'Inconsciente — não sabe que tem o problema',
          problema: 'Consciente do problema — não sabe que existe solução',
          solucao: 'Consciente da solução — não conhece marcas',
          produto: 'Comparando produtos/marcas',
          pronto: 'Cliente já decidiu, só precisa fechar',
        },
      },
      om_autoridade: {
        label: 'Qual o nível de autoridade da marca no mercado?',
        hint: 'Em mercados com marcas dominantes, oferta matadora costuma sangrar dinheiro.',
        opcoes: {
          desconhecida: 'Desconhecida — está começando agora',
          pouca: 'Pouca autoridade — alguns clientes conhecem',
          media: 'Autoridade média — nicho conhece, mainstream não',
          consolidada: 'Marca consolidada — referência no segmento',
          lider: 'Líder de categoria — todo mundo conhece',
        },
      },
    },
    justificativas: {
      favoravel: {
        tag: 'Favorável',
        dor_latente: 'A dor é forte o suficiente pra justificar uma oferta agressiva com gatilho de urgência.',
        poder_compra: 'O público tem capacidade financeira pra absorver a oferta no ticket cheio.',
        encontrar_online: 'Segmentação clara — escalar mídia paga é viável e barato.',
        mercado_expansao: 'Mercado crescendo cria espaço pra entrada agressiva sem canibalizar muito.',
        consciencia_autoridade: 'Cenário ideal: público não conhece a categoria e a marca tem espaço pra criar a narrativa.',
      },
      atencao: {
        tag: 'Atenção',
        dor_latente: 'Dor não está totalmente latente. Vai precisar educar o lead antes de apresentar a oferta.',
        poder_compra: 'Poder de compra limita o ticket. Considere parcelamento ou ticket menor.',
        encontrar_online: 'Segmentação parcial. Vai gastar mais em mídia até calibrar.',
        mercado_expansao: 'Mercado morno. Oferta matadora ainda funciona, mas concorrência reage rápido.',
        consciencia_autoridade: 'Público em transição. A oferta precisa educar e converter ao mesmo tempo.',
      },
      risco: {
        tag: 'Risco',
        dor_latente: 'Sem dor latente, oferta matadora vira ruído. Foque em conteúdo educativo primeiro.',
        poder_compra: 'Sem poder de compra, qualquer oferta vai bater no muro do "não tenho dinheiro".',
        encontrar_online: 'Público difícil de encontrar online — escalar fica caríssimo. Outros canais podem render mais.',
        mercado_expansao: 'Mercado em retração ou estagnado. Oferta agressiva canibaliza margem sem ganhar share.',
        consciencia_autoridade: 'Público maduro com marcas fortes. Oferta matadora é jogada arriscada — invista em diferenciação.',
      },
    },
  },
}
