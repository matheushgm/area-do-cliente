// `@` no editor rico: abre a lista de pessoas do time e insere `@Nome_Sobrenome`, o mesmo
// formato do chat (src/lib/chat.js, `slugDe`). Quem salva extrai os ids com `extrairMencoes`.
// Ligado pelo prop `mencoes` do MarkdownEditor (comentários da tarefa).
import { useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { $createTextNode } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin'
import ChatAvatar from '../Chat/ChatAvatar'
import { slugDe } from '../../lib/chat'

class Pessoa extends MenuOption {
  constructor(p) {
    super(p.id)
    this.pessoa = p
  }
}

// A caixa de comentário fica no rodapé do painel: sem espaço embaixo, a lista abre para cima.
const abreParaCima = (el) => el.getBoundingClientRect().bottom + 260 > window.innerHeight

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function MencoesPlugin({ pessoas = [] }) {
  const [editor] = useLexicalComposerContext()
  const [busca, setBusca] = useState(null)
  // Aceita letras, números, ponto e _ (o nome vira Nome_Sobrenome), até 40 caracteres.
  const gatilho = useBasicTypeaheadTriggerMatch('@', { minLength: 0, maxLength: 40, punctuation: '\\,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%\'"~=<>:;' })

  const opcoes = useMemo(() => {
    const q = semAcento(busca || '').replace(/_/g, ' ')
    return pessoas
      .filter((p) => p?.name && (!q || semAcento(p.name).includes(q)))
      .slice(0, 8)
      .map((p) => new Pessoa(p))
  }, [pessoas, busca])

  const escolher = useCallback((opcao, noDaBusca, fechar) => {
    editor.update(() => {
      const texto = $createTextNode(`@${slugDe(opcao.pessoa.name)} `)
      if (noDaBusca) noDaBusca.replace(texto)
      texto.select()
      fechar()
    })
  }, [editor])

  return (
    <LexicalTypeaheadMenuPlugin
      onQueryChange={setBusca}
      onSelectOption={escolher}
      triggerFn={gatilho}
      options={opcoes}
      menuRenderFn={(ancora, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => (
        ancora.current && opcoes.length
          ? createPortal(
            <div className={`md-mencoes ${abreParaCima(ancora.current) ? 'para-cima' : ''}`} role="listbox" aria-label="Pessoas">
              <p className="md-mencoes-titulo">Pessoas</p>
              {opcoes.map((o, i) => (
                <button
                  key={o.key}
                  type="button"
                  role="option"
                  aria-selected={selectedIndex === i}
                  ref={o.setRefElement}
                  className={selectedIndex === i ? 'ativo' : ''}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setHighlightedIndex(i); selectOptionAndCleanUp(o) }}
                >
                  <ChatAvatar pessoa={o.pessoa} size={20} />
                  <span>{o.pessoa.name}</span>
                </button>
              ))}
            </div>,
            ancora.current,
          )
          : null
      )}
    />
  )
}
