// Página PÚBLICA de aprovação de anúncios — o cliente recebe o link
// /aprovacao/:token (client_share_token do projeto) e aprova ou reprova os
// criativos enviados pela Central de anúncios, antes de irem pro ar.
// Ao reprovar, ele preenche o motivo + como o anúncio deveria estar.
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Megaphone, Loader2, AlertTriangle, CheckCircle2, XCircle, ExternalLink,
  Video, Image as ImageIcon, Layers, Clock, Paperclip, Send,
} from 'lucide-react'

const TIPO_META = {
  video:     { label: 'Vídeo',     Icon: Video },
  imagem:    { label: 'Imagem',    Icon: ImageIcon },
  carrossel: { label: 'Carrossel', Icon: Layers },
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function AprovacaoAnunciosPublico() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [company, setCompany] = useState('')
  const [ads,     setAds]     = useState([])

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/anuncios-aprovacao?token=${encodeURIComponent(token)}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao carregar.')
      setCompany(body.companyName || '')
      setAds(body.ads || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const pendentes = ads.filter((a) => a.aprovacao.status === 'pendente')
  const decididos = ads.filter((a) => a.aprovacao.status !== 'pendente')

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

  return (
    <div className="min-h-screen bg-rl-bg">
      {/* Header */}
      <div className="border-b border-rl-border bg-rl-card/85 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5 text-rl-purple" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold">
                Aprovação de Anúncios
              </p>
              <h1 className="text-base font-black text-rl-text leading-tight truncate">{company}</h1>
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
        {ads.length === 0 && (
          <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-12 px-6 text-center space-y-2">
            <Megaphone className="w-8 h-8 text-rl-muted/40 mx-auto" />
            <p className="text-sm font-semibold text-rl-text">Nenhum anúncio pra aprovar no momento.</p>
            <p className="text-xs text-rl-muted">Quando o time enviar um criativo novo, ele aparece aqui.</p>
          </div>
        )}

        {pendentes.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-black text-rl-text uppercase tracking-wide">
              Aguardando sua aprovação
            </h2>
            {pendentes.map((ad) => (
              <AdCard key={ad.id} ad={ad} token={token} onDecided={load} />
            ))}
          </section>
        )}

        {decididos.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-black text-rl-muted uppercase tracking-wide">
              Já avaliados
            </h2>
            {decididos.map((ad) => (
              <AdCard key={ad.id} ad={ad} token={token} decided />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

// ─── Card de um anúncio ───────────────────────────────────────────────────────
function AdCard({ ad, token, onDecided, decided = false }) {
  const [mode,       setMode]       = useState(null) // null | 'reprovando'
  const [motivo,     setMotivo]     = useState('')
  const [sugestao,   setSugestao]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const tipo = TIPO_META[ad.tipo] || { label: ad.tipo || 'Criativo', Icon: Layers }
  const TipoIcon = tipo.Icon
  const st = ad.aprovacao.status

  async function decide(decision) {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/anuncios-aprovacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, adId: ad.id, decision, motivo, sugestao }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao enviar.')
      onDecided?.()
    } catch (e) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  const canReprovar = motivo.trim().length > 0 && sugestao.trim().length > 0

  return (
    <div className="glass-card overflow-hidden">
      {/* Cabeçalho do card */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-rl-border/60">
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-rl-text truncate">{ad.nome || 'Criativo'}</p>
          <p className="text-[11px] text-rl-muted mt-0.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1"><TipoIcon className="w-3 h-3" /> {tipo.label}</span>
            {ad.createdAt && <span>· {fmtDate(ad.createdAt)}</span>}
          </p>
        </div>
        {decided && (
          st === 'aprovado' ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-300 shrink-0">
              <XCircle className="w-3.5 h-3.5" /> Reprovado
            </span>
          )
        )}
      </div>

      {/* Prévia do criativo */}
      <div className="px-5 py-4 space-y-3">
        {ad.attachmentUrl && ad.mediaKind === 'image' && (
          <img
            src={ad.attachmentUrl}
            alt={ad.nome || 'Criativo'}
            className="max-h-[420px] w-auto max-w-full rounded-xl border border-rl-border mx-auto"
          />
        )}
        {ad.attachmentUrl && ad.mediaKind === 'video' && (
          <video
            src={ad.attachmentUrl}
            controls
            playsInline
            className="max-h-[420px] w-auto max-w-full rounded-xl border border-rl-border mx-auto"
          />
        )}
        {ad.attachmentUrl && (ad.mediaKind === 'pdf' || ad.mediaKind === 'other') && (
          <a
            href={ad.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-rl-purple font-semibold hover:underline"
          >
            <Paperclip className="w-4 h-4" /> Abrir arquivo ({ad.attachmentName || 'anexo'})
          </a>
        )}
        {ad.url && (
          <a
            href={ad.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-rl-purple font-semibold hover:underline"
          >
            <ExternalLink className="w-4 h-4" /> Ver criativo no link
          </a>
        )}
        {!ad.attachmentUrl && !ad.url && (
          <p className="text-xs text-rl-muted italic">Criativo sem prévia disponível.</p>
        )}
        {ad.observacao && (
          <p className="text-xs text-rl-subtle bg-rl-surface/50 border border-rl-border rounded-xl px-3 py-2">
            {ad.observacao}
          </p>
        )}
      </div>

      {/* Decisão já tomada — mostra o registro */}
      {decided && st === 'reprovado' && (
        <div className="px-5 pb-4 space-y-2">
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-red-500">Motivo da reprovação</p>
            <p className="text-sm text-rl-text mt-1 whitespace-pre-wrap">{ad.aprovacao.motivo}</p>
          </div>
          <div className="rounded-xl bg-rl-surface/60 border border-rl-border px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-rl-muted">Como deveria estar</p>
            <p className="text-sm text-rl-text mt-1 whitespace-pre-wrap">{ad.aprovacao.sugestao}</p>
          </div>
        </div>
      )}
      {decided && ad.aprovacao.decididoEm && (
        <p className="px-5 pb-4 text-[10px] text-rl-muted">
          Avaliado em {fmtDate(ad.aprovacao.decididoEm)}
        </p>
      )}

      {/* Ações — só pra pendentes */}
      {!decided && (
        <div className="px-5 pb-5">
          {mode !== 'reprovando' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => decide('aprovado')}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Aprovar
              </button>
              <button
                onClick={() => setMode('reprovando')}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-300 text-red-600 text-sm font-bold hover:bg-red-50 transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Reprovar
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <div>
                <label className="text-xs font-bold text-rl-text uppercase tracking-wide mb-1 block">
                  Por que está reprovado? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder="Ex: a cor do fundo não segue a identidade da marca e o preço está desatualizado..."
                  className="input-field w-full resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-rl-text uppercase tracking-wide mb-1 block">
                  Como o anúncio deveria estar pra ser aprovado? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={sugestao}
                  onChange={(e) => setSugestao(e.target.value)}
                  rows={3}
                  placeholder="Ex: usar o fundo azul do manual da marca, preço R$ 199 e o logo no canto superior direito..."
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
          {error && mode !== 'reprovando' && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      )}
    </div>
  )
}
