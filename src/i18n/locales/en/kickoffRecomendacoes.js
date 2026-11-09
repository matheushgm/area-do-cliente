export default {
  painel: {
    titulo: 'Recommended funnels for this client',
    compativeis: { one: '{count} match for this diagnosis', other: '{count} matches for this diagnosis' },
    semSinais: 'Not enough signals to recommend a specific funnel.',
    semSinaisDica: 'Fill in the “Product/service model” and the Killer Offer analysis (above) to unlock recommendations.',
    recomendados: 'Recommended to start with',
    considerar: 'Also worth considering',
    match: 'match {n}',
    porQue: 'Why it makes sense here',
  },
  funis: {
    webinar: {
      label: 'Webinar Funnel',
      desc: 'Ideal for products/services with low lead awareness and brands that aren’t an authority yet. The webinar holds the lead for hours and builds trust.',
    },
    diagnostico: {
      label: 'Diagnostic Funnel',
      desc: 'Great for SaaS companies that want to book demos and for B2B companies that deliver a specific diagnosis (e.g. a company’s financial health).',
    },
    webinar_pago: {
      label: 'Paid Webinar Funnel',
      desc: 'Has worked very well for course creators and coaches/mentors who want to qualify the audience by charging a token entry fee.',
    },
    vsl: {
      label: 'VSL Funnel',
      desc: 'An alternative to the webinar. It shines when the lead already feels the pain but doesn’t know a specific solution to their problem yet.',
    },
    lancamento: {
      label: 'Launch Funnel',
      desc: 'The classic digital product strategy. Builds anticipation, brings the lead warm to the cart and maximizes conversion in a short window.',
    },
    wymb: {
      label: 'Win-Your-Money-Back Funnel',
      desc: 'Great for service providers: a full refund guarantee if the client doesn’t get the promised result. It crushes the risk objection.',
    },
    aplicacao: {
      label: 'Application Funnel',
      desc: 'For brands that already have authority and want to filter leads before handing them to sales. Works well for high-ticket B2B.',
    },
    ecommerce: {
      label: 'E-commerce Funnel',
      desc: 'The standard structure for selling physical products online: ad → product → checkout → upsell.',
    },
    isca_digital: {
      label: 'Lead Magnet Funnel',
      desc: 'Runs alongside another funnel that is already performing. Captures leads through free material (eBook, kit, spreadsheet) for sales to work.',
    },
    quiz: {
      label: 'Quiz Funnel',
      desc: 'Recommended for B2B companies that want to diagnose the lead while collecting more information for later qualification.',
    },
    whatsapp: {
      label: 'WhatsApp Message Funnel',
      desc: 'The local business funnel: the ad opens the conversation directly (click-to-WhatsApp) or the page only has buttons that lead to WhatsApp, with no form. The sale happens in the conversation.',
    },
    desafio: {
      label: 'Challenge Funnel',
      desc: 'Works for service providers, coaches and mentors. Engages the lead in a challenge of a few days and generates live social proof.',
    },
  },
  razoes: {
    webinar: {
      baixaConsciencia: 'Lead has low awareness of the problem/solution',
      baixaAutoridade: 'Brand is still building authority',
      consultoria: 'Consulting/advisory educates the lead while selling',
      whatsapp: 'Warms the lead up before the WhatsApp conversation',
    },
    diagnostico: {
      saas: 'SaaS model: a diagnosis helps book the demo',
      servicos: 'B2B services can deliver an initial diagnosis',
      consultoria: 'Consulting lives on diagnosing: it delivers value up front',
    },
    webinar_pago: {
      infoproduto: 'Digital products respond well to the paid webinar filter',
      coach: 'Coaches/mentors filter well with a paid webinar',
      consultoria: 'A premium filter can pre-qualify a consulting audience',
    },
    vsl: {
      dorLatente: 'Lead feels the pain but doesn’t know a specific solution',
      infoCoach: 'The model fits a VSL to qualify',
      consultoria: 'An educational VSL presents the consulting method',
    },
    lancamento: {
      infoproduto: 'The classic digital product strategy',
      coach: 'Mentoring programs respond well to launches',
      whatsapp: 'A WhatsApp broadcast list is natural traction for a launch',
    },
    wymb: {
      servicos: 'Service providers can offer a full guarantee',
      consultoria: 'A results guarantee breaks the objection in consulting',
    },
    aplicacao: {
      altaAutoridade: 'Established brand: it can filter leads through an application',
      saasServicos: 'The model accepts a pre-sales filter',
      consultoria: 'High-ticket consulting: an application filters serious leads for sales',
    },
    ecommerce: {
      ecommerce: 'Direct online sale of a physical product',
      whatsapp: 'An e-commerce structure can route leads to WhatsApp support',
    },
    isca_digital: {
      jaInveste: 'Already invests in traffic: runs alongside an active funnel',
      saasServicos: 'A good source of leads for sales',
      consultoria: 'Free material (whitepaper/diagnosis) captures qualified B2B leads',
      whatsapp: 'Lead magnet + click-to-WhatsApp is the natural combo for conversational sales',
    },
    quiz: {
      saasServicos: 'A quiz qualifies and collects data before sales',
      consultoria: 'A quiz works as a mini diagnosis before the sales call',
      whatsapp: 'A quiz qualifies and segments the lead before WhatsApp',
      altaConsciencia: 'A mature lead answers a quiz in depth',
      b2bHibrido: 'B2B/Hybrid model: a quiz qualifies and diagnoses before sales',
    },
    whatsapp: {
      whatsapp: 'Sales through WhatsApp: the natural funnel goes straight to the conversation',
      servicos: 'Service providers/local businesses close in conversation, not through a form',
      ecommerce: 'Messaging support helps with higher order values and pre-purchase questions',
      altaConsciencia: 'A mature lead already wants price/availability: a message is the shortest path',
      dorForte: 'Acute pain calls for a quick answer, and WhatsApp delivers that instantly',
    },
    desafio: {
      servicos: 'Service providers can run a challenge',
      coach: 'Coaches/mentors shine in live challenges',
      consultoria: 'A challenge works for consulting with a short advisory format',
    },
  },
}
