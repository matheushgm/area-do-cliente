// Configuração compartilhada do editor de Markdown (Lexical): nós registrados,
// transformadores de importação/exportação e as duas funções de conversão.
// Fica num arquivo sem JSX pra poder ser carregado também em Node
// (scripts/testar_roundtrip_markdown.mjs testa a ida e volta com criativos reais).
//
// Sem bloco de código de propósito: o CodeNode puxa o Prism (~100 kB) e copy de
// anúncio não tem código. Uma cerca ``` no texto continua texto — a ida e volta
// preserva, só não vira bloco.
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListNode, ListItemNode } from '@lexical/list'
import { LinkNode } from '@lexical/link'
import { TableNode, TableRowNode, TableCellNode } from '@lexical/table'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CODE,
  TRANSFORMERS,
} from '@lexical/markdown'

export const EDITOR_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  HorizontalRuleNode,
]

export const TRANSFORMADORES = TRANSFORMERS.filter((t) => t !== CODE)

// Preservar quebras de linha é o que mantém o contrato dos criativos: o rótulo
// "**GANCHO:**" numa linha e o texto na seguinte, sem linha em branco entre eles.
// Sem isso o exportador junta parágrafos com linha em branco e os parsers por
// regex (splitChunks, PDFs, copyLevas) deixam de bater.
const PRESERVAR_QUEBRAS = true

// O exportador do Lexical escapa `*`, `_`, `` ` `` e `~` soltos no texto
// ("R$ 25*" vira "R$ 25\*") pra garantir a própria releitura. Os consumidores do
// texto (react-markdown, creativoPDF, parseCreativeForFields) não entendem
// barra invertida, e a textarea nunca escapou nada — então devolvemos o texto
// cru, como era digitado. Custo: um "*x*" digitado literalmente vira itálico ao
// reabrir, exatamente como acontecia na textarea.
function desescapar(md) {
  return md.replace(/\\([*_`~])/g, '$1')
}

/** Dentro de editor.update(): substitui o conteúdo do root pelo markdown. */
export function $markdownParaEditor(md) {
  $convertFromMarkdownString(md || '', TRANSFORMADORES, undefined, PRESERVAR_QUEBRAS)
}

/** Dentro de editorState.read(): devolve o markdown do documento. */
export function $editorParaMarkdown() {
  return desescapar($convertToMarkdownString(TRANSFORMADORES, undefined, PRESERVAR_QUEBRAS))
}
