// ─── Níveis de consciência (Eugene Schwartz) ─────────────────────────────────
// O nível é um INPUT do usuário: ele diz em que nível o público-alvo dele está
// para aquela oferta, e TODAS as peças da geração são escritas nesse nível.
// (Antes o sistema gerava uma peça por nível, o que espalhava a comunicação em
// vez de focar na dor certa.)
//
// Sobre o nível 5: não é quem já conhece a nossa marca e só falta o empurrão —
// isso seria remarketing, que raramente rodamos em aquisição. É quem já decidiu
// resolver e está comparando 2 ou 3 fornecedores ao mesmo tempo.
//
// Mantido em sincronia com api/criativos-public.js (edge function autocontida).

export const NIVEIS_CONSCIENCIA = [
  {
    id: 'inconsciente',
    num: 1,
    label: 'Inconsciente do problema',
    hint: 'Nem sabe que tem o problema',
    video: `Ela não sabe que tem o problema — nunca parou pra pensar nisso. Entre pelo cotidiano dela, mostre uma cena que ela reconhece como normal e revele que aquilo é um problema (e o que está custando). Só depois conecte à solução. Tipo de mensagem: StoryTelling, Proclamação.`,
    estatico: `Nomeia um problema que ela ainda não percebeu, partindo de uma cena do cotidiano dela. Não cite o produto e não pressuponha que ela já sente a dor.`,
  },
  {
    id: 'problema',
    num: 2,
    label: 'Consciente do problema',
    hint: 'Sente a dor, mas não procura solução',
    video: `Ela sente a dor, mas está conformada ou acha que não tem jeito. Amplifique o custo de continuar assim e revele que existe saída. Não perca tempo explicando o problema — ela já vive ele. Tipo de mensagem: Segredos que ninguém te conta, Problema e Solução.`,
    estatico: `Fala da dor que ela já sente na pele e do custo de não resolver. Ainda não apresenta o produto.`,
  },
  {
    id: 'solucao',
    num: 3,
    label: 'Consciente da solução',
    hint: 'Sabe que existe solução, não conhece a sua',
    video: `Ela sabe que existe um tipo de solução e provavelmente já tentou alguma coisa que não funcionou. Mostre por que o seu mecanismo é diferente do que ela já tentou e por que é o caminho certo. Tipo de mensagem: Problema e Solução, Segredos que ninguém te conta.`,
    estatico: `Apresenta o mecanismo/caminho da solução e por que ele é diferente do que ela já tentou, sem depender do nome do produto.`,
  },
  {
    id: 'produto',
    num: 4,
    label: 'Consciente do produto',
    hint: 'Conhece o produto, mas não se convenceu',
    video: `Ela já conhece o seu produto ou o seu tipo de produto, mas travou numa objeção. Ataque essa objeção específica de frente, com prova, diferencial e demonstração. Tipo de mensagem: Promessa, Prova.`,
    estatico: `Nomeia o produto e ataca a objeção principal com prova ou diferencial concreto.`,
  },
  {
    id: 'comparando',
    num: 5,
    label: 'Comparando fornecedores',
    hint: 'Já decidiu resolver, está escolhendo entre marcas',
    video: `Ela já decidiu que vai resolver e está cotando duas ou três marcas ao mesmo tempo. Atenção: NÃO é alguém que já conhece a sua marca e só falta o empurrão (isso seria remarketing, que não é o caso aqui). O roteiro precisa VENCER A COMPARAÇÃO: diferencial concreto contra as alternativas do mercado, prova de resultado, garantia e redução de risco, condição comercial e um motivo pra fechar agora. Não explique o problema nem a solução — ela já sabe tudo isso e está com orçamento na mão. Tipo de mensagem: Prova, Oferta, Comparação.`,
    estatico: `Fala com quem está pedindo orçamento em duas ou três marcas ao mesmo tempo. A headline precisa vencer a comparação: diferencial contra as alternativas, prova, garantia e condição. Não explique o problema.`,
  },
]

export const NIVEIS_BY_ID = Object.fromEntries(NIVEIS_CONSCIENCIA.map((n) => [n.id, n]))

// Bloco de prompt do nível escolhido. Entra na parte NÃO editável do system
// prompt (estrutura) — se ficasse na metodologia, um override do usuário
// congelaria o nível escolhido na UI.
export function nivelBlock(nivelId, formato) {
  const n = NIVEIS_BY_ID[nivelId]
  if (!n) return ''
  const desc = formato === 'video' ? n.video : n.estatico
  const outros = NIVEIS_CONSCIENCIA.filter((x) => x.id !== n.id)
    .map((x) => `${x.num}. ${x.label}`)
    .join(' · ')

  return `## NÍVEL DE CONSCIÊNCIA DO PÚBLICO (informado pelo cliente)

Todas as peças desta geração falam com um público no nível ${n.num} de 5 da escala de Eugene Schwartz: **${n.label.toUpperCase()}**.

${desc}

Isso define O QUE dizer, onde começar e o quanto precisa explicar. Regras:
- Escreva TODAS as peças nesse mesmo nível — não gere uma peça por nível
- Não "desça" pra explicar o que esse público já sabe nem "suba" pra falar de decisão que ele ainda não está tomando
- Os outros níveis (${outros}) são território de outras campanhas — não invada`
}

// Distribui um total de peças entre N blocos, o mais uniforme possível.
// distribute(8, 3) → [3, 3, 2]. Os blocos iniciais ficam com a sobra.
export function distribute(total, buckets) {
  if (buckets <= 0) return []
  const base = Math.floor(total / buckets)
  const rem = total % buckets
  return Array.from({ length: buckets }, (_, i) => base + (i < rem ? 1 : 0))
}

// Opções de atalho no seletor de quantidade.
export const QTD_PRESETS = [3, 5, 8, 10, 15]
export const QTD_MAX = 30
