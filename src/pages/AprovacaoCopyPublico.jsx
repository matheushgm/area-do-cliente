// Página PÚBLICA de aprovação de COPY — o cliente recebe o link
// /aprovacao-copy/:token, exclusivo de UMA leva gerada em "Criativos com IA",
// e aprova ou reprova cada texto. Ao reprovar, preenche motivo + como deveria
// estar. O que ele aprova vai pra Central de anúncios como "Aprovado para
// Edição" e entra na fila do designer.
//
// "Editar e aprovar": pra ajuste pequeno não vale a pena devolver pro time. O
// cliente edita o texto na hora e aprova com alterações — o texto dele vira a
// copy aprovada e o original fica guardado pra comparação.
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Sparkles, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, Send, Video,
  Image as ImageIcon, Copy, Check, Pencil,
} from 'lucide-react'
import MarkdownBlock from '../components/Criativos/MarkdownBlock'

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} às ${hh}:${mi}`
}

export default function AprovacaoCopyPublico() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [leva,    setLeva]    = useState(null)
  const [bulk,    setBulk]    = useState(false)

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/copy-aprovacao?token=${encodeURIComponent(token)}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao carregar.')
      setLeva(body)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-rl-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-rl-purple animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-rl-bg flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-rl-text">Link inválido</h2>
          <p className="text-sm text-rl-muted">{error}</p>
        </div>
      </div>
    )
  }

  const itens      = leva.itens || []
  const pendentes  = itens.filter((it) => it.aprovacao.status === 'pendente')
  const decididos  = itens.filter((it) => it.aprovacao.status !== 'pendente')
  const isVideo    = leva.tipo === 'video'
  const TipoIcon   = isVideo ? Video : ImageIcon

  // Aprova tudo que está pendente, um de cada vez (cada decisão é uma escrita
  // no mesmo registro — em paralelo uma sobrescreveria a outra).
  async function aprovarTodos() {
    if (bulk) return
    setBulk(true)
    try {
      for (const it of pendentes) {
        await fetch('/api/copy-aprovacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, itemId: it.id, decision: 'aprovado' }),
        })
      }
      await load()
    } finally {
      setBulk(false)
    }
  }

  return (
    <div className="min-h-screen bg-rl-bg">
      {/* Header */}
      <div className="border-b border-rl-border bg-rl-card/85 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-rl-purple" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold">
                Aprovação de {isVideo ? 'roteiros' : 'copies'} · {leva.companyName}
              </p>
              <h1 className="text-base font-black text-rl-text leading-tight truncate">
                {leva.nome}
              </h1>
            </div>
          </div>
          {pendentes.length > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-rl-gold/10 border border-rl-gold/30 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-rl-gold shrink-0">
              <Clock className="w-3 h-3" />
              {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Resumo da leva */}
        <div className="glass-card px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11px] text-rl-muted flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-semibold text-rl-subtle">
              <TipoIcon className="w-3.5 h-3.5" /> {isVideo ? 'Roteiros de vídeo' : 'Copies de anúncio'}
            </span>
            <span>{itens.length} no total</span>
            {leva.funilLabel && <span>· {leva.funilLabel}</span>}
            {leva.enviadoEm && <span>· enviada em {fmtDateTime(leva.enviadoEm)}</span>}
          </div>
          {pendentes.length > 1 && (
            <button
              onClick={aprovarTodos}
              disabled={bulk}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 transition-all disabled:opacity-50"
            >
              {bulk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Aprovar todos
            </button>
          )}
        </div>

        {itens.length === 0 && (
          <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-12 px-6 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-rl-muted/40 mx-auto" />
            <p className="text-sm font-semibold text-rl-text">Nada pra aprovar nesta leva.</p>
          </div>
        )}

        {pendentes.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-black text-rl-text uppercase tracking-wide">
              Aguardando sua aprovação
            </h2>
            {pendentes.map((it, i) => (
              <CopyCard key={it.id} item={it} index={i} token={token} onDecided={load} />
            ))}
          </section>
        )}

        {decididos.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-black text-rl-muted uppercase tracking-wide">
              Já avaliados
            </h2>
            {decididos.map((it, i) => (
              <CopyCard key={it.id} item={it} index={i} token={token} decided />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

// ─── Card de uma copy ─────────────────────────────────────────────────────────
function CopyCard({ item, index, token, onDecided, decided = false }) {
  const [mode,       setMode]       = useState(null) // null | 'reprovando' | 'editando'
  const [motivo,     setMotivo]     = useState('')
  const [sugestao,   setSugestao]   = useState('')
  const [texto,      setTexto]      = useState(item.conteudo || '')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [copied,     setCopied]     = useState(false)

  const st      = item.aprovacao.status
  const editado = st === 'aprovado' && item.aprovacao.editado

  // `conteudo` só vai no "aprovar com alterações"; a aprovação simples manda o
  // texto como está e o servidor registra sem edição.
  async function decide(decision, { comAlteracoes = false } = {}) {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/copy-aprovacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, itemId: item.id, decision, motivo, sugestao,
          ...(comAlteracoes ? { conteudo: texto } : {}),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao enviar.')
      onDecided?.()
    } catch (e) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  function copiar() {
    navigator.clipboard?.writeText(item.conteudo || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const canReprovar = motivo.trim().length > 0 && sugestao.trim().length > 0
  const textoMudou  = texto.trim().length > 0 && texto.trim() !== (item.conteudo || '').trim()

  return (
    <div className="glass-card overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-rl-border/60">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold">
            Criativo {index + 1}
          </p>
          <p className="text-sm font-bold text-rl-text leading-snug mt-0.5">{item.titulo}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copiar}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-rl-muted hover:text-rl-purple transition-all"
            title="Copiar o texto"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
          {decided && (
            st === 'aprovado' ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                {editado ? <Pencil className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {editado ? 'Aprovado com alterações' : 'Aprovado'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-300">
                <XCircle className="w-3.5 h-3.5" /> Reprovado
              </span>
            )
          )}
        </div>
      </div>

      {/* Texto da copy (ou o editor, quando o cliente está ajustando) */}
      {mode === 'editando' ? (
        <div className="px-5 py-4 space-y-2">
          <label className="text-xs font-bold text-rl-text uppercase tracking-wide block">
            Ajuste o texto como ele deve ficar
          </label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={Math.min(24, Math.max(8, (texto.match(/\n/g) || []).length + 3))}
            className="input-field w-full resize-y font-mono text-[13px] leading-relaxed"
            autoFocus
          />
          <p className="text-[11px] text-rl-muted">
            O texto que você aprovar aqui é o que vai pra produção. O original fica guardado pra
            equipe comparar.
          </p>
        </div>
      ) : (
        <div className="px-5 py-4">
          <MarkdownBlock content={item.conteudo} />
        </div>
      )}

      {/* Texto original, quando o cliente aprovou com alterações */}
      {decided && editado && item.conteudoOriginal && (
        <details className="px-5 pb-4 group">
          <summary className="text-[11px] font-semibold text-rl-muted cursor-pointer hover:text-rl-text">
            Ver texto original (antes da sua edição)
          </summary>
          <div className="mt-2 rounded-xl bg-rl-surface/60 border border-rl-border px-4 py-3">
            <MarkdownBlock content={item.conteudoOriginal} />
          </div>
        </details>
      )}

      {/* Registro da decisão */}
      {decided && st === 'reprovado' && (
        <div className="px-5 pb-4 space-y-2">
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-red-500">
              Motivo da reprovação
            </p>
            <p className="text-sm text-rl-text mt-1 whitespace-pre-wrap">{item.aprovacao.motivo}</p>
          </div>
          <div className="rounded-xl bg-rl-surface/60 border border-rl-border px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-rl-muted">
              Como deveria estar
            </p>
            <p className="text-sm text-rl-text mt-1 whitespace-pre-wrap">{item.aprovacao.sugestao}</p>
          </div>
        </div>
      )}
      {decided && item.aprovacao.decididoEm && (
        <p className="px-5 pb-4 text-[10px] text-rl-muted">
          {st === 'aprovado' ? (editado ? 'Aprovado com alterações' : 'Aprovado') : 'Reprovado'} em{' '}
          {fmtDateTime(item.aprovacao.decididoEm)}
        </p>
      )}

      {/* Ações */}
      {!decided && (
        <div className="px-5 pb-5">
          {mode === null && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => decide('aprovado')}
                disabled={submitting}
                className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Aprovar texto
              </button>
              <button
                onClick={() => { setTexto(item.conteudo || ''); setMode('editando'); setError('') }}
                disabled={submitting}
                className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rl-purple/40 text-rl-purple text-sm font-bold hover:bg-rl-purple/10 transition-all disabled:opacity-50"
                title="Faça um ajuste pequeno você mesmo e aprove, sem precisar devolver pra equipe"
              >
                <Pencil className="w-4 h-4" /> Editar e aprovar
              </button>
              <button
                onClick={() => setMode('reprovando')}
                disabled={submitting}
                className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-300 text-red-600 text-sm font-bold hover:bg-red-50 transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Reprovar
              </button>
            </div>
          )}
          {mode === 'editando' && (
            <div className="space-y-2">
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <button
                  onClick={() => { setMode(null); setTexto(item.conteudo || ''); setError('') }}
                  disabled={submitting}
                  className="text-xs px-4 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => decide('aprovado', { comAlteracoes: true })}
                  disabled={submitting || !textoMudou}
                  title={!textoMudou ? 'Altere alguma coisa no texto pra aprovar com alterações' : undefined}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Aprovar com alterações
                </button>
              </div>
            </div>
          )}
          {mode === 'reprovando' && (
            <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <div>
                <label className="text-xs font-bold text-rl-text uppercase tracking-wide mb-1 block">
                  Por que está reprovado? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder="Ex: a promessa está forte demais e o prazo prometido não é o que a gente entrega..."
                  className="input-field w-full resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-rl-text uppercase tracking-wide mb-1 block">
                  Como o texto deveria estar pra ser aprovado? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={sugestao}
                  onChange={(e) => setSugestao(e.target.value)}
                  rows={3}
                  placeholder="Ex: falar em 30 dias em vez de 7, e trocar o CTA por agendar diagnóstico..."
                  className="input-field w-full resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => { setMode(null); setError('') }}
                  disabled={submitting}
                  className="text-xs px-4 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => decide('reprovado')}
                  disabled={submitting || !canReprovar}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Enviar reprovação
                </button>
              </div>
            </div>
          )}
          {error && mode === null && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      )}
    </div>
  )
}
