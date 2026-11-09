// Kickoff: funis recomendados (catálogo FUNNELS, razões e painel; FUNNELS também na Central de anúncios e de LPs)
export default {
  painel: {
    titulo: 'Funis recomendados pra esse cliente',
    compativeis: { one: '{count} compatível com o diagnóstico', other: '{count} compatíveis com o diagnóstico' },
    semSinais: 'Sem sinais suficientes pra recomendar um funil específico.',
    semSinaisDica: 'Preencha o “Modelo do produto/serviço” e a análise de Oferta Matadora (acima) pra desbloquear as recomendações.',
    recomendados: 'Recomendados pra começar',
    considerar: 'Também vale considerar',
    match: 'match {n}',
    porQue: 'Por que faz sentido aqui',
  },
  funis: {
    webinar: {
      label: 'Funil de Webinar',
      desc: 'Ideal pra produtos/serviços com baixa consciência do lead e marcas que ainda não são autoridade. O webinar prende o lead por horas e constrói confiança.',
    },
    diagnostico: {
      label: 'Funil de Diagnóstico',
      desc: 'Excelente pra SaaS que querem agendar demonstração e pra empresas B2B que entregam diagnóstico específico (ex: saúde financeira da empresa).',
    },
    webinar_pago: {
      label: 'Funil de Webinar Pago',
      desc: 'Funcionou muito bem pra infoprodutores e coaches/mentores que querem qualificar a audiência cobrando uma entrada simbólica.',
    },
    vsl: {
      label: 'Funil de VSL',
      desc: 'Alternativa ao webinar. Brilha quando o lead já tem dor latente mas ainda não conhece uma solução específica pro problema dele.',
    },
    lancamento: {
      label: 'Funil de Lançamento',
      desc: 'Estratégia clássica de infoprodutos. Constrói antecipação, faz o lead chegar quente no carrinho e maximiza conversão em janela curta.',
    },
    wymb: {
      label: 'Funil Win-Your-Money-Back',
      desc: 'Excelente pra prestadores de serviços: garantia de devolução total se o cliente não tiver o resultado prometido. Quebra objeção de risco com força.',
    },
    aplicacao: {
      label: 'Funil de Aplicação',
      desc: 'Pra marcas que já têm autoridade e querem filtrar leads antes de mandar pro comercial. Funciona bem em ticket alto B2B.',
    },
    ecommerce: {
      label: 'Funil de E-commerce',
      desc: 'Estrutura padrão pra venda direta de produtos físicos online: anúncio → produto → checkout → upsell.',
    },
    isca_digital: {
      label: 'Funil de Isca Digital',
      desc: 'Roda em paralelo a outro funil que já está performando. Capta leads via material gratuito (eBook, kit, planilha) pro comercial trabalhar.',
    },
    quiz: {
      label: 'Funil de Quiz',
      desc: 'Indicado pra empresas B2B que querem diagnosticar o lead enquanto coletam mais informações pra qualificação posterior.',
    },
    whatsapp: {
      label: 'Funil de Mensagem no WhatsApp',
      desc: 'O funil do negócio local: o anúncio abre a conversa direto (click-to-WhatsApp) ou a página só tem botões que levam ao WhatsApp, sem formulário. A venda acontece no atendimento.',
    },
    desafio: {
      label: 'Funil de Desafio',
      desc: 'Funciona pra prestadores de serviços, coaches e mentores. Engaja o lead num desafio de poucos dias e gera prova social ao vivo.',
    },
  },
  razoes: {
    webinar: {
      baixaConsciencia: 'Lead com baixa consciência do problema/solução',
      baixaAutoridade: 'Marca ainda construindo autoridade',
      consultoria: 'Consultoria/assessoria educa o lead enquanto vende',
      whatsapp: 'Aquecimento antes da conversa no WhatsApp',
    },
    diagnostico: {
      saas: 'Modelo SaaS — diagnóstico ajuda a marcar demo',
      servicos: 'Serviços B2B podem entregar diagnóstico inicial',
      consultoria: 'Consultoria/assessoria vive de diagnosticar — entrega de valor antecipada',
    },
    webinar_pago: {
      infoproduto: 'Infoprodutos respondem bem ao filtro de webinar pago',
      coach: 'Coaches/mentores filtram bem com webinar pago',
      consultoria: 'Filtro premium pode pré-qualificar audiência de consultoria',
    },
    vsl: {
      dorLatente: 'Lead com dor latente sem conhecer solução específica',
      infoCoach: 'Modelo combina com VSL pra qualificar',
      consultoria: 'VSL educativo apresenta o método de consultoria',
    },
    lancamento: {
      infoproduto: 'Estratégia clássica de infoprodutos',
      coach: 'Mentorias respondem bem a lançamentos',
      whatsapp: 'Lista de transmissão WhatsApp é tração natural pra lançamento',
    },
    wymb: {
      servicos: 'Prestadores de serviços conseguem entregar garantia total',
      consultoria: 'Garantia de resultado funciona pra quebrar objeção em consultoria',
    },
    aplicacao: {
      altaAutoridade: 'Marca consolidada — pode filtrar leads via aplicação',
      saasServicos: 'Modelo aceita filtro pré-comercial',
      consultoria: 'Consultoria de ticket alto — aplicação filtra leads sérios pro comercial',
    },
    ecommerce: {
      ecommerce: 'Venda direta de produto físico online',
      whatsapp: 'Estrutura de e-commerce pode redirecionar leads pro atendimento WhatsApp',
    },
    isca_digital: {
      jaInveste: 'Já investe em tráfego — paralelo a um funil ativo',
      saasServicos: 'Bom canal de leads pro comercial',
      consultoria: 'Material gratuito (whitepaper/diagnóstico) capta leads B2B qualificados',
      whatsapp: 'Isca digital + click-to-WhatsApp é o combo natural pra venda conversacional',
    },
    quiz: {
      saasServicos: 'Quiz qualifica e coleta dados antes do comercial',
      consultoria: 'Quiz funciona como mini-diagnóstico antes da call comercial',
      whatsapp: 'Quiz qualifica e segmenta o lead antes de entrar no WhatsApp',
      altaConsciencia: 'Lead já maduro responde quiz com profundidade',
      b2bHibrido: 'Modelo B2B/Híbrido — quiz qualifica e diagnostica antes do comercial',
    },
    whatsapp: {
      whatsapp: 'Venda via WhatsApp: o funil natural é levar direto pra conversa',
      servicos: 'Prestador de serviço/negócio local fecha por atendimento, não por formulário',
      ecommerce: 'Atendimento por mensagem ajuda no ticket maior e na dúvida antes da compra',
      altaConsciencia: 'Lead maduro já quer preço/disponibilidade: mandar mensagem é o caminho mais curto',
      dorForte: 'Dor aguda pede resposta rápida, e o WhatsApp entrega isso na hora',
    },
    desafio: {
      servicos: 'Prestadores de serviço conseguem entregar desafio',
      coach: 'Coaches/mentores brilham em desafios ao vivo',
      consultoria: 'Desafio funciona pra consultoria com formato advisory de curta duração',
    },
  },
}
