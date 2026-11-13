/**
 * propostaComercial.js — estrutura do roteiro da Proposta Comercial.
 *
 * Fonte única de verdade compartilhada entre o formulário
 * (`PropostaComercialModule.jsx`) e o PDF (`exportPropostaComercialPDF` em
 * `utils/exportPDF.js`), pra manter títulos, ordem e badges sempre sincronizados.
 *
 * `tipo` de cada seção:
 *  - 'MOMENTO' = fala/condução, NÃO vira slide
 *  - 'SLIDE'   = conteúdo que vira um slide na apresentação
 *
 * Cada campo: { id, label, tipo: 'text' | 'textarea', rows?, hint? }
 *
 * Os textos (título e descrição da seção, rótulo e ajuda do campo, falas-modelo)
 * moram em src/i18n/locales/{pt,en}/proposta.js. Aqui cada um vira um getter que
 * traduz no idioma de agora a cada leitura, então quem lê `sec.titulo` / `f.label`
 * continua igual. Ids, ordem e `tipo` não mudam: os ids são as chaves gravadas em
 * `projects_v2.proposta_comercial`.
 */
import { t } from '../i18n'
import TEXTOS_PT from '../i18n/locales/pt/proposta.js'

function ligar(alvo, campo, chave) {
  Object.defineProperty(alvo, campo, { enumerable: true, configurable: true, get: () => t(chave) })
  return alvo
}

const ESTRUTURA = [
  {
    n: 1,
    tipo: 'MOMENTO',
    campos: [
      { id: 'recepcao', tipo: 'textarea', rows: 4 },
      { id: 'quebraGeloPerguntas', tipo: 'textarea', rows: 4 },
      { id: 'problemaMapeado', tipo: 'text' },
      { id: 'pontosEmComum', tipo: 'textarea', rows: 2 },
    ],
  },
  {
    n: 2,
    tipo: 'SLIDE',
    campos: [
      { id: 'pactoInicialFalas', tipo: 'textarea', rows: 9 },
      { id: 'tresIntencoes', tipo: 'textarea', rows: 4 },
    ],
  },
  {
    n: 3,
    tipo: 'MOMENTO',
    campos: [
      { id: 'spinSituacao', tipo: 'textarea', rows: 3 },
      { id: 'spinProblema', tipo: 'textarea', rows: 3 },
      { id: 'spinImplicacao', tipo: 'textarea', rows: 3 },
      { id: 'spinNecessidade', tipo: 'textarea', rows: 3 },
    ],
  },
  {
    n: 4,
    tipo: 'MOMENTO',
    campos: [
      { id: 'objetivoCliente', tipo: 'text' },
      { id: 'pactoTransicao', tipo: 'textarea', rows: 3 },
    ],
  },
  {
    n: 5,
    tipo: 'SLIDE',
    campos: [
      { id: 'metodoNome', tipo: 'text' },
      { id: 'metodoPassos', tipo: 'textarea', rows: 5 },
    ],
  },
  {
    n: 6,
    tipo: 'SLIDE',
    campos: [
      { id: 'produtoIncluido', tipo: 'textarea', rows: 5 },
      { id: 'produtoDiferenciais', tipo: 'textarea', rows: 3 },
    ],
  },
  {
    n: 7,
    tipo: 'SLIDE',
    campos: [
      { id: 'slideDuvidas', tipo: 'textarea', rows: 4 },
    ],
  },
  {
    n: 8,
    tipo: 'SLIDE',
    campos: [
      { id: 'valorTabela', tipo: 'text' },
      { id: 'ancoragemJustificativa', tipo: 'textarea', rows: 4 },
    ],
  },
  {
    n: 9,
    tipo: 'SLIDE',
    campos: [
      { id: 'valorReal', tipo: 'text' },
      { id: 'valorRealCondicoes', tipo: 'textarea', rows: 3 },
    ],
  },
  {
    n: 10,
    tipo: 'SLIDE',
    campos: [
      { id: 'valorCall', tipo: 'text' },
      { id: 'valorCallGatilho', tipo: 'textarea', rows: 3 },
    ],
  },
]

// Liga só os textos que existem no dicionário pt (seção sem descrição e campo sem
// ajuda continuam sem a propriedade, como antes).
export const PROPOSTA_SECTIONS = ESTRUTURA.map((sec) => {
  const textosSec = TEXTOS_PT.secoes[`s${sec.n}`] || {}
  for (const campo of Object.keys(textosSec)) ligar(sec, campo, `proposta.secoes.s${sec.n}.${campo}`)
  for (const f of sec.campos) {
    for (const campo of Object.keys(TEXTOS_PT.campos[f.id] || {})) ligar(f, campo, `proposta.campos.${f.id}.${campo}`)
  }
  return sec
})

/**
 * Falas-modelo pré-preenchidas (editáveis). Só os campos do dicionário (`padroes`)
 * têm default; os demais começam vazios. Usadas apenas quando o campo nunca foi
 * salvo — e então gravadas no idioma de quem abriu o módulo.
 */
export const PROPOSTA_DEFAULTS = Object.keys(TEXTOS_PT.padroes).reduce(
  (acc, id) => ligar(acc, id, `proposta.padroes.${id}`),
  {}
)
