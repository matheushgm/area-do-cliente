// ─── VSL — Definição de slots do wireframe ────────────────────────────────────
// Cada wireframe descreve uma página real como um conjunto de "slots" (campos de
// texto) que a copy preenche. Este schema é a fonte da verdade para:
//   1. os placeholders mostrados no wireframe quando ainda não há copy;
//   2. (futuro) a geração estruturada da copy pela IA, campo a campo;
//   3. a edição/refino de cada bloco.
//
// `placeholder` = texto-guia cinza que aparece no lugar quando o slot está vazio,
// dizendo ao copywriter/designer o que entra ali.

export const VSL_WIREFRAME = {
  id: 'vsl',
  name: 'VSL — Video Sales Letter',
  description:
    'Página de vendas ancorada em um vídeo (VSL). Hero com vídeo + CTA, prova, oferta e preço.',

  // Estrutura de conteúdo padrão (vazia) — toda copy de VSL tem este shape.
  emptyContent: {
    announcement: '',
    headline: '',
    subheadline: '',
    heroCta: '',
    forWhomTitle: '',
    cards: [
      { title: '', desc: '' },
      { title: '', desc: '' },
      { title: '', desc: '' },
      { title: '', desc: '' },
    ],
    offerTitle: '',
    offerText: '',
    discountValue: '',
    discountLabel: '',
    offerCta: '',
    storyTitle: '',
    storyText: '',
    opportunityTitle: '',
    bullets: ['', '', '', ''],
    priceLabel: '',
    price: '',
    priceSecondary: '',
    priceCta: '',
    testimonials: [
      { name: '', role: '', text: '' },
      { name: '', role: '', text: '' },
      { name: '', role: '', text: '' },
    ],
  },

  // Textos-guia por slot (mostrados quando vazio).
  placeholders: {
    announcement: 'Barra de aviso (ex: oferta por tempo limitado) — opcional',
    headline: 'Headline principal — a promessa da VSL (use **negrito** para destacar)',
    subheadline: 'Subtítulo — reforça a promessa e o mecanismo único',
    heroCta: 'Botão principal (ex: Quero saber mais)',
    forWhomTitle: 'Título da seção "Para quem é a oferta"',
    cardTitle: 'Título do card',
    cardDesc: 'Descrição curta do benefício/dor',
    offerTitle: 'Título da oferta / desconto',
    offerText: 'Parágrafo que apresenta a oferta',
    discountValue: '40%',
    discountLabel: 'de desconto',
    offerCta: 'Botão da oferta (ex: Ver oferta)',
    storyTitle: 'Título da história de sucesso (ex: Veja a história de quem já ajudamos)',
    storyText: 'Depoimento/história em prosa — prova social',
    opportunityTitle: 'Título da seção de preço (ex: Oportunidade única)',
    bullet: 'Benefício incluído na oferta',
    priceLabel: 'Linha acima do preço (ex: ou 12x de)',
    price: 'R$ 49,90',
    priceSecondary: 'ou R$ 588 à vista',
    priceCta: 'Botão de compra (ex: Quero aprender)',
    testimonialName: 'Nome',
    testimonialRole: 'Cargo / contexto',
    testimonialText: 'Depoimento curto',
  },
}
