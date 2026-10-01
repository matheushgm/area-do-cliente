// Campo de Observações do cliente, nas duas formas em que aparece:
//  - ObservacoesEditor: textarea (autosave ou formulário) com botão "Ampliar"
//    que abre a mesma caixa em tela cheia, para textos longos.
//  - ObservacoesLeitura: texto só-leitura preservando quebras de linha, com
//    "Ver tudo / Ver menos" e botão "Ampliar" que abre o texto num modal.
import { useState } from 'react'
import { Maximize2, X } from 'lucide-react'
import Modal from './Modal'

const LINHAS_RECOLHIDO = 8

function Cabecalho({ titulo, onClose }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm font-semibold text-rl-text">{titulo}</p>
      <button onClick={onClose} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface" aria-label="Fechar">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ObservacoesEditor({ value, onChange, rows = 6, placeholder, titulo = 'Observações', rodape }) {
  const [ampliado, setAmpliado] = useState(false)
  return (
    <div>
      <div className="relative">
        <textarea
          value={value}
          onChange={onChange}
          rows={rows}
          className="input-field resize-y text-sm w-full pr-10 leading-relaxed"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setAmpliado(true)}
          className="absolute top-2 right-2 p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-surface transition-colors"
          title="Ampliar"
          aria-label="Ampliar observações"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      {rodape && <p className="text-[11px] text-rl-muted mt-1">{rodape}</p>}

      {ampliado && (
        <Modal onClose={() => setAmpliado(false)} maxWidth="4xl" className="flex flex-col max-h-[90vh]">
          <Cabecalho titulo={titulo} onClose={() => setAmpliado(false)} />
          <textarea
            autoFocus
            value={value}
            onChange={onChange}
            className="input-field resize-none text-sm w-full flex-1 min-h-[60vh] leading-relaxed"
            placeholder={placeholder}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px] text-rl-muted">{rodape || ''}</p>
            <button type="button" onClick={() => setAmpliado(false)} className="btn-primary text-sm">Concluir</button>
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
        <p
          className="text-sm text-rl-text mt-0.5 break-words whitespace-pre-wrap leading-relaxed flex-1 overflow-hidden"
          style={longo && !tudo ? { display: '-webkit-box', WebkitLineClamp: LINHAS_RECOLHIDO, WebkitBoxOrient: 'vertical' } : undefined}
        >
          {texto}
        </p>
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
        <button onClick={() => setTudo((v) => !v)} className="text-xs text-rl-purple hover:text-rl-purple/80 mt-1">
          {tudo ? 'Ver menos' : 'Ver tudo'}
        </button>
      )}

      {ampliado && (
        <Modal onClose={() => setAmpliado(false)} maxWidth="4xl" className="flex flex-col max-h-[90vh]">
          <Cabecalho titulo={titulo} onClose={() => setAmpliado(false)} />
          <div className="overflow-y-auto flex-1 pr-1">
            <p className="text-sm text-rl-text whitespace-pre-wrap break-words leading-relaxed">{texto}</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
