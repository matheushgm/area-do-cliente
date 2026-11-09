// Bloco de texto em markdown que o time pode EDITAR (editor rico) e REFINAR com
// IA: instrução livre sobre o texto inteiro ou o botão IA da toolbar sobre um
// trecho selecionado. Mesmo fluxo do refino dos criativos: a IA devolve o texto
// inteiro, a tela mostra a versão nova e o time aprova ou recusa. Serve aos
// textos gerados pela IA que antes só podiam ser regerados (Kickoff, Mecanismo
// Único, Produto/Serviço, dobras da LP).
//
//   <TextoEditavelIA valor={md} onSalvar={(md) => …} project={project} />
//
// `onRefinar(texto, trecho, instrucao, onChunk)` troca o refino padrão
// (refinarMarkdown) pelo do módulo. Sem `onSalvar` vira só leitura. `acoes`
// são botões extras na barra (ex.: Regenerar, Copiar).
import { useState } from 'react'
import { Pencil, Check, X, Sparkles, Loader2, AlertTriangle } from 'lucide-react'
import MarkdownView from './MarkdownView'
import MarkdownEditor from './MarkdownEditor'
import { refinarMarkdown } from '../../lib/refinarMarkdown'
import { useI18n } from '../../i18n'

const BTN =
  'flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg transition-all disabled:opacity-50'
const BTN_ROXO = `${BTN} bg-rl-purple/10 border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20`
const BTN_NEUTRO = `${BTN} bg-rl-surface text-rl-muted hover:text-rl-text`

const REFINO_VAZIO = {
  trecho: '',
  instrucao: '',
  streaming: '',
  resultado: null,
  erro: null,
  carregando: false,
}

export default function TextoEditavelIA({
  valor,
  onSalvar,
  onRefinar,
  project,
  minHeight = 220,
  semIA = false,
  xs = false,
  acoes = null,
  className = '',
}) {
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const [refino, setRefino] = useState(null)
  const { t } = useI18n()

  const podeEditar = typeof onSalvar === 'function'
  const podeRefinar = podeEditar && !semIA

  function abrirEdicao() {
    setRascunho(valor || '')
    setEditando(true)
    setRefino(null)
  }
  function cancelar() {
    setEditando(false)
    setRascunho('')
  }
  function salvar() {
    const md = (rascunho || '').trim()
    if (md && md !== (valor || '').trim()) onSalvar(md)
    setEditando(false)
    setRascunho('')
  }
  // Botão IA da toolbar: guarda o que já foi editado e abre o refino no trecho.
  function refinarTrecho(trecho) {
    salvar()
    setRefino({ ...REFINO_VAZIO, trecho: String(trecho || '').trim() })
  }
  function abrirRefino() {
    setEditando(false)
    setRefino({ ...REFINO_VAZIO })
  }

  async function enviarRefino() {
    if (!refino || !refino.instrucao.trim() || refino.carregando) return
    setRefino((r) => ({ ...r, carregando: true, streaming: '', resultado: null, erro: null }))
    const aoChegar = (parcial) => setRefino((r) => (r ? { ...r, streaming: parcial } : r))
    try {
      const fn =
        onRefinar ||
        ((texto, trecho, instrucao, cb) =>
          refinarMarkdown({ texto, trecho, instrucao, project, onChunk: cb }))
      const resultado = await fn(valor || '', refino.trecho, refino.instrucao, aoChegar)
      setRefino((r) => (r ? { ...r, carregando: false, streaming: '', resultado } : r))
    } catch (e) {
      console.error('[TextoEditavelIA] refino:', e)
      setRefino((r) =>
        r ? { ...r, carregando: false, streaming: '', erro: e?.message || t('ui.refino.erro') } : r
      )
    }
  }
  function aprovar() {
    if (refino?.resultado) onSalvar(refino.resultado)
    setRefino(null)
  }

  const ico = 'w-3 h-3'

  return (
    <div className={className}>
      {(podeEditar || acoes) && !refino && (
        <div className="flex items-center justify-end gap-1.5 flex-wrap mb-2">
          {!editando && acoes}
          {editando ? (
            <>
              <button type="button" onClick={salvar} className={BTN_ROXO}>
                <Check className={ico} /> {t('comum.salvar')}
              </button>
              <button type="button" onClick={cancelar} className={BTN_NEUTRO}>
                <X className={ico} /> {t('comum.cancelar')}
              </button>
            </>
          ) : (
            podeEditar && (
              <>
                {podeRefinar && (
                  <button
                    type="button"
                    onClick={abrirRefino}
                    className={BTN_ROXO}
                    title={t('ui.refino.dica')}
                  >
                    <Sparkles className={ico} /> {t('ui.refino.refinarComIA')}
                  </button>
                )}
                <button type="button" onClick={abrirEdicao} className={BTN_NEUTRO}>
                  <Pencil className={ico} /> {t('comum.editar')}
                </button>
              </>
            )
          )}
        </div>
      )}

      {editando ? (
        <MarkdownEditor
          value={rascunho}
          onChange={setRascunho}
          minHeight={minHeight}
          autoFocus
          onAI={podeRefinar ? refinarTrecho : undefined}
          className={xs ? 'md-editor--xs' : ''}
        />
      ) : (
        <MarkdownView content={valor} className={xs ? 'md-prose--xs' : ''} />
      )}

      {refino && (
        <div className="mt-3 rounded-xl border border-rl-purple/20 bg-rl-purple/5 px-4 pb-4 space-y-2.5">
          {!refino.resultado && !refino.carregando && (
            <>
              <p className="text-[10px] font-semibold text-rl-purple uppercase tracking-wide pt-3">
                {refino.trecho ? t('ui.refino.oQueMudarTrecho') : t('ui.refino.oQueMelhorar')}
              </p>
              {refino.trecho && (
                <blockquote className="text-xs text-rl-muted italic border-l-2 border-rl-purple/40 pl-3 max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {refino.trecho}
                </blockquote>
              )}
              <textarea
                value={refino.instrucao}
                onChange={(e) => setRefino((r) => ({ ...r, instrucao: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) enviarRefino()
                }}
                placeholder={t('ui.refino.placeholder')}
                rows={3}
                className="w-full bg-rl-surface/60 border border-rl-purple/30 rounded-xl p-3 text-xs text-rl-text leading-relaxed resize-none focus:outline-none focus:border-rl-purple/60 transition-colors placeholder:text-rl-muted/60"
                autoFocus
              />
              {refino.erro && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className={ico} /> {refino.erro}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={enviarRefino}
                  disabled={!refino.instrucao.trim()}
                  className={`${BTN_ROXO} px-3 py-1.5`}
                >
                  <Sparkles className={ico} /> {t('ui.refino.refinar')}
                </button>
                <button
                  type="button"
                  onClick={() => setRefino(null)}
                  className="text-[10px] px-2.5 py-1 text-rl-muted hover:text-rl-text transition-all"
                >
                  {t('comum.cancelar')}
                </button>
              </div>
            </>
          )}

          {refino.carregando && (
            <>
              <p className="text-[10px] font-semibold text-rl-purple uppercase tracking-wide pt-3 flex items-center gap-1.5">
                <Loader2 className={`${ico} animate-spin`} /> {t('ui.refino.refinando')}
              </p>
              {refino.streaming && (
                <div className="bg-rl-surface/60 border border-rl-purple/20 rounded-xl p-3">
                  <MarkdownView content={refino.streaming} className={xs ? 'md-prose--xs' : ''} />
                </div>
              )}
            </>
          )}

          {refino.resultado && !refino.carregando && (
            <>
              <p className="text-[10px] font-semibold text-rl-purple uppercase tracking-wide pt-3">
                {t('ui.refino.versaoRefinada')}
              </p>
              <div className="bg-rl-purple/5 border border-rl-purple/30 rounded-xl p-3">
                <MarkdownView content={refino.resultado} className={xs ? 'md-prose--xs' : ''} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={aprovar}
                  className={`${BTN} px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20`}
                >
                  <Check className={ico} /> {t('ui.refino.aprovar')}
                </button>
                <button
                  type="button"
                  onClick={() => setRefino((r) => ({ ...r, resultado: null }))}
                  className={`${BTN} px-3 py-1.5 bg-rl-surface text-rl-muted hover:text-red-400`}
                >
                  <X className={ico} /> {t('ui.refino.recusar')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
