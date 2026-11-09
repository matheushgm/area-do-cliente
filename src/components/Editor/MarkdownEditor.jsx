// Editor rico de Markdown, estilo Notion — ponto de entrada.
//
//   <MarkdownEditor value={md} onChange={setMd} minHeight={260} autoFocus onAI={(trecho) => …} />
//
// `value`/`onChange` são markdown (string). `onAI` liga o botão "IA" da toolbar
// flutuante e recebe o trecho selecionado. `readOnly` mostra o mesmo visual sem
// edição. Pra só exibir markdown use MarkdownView, que não carrega o Lexical.
//
// Dois modos, com a barra "Visual | Markdown" no alto da caixa (`codigo={false}`
// esconde): Visual é o Lexical; Markdown é um textarea com o texto cru. Os dois
// editam a mesma string. A escolha fica em localStorage (`md.editor.modo`) e vale
// pra todos os editores, como o modo Código do Codex da SellFlux.
//
// O Lexical (~124 kB gzip) é carregado sob demanda: enquanto baixa, o texto cru
// fica à vista no lugar do editor.
import { lazy, Suspense, useState } from 'react'
import { Code2, Eye } from 'lucide-react'
import { useI18n } from '../../i18n'

const Lexical = lazy(() => import('./LexicalMarkdownEditor'))

const CHAVE_MODO = 'md.editor.modo'
function lerModo() {
  try {
    return localStorage.getItem(CHAVE_MODO) === 'codigo' ? 'codigo' : 'visual'
  } catch {
    return 'visual'
  }
}
function gravarModo(modo) {
  try {
    localStorage.setItem(CHAVE_MODO, modo)
  } catch {
    /* sem localStorage (modo privado): a escolha vale só nesta tela */
  }
}

function Carregando({ value }) {
  return (
    <div className="md-editor-body">
      <div className="md-editor-content whitespace-pre-wrap">{value}</div>
    </div>
  )
}

export default function MarkdownEditor(props) {
  const {
    value = '',
    onChange,
    minHeight = 200,
    className = '',
    readOnly = false,
    placeholder: placeholderProp,
    autoFocus = false,
    codigo = true,
  } = props
  const { t } = useI18n()
  const placeholder = placeholderProp ?? t('ui.editor.escrevaAqui')
  const [modo, setModo] = useState(() => (codigo ? lerModo() : 'visual'))
  // Depois de uma troca manual, o modo novo recebe o foco (o autoFocus da
  // montagem só vale pra primeira abertura).
  const [trocado, setTrocado] = useState(false)

  const emCodigo = codigo && !readOnly && modo === 'codigo'

  function trocar(novo) {
    if (novo === modo) return
    setModo(novo)
    setTrocado(true)
    gravarModo(novo)
  }

  return (
    <div
      className={`md-editor ${readOnly ? 'md-editor--leitura' : ''} ${className}`}
      style={{ '--md-min-h': `${minHeight}px` }}
    >
      {codigo && !readOnly && (
        <div className="md-editor-bar" role="tablist" aria-label={t('ui.editor.modo')}>
          <button
            type="button"
            role="tab"
            aria-selected={!emCodigo}
            className={!emCodigo ? 'ativo' : ''}
            onClick={() => trocar('visual')}
            title={t('ui.editor.visualTitulo')}
          >
            <Eye /> {t('ui.editor.visual')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={emCodigo}
            className={emCodigo ? 'ativo' : ''}
            onClick={() => trocar('codigo')}
            title={t('ui.editor.markdownTitulo')}
          >
            <Code2 /> Markdown
          </button>
        </div>
      )}

      {emCodigo ? (
        <textarea
          className="md-editor-raw"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus || trocado}
          spellCheck={false}
          aria-label={t('ui.editor.markdown')}
        />
      ) : (
        <Suspense fallback={<Carregando value={value} />}>
          <Lexical {...props} placeholder={placeholder} autoFocus={autoFocus || trocado} />
        </Suspense>
      )}
    </div>
  )
}
