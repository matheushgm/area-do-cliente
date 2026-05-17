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
