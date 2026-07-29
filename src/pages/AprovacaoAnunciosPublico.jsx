// Página PÚBLICA de aprovação de anúncios — o cliente recebe o link
// /aprovacao/:token (client_share_token do projeto) e aprova ou reprova os
// criativos enviados pela Central de anúncios, antes de irem pro ar.
// Ao reprovar, ele preenche o motivo + como o anúncio deveria estar.
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import {
  Megaphone, Loader2, AlertTriangle, CheckCircle2, XCircle, ExternalLink,
  Video, Image as ImageIcon, Layers, Clock, Paperclip, Send, LayoutTemplate,
  Maximize2, X, ZoomIn, ZoomOut,
} from 'lucide-react'

const TIPO_META = {
  video:     { label: 'Vídeo',     Icon: Video },
  imagem:    { label: 'Imagem',    Icon: ImageIcon },
  carrossel: { label: 'Carrossel', Icon: Layers },
}

function fmtDate(iso) {
  if (!iso) return ''
  // Datas yyyy-mm-dd são "de calendário" — reordenar direto evita o recuo de
  // um dia que new Date() causa ao interpretar como meia-noite UTC (BRT = -3).
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// Timestamp ISO completo → "dd/mm/yyyy às HH:MM" no fuso de quem está vendo.
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

export default function AprovacaoAnunciosPublico() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [company, setCompany] = useState('')
  const [ads,     setAds]     = useState([])
  const [lps,     setLps]     = useState([])

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/anuncios-aprovacao?token=${encodeURIComponent(token)}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao carregar.')
      setCompany(body.companyName || '')
      setAds(body.ads || [])
      setLps(body.lps || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // Criativos e landing pages compartilham as mesmas seções — cada card indica o tipo.
  const itens = [
    ...ads.map((a) => ({ ...a, kind: 'ad' })),
    ...lps.map((l) => ({ ...l, kind: 'lp' })),
  ]
  const pendentes = itens.filter((a) => a.aprovacao.status === 'pendente')
  const decididos = itens.filter((a) => a.aprovacao.status !== 'pendente')

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
                Aprovação de Anúncios e Landing Pages
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
        {itens.length === 0 && (
          <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-12 px-6 text-center space-y-2">
            <Megaphone className="w-8 h-8 text-rl-muted/40 mx-auto" />
            <p className="text-sm font-semibold text-rl-text">Nada pra aprovar no momento.</p>
            <p className="text-xs text-rl-muted">Quando o time enviar um criativo ou landing page, aparece aqui.</p>
          </div>
        )}

        {pendentes.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-black text-rl-text uppercase tracking-wide">
              Aguardando sua aprovação
            </h2>
            {pendentes.map((ad) => (
              <AdCard key={`${ad.kind}-${ad.id}`} ad={ad} token={token} onDecided={load} />
            ))}
          </section>
        )}

        {decididos.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-black text-rl-muted uppercase tracking-wide">
              Já avaliados
            </h2>
            {decididos.map((ad) => (
              <AdCard key={`${ad.kind}-${ad.id}`} ad={ad} token={token} decided />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

// ─── Lightbox de imagem (desktop + mobile) ────────────────────────────────────
// Portal no <body> (o glass-card usa backdrop-filter, que quebraria position:
// fixed de um filho). Fecha por X, clique no fundo ou Esc. O botão de zoom
// alterna entre "caber na tela" e tamanho natural com navegação por
// arrasto/scroll (funciona com dedo no mobile e trackpad/roda no desktop).
function Lightbox({ src, alt, onClose }) {
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Trava o scroll da página enquanto o lightbox está aberto
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      {/* Barra de controles — sempre visível e clicável acima da imagem */}
      <div
        className="absolute top-0 inset-x-0 z-10 flex items-center justify-end gap-2 p-3 bg-gradient-to-b from-black/70 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setZoomed((z) => !z)}
          className="p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/25 transition-all"
          title={zoomed ? 'Ajustar à tela' : 'Zoom no tamanho real'}
          aria-label={zoomed ? 'Ajustar à tela' : 'Zoom no tamanho real'}
        >
          {zoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/25 transition-all"
          title="Fechar"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {zoomed ? (
        // Tamanho natural + pan por scroll (touch no mobile, roda/trackpad no desktop)
        <div className="flex-1 min-h-0 overflow-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
          <img
            src={src}
            alt={alt}
            onClick={() => setZoomed(false)}
            className="max-w-none m-auto cursor-zoom-out select-none"
            draggable={false}
          />
        </div>
      ) : (
        // Ajustada à tela
        <div className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8">
          <img
            src={src}
            alt={alt}
            onClick={(e) => { e.stopPropagation(); setZoomed(true) }}
            className="max-h-full max-w-full object-contain cursor-zoom-in select-none"
            draggable={false}
          />
        </div>
      )}
    </div>,
    document.body
  )
}

// ─── Card de um anúncio ───────────────────────────────────────────────────────
function AdCard({ ad, token, onDecided, decided = false }) {
  const [mode,       setMode]       = useState(null) // null | 'reprovando'
  const [motivo,     setMotivo]     = useState('')
  const [sugestao,   setSugestao]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [expanded,   setExpanded]   = useState(false) // lightbox da imagem

  const isLp = ad.kind === 'lp'
  const tipo = isLp
    ? { label: 'Landing page', Icon: LayoutTemplate }
    : TIPO_META[ad.tipo] || { label: ad.tipo || 'Criativo', Icon: Layers }
  const TipoIcon = tipo.Icon
  const st = ad.aprovacao.status

  async function decide(decision) {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/anuncios-aprovacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, adId: ad.id, kind: ad.kind || 'ad', decision, motivo, sugestao }),
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
          <div className="relative w-fit mx-auto max-w-full group">
            <img
              src={ad.attachmentUrl}
              alt={ad.nome || 'Criativo'}
              onClick={() => setExpanded(true)}
              className="max-h-[420px] w-auto max-w-full rounded-xl border border-rl-border cursor-zoom-in"
            />
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="absolute top-2 right-2 p-2 rounded-lg bg-black/55 text-white hover:bg-black/75 transition-all"
              title="Expandir imagem"
              aria-label="Expandir imagem"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}
        {expanded && ad.attachmentUrl && ad.mediaKind === 'image' && (
          <Lightbox src={ad.attachmentUrl} alt={ad.nome || 'Criativo'} onClose={() => setExpanded(false)} />
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
        {ad.url && (isLp ? (
          <a
            href={ad.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-rl-green/40 text-rl-green text-sm font-bold hover:bg-rl-green/10 transition-all"
          >
            <ExternalLink className="w-4 h-4" /> Abrir landing page
          </a>
        ) : (
          <a
            href={ad.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-rl-purple font-semibold hover:underline"
          >
            <ExternalLink className="w-4 h-4" /> Ver criativo no link
          </a>
        ))}
        {!ad.attachmentUrl && !ad.url && (
          <p className="text-xs text-rl-muted italic">
            {isLp ? 'Landing page sem link disponível.' : 'Criativo sem prévia disponível.'}
          </p>
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
          {st === 'aprovado' ? 'Aprovado' : 'Reprovado'} em {fmtDateTime(ad.aprovacao.decididoEm)}
          {ad.aprovacao.enviadoEm && <> · enviado pra aprovação em {fmtDateTime(ad.aprovacao.enviadoEm)}</>}
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
                  Como {isLp ? 'a landing page deveria estar pra ser aprovada' : 'o anúncio deveria estar pra ser aprovado'}? <span className="text-red-500">*</span>
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
