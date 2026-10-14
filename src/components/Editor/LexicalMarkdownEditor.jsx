// Editor rico de Markdown (Lexical). Não importar direto: usar MarkdownEditor,
// que carrega este arquivo sob demanda (o Lexical só entra no bundle de quem
// clicou em editar).
//
// Controlado por string: `value` é markdown, `onChange(md)` recebe markdown.
// A ida e volta preserva o texto (ver markdownConfig.js e o script de teste).
import { useEffect, useRef, useState } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { TablePlugin } from '@lexical/react/LexicalTablePlugin'
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getRoot } from 'lexical'
import {
  EDITOR_NODES,
  TRANSFORMADORES,
  $markdownParaEditor,
  $editorParaMarkdown,
} from './markdownConfig'
import theme from './theme'
import FloatingToolbarPlugin from './FloatingToolbarPlugin'

// Sincroniza a string de markdown com o documento nos dois sentidos:
//   editor → fora: a cada mudança de conteúdo exporta e chama onChange(md);
//   fora → editor: quando `value` chega diferente do último exportado (cancelar,
//   trocar de item, versão da IA aprovada), reimporta. O eco do próprio onChange
//   é ignorado — senão cada tecla reconstruía o documento e perdia o cursor.
function SincronizaPlugin({ value, onChange }) {
  const [editor] = useLexicalComposerContext()
  // Último markdown que passou por aqui, em qualquer direção. Lido e escrito só
  // dentro dos efeitos, nunca na renderização.
  const ultimo = useRef(value || '')

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return
      const md = editorState.read(() => $editorParaMarkdown())
      if (md === ultimo.current) return
      ultimo.current = md
      onChange?.(md)
    })
  }, [editor, onChange])

  useEffect(() => {
    const md = value || ''
    if (md === ultimo.current) return
    ultimo.current = md
    editor.update(() => {
      $getRoot().clear()
      $markdownParaEditor(md)
    })
  }, [value, editor])

  return null
}

// Alterna leitura/edição sem remontar o editor.
function EditavelPlugin({ editavel }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    editor.setEditable(editavel)
  }, [editor, editavel])
  return null
}

function aoErrar(e) {
  console.error('[MarkdownEditor]', e)
}

export default function LexicalMarkdownEditor({
  value = '',
  onChange,
  readOnly = false,
  placeholder = 'Escreva aqui…',
  minHeight = 200,
  autoFocus = false,
  onAI,
  className = '',
}) {
  // initialConfig só é lido na montagem; useState com inicializador garante
  // que o markdown inicial é importado uma vez só.
  const [initialConfig] = useState(() => ({
    namespace: 'md-editor',
    theme,
    nodes: EDITOR_NODES,
    editable: !readOnly,
    editorState: () => $markdownParaEditor(value || ''),
    onError: aoErrar,
  }))

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={`md-editor ${readOnly ? 'md-editor--leitura' : ''} ${className}`}
        style={{ '--md-min-h': `${minHeight}px` }}
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="md-editor-content"
              aria-placeholder={placeholder}
              placeholder={<div className="md-editor-placeholder">{placeholder}</div>}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <TablePlugin />
        <HorizontalRulePlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMADORES} />
        <SincronizaPlugin value={value} onChange={onChange} />
        <EditavelPlugin editavel={!readOnly} />
        {autoFocus && !readOnly && <AutoFocusPlugin defaultSelection="rootEnd" />}
        {!readOnly && <FloatingToolbarPlugin onAI={onAI} />}
      </div>
    </LexicalComposer>
  )
}
