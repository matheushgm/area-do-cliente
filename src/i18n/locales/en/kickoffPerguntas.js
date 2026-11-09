export default {
  pilares: {
    margem_lucro: {
      label: 'Profit margin',
      short: 'Margin',
    },
    oferta_entrada: {
      label: 'Entry offer',
      short: 'Entry offer',
    },
    conjunto_ofertas: {
      label: 'Offer stack',
      short: 'Repeat sales',
    },
    grande_promessa: {
      label: 'Big promise',
      short: 'Promise',
    },
    posicionamento: {
      label: 'Positioning',
      short: 'Positioning',
    },
    autoridade: {
      label: 'Market authority',
      short: 'Authority',
    },
    processo_comercial: {
      label: 'Sales process',
      short: 'Sales',
    },
    funil_previsivel: {
      label: 'Predictable funnel',
      short: 'Funnel',
    },
    empilhamento_canais: {
      label: 'Channel stacking',
      short: 'Channels',
    },
  },
  estagios: {
    '0': {
      label: 'Chaos',
      desc: 'No structured foundation yet: several fronts to tackle at once.',
    },
    '1': {
      label: 'Validation',
      desc: 'Has a product and some sales, but no predictability or processes.',
    },
    '2': {
      label: 'Structuring',
      desc: 'The sales basics are in place; it still needs to standardize and stack channels.',
    },
    '3': {
      label: 'Acceleration',
      desc: 'Ready to scale: predictable funnels and a validated offer.',
    },
    '4': {
      label: 'Scale',
      desc: 'A mature business with stacked channels and structured offers.',
    },
  },
  perguntas: {
    modelo_produto: {
      label: 'What is the product/service model?',
      hint: 'This helps define which funnel types make the most sense for this client.',
      opcoes: {
        ecommerce: 'E-commerce / physical product sold online',
        whatsapp: 'Sales through WhatsApp',
        saas: 'SaaS / Software as a service',
        servicos: 'Service provider',
        consultoria: 'Consulting / Advisory',
        infoproduto: 'Digital product / online course',
        coach: 'Coach / Mentor',
        outro: 'Other',
      },
    },
    grande_promessa: {
      label: 'What is the big promise of your product/service?',
      hint: 'Ideally specific, measurable and time-bound. E.g. "We triple the ROI of your paid traffic in 90 days".',
    },
    porque_voce: {
      label: 'Why should a customer choose your company over a competitor?',
      hint: 'List concrete differentiators: experience, methodology, results, specialization, guarantee, technology, etc. The more specific and the more reasons, the better.',
    },
    concorrentes: {
      label: 'Who are your 3 main competitors?',
      hint: 'One per line. The more specific, the better.',
    },
    cliente_ideal_qualificado: {
      label: 'Who is the ideal customer, and what clearly confirms we generated a qualified lead?',
      hint: 'Describe the profile (job title, industry, size/revenue, main pain) plus the objective criteria that make a lead sales-ready. E.g.: "E-commerce traffic manager with R$50k+/month in revenue, already investing in Meta Ads and looking to scale; qualified if they are a decision maker with a minimum budget of R$10k/month".',
    },
    margem_bruta: {
      label: 'What is the average gross margin per sale/contract?',
      hint: 'GROSS margin = (Revenue - Direct cost of the product/service) / Revenue. It only counts what is directly tied to delivery (e.g. raw materials, delivery labor, platform fees). It does NOT subtract overhead, fixed salaries, rent or marketing: that is NET margin. We want the GROSS margin because it defines how much is left to invest in acquisition (marketing/traffic).',
      unknownLabel: "I don't know how to calculate it",
    },
    ticket_medio: {
      label: 'What is your average order value?',
      hint: 'Average value per closed sale/contract.',
    },
    faturamento_mensal: {
      label: 'What was last month’s revenue?',
      hint: 'Total revenue for the previous month: the sum of all sales/contracts.',
    },
    cac_ltv: {
      label: 'What is the maximum CAC you are willing to pay per customer?',
      hint: 'Maximum acceptable CAC = the ceiling on what an acquisition can cost while keeping the business healthy (rule of thumb: CAC < 1/3 of LTV). This number is what makes the funnel predictable: without it, for every dollar invested in traffic you don’t know whether you are still in the black. It sets the CPL ceiling for each channel and the point where scaling stops being profitable. If you don’t have this number, leave it blank and make calculating it a priority before the next investment round.',
    },
    conteudo: {
      label: 'Do you produce organic content regularly?',
      opcoes: {
        forte: 'Yes, weekly on 2+ channels',
        medio: 'Yes, occasionally on 1 channel',
        nenhum: "I don't produce any",
      },
    },
    lead_magnet: {
      label: 'Do you have a lead magnet (eBook, webinar, kit, sample)?',
      descriptionLabel: 'Describe your current lead magnet',
      descriptionPlaceholder: 'E.g. eBook on paid traffic captured through a form on the website...',
      opcoes: {
        sim: 'Yes',
        nao: 'No',
      },
    },
    investimento_passado: {
      label: 'How much did you invest in paid traffic last month?',
      hint: 'Add up Meta + Google + other platforms for the previous month.',
    },
    investimento_futuro: {
      label: 'How much do you plan to invest in paid traffic per month with us?',
      hint: 'Estimated monthly paid media / acquisition budget going forward.',
    },
    canais_ativos: {
      label: 'Which acquisition channels do you use today? (select all)',
      opcoes: {
        meta: 'Meta Ads',
        google: 'Google Ads',
        tiktok: 'TikTok Ads',
        linkedin: 'LinkedIn Ads',
        youtube: 'YouTube Ads',
        organico: 'Organic (IG/TT/YT)',
        email: 'Email marketing',
        whatsapp: 'WhatsApp / SMS',
        indicacao: 'Referrals',
        outbound: 'Outbound / cold',
        eventos: 'Events',
        influencia: 'Influencers',
      },
    },
    oferta_entrada: {
      label: 'Do you have an entry offer, guarantee or standout bonus to win the first sale?',
      hint: 'Counts as an entry offer: promotional price, kit/bundle, trial/demo, unconditional guarantee, exclusive first-purchase bonus, free shipping, etc.',
      descriptionLabel: 'Describe the entry offer',
      descriptionPlaceholder: 'E.g. 30% off the first purchase + free shipping + 7-day guarantee...',
      opcoes: {
        sim_testada: 'Yes, structured and tested',
        sim: 'Yes, but not tested',
        nao: "I don't have one",
      },
    },
    b2b_demanda: {
      label: 'How do you generate demand today? (current process, select all)',
      opcoes: {
        outbound: 'Outbound / Cold calling',
        inbound: 'Inbound (organic + ads)',
        eventos: 'Events / talks',
        parceria: 'Partnerships / channels',
        indicacao: 'Referrals',
        nenhum: "I don't have a process",
      },
    },
    b2b_clientes_base: {
      label: 'How many active customers do you have today?',
    },
    b2b_recompra: {
      label: 'Does your business model have repeat purchases or recurring revenue?',
      opcoes: {
        recorrente: 'Monthly/annual recurring (SaaS, contract)',
        recompra: 'Natural repeat purchases (consumables)',
        unica: 'One-time purchase',
      },
    },
    b2b_precificacao: {
      label: 'How do you price your product/service today?',
      opcoes: {
        valor: 'Based on value delivered (ROI)',
        hora: 'Based on hours/project',
        mercado: 'Copying the competition',
        unknown: "I'm not really sure",
      },
    },
    b2b_crm: {
      label: 'Where do you manage your customer base today?',
      opcoes: {
        crm: 'Dedicated CRM (RD, Pipedrive, HubSpot, Salesforce)',
        planilha: 'Structured spreadsheet',
        whats: 'WhatsApp / email / memory',
      },
    },
    b2b_ciclo_venda: {
      label: 'What is the average sales cycle in days?',
      hint: 'From the lead coming in to the deal closing.',
    },
    b2b_processo_comercial: {
      label: 'What is your sales process after a lead comes in?',
      opcoes: {
        sdr_closer: 'SDR qualifies, closer closes, stages tracked in the CRM',
        unico: 'A single salesperson handles the whole cycle',
        nenhum: 'No defined process',
      },
    },
    b2b_taxas_conversao: {
      label: 'Do you know your funnel conversion rates (lead→MQL→SQL→sale)?',
      descriptionLabel: 'Enter your current rates (in %)',
      opcoes: {
        sim: 'Yes',
        nao: 'No',
      },
      sub: {
        lead_mql: {
          label: 'Lead → MQL',
          placeholder: 'E.g. 30',
        },
        mql_sql: {
          label: 'MQL → SQL',
          placeholder: 'E.g. 50',
        },
        sql_venda: {
          label: 'SQL → Sale',
          placeholder: 'E.g. 25',
        },
      },
    },
    b2c_demanda: {
      label: 'How do you generate demand today? (select all)',
      opcoes: {
        meta: 'Meta Ads',
        google: 'Google Shopping',
        influencia: 'Influencers',
        email: 'Email / WhatsApp',
        indicacao: 'Referrals',
        fisica: 'Physical store',
        nenhum: "I don't have a process",
      },
    },
    b2c_clientes_base: {
      label: 'How many active customers do you have?',
    },
    b2c_atendimento: {
      label: 'What is your customer service process?',
      opcoes: {
        dedicado: 'Dedicated team with SLA + script',
        proprio: 'In-house service with no standard',
        reativo: 'Reactive, as things come up',
      },
    },
    b2c_recompra: {
      label: 'Does your product allow repeat purchases? How do you encourage them today?',
      opcoes: {
        fidelidade: 'Yes, with a loyalty/subscription program',
        email: 'Yes, with post-purchase email/WhatsApp',
        passivo: "Yes, but I don't encourage it",
        nao_permite: "It doesn't allow repeat purchases",
      },
    },
    b2c_upsell: {
      label: 'Do you have upsell/cross-sell offers at checkout or after the purchase?',
      descriptionLabel: 'Which offers?',
      descriptionPlaceholder: 'E.g. accessory cross-sell at checkout, email with a complementary product 7 days after purchase...',
      opcoes: {
        sim: 'Yes',
        nao: 'No',
      },
    },
    b2c_frequencia_recompra: {
      label: 'What is your average repeat purchase frequency (in days)?',
      hint: 'Leave blank if repeat purchases aren’t possible.',
    },
  },
  proximosPassos: {
    margem_lucro: {
      b2b: 'Map CAC and LTV by channel over the next 30 days; review pricing based on value delivered.',
      b2c: 'Calculate margin per SKU, separate anchor products from margin drains and reprice the catalog.',
      hibrido: 'Map margin per revenue line and CAC/LTV per channel; reprice based on value delivered.',
    },
    oferta_entrada: {
      b2b: 'Build an entry offer (POC, pilot project or 14-day trial) with scope, timeline and guarantee.',
      b2c: 'Launch a testable entry offer (kit/discount/guarantee) and validate it with 2 ads in an A/B test for 14 days.',
      hibrido: 'Create two entry offers (one B2B, one B2C) with an urgency trigger and an A/B test within 30 days.',
    },
    conjunto_ofertas: {
      b2b: 'Build an upsell/cross-sell plan and recurring packages; run QBRs for retention.',
      b2c: 'Set up a post-purchase flow (email + WhatsApp) with upsell, a loyalty program and cross-sell at checkout.',
      hibrido: 'Map repeat purchase opportunities in both lines and launch 1 upsell per line in the next 60 days.',
    },
    grande_promessa: {
      b2b: 'Rewrite the promise with a metric + timeframe + guarantee; validate it with 5 current customers.',
      b2c: 'Rewrite the promise with a specific benefit + timeframe + social proof; test it in 2 creatives.',
      hibrido: 'Define one promise per business line and standardize it across the website, ads and sales materials.',
    },
    posicionamento: {
      b2b: 'Define the niche and ICP (Ideal Customer Profile); map 3 competitors and clear differentiators.',
      b2c: 'Build the brand narrative and visual/verbal differentiators; audit the competition directly.',
      hibrido: 'Give each line its own value proposition; map the B2B ICP and the B2C persona separately.',
    },
    autoridade: {
      b2b: '12-week LinkedIn editorial plan + 1 lead magnet (eBook or webinar) launched within 30 days.',
      b2c: 'Organic content calendar (IG/TikTok) 3x a week + 1 lead magnet (kit, sample) within 30 days.',
      hibrido: 'Dual editorial plan: LinkedIn for B2B, IG/TT for B2C; 1 lead magnet per line within 45 days.',
    },
    processo_comercial: {
      b2b: 'Set up a CRM, define the funnel stages, create an SDR↔Closer SLA and a weekly pipeline dashboard.',
      b2c: 'Standardize customer service with a script, a response SLA (<5 min) and a single tool (WhatsApp Business + spreadsheet).',
      hibrido: 'Unified CRM with separate pipelines; a sales process per line + a monthly conversion dashboard.',
    },
    funil_previsivel: {
      b2b: 'Invest in paid media (Meta + LinkedIn) at R$15k+/month and measure CAC per channel over the next 90 days.',
      b2c: 'Increase investment in Meta + Google Shopping; measure ROAS per ad and per SKU weekly.',
      hibrido: 'Split the budget between B2B and B2C channels; funnel tracking with source by channel within 30 days.',
    },
    empilhamento_canais: {
      b2b: 'Add 2 channels (e.g. LinkedIn Ads + outbound email) and test them for 60 days with dedicated tracking.',
      b2c: 'Add 2 channels (e.g. TikTok + Email + Influencers) and validate performance for 60 days.',
      hibrido: 'Stack channels per line: B2B (LinkedIn, Outbound, Events) + B2C (Meta, TikTok, Influencers).',
    },
  },
  om: {
    pilares: {
      dor_latente: {
        label: 'Lead’s latent pain',
        short: 'Latent pain',
        desc: 'The pain your product solves has to be felt day to day, not something the lead only discovers when a salesperson explains it.',
      },
      poder_compra: {
        label: 'Audience purchasing power',
        short: 'Purchasing power',
        desc: 'Without the money to buy, the best offer in the world won’t convert.',
      },
      encontrar_online: {
        label: 'How easy the audience is to find online',
        short: 'Targetable',
        desc: 'If Meta/Google/LinkedIn can’t target the audience well, scaling gets too expensive.',
      },
      mercado_expansao: {
        label: 'Growing market',
        short: 'Market',
        desc: 'Growing markets allow an aggressive entry; in stagnant markets, killer offers have to steal share from competitors, which is much harder.',
      },
      consciencia_autoridade: {
        label: 'Low awareness + low authority',
        short: 'Awareness/Authority',
        desc: 'A killer offer shines when the audience doesn’t know the solution yet AND the brand isn’t a reference. In mature markets with leading brands, the game changes.',
      },
    },
    vereditos: {
      cabe: {
        label: 'It fits! A killer offer is the right strategy',
        short: 'Fits',
        desc: 'The client’s situation checks every pillar. Build an aggressive offer with a guarantee, a deadline and social proof: it will sell.',
      },
      talvez: {
        label: 'Maybe: it works with adjustments',
        short: 'Maybe',
        desc: 'There are gaps in at least one pillar. It’s worth testing a killer offer with a more niche audience, or fixing the weak spots before scaling.',
      },
      nao_cabe: {
        label: 'Other strategies work better',
        short: 'Doesn’t fit',
        desc: 'The context doesn’t favor a killer offer. Focus on building authority, educational content, social proof and mid-funnel before trying the aggressive offer.',
      },
    },
    perguntas: {
      om_dor_latente: {
        label: 'How latent is the pain the product/service solves?',
        hint: 'Latent = the lead already complains about it today, without anyone pointing it out.',
        opcoes: {
          aguda: 'Acute pain: it keeps the lead up at night and they actively look for a solution',
          percebida: 'Perceived: the lead complains about it when prompted',
          media: 'Moderate: the lead agrees once it’s explained, but doesn’t look for it',
          baixa: 'Low: the lead needs a lot of education to recognize it',
          inexistente: 'None: the product solves something nobody asks for',
        },
      },
      om_poder_compra: {
        label: 'What is the typical purchasing power of the target audience?',
        opcoes: {
          alto_b2b: 'B2B: company with R$1M+ in annual revenue',
          alto_b2c: 'B2C upper class: buys without blinking',
          medio_b2b: 'B2B: smaller company, weighs the investment carefully',
          medio_b2c: 'B2C middle class: compares prices, installments help',
          baixo_b2c: 'B2C lower-middle class: price sensitive, low order value',
          desconhecido: 'Hard to price / purchasing power varies',
        },
      },
      om_encontrar_online: {
        label: 'How easily can the audience be found/targeted online?',
        hint: 'Think of interests on Meta, keywords on Google, job titles on LinkedIn.',
        opcoes: {
          super: 'Highly targetable: clear interests, job titles or keywords',
          bom: 'Reasonable: some behavioral signals, you can aim at them',
          fraco: 'Weak: scattered audience, no clear intent signal',
          invisivel: 'Almost invisible: only through referrals or offline',
        },
      },
      om_mercado_expansao: {
        label: 'Where is the market right now?',
        opcoes: {
          forte_expansao: 'Strong growth: new players appearing, rising demand',
          moderada: 'Moderate growth: healthy market, no boom',
          estavel: 'Stable: no big changes in recent years',
          retracao_leve: 'Slightly shrinking',
          retracao_forte: 'Shrinking fast / industry in decline',
        },
      },
      om_consciencia: {
        label: 'How aware is the audience of the problem/solution?',
        hint: 'A killer offer shines when the audience DOESN’T KNOW the solution YET: you create the urgency.',
        opcoes: {
          inconsciente: 'Unaware: doesn’t know they have the problem',
          problema: 'Problem aware: doesn’t know a solution exists',
          solucao: 'Solution aware: doesn’t know the brands',
          produto: 'Comparing products/brands',
          pronto: 'Customer has decided, just needs to close',
        },
      },
      om_autoridade: {
        label: 'How much authority does the brand have in the market?',
        hint: 'In markets with dominant brands, a killer offer tends to burn money.',
        opcoes: {
          desconhecida: 'Unknown: just getting started',
          pouca: 'Little authority: some customers know it',
          media: 'Medium authority: known in the niche, not mainstream',
          consolidada: 'Established brand: a reference in the segment',
          lider: 'Category leader: everyone knows it',
        },
      },
    },
    justificativas: {
      favoravel: {
        tag: 'Favorable',
        dor_latente: 'The pain is strong enough to justify an aggressive offer with an urgency trigger.',
        poder_compra: 'The audience has the money to take the offer at full price.',
        encontrar_online: 'Clear targeting: scaling paid media is viable and cheap.',
        mercado_expansao: 'A growing market leaves room for an aggressive entry without much cannibalization.',
        consciencia_autoridade: 'Ideal scenario: the audience doesn’t know the category and the brand has room to shape the narrative.',
      },
      atencao: {
        tag: 'Caution',
        dor_latente: 'The pain isn’t fully latent. You’ll need to educate the lead before presenting the offer.',
        poder_compra: 'Purchasing power limits the order value. Consider installments or a lower price point.',
        encontrar_online: 'Partial targeting. You’ll spend more on media until it’s calibrated.',
        mercado_expansao: 'Lukewarm market. A killer offer still works, but competitors react fast.',
        consciencia_autoridade: 'Audience in transition. The offer has to educate and convert at the same time.',
      },
      risco: {
        tag: 'Risk',
        dor_latente: 'Without latent pain, a killer offer becomes noise. Focus on educational content first.',
        poder_compra: 'Without purchasing power, any offer will hit the "I can’t afford it" wall.',
        encontrar_online: 'Audience is hard to find online: scaling gets very expensive. Other channels may pay off more.',
        mercado_expansao: 'Shrinking or stagnant market. An aggressive offer eats margin without gaining share.',
        consciencia_autoridade: 'Mature audience with strong brands. A killer offer is a risky play: invest in differentiation.',
      },
    },
  },
}
