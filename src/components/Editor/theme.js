// Classes que o Lexical aplica a cada nó. O CSS fica em src/index.css
// (bloco "Editor de Markdown"), compartilhado com o MarkdownView pra leitura e
// edição ficarem com a mesma cara.
const theme = {
  paragraph: 'md-p',
  heading: { h1: 'md-h1', h2: 'md-h2', h3: 'md-h3', h4: 'md-h4', h5: 'md-h5', h6: 'md-h6' },
  quote: 'md-quote',
  list: {
    ul: 'md-ul',
    ol: 'md-ol',
    listitem: 'md-li',
    nested: { listitem: 'md-li-nested' },
    listitemChecked: 'md-li-checked',
    listitemUnchecked: 'md-li-unchecked',
  },
  link: 'md-link',
  text: {
    bold: 'md-bold',
    italic: 'md-italic',
    underline: 'md-underline',
    strikethrough: 'md-strike',
    code: 'md-code',
    highlight: 'md-highlight',
  },
  table: 'md-table',
  tableRow: 'md-tr',
  tableCell: 'md-td',
  tableCellHeader: 'md-th',
  hr: 'md-hr',
}

export default theme
