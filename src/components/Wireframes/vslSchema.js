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

  // Textos-guia de cada slot vazio: src/i18n/locales/{pt,en}/wireframes.js (vsl.ph).
}
