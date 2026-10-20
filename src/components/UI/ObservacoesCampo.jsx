// Campo de Observações do cliente, nas duas formas em que aparece:
//  - ObservacoesEditor: editor de markdown (autosave ou formulário) com botão
//    "Ampliar" que abre o mesmo editor em tela cheia, para textos longos.
//  - ObservacoesLeitura: leitura rica, com "Ver tudo / Ver menos" e botão
//    "Ampliar" que abre o texto num modal.
// O texto é markdown; o que já estava gravado como texto puro continua
// legível (quebra de linha vira <br>).
import { useState } from 'react'
import { Maximize2, X } from 'lucide-react'
import Modal from './Modal'
import MarkdownEditor from '../Editor/MarkdownEditor'
import MarkdownView from '../Editor/MarkdownView'

const LINHAS_RECOLHIDO = 8

function Cabecalho({ titulo, onClose }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm font-semibold text-rl-text">{titulo}</p>
      <button
        onClick={onClose}
        className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// `onChange` recebe um evento sintético `{ target: { value } }` pra manter a
// assinatura que os dois formulários do ClientProfile já usam (e.target.value).
export function ObservacoesEditor({
  value,
  onChange,
  rows = 6,
  placeholder,
  titulo = 'Observações',
  rodape,
}) {
  const [ampliado, setAmpliado] = useState(false)
  const emitir = (md) => onChange({ target: { value: md } })
  const alturaModal = typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.6) : 480
  return (
    <div>
      <div className="flex items-center justify-end mb-1">
        <button
          type="button"
          onClick={() => setAmpliado(true)}
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-surface transition-colors"
          title="Ampliar"
          aria-label="Ampliar observações"
        >
          <Maximize2 className="w-3.5 h-3.5" /> Ampliar
        </button>
      </div>
      {!ampliado && (
        <MarkdownEditor
          value={value || ''}
          onChange={emitir}
          minHeight={rows * 24}
          placeholder={placeholder}
        />
      )}
      {rodape && <p className="text-[11px] text-rl-muted mt-1">{rodape}</p>}

      {ampliado && (
        <Modal
          onClose={() => setAmpliado(false)}
          maxWidth="4xl"
          className="flex flex-col max-h-[90vh]"
        >
          <Cabecalho titulo={titulo} onClose={() => setAmpliado(false)} />
          <div className="overflow-y-auto flex-1">
            <MarkdownEditor
              value={value || ''}
              onChange={emitir}
              minHeight={alturaModal}
              placeholder={placeholder}
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px] text-rl-muted">{rodape || ''}</p>
            <button
              type="button"
              onClick={() => setAmpliado(false)}
              className="btn-primary text-sm"
            >
              Concluir
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function ObservacoesLeitura({ texto, titulo = 'Observações' }) {
  const [tudo, setTudo] = useState(false)
  const [ampliado, setAmpliado] = useState(false)
  if (!texto) return null
  const linhas = texto.split('\n').length
  const longo = linhas > LINHAS_RECOLHIDO || texto.length > 600
  return (
    <div>
      <div className="flex items-start gap-2">
        <div
          className="mt-0.5 flex-1 overflow-hidden"
          style={longo && !tudo ? { maxHeight: `${LINHAS_RECOLHIDO * 1.6}em` } : undefined}
        >
          <MarkdownView content={texto} />
        </div>
        <button
          onClick={() => setAmpliado(true)}
          className="shrink-0 p-1 rounded-md text-rl-muted hover:text-rl-purple hover:bg-rl-surface"
          title="Ampliar"
          aria-label="Ampliar observações"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {longo && (
        <button
          onClick={() => setTudo((v) => !v)}
          className="text-xs text-rl-purple hover:text-rl-purple/80 mt-1"
        >
          {tudo ? 'Ver menos' : 'Ver tudo'}
        </button>
      )}

      {ampliado && (
        <Modal
          onClose={() => setAmpliado(false)}
          maxWidth="4xl"
          className="flex flex-col max-h-[90vh]"
        >
          <Cabecalho titulo={titulo} onClose={() => setAmpliado(false)} />
          <div className="overflow-y-auto flex-1 pr-1">
            <MarkdownView content={texto} />
          </div>
        </Modal>
      )}
    </div>
  )
}
