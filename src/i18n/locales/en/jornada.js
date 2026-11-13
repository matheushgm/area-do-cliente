export default {
  titulo: 'Journey',
  descricao: 'The full view of the {cliente} project in 4 phases. Use the Journey as your starting point to see what still needs work.',
  clientePadrao: 'Client',
  progressoGeral: 'Overall progress',
  etapasConcluidas: { one: '{done} of {count} step completed', other: '{done} of {count} steps completed' },
  emAndamentoQtd: '· {n} in progress',
  proxima: 'Next:',
  tudoPronto: 'all done 🎉',
  fase: 'Phase 0{n}: {titulo}',
  concluidasFase: '{done}/{total} completed',
  status: {
    concluido: 'Completed',
    andamento: 'In progress',
    pendente: 'Pending',
  },
  fases: {
    preparacao: {
      titulo: 'Preparation',
      desc: 'Get to know the business, the audience and the goal — the foundation for everything.',
      selo: 'Core foundation',
      modulos: {
        dados: { rotulo: 'Client Details', desc: 'Registration, contract and business information.' },
        produtos: { rotulo: 'Product / Service', desc: 'What the client sells, ICP by revenue line.' },
        icp: { rotulo: 'Personas', desc: 'Dreams, pains, objections and habits of the ideal customer.' },
        kickoff: { rotulo: 'Kickoff', desc: 'Initial diagnosis across 9 pillars and an irresistible-offer verdict.' },
        roi: { rotulo: 'ROI Calculator', desc: 'Leads, MQLs, SQLs and sales needed to hit the target ROI.' },
      },
    },
    criacao: {
      titulo: 'Creation',
      desc: 'Build the assets that will generate demand.',
      selo: 'Assets',
      modulos: {
        mecanismo_unico: { rotulo: 'Unique Mechanism', desc: 'A 6-section differentiation playbook + AI positioning.' },
        oferta: { rotulo: 'Irresistible Offer', desc: 'Offer structure with bonuses, guarantee and triggers.' },
        promessa: { rotulo: 'Promise Builder', desc: 'Shapes the big promise of the product/service.' },
        campaign: { rotulo: 'Campaign', desc: 'Campaign planning by channel and funnel stage.' },
        estrategiav2: { rotulo: 'Strategy', desc: 'Competitive map and differentiation opportunities.' },
        criativos: { rotulo: 'Ad creation', desc: 'Static creatives and video scripts generation.' },
        landingpage: { rotulo: 'Landing page builder', desc: 'Section-by-section landing page structure with AI.' },
        metalab: { rotulo: 'Meta Ads Lab', desc: '3-phase testing protocol (creatives, audiences, hooks).' },
        googleads: { rotulo: 'Google Ads with AI', desc: 'Keyword groups + ad copy generation.' },
      },
    },
    no_ar: {
      titulo: 'Campaigns live',
      desc: 'Execution, control and real-time tracking.',
      selo: 'Execution',
      modulos: {
        debriefing: { rotulo: 'Ad hub', desc: 'Tracking of live creatives + status per ad.' },
        resultados: { rotulo: 'Results', desc: 'B2B / B2C performance with a link for the client to fill in.' },
      },
    },
    primeiros_resultados: {
      titulo: 'First results',
      desc: 'Validate the client\'s satisfaction and perceived results.',
      selo: 'Validation',
      modulos: {
        nps: { rotulo: 'NPS', desc: 'Satisfaction survey by contract milestone.' },
      },
    },
  },
}
