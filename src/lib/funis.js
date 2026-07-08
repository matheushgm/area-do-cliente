// Catálogo de funis usado na criação de anúncios. Cada anúncio roda em UM funil,
// e o funil define o OBJETIVO e o CTA da peça (o `objetivo` entra no prompt).
// Os ids acompanham o catálogo do Kickoff (KickoffFunnelRecommendations.js).
// Mantido em sincronia com FUNIS_OBJETIVO em api/criativos-public.js.

export const FUNIS = [
  {
    id: 'webinar',
    label: 'Funil de Webinar',
    icon: '🎥',
    meta: 'inscrição na aula ao vivo',
    objetivo:
      'Convidar a pessoa para se INSCREVER e ASSISTIR a um webinar/aula ao vivo gratuita. O CTA leva ao cadastro e à presença na live — NUNCA à compra direta. Venda a transformação que ela terá ao participar da aula.',
  },
  {
    id: 'webinar_pago',
    label: 'Funil de Webinar Pago',
    icon: '💎',
    meta: 'garantir vaga na aula paga',
    objetivo:
      'Convidar para um webinar/aula ao vivo com uma entrada simbólica paga. O CTA é GARANTIR A VAGA pagando o valor de entrada. Trate o preço baixo como filtro de qualificação (quem paga leva a sério), não como objeção. Não venda o produto final.',
  },
  {
    id: 'diagnostico',
    label: 'Funil de Diagnóstico',
    icon: '🔍',
    meta: 'agendar reunião 1x1',
    objetivo:
      'Levar a pessoa a AGENDAR uma reunião/sessão de diagnóstico 1x1 (gratuita). O CTA é agendar a conversa. A promessa é o diagnóstico específico que ela recebe na reunião — não o produto final.',
  },
  {
    id: 'aplicacao',
    label: 'Funil de Aplicação',
    icon: '📋',
    meta: 'aplicar e falar com o time',
    objetivo:
      'Levar a pessoa a PREENCHER UMA APLICAÇÃO/formulário para ser aprovada e então falar com o time numa reunião 1x1. O CTA é "aplicar" / "candidatar-se". Posicione como vaga seletiva, de ticket alto — nem todo mundo é aprovado.',
  },
  {
    id: 'vsl',
    label: 'Funil de VSL',
    icon: '📹',
    meta: 'assistir ao vídeo de vendas',
    objetivo:
      'Levar a pessoa a ASSISTIR a um vídeo de vendas (VSL) que revela o método/solução. O CTA é "assista ao vídeo". A ação de compra ou agendamento acontece ao final do vídeo, não no anúncio.',
  },
  {
    id: 'isca_digital',
    label: 'Funil de Isca Digital',
    icon: '🧲',
    meta: 'baixar material gratuito',
    objetivo:
      'Levar a pessoa a BAIXAR um material gratuito (eBook, kit, planilha, checklist). O CTA é baixar/receber o material. A promessa é o valor do material em si — não venda o produto principal aqui.',
  },
  {
    id: 'quiz',
    label: 'Funil de Quiz',
    icon: '❓',
    meta: 'responder o quiz',
    objetivo:
      'Levar a pessoa a RESPONDER um quiz/diagnóstico rápido que revela algo sobre ela. O CTA é "faça o quiz" / "descubra seu resultado". A curiosidade sobre o resultado é o motor — não venda o produto direto.',
  },
  {
    id: 'lancamento',
    label: 'Lançamento',
    icon: '🚀',
    meta: 'entrar na lista de espera',
    objetivo:
      'Aquecer a pessoa para um LANÇAMENTO com data marcada. O CTA é entrar na lista/grupo de espera para participar da abertura. Construa antecipação e escassez de janela — as vagas/condições só existem no evento.',
  },
  {
    id: 'desafio',
    label: 'Funil de Desafio',
    icon: '🏆',
    meta: 'inscrever-se no desafio',
    objetivo:
      'Convidar a pessoa para um DESAFIO de poucos dias (ex.: desafio de 5 dias). O CTA é inscrever-se no desafio. Venda a pequena transformação prática que ela alcança ao final — não o produto principal.',
  },
  {
    id: 'ecommerce',
    label: 'Funil de E-commerce (Venda Direta)',
    icon: '🛒',
    meta: 'comprar agora',
    objetivo:
      'Levar a pessoa DIRETO À COMPRA do produto no site. O CTA é comprar / aproveitar a oferta agora. Pode falar preço, desconto, condições, frete e urgência de estoque. É o único funil de venda direta.',
  },
  {
    id: 'wymb',
    label: 'Funil Win-Your-Money-Back',
    icon: '🛡️',
    meta: 'contratar com garantia total',
    objetivo:
      'Vender um serviço com GARANTIA de devolução total do dinheiro se não houver o resultado prometido. O CTA é contratar/agendar. Use a garantia como a quebra de objeção central: risco zero para o cliente.',
  },
]

export const FUNIS_BY_ID = Object.fromEntries(FUNIS.map((f) => [f.id, f]))
