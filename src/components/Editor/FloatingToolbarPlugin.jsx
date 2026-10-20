// Toolbar flutuante: aparece sobre a seleção de texto, como no Notion.
// Negrito, itálico, tachado, parágrafo/título, lista, link e — quando o pai
// passa `onAI` — o botão "IA" que entrega o trecho selecionado pra quem chamou.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical'
import { $setBlocksType } from '@lexical/selection'
import { $createHeadingNode, $isHeadingNode } from '@lexical/rich-text'
import { $isListNode, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list'
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $findMatchingParent, mergeRegister } from '@lexical/utils'
import {
  Bold,
  Italic,
  Strikethrough,
  Link as LinkIcon,
  List,
  Heading2,
  Heading3,
  Pilcrow,
  Sparkles,
} from 'lucide-react'

const OCULTO = { visivel: false }

export default function FloatingToolbarPlugin({ onAI }) {
  const [editor] = useLexicalComposerContext()
  const [estado, setEstado] = useState(OCULTO)
  const textoSelecionado = useRef('')

  const atualizar = useCallback(() => {
    editor.getEditorState().read(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel) || sel.isCollapsed() || !editor.isEditable()) {
        setEstado(OCULTO)
        return
      }
      const texto = sel.getTextContent()
      if (!texto.trim()) {
        setEstado(OCULTO)
        return
      }
      const nativa = window.getSelection()
      if (!nativa || nativa.rangeCount === 0) {
        setEstado(OCULTO)
        return
      }
      const rect = nativa.getRangeAt(0).getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        setEstado(OCULTO)
        return
      }
      const no = sel.anchor.getNode()
      const bloco = no.getTopLevelElementOrThrow()
      const link = $findMatchingParent(no, $isLinkNode)
      textoSelecionado.current = texto
      setEstado({
        visivel: true,
        x: Math.min(Math.max(rect.left + rect.width / 2, 120), window.innerWidth - 120),
        y: Math.max(rect.top, 48),
        bold: sel.hasFormat('bold'),
        italic: sel.hasFormat('italic'),
        strike: sel.hasFormat('strikethrough'),
        link: !!link,
        bloco: $isHeadingNode(bloco) ? bloco.getTag() : $isListNode(bloco) ? 'lista' : 'p',
      })
    })
  }, [editor])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(() => atualizar()),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          atualizar()
          return false
        },
        COMMAND_PRIORITY_LOW
      )
    )
  }, [editor, atualizar])

  // Rolagem ou redimensionamento movem a seleção na tela — reposiciona.
  useEffect(() => {
    if (!estado.visivel) return
    const re = () => atualizar()
    window.addEventListener('scroll', re, true)
    window.addEventListener('resize', re)
    return () => {
      window.removeEventListener('scroll', re, true)
      window.removeEventListener('resize', re)
    }
  }, [estado.visivel, atualizar])

  if (!estado.visivel) return null

  const formatar = (f) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, f)
  const bloco = (tipo) =>
    editor.update(() => {
      const sel = $getSelection()
      if (!$isRangeSelection(sel)) return
      $setBlocksType(sel, () => (tipo === 'p' ? $createParagraphNode() : $createHeadingNode(tipo)))
    })
  const lista = () =>
    editor.dispatchCommand(
      estado.bloco === 'lista' ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND,
      undefined
    )
  const link = () => {
    if (estado.link) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      return
    }
    const url = window.prompt('Endereço do link (https://…)')
    if (!url) return
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, {
      url: /^https?:\/\//i.test(url) ? url : `https://${url}`,
    })
  }
  // mousedown com preventDefault: o clique no botão não tira o foco do editor
  // nem desfaz a seleção.
  const semFoco = (e) => e.preventDefault()

  return createPortal(
    <div
      className="md-toolbar"
      style={{ left: estado.x, top: estado.y }}
      onMouseDown={semFoco}
      role="toolbar"
    >
      <button
        type="button"
        title="Parágrafo"
        className={estado.bloco === 'p' ? 'ativo' : ''}
        onClick={() => bloco('p')}
      >
        <Pilcrow />
      </button>
      <button
        type="button"
        title="Título 2"
        className={estado.bloco === 'h2' ? 'ativo' : ''}
        onClick={() => bloco('h2')}
      >
        <Heading2 />
      </button>
      <button
        type="button"
        title="Título 3"
        className={estado.bloco === 'h3' ? 'ativo' : ''}
        onClick={() => bloco('h3')}
      >
        <Heading3 />
      </button>
      <button
        type="button"
        title="Lista"
        className={estado.bloco === 'lista' ? 'ativo' : ''}
        onClick={lista}
      >
        <List />
      </button>
      <span className="sep" />
      <button
        type="button"
        title="Negrito (Ctrl+B)"
        className={estado.bold ? 'ativo' : ''}
        onClick={() => formatar('bold')}
      >
        <Bold />
      </button>
      <button
        type="button"
        title="Itálico (Ctrl+I)"
        className={estado.italic ? 'ativo' : ''}
        onClick={() => formatar('italic')}
      >
        <Italic />
      </button>
      <button
        type="button"
        title="Tachado"
        className={estado.strike ? 'ativo' : ''}
        onClick={() => formatar('strikethrough')}
      >
        <Strikethrough />
      </button>
      <button
        type="button"
        title={estado.link ? 'Remover link' : 'Link'}
        className={estado.link ? 'ativo' : ''}
        onClick={link}
      >
        <LinkIcon />
      </button>
      {onAI && (
        <>
          <span className="sep" />
          <button
            type="button"
            className="ia"
            title="Refinar este trecho com IA"
            onClick={() => onAI(textoSelecionado.current)}
          >
            <Sparkles /> IA
          </button>
        </>
      )}
    </div>,
    document.body
  )
}
