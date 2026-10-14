// Editor rico de Markdown, estilo Notion — ponto de entrada.
//
//   <MarkdownEditor value={md} onChange={setMd} minHeight={260} autoFocus onAI={(trecho) => …} />
//
// `value`/`onChange` são markdown (string). `onAI` liga o botão "IA" da toolbar
// flutuante e recebe o trecho selecionado. `readOnly` mostra o mesmo visual sem
// edição. Pra só exibir markdown use MarkdownView, que não carrega o Lexical.
//
// O Lexical (~130 kB gzip) é carregado sob demanda: enquanto baixa, o texto cru
// fica à vista no lugar do editor.
import { lazy, Suspense } from 'react'

const Lexical = lazy(() => import('./LexicalMarkdownEditor'))

function Carregando({ value, minHeight }) {
  return (
    <div className="md-editor md-editor--carregando" style={{ '--md-min-h': `${minHeight}px` }}>
      <div className="md-editor-content whitespace-pre-wrap">{value}</div>
    </div>
  )
}

export default function MarkdownEditor(props) {
  const { value = '', minHeight = 200 } = props
  return (
    <Suspense fallback={<Carregando value={value} minHeight={minHeight} />}>
      <Lexical {...props} />
    </Suspense>
  )
}
