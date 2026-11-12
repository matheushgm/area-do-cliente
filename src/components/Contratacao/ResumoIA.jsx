import { useRef, useState } from 'react'
import { Sparkles, Loader2, Upload, Wand2, Square, RefreshCw } from 'lucide-react'
import MarkdownView from '../Editor/MarkdownView'
import { streamClaude } from '../../lib/claude'
import { MODELO_RESUMO, NIVEL_ROTULO, NOTAS, promptResumo, separarResumo } from '../../lib/contratacao'
import { NivelBadge, Pill } from './ui'

// Tira a "sujeira" de legenda (.vtt / .srt): cabeçalho, numeração e tempos.
function limparLegenda(texto) {
  return texto
    .split(/\r?\n/)
    .filter((l) => !/^WEBVTT/.test(l) && !/^\d+$/.test(l.trim()) && !/-->/.test(l) && !/^NOTE\b/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Campo da transcrição + resumo pela IA. Salva via `onSalvar(patch)`:
 * `transcricao`, e depois `resumo_ia`, `sugestao_ia`, `resumo_gerado_em`.
 * `onAplicarNotas(notas, substituir)` leva as notas sugeridas para o roteiro.
 */
export default function ResumoIA({ cargo, candidato, entrevista, onSalvar, onAplicarNotas, showToast }) {
  const [transcricao, setTranscricao] = useState(entrevista.transcricao || '')
  const [gerando, setGerando] = useState(false)
  const [parcial, setParcial] = useState('')
  const [editandoTranscricao, setEditandoTranscricao] = useState(!entrevista.resumo_ia)
  const abortRef = useRef(null)
  const timer = useRef(null)

  const alterarTranscricao = (v) => {
    setTranscricao(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onSalvar({ transcricao: v }), 800)
  }

  async function lerArquivo(file) {
    if (!file) return
    if (!/\.(txt|vtt|srt|md)$/i.test(file.name)) {
      showToast('Use um arquivo de texto (.txt, .vtt, .srt ou .md). Para Word ou PDF, copie e cole o texto.', 'error')
      return
    }
    const bruto = await file.text()
    const texto = /\.(vtt|srt)$/i.test(file.name) ? limparLegenda(bruto) : bruto
    alterarTranscricao(texto)
  }

  async function gerar() {
    if (transcricao.trim().length < 200) {
      showToast('Cole a transcrição da conversa antes de gerar o resumo.', 'error')
      return
    }
    clearTimeout(timer.current)
    setGerando(true)
    setParcial('')
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const { system, messages } = promptResumo({ cargo, candidato, entrevista: { ...entrevista, transcricao } })
      const texto = await streamClaude({
        model: MODELO_RESUMO,
        max_tokens: 16000,
        system,
        messages,
        onChunk: (t) => setParcial(t),
        signal: ctrl.signal,
      })
      const { markdown, sugestao } = separarResumo(texto)
      await onSalvar({
        transcricao,
        resumo_ia: markdown,
        sugestao_ia: sugestao,
        resumo_gerado_em: new Date().toISOString(),
      })
      setEditandoTranscricao(false)
      showToast('Resumo salvo no perfil do candidato.')
    } catch (err) {
      if (err.name !== 'AbortError') showToast(err.message || 'A IA não respondeu. Tente de novo.', 'error')
    } finally {
      setGerando(false)
      setParcial('')
      abortRef.current = null
    }
  }

  const sugestao = entrevista.sugestao_ia
  const notasIA = sugestao?.notas || {}
  const qtdIA = Object.values(notasIA).filter((n) => typeof n === 'number').length
  const mostrado = gerando ? separarResumo(parcial).markdown : entrevista.resumo_ia

  return (
    <div className="space-y-4">
      <section className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-rl-text flex-1">Transcrição da conversa</h3>
          {!editandoTranscricao && transcricao && (
            <button type="button" onClick={() => setEditandoTranscricao(true)} className="text-xs text-rl-muted hover:text-rl-text">
              Ver / editar transcrição
            </button>
          )}
          <label className="btn-ghost text-xs inline-flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Anexar arquivo
            <input type="file" className="hidden" accept=".txt,.vtt,.srt,.md" onChange={(e) => { lerArquivo(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
        {editandoTranscricao ? (
          <textarea
            className="input-field min-h-[220px] font-mono text-xs leading-relaxed"
            placeholder="Cole aqui a transcrição da entrevista (Meet, Zoom, tl;dv, Fireflies...) ou anexe o .txt/.vtt."
            value={transcricao}
            onChange={(e) => alterarTranscricao(e.target.value)}
          />
        ) : (
          <p className="text-xs text-rl-muted">
            {transcricao ? `${transcricao.split(/\s+/).length.toLocaleString('pt-BR')} palavras anexadas.` : 'Sem transcrição.'}
          </p>
        )}
        <div className="flex items-center gap-2 justify-end">
          {gerando ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="btn-secondary text-sm inline-flex items-center gap-2">
              <Square className="w-3.5 h-3.5" /> Parar
            </button>
          ) : (
            <button type="button" onClick={gerar} className="btn-primary text-sm inline-flex items-center gap-2">
              {entrevista.resumo_ia ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {entrevista.resumo_ia ? 'Gerar o resumo de novo' : 'Gerar resumo com IA'}
            </button>
          )}
        </div>
      </section>

      {(gerando || entrevista.resumo_ia) && (
        <section className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-rl-purple" />
            <h3 className="text-sm font-bold text-rl-text flex-1">Resumo da IA</h3>
            {gerando && <Loader2 className="w-4 h-4 animate-spin text-rl-muted" />}
            {!gerando && sugestao?.nivel && (
              <span className="inline-flex items-center gap-1.5 text-xs text-rl-muted">IA sugere <NivelBadge nivel={sugestao.nivel} /></span>
            )}
          </div>
          {sugestao?.frase && !gerando && <p className="text-sm text-rl-subtle italic">“{sugestao.frase}”</p>}
          <MarkdownView content={mostrado || '...'} className="md-prose--13" codigo={false} />

          {!gerando && qtdIA > 0 && onAplicarNotas && (
            <div className="border-t border-rl-border/60 pt-4 space-y-3">
              <p className="text-xs font-semibold text-rl-text">Notas que a IA daria</p>
              <div className="flex flex-wrap gap-1.5">
                {cargo.perguntas.map((p) => {
                  const n = notasIA[p.id]
                  const minha = entrevista.respostas?.[p.id]?.nota
                  const difere = typeof n === 'number' && typeof minha === 'number' && n !== minha
                  return (
                    <Pill key={p.id} cor={typeof n !== 'number' ? 'muted' : difere ? 'gold' : 'purple'}>
                      {p.atividade.split(' ').slice(0, 3).join(' ')}: {typeof n === 'number' ? NOTAS[n].rotulo : 'não apareceu'}
                      {difere && ` (você: ${NOTAS[minha].rotulo})`}
                    </Pill>
                  )
                })}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => onAplicarNotas(notasIA, false)} className="btn-secondary text-xs inline-flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" /> Usar nas perguntas sem nota
                </button>
                <button type="button" onClick={() => { if (window.confirm('Trocar todas as suas notas pelas da IA?')) onAplicarNotas(notasIA, true) }}
                  className="btn-ghost text-xs">
                  Substituir todas
                </button>
              </div>
              {sugestao?.nivel && <p className="text-[11px] text-rl-muted">Nível sugerido pela IA: {NIVEL_ROTULO[sugestao.nivel] || sugestao.nivel}. A decisão final é sua.</p>}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
