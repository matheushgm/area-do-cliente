// Constantes do Playbook "Construção de Mecanismo Único" (XPN Digital).
// Cobrem opções pré-definidas usadas pelas 6 seções.

// ─── Seção 3: Vilões candidatos ───────────────────────────────────────────────
export const VILOES = [
  { id: 'ultrapassados',  label: 'Métodos ultrapassados' },
  { id: 'generica',       label: 'Informação genérica demais' },
  { id: 'gurus',          label: 'Gurus que nunca fizeram na prática' },
  { id: 'fora_contexto',  label: 'Conselhos de quem não entende o contexto dele' },
  { id: 'outro_publico',  label: 'Abordagem feita pra outro tipo de negócio/pessoa' },
  { id: 'peca_faltando',  label: 'Falta de uma peça específica do quebra-cabeça' },
]

// ─── Seção 3: Tipos de prova ──────────────────────────────────────────────────
export const TIPOS_PROVA = [
  { id: 'dado',        label: 'Dado / estatística' },
  { id: 'pesquisa',    label: 'Pesquisa / estudo' },
  { id: 'comparacao',  label: 'Comparação conhecida' },
  { id: 'historia',    label: 'História real' },
  { id: 'logica',      label: 'Lógica simples' },
]

// ─── Seção 3: Exemplos de conexão lógica + prova (por tipo de cliente) ────────
// Cada exemplo mostra a cadeia completa (vilão → problema → fracasso) e o tipo
// de prova que a sustenta. As provas são sempre evidência do PRÓPRIO negócio
// (o que ele viu atendendo), justamente pra ensinar que prova se colhe, não se
// inventa — o cliente deve trocar pelos números reais dele.
export const EXEMPLOS_CONEXAO = {
  b2b: [
    {
      id: 'b2b-bpo',
      segmento: 'BPO Financeiro',
      vilao:    'contabilidade que só entrega obrigação fiscal',
      problema: 'o dono nunca teve um DRE gerencial confiável',
      fracasso: 'cresceu o faturamento e diminuiu o lucro sem entender por quê',
      prova:    'Nos últimos 40 diagnósticos que fizemos, 34 empresas tinham lucro no papel e caixa negativo no mesmo mês.',
    },
    {
      id: 'b2b-trafego',
      segmento: 'Agência de tráfego',
      vilao:    'gestor que só olha métrica de plataforma',
      problema: 'otimizou pra lead barato em vez de venda',
      fracasso: 'encheu o CRM de gente que não compra e concluiu que "anúncio não funciona pro meu negócio"',
      prova:    'Auditamos 25 contas no último ano: em 19 delas, a campanha de menor custo por lead era a de pior custo por cliente.',
    },
    {
      id: 'b2b-erp',
      segmento: 'Software / ERP',
      vilao:    'implantação de sistema entregue como treinamento',
      problema: 'a equipe voltou pro Excel na primeira semana cheia',
      fracasso: 'pagou 12 meses de licença de um sistema que ninguém usa',
      prova:    'Dos 60 clientes que chegaram vindos de outro ERP, 41 nunca passaram da fase de cadastro.',
    },
    {
      id: 'b2b-comercial',
      segmento: 'Consultoria comercial',
      vilao:    'script de vendas copiado de curso gringo',
      problema: 'o time trata uma compra de R$80 mil como compra por impulso',
      fracasso: 'o desconto virou a única ferramenta de fechamento',
      prova:    'Ouvimos 200 ligações dos times que atendemos: em 7 de cada 10, o desconto apareceu antes de o cliente falar de preço.',
    },
    {
      id: 'b2b-distribuidora',
      segmento: 'Indústria / Distribuidora',
      vilao:    'tabela de preço única pra todo tipo de cliente',
      problema: 'o vendedor dá o mesmo desconto no pedido de R$2 mil e no de R$200 mil',
      fracasso: 'os maiores clientes viraram os menos rentáveis da carteira',
      prova:    'Na curva ABC dos nossos clientes, 3 dos 5 maiores compradores davam margem menor que a média da carteira.',
    },
  ],
  b2c: [
    {
      id: 'b2c-colchao',
      segmento: 'Colchões',
      vilao:    'colchão vendido por firmeza, não por biotipo',
      problema: 'comprou o "ortopédico duro" achando que era o certo pra coluna',
      fracasso: 'trocou de colchão duas vezes e continua acordando com dor',
      prova:    'Nas 300 avaliações de sono que fizemos na loja, 2 em cada 3 pessoas com dor lombar estavam num colchão firme demais pro peso delas.',
    },
    {
      id: 'b2c-emagrecimento',
      segmento: 'Emagrecimento',
      vilao:    'dieta restritiva copiada da internet',
      problema: 'cortou tudo o que ela gosta logo na primeira semana',
      fracasso: 'perdeu 4 kg, desistiu no mês seguinte e recuperou 6',
      prova:    'Das 180 alunas que chegaram até nós, 141 já tinham feito pelo menos 3 dietas e recuperado o peso em todas.',
    },
    {
      id: 'b2c-otica',
      segmento: 'Ótica',
      vilao:    'óculos vendido só pelo grau, sem olhar como a pessoa usa a vista',
      problema: 'recebeu lente de visão simples pra passar 9 horas no computador',
      fracasso: 'trocou de armação achando que era o modelo e a dor de cabeça continuou',
      prova:    'Nos últimos 500 exames da nossa loja, 3 em cada 10 pessoas com queixa de dor de cabeça usavam lente errada pra distância que mais utilizam.',
    },
    {
      id: 'b2c-odonto',
      segmento: 'Odontologia',
      vilao:    'tratamento orçado por procedimento solto, não pelo caso inteiro',
      problema: 'começou pelo mais barato e parou no meio',
      fracasso: 'gastou R$4 mil num remendo que vai precisar ser refeito do zero',
      prova:    'De cada 10 pacientes que chegam pra segunda opinião aqui, 6 já pagaram por um tratamento que precisou ser refeito.',
    },
    {
      id: 'b2c-carro',
      segmento: 'Concessionária / Seminovos',
      vilao:    'financiamento vendido pela parcela, não pelo custo total',
      problema: 'escolheu o carro que cabia na parcela, não o que aguentava o uso dele',
      fracasso: 'trocou de carro em 18 meses e saiu devendo mais do que o carro vale',
      prova:    'Nas trocas que fizemos no último ano, 4 em cada 10 clientes chegaram devendo mais que o valor de mercado do próprio carro.',
    },
  ],
}

// ─── Seção 4: Formatos de nome do mecanismo ───────────────────────────────────
export const FORMATOS_NOME = [
  { id: 'metodo_nome',       label: 'Método + Nome',          exemplo: 'Método Avalanche' },
  { id: 'sistema_sigla',     label: 'Sistema + Sigla',        exemplo: 'Sistema P.E.V' },
  { id: 'os_numero_palavra', label: 'Os + Número + Palavra',  exemplo: 'Os 3 Pilares da Venda' },
  { id: 'conceito_metafora', label: 'Conceito + Metáfora',    exemplo: 'Funil Invertido' },
]

// ─── Seção 4: Técnicas de "por que funciona" ──────────────────────────────────
export const TECNICAS = [
  { id: 'autoridade',     label: 'Associação com autoridade', placeholder: 'Usa o mesmo princípio que [EMPRESA]...' },
  { id: 'especificidade', label: 'Especificidade extrema',    placeholder: 'Funciona para [PÚBLICO ULTRA ESPECÍFICO]...' },
  { id: 'segredo',        label: 'Componente secreto',         placeholder: 'Descobri quando [HISTÓRIA]...' },
  { id: 'processo',       label: 'Processo claro',             placeholder: 'São X etapas: primeiro..., depois...' },
]

// ─── Seção 6: Critérios de validação ──────────────────────────────────────────
export const CRITERIOS_VALIDACAO = [
  { id: 'verdadeiro',   label: 'É verdadeiro?',   desc: 'baseado em algo real' },
  { id: 'fazSentido',   label: 'Faz sentido?',    desc: 'a lógica fecha?' },
  { id: 'novidade',     label: 'É novidade?',     desc: 'ele não sabia disso?' },
  { id: 'interessante', label: 'É interessante?', desc: 'gera curiosidade?' },
  { id: 'contavel',     label: 'É "contável"?',   desc: 'ele falaria pra um amigo?' },
  { id: 'diferente',    label: 'É diferente?',    desc: 'não parece o que já tentou?' },
  { id: 'aplicavel',    label: 'É aplicável?',    desc: 'ele se vê fazendo isso?' },
]

// ─── Seção 6: Teste do amigo ──────────────────────────────────────────────────
export const TESTE_AMIGO = [
  { id: 'aprovado',          label: '"Faz sentido, nunca tinha pensado nisso"', resultado: 'APROVADO' },
  { id: 'nao_entendi',       label: '"Hã? Não entendi"',                          resultado: 'REFAÇA' },
  { id: 'ja_vi_em_lugares',  label: '"Isso eu já vi em todo lugar"',              resultado: 'REFAÇA' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Conta quantos critérios da validação foram marcados como "sim"
export function countValidacao(validacao = {}) {
  return CRITERIOS_VALIDACAO.reduce((acc, c) => acc + (validacao[c.id] === 'sim' ? 1 : 0), 0)
}

// Determina o veredito final
export function vereditoValidacao(validacao = {}) {
  const count = countValidacao(validacao)
  if (count === 7) return { tier: 'excelente', label: 'Excelente — pode usar seu mecanismo!', color: '#15803D' }
  if (count >= 5)  return { tier: 'bom',       label: 'Bom — revise os pontos fracos',         color: '#EAB308' }
  return { tier: 'refazer', label: 'Refaça — volte às seções anteriores', color: '#EF4444' }
}
