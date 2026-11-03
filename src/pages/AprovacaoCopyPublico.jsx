// Página PÚBLICA de aprovação de COPY — o cliente recebe o link
// /aprovacao-copy/:token, exclusivo de UMA leva gerada em "Criativos com IA",
// e aprova ou reprova cada texto. Ao reprovar, preenche motivo + como deveria
// estar. O que ele aprova vai pra Central de anúncios como "Aprovado para
// Edição" e entra na fila do designer.
//
// "Editar e aprovar": pra ajuste pequeno não vale a pena devolver pro time. O
// cliente edita o texto na hora e aprova com alterações — o texto dele vira a
// copy aprovada e o original fica guardado pra comparação.
//
// `modo="interno"` é a REVISÃO do time (/revisao-copy/:token, com login): a mesma
// tela decide a etapa anterior ao cliente. O que o time aprova é liberado no link
// do cliente; nas levas com revisão, o cliente só vê o que já foi liberado.
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Sparkles, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, Send, Video,
  Image as ImageIcon, Copy, Check, Pencil, FileDown, Link2, ShieldCheck,
} from 'lucide-react'
import MarkdownView from '../components/Editor/MarkdownView'
import MarkdownEditor from '../components/Editor/MarkdownEditor'
import { apiFetch } from '../lib/api'

const API = '/api/copy-aprovacao'

// Revisão interna vai autenticada; o cliente, sem login.
async function lerLeva(token, interno) {
  if (interno) return apiFetch(`${API}?token=${encodeURIComponent(token)}&etapa=interna`)
  const res  = await fetch(`${API}?token=${encodeURIComponent(token)}`)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'Erro ao carregar.')
  return body
}

async function enviarDecisao(payload, interno) {
  if (interno) return apiFetch(API, { body: { ...payload, etapa: 'interna' } })
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'Erro ao enviar.')
  return body
}

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

// Os geradores de PDF puxam react-dom/server + react-markdown; carregados só no
// clique pra não pesar na abertura do link.
async function exportarPDF(fn) {
  const mod = await import('../lib/creativoPDF')
  fn(mod)
}

export default function AprovacaoCopyPublico({ modo = 'cliente' }) {
  const interno = modo === 'interno'
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [leva,    setLeva]    = useState(null)
  const [bulk,    setBulk]    = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)

  const load = useCallback(async () => {
    try {
      setLeva(await lerLeva(token, interno))
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token, interno])

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
  const liberados  = interno ? itens.filter((it) => it.aprovacao.status === 'aprovado').length : 0
  const linkCliente = `${window.location.origin}/aprovacao-copy/${token}`

  // Aprova tudo que está pendente, um de cada vez (cada decisão é uma escrita
  // no mesmo registro — em paralelo uma sobrescreveria a outra).
  async function aprovarTodos() {
    if (bulk) return
    setBulk(true)
    try {
      for (const it of pendentes) {
        await enviarDecisao({ token, itemId: it.id, decision: 'aprovado' }, interno).catch(() => {})
      }
      await load()
    } finally {
      setBulk(false)
    }
  }

  function copiarLinkCliente() {
    navigator.clipboard?.writeText(linkCliente)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
  }

  // A leva inteira num PDF só. Usa o texto atual de cada item (já com a edição do
  // cliente, quando houve) — o mesmo gerador do "Criativos com IA".
  function exportarLeva() {
    exportarPDF(({ exportCreativoSetPDF }) => exportCreativoSetPDF({
      companyName: leva.companyName,
      creative: {
        content:      itens.map((it) => it.conteudo || '').join('\n\n---\n\n'),
        type:         leva.tipo,
        quantity:     itens.length,
        adTypeLabels: [leva.funilLabel, leva.nivelLabel].filter(Boolean),
        createdAt:    leva.enviadoEm,
      },
    }))
  }

  return (
    <div className="min-h-screen bg-rl-bg">
      {/* Header */}
      <div className="border-b border-rl-border bg-rl-card/85 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
              {interno ? <ShieldCheck className="w-5 h-5 text-rl-purple" /> : <Sparkles className="w-5 h-5 text-rl-purple" />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold">
                {interno ? 'Revisão interna' : 'Aprovação'} de {isVideo ? 'roteiros' : 'copies'} · {leva.companyName}
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
        {/* Revisão interna: o que fazer e o link que vai pro cliente */}
        {interno && (
          <div className="rounded-xl border border-rl-purple/30 bg-rl-purple/5 px-5 py-4 space-y-3">
            <p className="text-sm text-rl-text">
              Revise antes do cliente. O que você aprovar aqui é liberado no link dele; o que você
              reprovar volta pra Central com o motivo e não chega ao cliente.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-rl-subtle">
                {liberados > 0
                  ? `${liberados} ${liberados === 1 ? 'texto liberado' : 'textos liberados'} pro cliente`
                  : 'Nenhum texto liberado ainda: o link do cliente está vazio.'}
              </span>
              {liberados > 0 && (
                <button
                  onClick={copiarLinkCliente}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-rl-purple text-white hover:bg-rl-purple/90 transition-all"
                >
                  {linkCopiado ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                  {linkCopiado ? 'Link copiado!' : 'Copiar link do cliente'}
                </button>
              )}
            </div>
          </div>
        )}

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
          <button
            onClick={exportarLeva}
            disabled={itens.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-rl-border text-rl-subtle hover:text-rl-text hover:bg-rl-surface transition-all disabled:opacity-50"
          >
            <FileDown className="w-3.5 h-3.5" /> Exportar PDF
          </button>
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
            <p className="text-sm font-semibold text-rl-text">
              {leva.emRevisao
                ? 'Os textos desta leva ainda estão sendo revisados pela equipe.'
                : 'Nada pra aprovar nesta leva.'}
            </p>
            {leva.emRevisao && (
              <p className="text-xs text-rl-muted">Assim que forem liberados, eles aparecem aqui neste mesmo link.</p>
            )}
          </div>
        )}
        {itens.length > 0 && leva.emRevisao && (
          <p className="-mt-4 text-xs text-rl-muted">
            Outros textos desta leva ainda estão com a equipe e aparecem aqui quando forem liberados.
          </p>
        )}

        {pendentes.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-black text-rl-text uppercase tracking-wide">
              {interno ? 'Aguardando revisão' : 'Aguardando sua aprovação'}
            </h2>
            {pendentes.map((it, i) => (
              <CopyCard key={it.id} item={it} index={i} token={token} onDecided={load} tipo={leva.tipo} companyName={leva.companyName} interno={interno} />
            ))}
          </section>
        )}

        {decididos.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-black text-rl-muted uppercase tracking-wide">
              {interno ? 'Já revisados' : 'Já avaliados'}
            </h2>
            {decididos.map((it, i) => (
              <CopyCard key={it.id} item={it} index={i} token={token} decided tipo={leva.tipo} companyName={leva.companyName} interno={interno} />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

// ─── Card de uma copy ─────────────────────────────────────────────────────────
function CopyCard({ item, index, token, onDecided, decided = false, tipo, companyName, interno = false }) {
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
      await enviarDecisao({
        token, itemId: item.id, decision, motivo, sugestao,
        ...(comAlteracoes ? { conteudo: texto } : {}),
      }, interno)
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

  function exportar() {
    exportarPDF(({ exportCreativoSinglePDF }) => exportCreativoSinglePDF({
      content: item.conteudo || '', type: tipo, index, companyName,
    }))
  }

  // Na revisão do time basta o motivo; do cliente pedimos também como deveria estar.
  const canReprovar = motivo.trim().length > 0 && (interno || sugestao.trim().length > 0)
  const rotuloAprovado = interno ? 'Liberado pro cliente' : 'Aprovado'
  const rotuloReprovado = interno ? 'Reprovado na revisão' : 'Reprovado'
  const quem = interno && item.aprovacao.por?.nome ? ` por ${item.aprovacao.por.nome}` : ''
  // Na revisão, depois de liberado: o que o cliente já respondeu.
  const respostaCliente = interno && st === 'aprovado' ? item.cliente?.status : null
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
          <button
            onClick={exportar}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-rl-muted hover:text-rl-purple transition-all"
            title="Exportar este criativo em PDF"
          >
            <FileDown className="w-3 h-3" />
          </button>
          {decided && (
            st === 'aprovado' ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                {editado ? <Pencil className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {editado ? `${rotuloAprovado} com alterações` : rotuloAprovado}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-300">
                <XCircle className="w-3.5 h-3.5" /> {rotuloReprovado}
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
          <MarkdownEditor value={texto} onChange={setTexto} minHeight={240} autoFocus />
          <p className="text-[11px] text-rl-muted">
            {interno
              ? 'O cliente recebe o texto já com o seu ajuste. O original fica guardado na leva.'
              : 'O texto que você aprovar aqui é o que vai pra produção. O original fica guardado pra equipe comparar.'}
          </p>
        </div>
      ) : (
        <div className="px-5 py-4">
          <MarkdownView content={item.conteudo} />
        </div>
      )}

      {/* Revisão: texto como chegou do copywriter, antes do ajuste do time */}
      {interno && decided && editado && item.conteudoAntesDaRevisao && (
        <details className="px-5 pb-4 group">
          <summary className="text-[11px] font-semibold text-rl-muted cursor-pointer hover:text-rl-text">
            Ver texto antes da revisão
          </summary>
          <div className="mt-2 rounded-xl bg-rl-surface/60 border border-rl-border px-4 py-3">
            <MarkdownView content={item.conteudoAntesDaRevisao} />
          </div>
        </details>
      )}

      {/* Texto original, quando o cliente aprovou com alterações */}
      {!interno && decided && editado && item.conteudoOriginal && (
        <details className="px-5 pb-4 group">
          <summary className="text-[11px] font-semibold text-rl-muted cursor-pointer hover:text-rl-text">
            Ver texto original (antes da sua edição)
          </summary>
          <div className="mt-2 rounded-xl bg-rl-surface/60 border border-rl-border px-4 py-3">
            <MarkdownView content={item.conteudoOriginal} />
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
          {item.aprovacao.sugestao && (
            <div className="rounded-xl bg-rl-surface/60 border border-rl-border px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider font-bold text-rl-muted">
                Como deveria estar
              </p>
              <p className="text-sm text-rl-text mt-1 whitespace-pre-wrap">{item.aprovacao.sugestao}</p>
            </div>
          )}
        </div>
      )}
      {decided && item.aprovacao.decididoEm && (
        <p className="px-5 pb-4 text-[10px] text-rl-muted">
          {st === 'aprovado' ? (editado ? `${rotuloAprovado} com alterações` : rotuloAprovado) : rotuloReprovado}
          {quem} em {fmtDateTime(item.aprovacao.decididoEm)}
          {respostaCliente === 'pendente' && ' · aguardando o cliente'}
          {respostaCliente === 'aprovado' && ' · o cliente aprovou'}
          {respostaCliente === 'reprovado' && ' · o cliente reprovou'}
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
                {interno ? 'Aprovar e liberar' : 'Aprovar texto'}
              </button>
              <button
                onClick={() => { setTexto(item.conteudo || ''); setMode('editando'); setError('') }}
                disabled={submitting}
                className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rl-purple/40 text-rl-purple text-sm font-bold hover:bg-rl-purple/10 transition-all disabled:opacity-50"
                title={interno
                  ? 'Ajuste o texto e libere já corrigido pro cliente'
                  : 'Faça um ajuste pequeno você mesmo e aprove, sem precisar devolver pra equipe'}
              >
                <Pencil className="w-4 h-4" /> {interno ? 'Editar e liberar' : 'Editar e aprovar'}
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
                  {interno ? 'Liberar com alterações' : 'Aprovar com alterações'}
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
                  Como o texto deveria estar pra ser aprovado?{' '}
                  {interno ? <span className="text-rl-muted normal-case font-normal">(opcional)</span> : <span className="text-red-500">*</span>}
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
