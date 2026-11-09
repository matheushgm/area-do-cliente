// ADS Roadmap em inglês: mesma estrutura de src/lib/adsRoadmap.js, linha a linha.
// Mexeu no português, mexa aqui na mesma posição. Ids das faixas e das regras são
// os mesmos do português; os números das tabelas de benchmark (contas, valores)
// não ficam aqui: adsRoadmap.js reaproveita os do português e só troca a pontuação.
//
// Este arquivo não importa nada do português de propósito (evita import circular:
// é o adsRoadmap.js que importa daqui).

// ─── Regras que valem em toda faixa ──────────────────────────────────────────
export const REGRAS = [
  {
    id: 'otimizacao',
    titulo: 'Optimization rule (Meta decides)',
    itens: [
      'All of the month\'s creatives stay active at the same time in the ad set (add 3 per week, up to 12 per month). Always keep 6 creatives on standby.',
      'Meta chooses where to concentrate delivery. Usually 1 or 2 ads take almost the entire budget; the others stay active with almost no spend.',
      'The manager only looks at ads that are getting delivery. If one of them goes over 2× the target cost (CPL, CPA or cost per conversation) with the minimum spend reached, it is turned off and tagged as tested.',
      'When an ad is turned off, Meta redistributes the budget to the ads that were already active without delivery. They start being tested without the manager uploading anything.',
      'Never turn off an ad Meta didn\'t prioritize (it wasn\'t tested, it just didn\'t get delivery). Never reactivate an ad tagged as tested in the same ad set.',
    ],
  },
  {
    id: 'desligar',
    titulo: 'When to turn off an ad',
    itens: [
      'Only ads that are getting delivery.',
      'Condition: ad spend ≥ 2× the target and (0 conversions or cost ≥ 2× the target).',
      'Never before 72h of delivery. In B2B the evaluation window is 7 to 10 days.',
      'Saturation: frequency ≥ 3.5 over the last 7 days (≥ 5 on a warm audience) with CTR dropping.',
      'Always with the tested tag: _TESTADO suffix in the ad name + a ClickUp entry with spend, conversions and cost. An ad turned off without the tag doesn\'t count as an optimization.',
    ],
  },
  {
    id: 'escalar',
    titulo: 'When to scale',
    itens: [
      '+20% on the ad set when cost stays ≤ target for 3 days, up to the tier ceiling.',
      'Scale down: -20% on the ad set when cost is above the target.',
      'Going past the tier ceiling = a proposal to move the client up a tier, never scaling on your own.',
      'Budget can move between campaigns in the same tier (e.g. warm saturated, back to cold) without exceeding the daily total.',
    ],
  },
  {
    id: 'verba-minima',
    titulo: 'Minimum budget per ad set',
    itens: [
      'Each ad set needs a daily budget of ≥ 2× the target cost. If it doesn\'t get there, the ad set goes away and the budget moves to the main ad set.',
      'This rule decides whether the tier fits the client: with a target CPL of R$ 40, an ad set at R$ 30/day doesn\'t work.',
      'Targets (target CPL/CPA, ticket, ROI) come from the Client Area (the project\'s ROI calculator). No target set, no campaign goes live.',
    ],
  },
  {
    id: 'canais',
    titulo: 'Meta or Google',
    itens: [
      'Meta is the default. Google Search comes in only when (1) people already search for the product on Google and (2) the estimated CPC allows ≥ 10 clicks per day with the available budget (CPC ≤ daily budget ÷ 10).',
      'Up to R$ 3,000 Google replaces Meta, never runs alongside it. From R$ 4,000 it can run in parallel, with budget taken from cold BOFU or TOFU.',
      'In B2B with active search intent (software, supplier, consulting) Google usually wins.',
    ],
  },
  {
    id: 'lab',
    titulo: 'Lab (testing process)',
    itens: [
      'Up to R$ 5,000 the Lab is not a separate campaign: it is the testing process inside the main BOFU ad set (or MOFU, in B2B with a lead magnet).',
      '1 hypothesis per week, 3 variations go live together, all active. Meta chooses, and the manager documents in ClickUp what won and why (spend, conversions, cost).',
      'Suggested sequence: week 1 creatives (angle/format), week 2 hooks (first 3 seconds) of the winner, week 3 headlines, week 4 a new batch of creatives.',
      'Winner criterion: spend ≥ 2× the target and cost below the target. Without that it isn\'t a winner, it\'s "no data".',
      'A separate Lab campaign, with Meta\'s native A/B test, only above R$ 5,000.',
    ],
  },
]

// ─── Benchmarks por etapa (Protocolo Gestão de Tráfego) ──────────────────────
export const BENCHMARKS = [
  {
    etapa: 'TOFU',
    objetivo: 'Profile visits, video views, engagement',
    metricas: [
      ['CPM', 'as low as possible; niche average'],
      ['Average video play time', '> 10 seconds'],
      ['Hook rate (3s)', '> 30%'],
      ['Cost per profile visit', 'account average'],
    ],
    otimizacao: 'Every 7 days: refresh creatives, turn off the weak ones, tell the client what is driving quality.',
  },
  {
    etapa: 'MOFU',
    objetivo: 'Lead magnet lead or webinar sign-up',
    metricas: [
      ['Link CTR', '> 1% (ideally > 2%)'],
      ['Landing page conversion rate', '20% to 50%'],
      ['Hook rate', '> 30%'],
      ['Cost per lead', '≤ 1/3 of the BOFU CPL'],
      ['MQL and cost per MQL', 'project target'],
    ],
    otimizacao: 'Check daily, optimize between 3 and 7 days. Below 20% conversion the problem is the landing page, not the ad.',
  },
  {
    etapa: 'BOFU',
    objetivo: 'Lead, message or sale',
    metricas: [
      ['Link CTR', '> 1%'],
      ['Landing page conversion rate', '5% to 20%'],
      ['Hook rate', '> 30%'],
      ['Cost per lead / CPA', 'project\'s target CPL or CPA'],
      ['Purchase rate (e-commerce/info products)', '≥ 3%'],
      ['CAC', 'compare with average ticket'],
    ],
    otimizacao: 'Optimization rule (Meta prioritizes) + the turn-off rule (above).',
  },
]

// O exemplo fica igual ao português: a etapa no nome (TOPO, MEIO, FUNDO) é lida
// pelo dashboard (classifyFunnel), então a nomenclatura não muda com o idioma.
export const NOMENCLATURA = [
  ['Campaign', 'Funnel stage_Budget type_Objective_Short description (write the stage in Portuguese, TOPO, MEIO or FUNDO: the dashboard reads it)', 'FUNDO_CBO_Leads_Financiamento'],
  ['Ad set', 'Hierarchy_Temperature_Platform_Audience detail (Frio = cold, Quente = warm)', '01_Frio_Meta_Amplo'],
  ['Ad', 'Date_Short description (+ _TESTADO when turned off)', '2026-09-17_Video_Depoimento'],
]

export const VISUALIZACOES = [
  {
    nome: 'Top of funnel',
    colunas: 'Delivery | Amount spent | CPM | Instagram profile visits | Results | Cost per result | Instagram follows | Video average play time | 3-second video play rate | Reach | Frequency | Budget | Link clicks | CPC | Clicks | CTR | Video plays at 25% | 50% | 75% | 100%',
  },
  {
    nome: 'Middle of funnel',
    colunas: 'Delivery | Amount spent | CPM | Leads | Cost per lead | Conversion rate | Reach | Frequency | Budget | Link clicks | CPC | Link CTR | MQL | Cost per MQL | Hook rate',
  },
  {
    nome: 'Bottom of funnel (B2B)',
    colunas: 'Delivery | Amount spent | Budget | CPM | Leads | Cost per lead | Results | Cost per result | Conversion rate | MQL | Cost per MQL | Reach | Frequency | Link clicks | CPC | CTR',
  },
  {
    nome: 'Bottom of funnel (B2C)',
    colunas: 'Delivery | Amount spent | CPM | Leads | Cost per lead | Results | Cost per result | Conversion rate | Reach | Frequency | Budget | Link clicks | CPC | CTR | Messaging conversations started | Cost per messaging conversation started',
  },
]

// ─── Benchmark interno (portfólio Revenue Lab) ───────────────────────────────
// Só os textos. As tabelas de números vêm do português (adsRoadmap.js monta).
export const BENCHMARK_INTERNO_TEXTOS = {
  periodo: 'Aug 20 to Sep 18, 2026',
  fonte: 'Client Area dashboard (Meta + Google), last 30 full days, accounts with more than R$ 300 spent.',
  comoUsar: 'The median is the typical account in the portfolio. An account below its segment\'s median needs a diagnosis; above the median it is a candidate to scale.',
  definicoes: [
    ['CTR (Meta)', 'link clicks ÷ impressions'],
    ['Conv. rate (Meta)', 'Conversions (the campaign\'s optimization event) ÷ link clicks'],
    ['BOFU cost/conv (Meta)', 'spend ÷ conversions, only from campaigns with "fundo" in the name'],
    ['CPC / CTR / Conv. rate / Cost/conv (Google)', 'spend ÷ clicks · clicks ÷ impressions · conversions ÷ clicks · spend ÷ conversions'],
  ],
  colsMediana: {
    meta: ['CTR (link)', 'CPM', 'Conv. rate', 'BOFU cost/conv'],
    google: ['CPC', 'CTR', 'Conv. rate', 'Cost/conv'],
  },
  colsContas: {
    meta: ['Account', 'Spend', 'CTR', 'CPM', 'Conv. rate', 'BOFU cost/conv'],
    google: ['Account', 'Spend', 'CPC', 'CTR', 'Conv. rate', 'Cost/conv'],
  },
  ressalvas: [
    'A conversion isn\'t the same thing in every account. On Meta, "Conversions" is each campaign\'s optimization event (WhatsApp conversation, form lead, purchase). WhatsApp accounts (Cical, Boa Noite, RGM) show a 40 to 50% rate because the click already becomes a conversation; landing page accounts with a form sit at 2 to 10%.',
    'BuzzLead (Google, R$ 0.75 per conversion), Nacional Kart SP (Google) and Bio Cosméticos (Meta, R$ 2.08) count a light action as a conversion. For a real lead benchmark, ignore these rows.',
    'Nomus accounts for 74% of all Google spend in the portfolio. That\'s why the Google B2B weighted average is basically Nomus. Use the median.',
    'BOFU cost per conversion (Meta) only exists for accounts that name campaigns with "fundo" (the Protocol\'s naming convention). Sempre Chevrolet, Escribo, Matheus Business and PVB don\'t follow the standard and have no value.',
    'Google CTR in accounts with Display/PMax (Bio Cosméticos 23%, NectarCRM 33%) comes out inflated because the impressions column only covers Search/Shopping.',
  ],
}

// ─── Faixas de verba ─────────────────────────────────────────────────────────
export const NAO_FAZ = 'Doesn\'t run'

export const FAIXAS = [
  // ── até R$ 1.000 ──────────────────────────────────────────────────────────
  {
    id: '1k',
    label: 'Up to R$ 1,000',
    verbaMensal: 1000,
    verbaDia: 33,
    resumo: 'A single BOFU campaign, to drive sales as fast as possible. B2B doesn\'t run in this tier.',
    rows: [
      ['Daily budget', 'R$ 33', NAO_FAZ],
      ['Acquisition funnel type', '• WhatsApp funnel', NAO_FAZ],
      ['Structure', 'Campaign 1: BOFU (R$ 33/day, 100%).\nNo TOFU in this tier: the whole budget goes to driving sales as fast as possible.', NAO_FAZ],
      ['Channels', 'Default: Meta only.\nSwap Meta for Google Search only when both conditions hold: (1) people already search for the product on Google and (2) the keyword\'s estimated CPC allows at least 10 clicks per day with R$ 33 (CPC up to R$ 3.30).\nIn this tier that is rare, so it is almost always Meta.', NAO_FAZ],
      ['Budget', 'CBO', NAO_FAZ],
      ['Ad sets', 'Just 1. With R$ 33/day you can\'t split without spreading the budget too thin.', NAO_FAZ],
      ['Audiences', 'Advantage+ broad.\nNo lookalike, retargeting or interests in this tier.', NAO_FAZ],
      ['Objective', 'Sales via WhatsApp (conversations)', NAO_FAZ],
      ['Active creatives per ad set', 'All of the month\'s creatives stay active at the same time (add 3 per week, up to 12 active in the month). Meta chooses where to concentrate delivery.\nOptimization rule: turn off the ad that goes over 2× the target cost per conversation with the minimum spend reached, tag it as tested and Meta redistributes the budget. Never turn off an ad Meta didn\'t prioritize and never reactivate an ad tagged as tested in the same ad set.', NAO_FAZ],
      ['New creatives per month', '3 per week, up to 12/month, uploaded already active (a mix of static and video/reels)', NAO_FAZ],
      ['Tested tag', 'Required when turning off: _TESTADO suffix in the ad name + a ClickUp entry.', NAO_FAZ],
      ['Destination', 'WhatsApp', NAO_FAZ],
      ['Routine', 'Daily (10 min): spend vs. ceiling, anomalies, and which ads Meta is prioritizing today and what each one costs.\nWeekly: upload the 3 new creatives, ClickUp entry.', NAO_FAZ],
      ['Cut-off metric', 'Cost per conversation started', NAO_FAZ],
      ['Turn off', 'Only ads getting delivery. Condition: ad spend ≥ 2× the target and (0 conversations or cost ≥ 2× the target). Saturation: frequency ≥ 3.5 over the last 7 days.', NAO_FAZ],
      ['Scale', 'No scaling within the tier: the ceiling is R$ 33/day. If cost per conversation stays ≤ target for 7 days in a row, it becomes a proposal to move the client up to the R$ 2,000 tier.', NAO_FAZ],
      ['Expected results', 'R$ 1,000 ÷ target cost per conversation. E.g. R$ 25 per conversation → ~40 conversations/month', NAO_FAZ],
      ['Client reporting', 'Weekly summary on WhatsApp + monthly report', NAO_FAZ],
    ],
    estrutura: {
      b2c: [
        {
          nome: 'BOFU', tipo: 'CBO', verba: 'R$ 33/day', sub: 'Campaign 1',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Advantage+ broad', ads: ['AD 01', 'AD 02', 'AD 03'], nota: '3 per week · WhatsApp' },
          ],
        },
      ],
      b2b: null,
      google: {
        titulo: 'Google structure',
        ou: true,
        campanhas: [
          {
            nome: 'Search', tipo: '', verba: 'R$ 33/day', sub: 'Google campaign',
            conjuntos: [
              { nome: 'Ad group 01', sub: 'product', ads: ['AD 01'] },
              { nome: 'Ad group 02', sub: 'branding', ads: ['AD 02'] },
            ],
          },
        ],
        nota: 'Only if people already search for the product. Never alongside Meta in this tier.',
      },
      pontos: {
        b2c: [
          'Test 3 creatives per week at most',
          'CPL: R$ 5 to R$ 15',
          '2 to 6 messages per day',
          'No warm audience',
          'Only one funnel: WhatsApp',
          'Optimization is just turning off the creative whose CPL is 2× above the target CPL and turning on a creative that hasn\'t been tested',
          'As soon as a creative is turned off it is tagged "_Fadigado" (fatigued) or "_Ruim" (poor)',
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When the CPL is below the target CPL'] },
          'Increase the budget by 20% per day so CPM doesn\'t spike',
        ],
        google: [
          'Test 2 campaigns at most',
          'CPC: R$ 1 to R$ 5',
          'CPL: R$ 9 to R$ 108',
          'Up to 3 conversions per day',
          'Only one campaign, so you don\'t lose bids in the auction',
          { t: 'Optimization here means:', sub: ['adding negative keywords', 'changing headlines', 'changing ads'] },
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When the CPL is below the target CPL'] },
          'Increase the budget by 20% per day so CPM doesn\'t spike',
        ],
      },
      notas: {
        b2c: ['No TOFU, no lookalike, no retargeting.', 'No scaling within the tier: 7 days below target = a proposal to move up to R$ 2,000.'],
        b2b: ['B2B runs neither Meta nor Google in this tier: a B2B CPL doesn\'t work with R$ 33/day. It starts at R$ 2,000.'],
      },
    },
  },

  // ── R$ 2.000 ──────────────────────────────────────────────────────────────
  {
    id: '2k',
    label: 'R$ 2,000',
    verbaMensal: 2000,
    verbaDia: 66,
    resumo: 'BOFU on CBO with everything active. B2C gets a small TOFU if the client has content. B2B comes in, 100% BOFU.',
    rows: [
      ['Daily budget', 'R$ 66', 'R$ 66'],
      ['Acquisition funnel type', '• WhatsApp funnel or\n• Short landing page funnel', '• Landing page with form funnel or\n• Instant form funnel (Meta)'],
      ['Structure', 'Campaign 1: BOFU (R$ 50/day, 75%).\nCampaign 2: TOFU Profile visits or Video views (R$ 16/day, 25%), only if the client has content/video to run. If not, 100% BOFU.', 'Campaign 1: BOFU with a landing page or instant form (R$ 66/day, 100%). No TOFU in this tier.'],
      ['Channels', 'Default: Meta only. With this budget you don\'t split into two channels.\nGoogle Search instead of Meta when (1) people already search for the product on Google and (2) the estimated CPC allows ≥ 10 clicks/day with R$ 66 (CPC up to R$ 6.60).', 'Default: a single channel, Meta or Google Search. Same two conditions to choose Google.\nIn B2B with active search intent (e.g. "X software", "Y supplier") Google usually wins.'],
      ['Budget', 'CBO on the BOFU campaign', 'CBO'],
      ['Ad sets', '1 to 2 in BOFU (broad + 1 lookalike audience). Each ad set needs a daily budget of ≥ 2× the target CPL, otherwise it becomes just 1.', '1 ad set'],
      ['Audiences', 'Advantage+ broad as the default.\nLookalike only with a source of ≥ 1,000 events or a customer list.', 'Broad with a job title/industry signal, or a lookalike of the customer base if one exists.'],
      ['Objective', 'Sales (website or WhatsApp) + reach/followers in TOFU', 'Leads (form or landing page)'],
      ['Active creatives per ad set', 'All of the month\'s creatives stay active at the same time (add 3 per week, up to 12 active in the month). Meta chooses where to concentrate delivery. Optimization rule: turn off the ad that goes over 2× the target CPL with the minimum spend reached, tag it as tested and Meta redistributes the budget. Never turn off an ad Meta didn\'t prioritize and never reactivate an ad tagged as tested in the same ad set.', 'Same rule. Upload 4 to 6 creatives per month. 7-day evaluation window.'],
      ['New creatives per month', '3 per week, up to 12/month (a mix of static and video/reels)', '6 to 12/month (a mix of static and video)'],
      ['Tested tag', 'Required when turning off: _TESTADO suffix in the ad name + a ClickUp entry.', 'Same'],
      ['Destination', 'WhatsApp or short landing page', 'Landing page with a form, or Meta instant form if there is no landing page'],
      ['Routine', 'Daily (15 min): spend vs. ceiling, anomalies, and which ads Meta is prioritizing and what each one costs.\nWeekly: upload the 3 new creatives, budget adjustment, ClickUp entry.', 'Daily: same. Weekly: upload 1 to 2 new creatives, budget adjustment, entry.'],
      ['Cut-off metric', 'Sales: CPA or ROAS. WhatsApp: cost per conversation', 'CPL'],
      ['Turn off', 'Only ads getting delivery. Condition: spend ≥ 2× the target and (0 conversions or cost ≥ 2× the target). Never before 72h of delivery. Saturation: frequency ≥ 3.5 with CTR dropping. Always with the tested tag.', 'Same, with CPL and a 10 to 14-day window.'],
      ['Scale', '+20% on the ad set when cost stays ≤ target for 3 days, up to the R$ 66/day ceiling. Past the ceiling = a proposal to move the client up a tier.', 'Same'],
      ['Expected results', 'R$ 2,000 ÷ target CPA. E.g. CPA R$ 80 → ~25 sales or conversations', 'R$ 2,000 ÷ target CPL. E.g. CPL R$ 60 → ~33 leads'],
      ['Client reporting', 'Weekly summary on WhatsApp + monthly report', 'Same'],
    ],
    estrutura: {
      b2c: [
        {
          nome: 'BOFU', tipo: 'CBO', verba: 'R$ 50/day', sub: 'Campaign 1',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Advantage+ broad', ads: ['AD 01', 'AD 02', 'AD 03', '…', 'AD 12'], nota: 'all active · 3/week' },
            { nome: 'Ad set 02', sub: 'Lookalike or Retargeting (optional)', opcional: true, ads: ['AD 01', 'AD 02', 'AD 03'], nota: 'only with a source of ≥ 1,000 events or a list' },
          ],
        },
        {
          nome: 'TOFU (optional)', tipo: '', verba: 'R$ 16/day', sub: 'Campaign 2', opcional: true,
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Profile / Video views', opcional: true, ads: ['AD 01', 'AD 02', 'AD 03'], nota: 'only if the client has content' },
          ],
        },
      ],
      b2b: [
        {
          nome: 'BOFU', tipo: 'CBO', verba: 'R$ 66/day', sub: 'Campaign 1',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Broad + job title', ads: ['AD 01', 'AD 02', 'AD 03', '…', 'AD 12'], nota: 'all active · 6 to 12 per month' },
          ],
        },
      ],
      google: {
        titulo: 'Google structure',
        ou: true,
        campanhas: [
          {
            nome: 'Search', tipo: '', verba: 'R$ 66/day', sub: 'Google campaign',
            conjuntos: [
              { nome: 'Ad group 01', sub: 'product', ads: ['AD 01', 'AD 02'] },
              { nome: 'Ad group 02', sub: 'product', ads: ['AD 01', 'AD 02'] },
              { nome: 'Ad group 03', sub: 'branding', ads: ['AD 01', 'AD 02'] },
            ],
          },
        ],
        nota: 'Only if people already search for the product. Never alongside Meta in this tier.',
      },
      pontos: {
        b2c: [
          'Test 3 creatives per week at most (up to 12 active in the month, all on)',
          'BOFU R$ 50/day (75%) + TOFU R$ 16/day (25%) only if the client has content. No content, 100% BOFU',
          '1 to 2 ad sets in BOFU: Broad + Lookalike (Lookalike only with a source of ≥ 1,000 events or a customer list)',
          'One funnel: WhatsApp or short landing page',
          'Cut-off metric: CPA/ROAS for sales, cost per conversation for WhatsApp',
          'Optimization means turning off the creative whose cost is 2× above the target (spend ≥ 2× the target, never before 72h) and tagging it "_TESTADO". Meta redistributes the budget to the creatives that haven\'t been tested yet',
          'Never turn off an ad Meta didn\'t prioritize',
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When cost stays below the target for 3 days in a row'] },
          'Increase by 20% per day up to the R$ 66/day ceiling so CPM doesn\'t spike. Past the ceiling = a proposal to move up a tier',
        ],
        b2b: [
          '1 campaign, 100% BOFU (R$ 66/day). No TOFU in this tier',
          '1 ad set: Broad + job title/industry signal (or a lookalike of the customer base, if one exists)',
          '6 to 12 creatives per month, all active (add 1 to 2 per week)',
          'Destination: landing page with a form or Meta instant form',
          'Cut-off metric: CPL. 7-day evaluation window; turn off only after 10 to 14 days',
          'Optimization means turning off the creative whose CPL is 2× above the target CPL (spend ≥ 2× the target) and tagging it "_TESTADO"',
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When the CPL stays below the target CPL for 3 days in a row'] },
          'Increase by 20% per day up to the R$ 66/day ceiling so CPM doesn\'t spike',
        ],
        google: [
          'Only replaces Meta when people already search for the product and the CPC allows ≥ 10 clicks/day (CPC ≤ R$ 6.60)',
          'In B2B with active search intent ("X software", "Y supplier") Google usually wins',
          '1 Search campaign, up to 3 ad groups, 2 ads per ad group',
          'Only one campaign, so you don\'t lose bids in the auction',
          { t: 'Optimization here means:', sub: ['adding negative keywords', 'changing headlines', 'changing ads'] },
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When the CPL is below the target CPL'] },
          'Increase the budget by 20% per day so CPC doesn\'t spike',
        ],
      },
      notas: {
        b2c: ['Dashed = optional. No content for TOFU, 100% of the budget goes to BOFU.'],
        b2b: ['No TOFU in this tier. Destination: landing page with a form or instant form.'],
      },
    },
  },

  // ── R$ 3.000 ──────────────────────────────────────────────────────────────
  {
    id: '3k',
    label: 'R$ 3,000',
    verbaMensal: 3000,
    verbaDia: 100,
    resumo: 'BOFU on CBO with two ad sets (warm and cold). The Lab runs inside BOFU, with no separate campaign.',
    rows: [
      ['Daily budget', 'R$ 100', 'R$ 100'],
      ['Budget split', '• BOFU: R$ 84/day (R$ 2,520/month)\n• TOFU: R$ 16/day (R$ 480/month)', '• BOFU: R$ 100/day (R$ 3,000/month)\n• No TOFU'],
      ['Acquisition funnel type', '• WhatsApp funnel or\n• Short landing page funnel', '• Landing page with form funnel or\n• Instant form funnel (Meta)'],
      ['Structure', 'Campaign 1: BOFU CBO (R$ 84/day)\nAd set 1: Warm audience\nAd set 2: Cold audience\nCampaign 2: TOFU Profile visits or Video views (R$ 16/day), only if the client has content/video to run. If not, 100% BOFU.', 'Campaign 1: BOFU CBO with a landing page or instant form (R$ 100/day).\nAd set 1: Warm audience\nAd set 2: Cold audience\nNo TOFU in this tier.'],
      ['Channels', 'Default: Meta.\nGoogle Search replaces BOFU only when (1) people already search for the product on Google and (2) the estimated CPC allows ≥ 10 clicks/day with R$ 84 (CPC up to R$ 8.40).', 'Default: a single channel, Meta or Google Search.\nSame two conditions (CPC up to R$ 10.00 with R$ 100/day). In B2B with active search intent Google usually wins.'],
      ['Budget', 'CBO on both campaigns', 'CBO'],
      ['Ad sets', 'Ad set 1 broad (the Lab runs here).\nAd set 2 retargeting or lookalike, with the winners from ad set 1. Each ad set needs a daily budget of ≥ 2× the target CPL.', 'Ad set 1 broad with a job title/industry signal.\nAd set 2 retargeting or lookalike, under the same rule.'],
      ['Audiences', 'Advantage+ broad as the default.\nRetargeting if there is an engagement/pixel audience; otherwise lookalike (≥ 1,000 events or a list); otherwise just ad set 1 until there is a source.', 'Broad with job title/industry.\nRetargeting or a lookalike of the customer base, under the same rule.'],
      ['Objective', 'BOFU: sales (WhatsApp or landing page). TOFU: reach + followers.', 'Leads (form or landing page) and MQL'],
      ['Lab (process inside BOFU)', 'Test 3 creatives per week, 12 per month, in ad set 1.\nAlways keep 6 creatives on standby to replace anything that stops performing right away.\nWinner criterion: spend ≥ 2× the target and cost below the target.', 'Same, with CPL. 7 to 10-day cycles per hypothesis because B2B conversion is slower.'],
      ['Active creatives per ad set', 'All of the month\'s creatives stay active at the same time (3 per week, up to 12 per month). Meta chooses where to concentrate delivery.\nOptimization rule: turn off the ad that goes over 2× the target CPA with the minimum spend reached, tag it as tested and Meta redistributes the budget.\nNever turn off an ad Meta didn\'t prioritize and never reactivate an ad tagged as tested in the same ad set.', 'Same rule, with CPL. Up to 12 per month.'],
      ['New creatives per month', '3 per week, up to 12/month, following the Lab sequence (creative → hook → headline → creative)', 'Same'],
      ['Tested tag', 'Required when turning off: _TESTADO suffix in the ad name + a ClickUp entry with the result (spend, conversions, cost).', 'Same'],
      ['Destination', 'WhatsApp or short landing page', 'Landing page with a form, or instant form'],
      ['Routine', 'Daily (15 min): spend vs. ceiling per campaign, anomalies, and which ads Meta is prioritizing and what each one costs.\nWeekly: close the week\'s hypothesis (document the winner in ClickUp), upload the next 3 variations, budget adjustment.', 'Same'],
      ['Cut-off metric', 'BOFU: CPA or cost per conversation. No conversions in the period, link CTR (hooks: 3s retention + CTR).', 'CPL. No conversions in the period, link CTR. If it spends 2× the target CPL, turn off the creative.'],
      ['Turn off', 'Only ads getting delivery. Condition: spend ≥ 2× the target and (0 conversions or cost ≥ 2× the target). Never before 72h of delivery. Saturation: frequency ≥ 3.5 over the last 7 days. Always with the tested tag.', 'Same, with CPL and a 7 to 10-day window.'],
      ['Scale', '+20% on the ad set when cost stays ≤ target for 3 days, up to the R$ 84/day ceiling (B2B: R$ 100). Past the ceiling = a proposal to move the client up a tier.', 'Same'],
      ['Expected results', 'R$ 2,520 of BOFU ÷ target CPA. E.g. CPA R$ 80 → ~31 sales or conversations', 'R$ 3,000 ÷ target CPL. E.g. CPL R$ 60 → ~50 leads'],
      ['Client reporting', 'Weekly summary on WhatsApp with the winner of the week\'s hypothesis + monthly Lab report with the validated kit (creative, hook, headline) and the criterion for each winner.', 'Same'],
    ],
    estrutura: {
      b2c: [
        {
          nome: 'BOFU', tipo: 'CBO', verba: 'R$ 84/day', sub: 'Campaign 1 · the Lab runs here',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Advantage+ broad', ads: ['AD 01 · 02 · 03  (wk 1: 3 creatives)', 'AD 04 · 05 · 06  (wk 2: 3 hooks)', 'AD 07 · 08 · 09  (wk 3: 3 headlines)', 'AD 10 · 11 · 12  (wk 4: 3 creatives)'], nota: 'all active · Meta chooses · the manager documents the winner' },
            { nome: 'Ad set 02', sub: 'Retargeting or Lookalike', ads: ['Winner 01', 'Winner 02', 'Winner 03'], nota: 'only the winners from Ad set 01' },
          ],
        },
        {
          nome: 'TOFU', tipo: '', verba: 'R$ 16/day', sub: 'Campaign 2',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Profile visits / Video views', ads: ['AD 01', 'AD 02', 'AD 03'], nota: 'only if the client has content' },
          ],
        },
      ],
      b2b: [
        {
          nome: 'BOFU', tipo: 'CBO', verba: 'R$ 100/day', sub: 'Campaign 1 · the Lab runs here',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Broad + job title', ads: ['AD 01 · 02 · 03  (wk 1)', 'AD 04 · 05 · 06  (wk 2)', 'AD 07 · 08 · 09  (wk 3)', 'AD 10 · 11 · 12  (wk 4)'], nota: 'same weekly sequence as B2C' },
            { nome: 'Ad set 02', sub: 'Retargeting or Lookalike', ads: ['Winner 01', 'Winner 02', 'Winner 03'], nota: 'only the winners from Ad set 01' },
          ],
        },
      ],
      google: {
        titulo: 'Google structure',
        ou: true,
        campanhas: [
          {
            nome: 'Search', tipo: '', verba: 'R$ 100/day', sub: 'Google campaign',
            conjuntos: [
              { nome: 'Ad group 01', sub: 'product', ads: ['AD 01', 'AD 02'] },
              { nome: 'Ad group 02', sub: 'product', ads: ['AD 01', 'AD 02'] },
              { nome: 'Ad group 03', sub: 'branding', ads: ['AD 01', 'AD 02'] },
            ],
          },
        ],
        nota: 'Only if people already search for the product. Never alongside Meta in this tier.',
      },
      pontos: {
        b2c: [
          'Test 3 creatives per week (up to 12 active in the month, all on), following the Lab sequence: creative → hook → headline → creative',
          'BOFU R$ 84/day on CBO with two ad sets + TOFU R$ 16/day only if the client has content',
          'Ad set 01 Broad (the Lab runs here). Ad set 02 Retargeting or Lookalike, only with the winners from 01',
          'Retargeting if there is an engagement/pixel audience; otherwise lookalike (≥ 1,000 events or a list); otherwise just Ad set 01 until there is a source',
          'One funnel: WhatsApp or short landing page',
          'Cut-off metric: CPA or cost per conversation. No conversions in the period, link CTR',
          'Optimization means turning off the creative whose cost is 2× above the target (spend ≥ 2× the target, never before 72h) and tagging it "_TESTADO". Meta redistributes to the ones not tested yet',
          'Never turn off an ad Meta didn\'t prioritize',
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When cost stays below the target for 3 days in a row'] },
          'Increase by 20% per day up to the R$ 84/day ceiling in BOFU. Past the ceiling = a proposal to move up a tier',
        ],
        b2b: [
          '1 campaign, 100% BOFU (R$ 100/day). No TOFU in this tier',
          'Ad set 01 Broad + job title/industry signal (the Lab runs here). Ad set 02 Retargeting or a Lookalike of the customer base, only with the winners from 01',
          'Each ad set needs a daily budget of ≥ 2× the target CPL, otherwise it becomes a single ad set',
          'Up to 12 creatives per month, all active, in the same weekly sequence as B2C',
          'Destination: landing page with a form or Meta instant form',
          'Cut-off metric: CPL. No conversions in the period, link CTR. Spent 2× the target CPL, turn off the creative and tag it "_TESTADO"',
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When the CPL stays below the target CPL for 3 days in a row'] },
          'Increase by 20% per day up to the R$ 100/day ceiling so CPM doesn\'t spike',
        ],
        google: [
          'Only replaces Meta when people already search for the product and the CPC allows ≥ 10 clicks/day (CPC ≤ R$ 8.40 in B2C, ≤ R$ 10 in B2B)',
          'In B2B with active search intent ("X software", "Y supplier") Google usually wins',
          '1 Search campaign, up to 3 ad groups, 2 ads per ad group',
          'Only one campaign, so you don\'t lose bids in the auction',
          { t: 'Optimization here means:', sub: ['adding negative keywords', 'changing headlines', 'changing ads'] },
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When the CPL is below the target CPL'] },
          'Increase the budget by 20% per day so CPC doesn\'t spike',
        ],
      },
      notas: {
        b2c: ['No Lab campaign: testing is the process inside Ad set 01.'],
        b2b: ['No TOFU. Destination: landing page with a form or instant form.'],
      },
    },
  },

  // ── R$ 4.000 ──────────────────────────────────────────────────────────────
  {
    id: '4k',
    label: 'R$ 4,000',
    verbaMensal: 4000,
    verbaDia: 133,
    resumo: 'Cold and warm become separate ABO campaigns, each ad set with a fixed budget. On CBO, Meta puts almost everything into cold and retargeting gets no delivery.',
    rows: [
      ['Daily budget', 'R$ 133', 'R$ 133'],
      ['Budget split', '• Cold BOFU: R$ 80/day (R$ 2,400/month)\n• Warm BOFU: R$ 30/day (R$ 900/month)\n• TOFU: R$ 23/day (R$ 700/month)', '• Cold BOFU: R$ 100/day (R$ 3,000/month)\n• Warm BOFU: R$ 33/day (R$ 1,000/month)\n• No TOFU'],
      ['Acquisition funnel type', '• WhatsApp funnel or\n• Short landing page funnel', '• Landing page with form funnel or\n• Instant form funnel (Meta)'],
      ['Structure', 'Campaign 1: Cold BOFU ABO (R$ 80/day)\nAd set 1: Advantage+ broad (R$ 50/day), the Lab runs here\nAd set 2: Lookalike or interests (R$ 30/day)\nCampaign 2: Warm BOFU ABO (R$ 30/day)\nAd set 1: Retargeting IG/FB engagement 30 to 90 days + website/landing page visitors + people who started a conversation and didn\'t buy\nCampaign 3: TOFU Profile visits or Video views (R$ 23/day), only if the client has content. If not, the budget goes to Cold BOFU', 'Campaign 1: Cold BOFU ABO (R$ 100/day)\nAd set 1: Broad with a job title/industry signal (R$ 60/day), the Lab runs here\nAd set 2: Lookalike of customers/leads or industry interests (R$ 40/day)\nCampaign 2: Warm BOFU ABO (R$ 33/day)\nAd set 1: Retargeting engagement + landing page visitors + leads that didn\'t become MQL\nNo TOFU in this tier'],
      ['Channels', 'Default: Meta. Google Search comes in as a parallel channel (doesn\'t replace) only if people already search for the product and the CPC allows ≥ 10 clicks/day with R$ 30 (CPC up to R$ 3.00). In that case Campaign 3 (TOFU) goes away and Google comes in with the R$ 23 + R$ 7 from Cold', 'Default: Meta. Google Search in parallel under the same rule, using R$ 33/day from Cold BOFU (CPC up to R$ 3.30). In B2B with active search intent, it is worth it'],
      ['Budget', 'ABO on the BOFU campaigns (fixed budget per ad set to guarantee delivery on warm). TOFU on CBO', 'ABO in BOFU'],
      ['Ad sets', 'Cold BOFU: 2. Warm BOFU: 1. TOFU: 1.\nRule: each ad set needs a daily budget of ≥ 2× the target CPL; if Cold\'s Ad set 2 doesn\'t get there, it goes away and the budget moves to Ad set 1', 'Cold BOFU: 2. Warm BOFU: 1. Same rule'],
      ['Audiences', 'Cold: Advantage+ broad + Lookalike (source ≥ 1,000 events or a list) or interests.\nWarm: IG/FB engagement 30 to 90 days, website/landing page visitors 30 days, started a WhatsApp conversation 30 days. Exclude buyers from warm', 'Cold: broad with job title/industry + customer lookalike or industry interests.\nWarm: engagement, landing page visitors, leads without MQL. Exclude MQLs and customers'],
      ['Objective', 'BOFU: sales (WhatsApp or landing page). TOFU: reach + followers', 'Leads (form or landing page) and MQL'],
      ['Lab (inside Cold BOFU, Ad set 1)', 'Test 3 creatives per week, 12 per month, always in Cold\'s Ad set 1.\nAlways keep 6 creatives on standby to replace anything that stops performing right away.\nWinner criterion: spend ≥ 2× the target and cost below the target.\nThe Cold winner is replicated in Cold\'s Ad set 2 and in Warm. Warm doesn\'t test creatives: it only runs winners, with copy adjusted for people who already know the brand (offer, proof, urgency)', 'Same, with CPL. The winner goes to Cold\'s Ad set 2 and to Warm with re-engagement copy (case study, proof, call to book a meeting)'],
      ['Active creatives per ad set', 'Cold Ad set 1: all of the month\'s creatives active (up to 12), Meta chooses. Cold Ad set 2 and Warm: 3 to 4 winners.\nOptimization rule: turn off the ad that goes over 2× the target CPA with the minimum spend reached, tag it as tested and bring one in from standby.\nNever turn off an ad Meta didn\'t prioritize and never reactivate an ad tagged as tested in the same ad set', 'Same, with CPL'],
      ['New creatives per month', '3 per week, up to 12/month, plus the 6 on standby ready to go (a mix of static and video/reels)', 'Same'],
      ['Tested tag', 'Required when turning off: _TESTADO suffix in the ad name + a ClickUp entry with the result (spend, conversions, cost)', 'Same'],
      ['Destination', 'WhatsApp or short landing page', 'Landing page with a form, or instant form'],
      ['Routine', 'Daily (20 min): spend vs. ceiling per campaign and per ad set (ABO means checking ad set by ad set), anomalies, what Meta prioritizes in Cold, Warm frequency.\nWeekly: close the week\'s hypothesis in ClickUp, upload the 3 new creatives to Cold, replicate the winner in Warm, refill the standby pool', 'Same'],
      ['Cut-off metric', 'Cold: CPA or cost per conversation. Warm: CPA, with frequency as the alarm (≥ 5 in 7 days = swap the creative). No conversions in the period, link CTR', 'CPL and cost per MQL. Warm: frequency ≥ 5 in 7 days = swap the creative'],
      ['Turn off', 'Only ads getting delivery. Spend ≥ 2× the target and (0 conversions or cost ≥ 2× the target). Never before 72h. Saturation: frequency ≥ 3.5 on Cold and ≥ 5 on Warm over the last 7 days. Always with the tested tag', 'Same, with CPL and a 7 to 10-day window'],
      ['Scale', '+20% on the ad set when cost stays ≤ target for 3 days, up to the campaign ceiling. Budget can move between Cold and Warm (e.g. warm saturated → back to cold), without exceeding R$ 133/day in total. Past the ceiling = a proposal to move up a tier', 'Same'],
      ['Client reporting', 'Weekly summary on WhatsApp with the winner of the week + monthly report with results split Cold vs. Warm (cost per conversion for each) and the validated kit', 'Same'],
      ['Entry condition', 'The minimum budget per ad set rule (≥ 2× target CPL/day) has to work for Warm and Lookalike at R$ 30/day: it only fits if the target CPL is up to R$ 15. Above that, use the R$ 3,000 structure with more budget.', 'Same, with R$ 33/day on Warm (target CPL up to R$ 16).'],
    ],
    estrutura: {
      b2c: [
        {
          nome: 'Cold BOFU', tipo: 'ABO', verba: 'R$ 80/day', sub: 'Campaign 1',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Advantage+ broad · R$ 50/day', ads: ['AD 01-03 · wk 1', 'AD 04-06 · wk 2', 'AD 07-12 · wk 3-4'], nota: 'the Lab runs here · all active · 6 on standby' },
            { nome: 'Ad set 02', sub: 'Lookalike / interests · R$ 30/day', ads: ['Winner 01', 'Winner 02'] },
          ],
        },
        {
          nome: 'Warm BOFU', tipo: 'ABO', verba: 'R$ 30/day', sub: 'Campaign 2',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Engagement + website + open conversation', ads: ['Winner 01', 'Winner 02', 'Winner 03'], nota: 're-engagement copy · frequency ≥ 5 in 7 days = swap the creative' },
          ],
        },
        {
          nome: 'TOFU', tipo: '', verba: 'R$ 23/day', sub: 'Campaign 3',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Profile visits / Video views', ads: ['AD 01', 'AD 02', 'AD 03'], nota: 'only if the client has content' },
          ],
        },
      ],
      b2b: [
        {
          nome: 'Cold BOFU', tipo: 'ABO', verba: 'R$ 100/day', sub: 'Campaign 1',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Broad + job title · R$ 60/day', ads: ['AD 01-03 · wk 1', 'AD 04-06 · wk 2', 'AD 07-12 · wk 3-4'], nota: 'the Lab runs here · all active · 6 on standby' },
            { nome: 'Ad set 02', sub: 'Lookalike / interests · R$ 40/day', ads: ['Winner 01', 'Winner 02'] },
          ],
        },
        {
          nome: 'Warm BOFU', tipo: 'ABO', verba: 'R$ 33/day', sub: 'Campaign 2',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Engagement + landing page + leads without MQL', ads: ['Winner 01', 'Winner 02', 'Winner 03'], nota: 're-engagement copy · frequency ≥ 5 in 7 days = swap the creative' },
          ],
        },
      ],
      google: {
        titulo: 'Google structure',
        paralelo: true,
        campanhas: [
          {
            nome: 'Search', tipo: '', verba: 'up to R$ 30/day', sub: 'Google campaign',
            conjuntos: [
              { nome: 'Ad group 01', sub: 'product', ads: ['AD 01', 'AD 02'] },
              { nome: 'Ad group 02', sub: 'product', ads: ['AD 01', 'AD 02'] },
              { nome: 'Ad group 03', sub: 'branding', ads: ['AD 01', 'AD 02'] },
            ],
          },
        ],
        nota: 'Only if people already search for the product. B2C: Campaign 3 (TOFU) goes away and Google comes in with R$ 23 + R$ 7 from Cold. B2B: R$ 33/day taken from Cold BOFU.',
      },
      pontos: {
        b2c: [
          'Cold and warm become separate ABO campaigns: on CBO, Meta puts almost everything into cold and retargeting gets no delivery',
          'Cold BOFU R$ 80/day (Ad set 01 Broad R$ 50 + Ad set 02 Lookalike/interests R$ 30) · Warm BOFU R$ 30/day · TOFU R$ 23/day only with content',
          'The Lab runs in Cold\'s Ad set 01: 3 creatives per week, 12 per month, always 6 on standby',
          'The Cold winner (spend ≥ 2× the target and cost below the target) is replicated in Ad set 02 and in Warm. Warm doesn\'t test creatives, it only runs winners with re-engagement copy (offer, proof, urgency)',
          'Warm: IG/FB engagement 30 to 90 days + website/landing page visitors 30 days + people who started a conversation and didn\'t buy. Exclude buyers',
          'Cut-off metric: CPA or cost per conversation. On Warm, frequency ≥ 5 in 7 days = swap the creative',
          'Optimization means turning off the creative whose cost is 2× above the target (spend ≥ 2× the target, never before 72h), tagging it "_TESTADO" and bringing one in from standby',
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When cost stays below the target for 3 days in a row'] },
          'Increase by 20% on the ad set up to the campaign ceiling. Budget can move between Cold and Warm without exceeding R$ 133/day',
          'Entry condition: Warm and Lookalike at R$ 30/day only work if the target CPL is up to R$ 15. Above that, the R$ 3,000 structure with more budget',
        ],
        b2b: [
          'Cold BOFU ABO R$ 100/day (Ad set 01 Broad + job title R$ 60 + Ad set 02 Lookalike/industry interests R$ 40) · Warm BOFU ABO R$ 33/day · No TOFU',
          'The Lab runs in Cold\'s Ad set 01: 3 creatives per week, 12 per month, 6 on standby',
          'The winner goes to Cold\'s Ad set 02 and to Warm with re-engagement copy (case study, proof, call to book a meeting)',
          'Warm: engagement + landing page visitors + leads that didn\'t become MQL. Exclude MQLs and customers',
          'Destination: landing page with a form or instant form. Objective: leads and MQL',
          'Cut-off metric: CPL and cost per MQL. On Warm, frequency ≥ 5 in 7 days = swap the creative',
          'Optimization means turning off the creative whose CPL is 2× above the target (spend ≥ 2× the target, 7 to 10-day window), tagging it "_TESTADO" and bringing one in from standby',
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When the CPL stays below the target CPL for 3 days in a row'] },
          'Increase by 20% on the ad set up to the campaign ceiling, without exceeding R$ 133/day in total',
          'Entry condition: Warm at R$ 33/day only works with a target CPL up to R$ 16',
        ],
        google: [
          'Runs in parallel with Meta (doesn\'t replace it), only if people already search for the product and the CPC allows ≥ 10 clicks/day (CPC ≤ R$ 3.00 in B2C, ≤ R$ 3.30 in B2B)',
          'B2C: Campaign 3 (TOFU) goes away and Google comes in with R$ 23 + R$ 7 from Cold. B2B: R$ 33/day from Cold BOFU. In B2B with active search intent, it is worth it',
          '1 Search campaign, up to 3 ad groups, 2 ads per ad group',
          { t: 'Optimization here means:', sub: ['adding negative keywords', 'changing headlines', 'changing ads'] },
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When the CPL is below the target CPL'] },
          'Increase the budget by 20% per day so CPC doesn\'t spike',
        ],
      },
      notas: {
        b2c: ['The winner from Cold\'s Ad set 01 is replicated in Ad set 02 and in Warm.', 'TOFU only if the client has content; otherwise the budget goes to Cold BOFU.'],
        b2b: ['No TOFU. Warm excludes MQLs and customers. Objective: leads and MQL.'],
      },
    },
  },

  // ── R$ 5.000 ──────────────────────────────────────────────────────────────
  {
    id: '5k',
    label: 'R$ 5,000',
    verbaMensal: 5000,
    verbaDia: 166,
    resumo: 'In B2B, middle of funnel comes in (lead magnet or webinar), feeding a more qualified warm audience. In B2C the R$ 4,000 structure gets more budget and Google fits in parallel.',
    rows: [
      ['Daily budget', 'R$ 166', 'R$ 166'],
      ['Budget split', '• Cold BOFU: R$ 100/day (R$ 3,000/month)\n• Warm BOFU: R$ 36/day (R$ 1,080/month)\n• TOFU: R$ 30/day (R$ 900/month)', '• MOFU: R$ 66/day (R$ 2,000/month)\n• Cold BOFU: R$ 60/day (R$ 1,800/month)\n• Warm BOFU: R$ 40/day (R$ 1,200/month)\n• No TOFU'],
      ['Acquisition funnel type', '• WhatsApp funnel or\n• Short landing page funnel', '• Lead magnet funnel (e-book, checklist, spreadsheet, assessment) or\n• Webinar funnel (1 per month)\n+ Landing page with form funnel in BOFU'],
      ['Structure', 'Campaign 1: Cold BOFU ABO (R$ 100/day)\nAd set 1: Advantage+ broad (R$ 60/day), the Lab runs here\nAd set 2: Lookalike or interests (R$ 40/day)\nCampaign 2: Warm BOFU ABO (R$ 36/day)\nAd set 1: engagement 30 to 90 days + website/landing page visitors + open conversation without a purchase\nCampaign 3: TOFU Profile visits or Video views (R$ 30/day), only with content', 'Campaign 1: MOFU ABO (R$ 66/day), Leads objective\nAd set 1: Broad with job title/industry (R$ 40/day), the Lab runs here\nAd set 2: Lookalike of customers/leads or industry interests (R$ 26/day)\nDestination: lead magnet opt-in page or webinar registration page\nCampaign 2: Cold BOFU ABO (R$ 60/day)\nAd set 1: Broad with job title/industry, direct application landing page / form\nCampaign 3: Warm BOFU ABO (R$ 40/day)\nAd set 1: people who downloaded the lead magnet or registered for the webinar (30 to 60 days) + engagement + landing page visitors + leads without MQL. Destination: meeting/assessment landing page or sales WhatsApp'],
      ['Middle of funnel (B2B)', 'Doesn\'t run. In B2C the "middle" is TOFU with content', 'Lead magnet: runs continuously. Only worth it if ≥ 10% of lead magnet leads become MQL within 30 days; below that, turn it off and the budget goes back to Cold BOFU.\nWebinar: 1 per month. The registration campaign runs 10 to 14 days before with the R$ 66/day; in the 3 days before the event, R$ 20/day becomes a reminder to the registrant audience; after the event, 7 days of replay + offer on Warm.\nCost target: MOFU CPL ≤ 1/3 of the BOFU CPL. E.g. BOFU CPL R$ 60 → lead magnet/registration up to R$ 20'],
      ['Channels', 'Meta + Google Search in parallel, if people already search for the product. Google uses up to R$ 30/day taken from Cold (Ad set 2), CPC up to R$ 3.00. TOFU stays', 'Meta + Google Search in parallel under the same rule, with up to R$ 30/day from Cold BOFU. In B2B with active search intent (software, supplier, consulting), Google comes in by default'],
      ['Budget', 'ABO on the BOFU campaigns. TOFU on CBO', 'ABO on all three campaigns'],
      ['Ad sets', 'Cold BOFU: 2. Warm: 1. TOFU: 1.\nRule: each ad set ≥ 2× target CPL per day; whatever doesn\'t get there goes away and the budget moves to Cold\'s Ad set 1', 'MOFU: 2. Cold BOFU: 1. Warm: 1.\nSame rule (in MOFU, the reference is the lead magnet/registration CPL)'],
      ['Audiences', 'Cold: Advantage+ broad + Lookalike (source ≥ 1,000 events or a list) or interests.\nWarm: engagement, visitors, open conversation. Exclude buyers', 'MOFU and Cold: broad with job title/industry + customer lookalike or industry interests.\nWarm: lead magnet/webinar leads + engagement + landing page visitors + leads without MQL. Exclude MQLs and customers from everything'],
      ['Objective', 'BOFU: sales (WhatsApp or landing page). TOFU: reach + followers', 'MOFU: lead magnet leads/registrants. BOFU: leads, MQL and meetings'],
      ['Lab', 'Test 3 creatives per week, 12 per month, in Cold\'s Ad set 1. 6 on standby.\nWinner criterion: spend ≥ 2× the target and cost below the target.\nThe winner is replicated in Ad set 2 and in Warm with re-engagement copy', 'The Lab runs in MOFU\'s Ad set 1 (where there is the most conversion volume). 3 creatives/week, 6 on standby, same criterion.\nThe winning angle is adapted for Cold BOFU (same promise, book-a-meeting CTA) and for Warm (re-engagement copy: "you downloaded the guide, now...").\nWebinar: 3 registration creatives per edition, tested in the first 4 days'],
      ['Active creatives per ad set', 'Cold Ad set 1: up to 12 active, Meta chooses. Ad set 2 and Warm: 3 to 4 winners.\nOptimization rule: turn off whatever goes over 2× the target CPA with the minimum spend, tag it as tested, bring one in from standby.\nNever turn off what Meta didn\'t prioritize', 'MOFU Ad set 1: up to 12 active. MOFU Ad set 2, Cold BOFU and Warm: 3 to 4 winners. Same rule, with CPL'],
      ['New creatives per month', '3 per week, up to 12/month + 6 on standby', '3 per week, up to 12/month + 6 on standby, + 3 registration creatives per webinar'],
      ['Tested tag', 'Required when turning off: _TESTADO suffix + a ClickUp entry with the result', 'Same'],
      ['Destination', 'WhatsApp or short landing page', 'MOFU: opt-in or registration page (with the Lead pixel event). BOFU: landing page with a form. Warm: meeting/assessment landing page or sales WhatsApp'],
      ['Routine', 'Daily (20 min): spend per campaign and ad set, anomalies, what Meta prioritizes in Cold, Warm frequency.\nWeekly: the week\'s hypothesis, 3 new creatives, replicate the winner, refill the standby pool', 'Same + weekly: MOFU lead → MQL rate (from the CRM or the Client Area), to decide whether MOFU continues.\nWebinar: 30-day calendar (registration → reminder → event → replay)'],
      ['Cut-off metric', 'Cold: CPA or cost per conversation. Warm: CPA + frequency ≥ 5 in 7 days = swap. No conversions, link CTR', 'MOFU: lead magnet/registration CPL and landing page conversion rate (20 to 50%; below 20% the problem is the landing page, not the ad).\nBOFU: CPL and cost per MQL. Warm: cost per meeting + frequency ≥ 5'],
      ['Turn off', 'Only ads getting delivery. Spend ≥ 2× the target and (0 conversions or cost ≥ 2× the target). Never before 72h. Frequency ≥ 3.5 on Cold, ≥ 5 on Warm', 'Same. In MOFU the target is the lead magnet CPL; in BOFU, the CPL/MQL; 7 to 10-day window'],
      ['Scale', '+20% on the ad set with cost ≤ target for 3 days, up to the campaign ceiling. Budget moves between Cold, Warm and Google without exceeding R$ 166/day', 'Same. If MOFU delivers cheaper MQLs than BOFU for 2 weeks, move budget from Cold BOFU to MOFU (up to 50/50). If the opposite, MOFU shrinks to R$ 40/day or is turned off'],
      ['Expected results', 'R$ 3,000 of Cold ÷ target CPA + whatever Warm converts. E.g. CPA R$ 80 → ~37 sales from cold', 'MOFU: R$ 2,000 ÷ R$ 20 = ~100 lead magnet leads/registrants, 10% to MQL = ~10 MQLs.\nBOFU: R$ 1,800 ÷ R$ 60 = ~30 leads.\nWarm: meetings at a cost below BOFU'],
      ['Client reporting', 'Weekly summary on WhatsApp + monthly report with Cold vs. Warm vs. Google and the validated kit', 'Same + the full funnel: MOFU leads → MQL → meeting, with cost per stage. Webinar: registrants, attendance, meetings generated'],
      ['Entry condition', '', 'The client needs the lead magnet ready (or the capacity to run 1 webinar/month) and the sales team following up on MOFU leads within 24h. Without that, MOFU only generates cheap leads nobody works, and the right structure is the R$ 4,000 one with more budget'],
    ],
    estrutura: {
      b2c: [
        {
          nome: 'Cold BOFU', tipo: 'ABO', verba: 'R$ 100/day', sub: 'Campaign 1',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Advantage+ broad · R$ 60/day', ads: ['AD 01-03 · wk 1', 'AD 04-06 · wk 2', 'AD 07-12 · wk 3-4'], nota: 'the Lab runs here · all active · 6 on standby' },
            { nome: 'Ad set 02', sub: 'Lookalike · R$ 40/day', ads: ['Winner 01', 'Winner 02'] },
          ],
        },
        {
          nome: 'Warm BOFU', tipo: 'ABO', verba: 'R$ 36/day', sub: 'Campaign 2',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Engagement + website + conversation', ads: ['Winner 01', 'Winner 02', 'Winner 03'], nota: 're-engagement copy · frequency ≥ 5 in 7 days = swap' },
          ],
        },
        {
          nome: 'TOFU', tipo: '', verba: 'R$ 30/day', sub: 'Campaign 3',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Profile visits / Video views', ads: ['AD 01', 'AD 02', 'AD 03'] },
          ],
        },
      ],
      b2b: [
        {
          nome: 'MOFU (Lead magnet, Webinar)', tipo: 'ABO', verba: 'R$ 66/day', sub: 'Campaign 1 · Leads',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Broad + job title · R$ 40/day', ads: ['AD 01-03 · wk 1', 'AD 04-06 · wk 2', 'AD 07-12 · wk 3-4'], nota: 'the Lab runs here · lead magnet page or webinar registration' },
            { nome: 'Ad set 02', sub: 'Lookalike · R$ 26/day', ads: ['Winner 01', 'Winner 02'], nota: 'Leads objective · e-book, checklist, assessment or webinar registration' },
          ],
        },
        {
          nome: 'Cold BOFU', tipo: 'ABO', verba: 'R$ 60/day', sub: 'Campaign 2',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'Broad + job title', ads: ['Winner 01', 'Winner 02', 'Winner 03'], nota: 'same promise as MOFU, book-a-meeting CTA · application landing page' },
          ],
        },
        {
          nome: 'Warm BOFU', tipo: 'ABO', verba: 'R$ 40/day', sub: 'Campaign 3',
          conjuntos: [
            { nome: 'Ad set 01', sub: 'MOFU leads + engagement + landing page', ads: ['Winner 01', 'Winner 02', 'Winner 03'], nota: 're-engagement copy · meeting landing page or sales WhatsApp' },
          ],
        },
      ],
      google: {
        titulo: 'Google structure',
        paralelo: true,
        campanhas: [
          {
            nome: 'Search', tipo: '', verba: 'up to R$ 30/day', sub: 'Google campaign',
            conjuntos: [
              { nome: 'Ad group 01', sub: 'product', ads: ['AD 01', 'AD 02'] },
              { nome: 'Ad group 02', sub: 'product', ads: ['AD 01', 'AD 02'] },
              { nome: 'Ad group 03', sub: 'branding', ads: ['AD 01', 'AD 02'] },
            ],
          },
        ],
        nota: 'In parallel with Meta, only if people already search for the product. Budget of up to R$ 30/day taken from Cold BOFU (B2C: Ad set 02). In B2B with active search intent it comes in by default.',
      },
      pontos: {
        b2c: [
          'The R$ 4,000 structure with more budget: Cold BOFU ABO R$ 100/day (Ad set 01 Broad R$ 60 + Ad set 02 Lookalike R$ 40) · Warm BOFU R$ 36/day · TOFU R$ 30/day only with content',
          'The Lab runs in Cold\'s Ad set 01: 3 creatives per week, 12 per month, 6 on standby',
          'The winner (spend ≥ 2× the target and cost below the target) is replicated in Ad set 02 and in Warm with re-engagement copy',
          'Warm: engagement 30 to 90 days + website/landing page visitors + open conversation without a purchase. Exclude buyers',
          'Cut-off metric: CPA or cost per conversation. On Warm, frequency ≥ 5 in 7 days = swap the creative',
          'Optimization means turning off the creative whose cost is 2× above the target (never before 72h), tagging it "_TESTADO" and bringing one in from standby. Never turn off what Meta didn\'t prioritize',
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When cost stays below the target for 3 days in a row'] },
          'Increase by 20% on the ad set up to the campaign ceiling. Budget moves between Cold, Warm and Google without exceeding R$ 166/day',
        ],
        b2b: [
          'Middle of funnel comes in: Campaign 1 MOFU ABO R$ 66/day (lead magnet or webinar) · Campaign 2 Cold BOFU ABO R$ 60/day · Campaign 3 Warm BOFU ABO R$ 40/day · No TOFU',
          'The Lab runs in MOFU\'s Ad set 01 (where the volume is). The winning angle is adapted for Cold BOFU (book-a-meeting CTA) and for Warm ("you downloaded the guide, now...")',
          'The lead magnet runs continuously and only stays on if ≥ 10% of leads become MQL within 30 days. Webinar: 1 per month, registration 10 to 14 days before, reminder in the 3 days before, 7 days of replay + offer on Warm',
          'MOFU cost target: CPL ≤ 1/3 of the BOFU CPL (e.g. BOFU R$ 60 → lead magnet/registration up to R$ 20)',
          'Warm: people who downloaded the lead magnet or registered (30 to 60 days) + engagement + landing page visitors + leads without MQL. Exclude MQLs and customers from everything',
          'Cut-off metric: MOFU = lead magnet CPL and landing page conversion (20 to 50%; below 20% the problem is the landing page). BOFU = CPL and cost per MQL. Warm = cost per meeting + frequency ≥ 5',
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When the CPL stays below the target CPL for 3 days in a row', '3) If MOFU delivers cheaper MQLs than BOFU for 2 weeks, move budget from Cold to MOFU (up to 50/50)'] },
          'Entry condition: lead magnet ready (or 1 webinar/month) and sales following up on MOFU leads within 24h. Without that, the R$ 4,000 structure with more budget',
        ],
        google: [
          'Runs in parallel with Meta, if people already search for the product. Up to R$ 30/day taken from Cold BOFU (B2C: Ad set 02), CPC ≤ R$ 3.00',
          'In B2B with active search intent (software, supplier, consulting) Google comes in by default',
          '1 Search campaign, up to 3 ad groups, 2 ads per ad group',
          { t: 'Optimization here means:', sub: ['adding negative keywords', 'changing headlines', 'changing ads'] },
          { t: 'When to scale?', sub: ['1) When the calculated ROAS is above 3', '2) When the CPL is below the target CPL'] },
          'Increase the budget by 20% per day so CPC doesn\'t spike. The monthly report splits Cold vs. Warm vs. Google',
        ],
      },
      notas: {
        b2c: ['The winner from Cold\'s Ad set 01 is replicated in Ad set 02 and in Warm.'],
        b2b: ['Whoever converted in MOFU (downloaded the lead magnet / registered for the webinar) becomes the Warm audience.', 'No TOFU. MOFU only continues if ≥ 10% of leads become MQL within 30 days.'],
      },
    },
  },
]
