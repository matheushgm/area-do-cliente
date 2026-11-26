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
  Maximize2, X, ZoomIn, ZoomOut, History, Folder, FolderOpen, ChevronDown,
} from 'lucide-react'
import { agruparPorPasta } from '../components/Debriefing/debriefingData'
import { useI18n, idiomaAtual, localeAtual, t as tSolto } from '../i18n'

// Rótulo = chave em `aprovacao.tipos.*`, traduzida no render.
const TIPO_META = {
  video:     { label: 'video',     Icon: Video },
  imagem:    { label: 'imagem',    Icon: ImageIcon },
  carrossel: { label: 'carrossel', Icon: Layers },
}

const OPCOES_DATA = { day: '2-digit', month: '2-digit', year: 'numeric' }

function fmtDate(iso) {
  if (!iso) return ''
  // Datas yyyy-mm-dd são "de calendário" — montar a data local evita o recuo de
  // um dia que new Date() causa ao interpretar como meia-noite UTC (BRT = -3).
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(localeAtual(), OPCOES_DATA)
}

// Timestamp ISO completo → "dd/mm/yyyy às HH:MM" no fuso e no idioma de quem está vendo.
function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const data = d.toLocaleDateString(localeAtual(), OPCOES_DATA)
  const hora = d.toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' })
  return tSolto('aprovacao.dataHora', { data, hora })
}

// Monta URL/headers conforme a origem do acesso:
//   { token }                 → link público /aprovacao/:token (client_share_token)
//   { portal, projectId }     → sessão do portal (/portal/:projectId)
function authQuery(auth) {
  return auth.portal
    ? `projectId=${encodeURIComponent(auth.projectId)}`
    : `token=${encodeURIComponent(auth.token)}`
}
function authHeaders(auth) {
  return { 'X-Idioma': idiomaAtual(), ...(auth.portal ? { Authorization: `Bearer ${auth.portal}` } : {}) }
}
function authBody(auth) {
  return auth.portal ? { projectId: auth.projectId } : { token: auth.token }
}

export default function AprovacaoAnunciosPublico() {
  const { token } = useParams()
  return <AprovacaoView auth={{ token }} />
}

// Corpo reutilizável: página pública e módulo "Aprovação" do portal.
// `readOnly` esconde os botões de decisão (permissão `view` no portal);
// `embedded` tira o cabeçalho/fundo de página inteira.
export function AprovacaoView({ auth, readOnly = false, embedded = false }) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [company, setCompany] = useState('')
  const [ads,     setAds]     = useState([])
  const [lps,     setLps]     = useState([])

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/anuncios-aprovacao?${authQuery(auth)}`, { headers: authHeaders(auth) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || t('aprovacao.erroCarregar'))
      setCompany(body.companyName || '')
      setAds(body.ads || [])
      setLps(body.lps || [])
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [auth.token, auth.portal, auth.projectId]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className={`${embedded ? 'py-16' : 'min-h-screen bg-rl-bg'} flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 text-rl-purple animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${embedded ? 'py-8' : 'min-h-screen bg-rl-bg p-6'} flex items-center justify-center`}>
        <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-rl-text">{embedded ? t('aprovacao.naoCarregou') : t('aprovacao.linkInvalido')}</h2>
          <p className="text-sm text-rl-muted">{error}</p>
        </div>
      </div>
    )
  }

  const body = (
    <>
      {itens.length === 0 && (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-12 px-6 text-center space-y-2">
          <Megaphone className="w-8 h-8 text-rl-muted/40 mx-auto" />
          <p className="text-sm font-semibold text-rl-text">{t('aprovacao.vazio')}</p>
          <p className="text-xs text-rl-muted">{t('aprovacao.vazioDica')}</p>
        </div>
      )}

      {pendentes.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-black text-rl-text uppercase tracking-wide">
            {readOnly ? t('aprovacao.aguardando') : t('aprovacao.aguardandoSua')}
          </h2>
          <PorPasta
            itens={pendentes}
            abertaInicial={(nPastas) => nPastas === 1}
            renderCard={(ad) => (
              <AdCard key={`${ad.kind}-${ad.id}`} ad={ad} auth={auth} onDecided={load} readOnly={readOnly} />
            )}
          />
        </section>
      )}

      {decididos.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-black text-rl-muted uppercase tracking-wide">
            {t('aprovacao.jaAvaliados')}
          </h2>
          <PorPasta
            itens={decididos}
            abertaInicial={() => false}
            renderCard={(ad) => <AdCard key={`${ad.kind}-${ad.id}`} ad={ad} auth={auth} decided />}
          />
        </section>
      )}
    </>
  )

  if (embedded) {
    return (
      <div className="space-y-6">
        {pendentes.length > 0 && (
          <span className="inline-flex items-center gap-1.5 bg-rl-gold/10 border border-rl-gold/30 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-rl-gold">
            <Clock className="w-3 h-3" />
            {t('aprovacao.pendentes', { count: pendentes.length })}
          </span>
        )}
        {body}
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
                {t('aprovacao.titulo')}
              </p>
              <h1 className="text-base font-black text-rl-text leading-tight truncate">{company}</h1>
            </div>
          </div>
          {pendentes.length > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-rl-gold/10 border border-rl-gold/30 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-rl-gold shrink-0">
              <Clock className="w-3 h-3" />
              {t('aprovacao.pendentes', { count: pendentes.length })}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {body}
      </div>
    </div>
  )
}

// Cards separados pelas pastas que o time usa na Central. Sem pasta nenhuma,
// a lista segue corrida como sempre; o que não tem pasta (e as LPs) vai em
// "Outros", no fim.
function PorPasta({ itens, abertaInicial, renderCard }) {
  const { t } = useI18n()
  const grupos = agruparPorPasta(itens)
  if (grupos.length === 1 && !grupos[0].pasta) return grupos[0].ads.map(renderCard)
  return grupos.map((g) => (
    <PastaBloco
      key={g.pasta || 'outros'}
      nome={g.pasta || t('aprovacao.outros')}
      total={g.ads.length}
      abertaInicial={abertaInicial(grupos.length)}
    >
      {g.ads.map(renderCard)}
    </PastaBloco>
  ))
}

function PastaBloco({ nome, total, abertaInicial, children }) {
  const { t } = useI18n()
  const [aberta, setAberta] = useState(abertaInicial)
  const Icone = aberta ? FolderOpen : Folder
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-rl-border bg-rl-surface/40 hover:border-rl-purple/40 transition-all text-left"
      >
        <Icone className="w-4 h-4 text-rl-purple shrink-0" />
        <span className="text-sm font-bold text-rl-text flex-1 min-w-0 truncate">{nome}</span>
        <span className="text-xs text-rl-muted shrink-0">{t('aprovacao.nCriativos', { count: total })}</span>
        <ChevronDown className={`w-4 h-4 text-rl-muted shrink-0 transition-transform ${aberta ? 'rotate-180' : ''}`} />
      </button>
      {aberta && <div className="space-y-4">{children}</div>}
    </div>
  )
}

// ─── Lightbox de imagem (desktop + mobile) ────────────────────────────────────
// Portal no <body> (o glass-card usa backdrop-filter, que quebraria position:
// fixed de um filho). Fecha por X, clique no fundo ou Esc. O botão de zoom
// alterna entre "caber na tela" e tamanho natural com navegação por
// arrasto/scroll (funciona com dedo no mobile e trackpad/roda no desktop).
function Lightbox({ src, alt, onClose }) {
  const { t } = useI18n()
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
          title={zoomed ? t('aprovacao.ajustarTela') : t('aprovacao.zoomReal')}
          aria-label={zoomed ? t('aprovacao.ajustarTela') : t('aprovacao.zoomReal')}
        >
          {zoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/25 transition-all"
          title={t('comum.fechar')}
          aria-label={t('comum.fechar')}
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
function AdCard({ ad, auth, onDecided, decided = false, readOnly = false }) {
  const { t } = useI18n()
  const [mode,       setMode]       = useState(null) // null | 'reprovando'
  const [motivo,     setMotivo]     = useState('')
  const [sugestao,   setSugestao]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [expanded,   setExpanded]   = useState(false) // lightbox da imagem
  const [ampliado,   setAmpliado]   = useState(null)  // lightbox de um arquivo da galeria

  const isLp = ad.kind === 'lp'
  // Criativo com mais de um arquivo (feed + story, cards do carrossel) vira galeria.
  const galeria = !isLp && Array.isArray(ad.arquivos) && ad.arquivos.length > 1
  const tipo = isLp
    ? { label: t('aprovacao.tipos.lp'), Icon: LayoutTemplate }
    : TIPO_META[ad.tipo]
      ? { ...TIPO_META[ad.tipo], label: t(`aprovacao.tipos.${TIPO_META[ad.tipo].label}`) }
      : { label: ad.tipo || t('aprovacao.criativo'), Icon: Layers }
  const TipoIcon = tipo.Icon
  const st = ad.aprovacao.status

  async function decide(decision) {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/anuncios-aprovacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth) },
        body: JSON.stringify({ ...authBody(auth), adId: ad.id, kind: ad.kind || 'ad', decision, motivo, sugestao }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || t('aprovacao.erroEnviar'))
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
          <p className="font-mono text-sm font-bold text-rl-text truncate flex items-center gap-2">
            {ad.nome || t('aprovacao.criativo')}
            {!isLp && (ad.version || 1) > 1 && (
              <span className="font-sans shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rl-purple/10 text-rl-purple border border-rl-purple/30">
                {t('aprovacao.versao', { n: ad.version })}
              </span>
            )}
          </p>
          <p className="text-[11px] text-rl-muted mt-0.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1"><TipoIcon className="w-3 h-3" /> {tipo.label}</span>
            {ad.createdAt && <span>· {fmtDate(ad.createdAt)}</span>}
          </p>
        </div>
        {decided && (
          st === 'aprovado' ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('aprovacao.aprovado')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-300 shrink-0">
              <XCircle className="w-3.5 h-3.5" /> {t('aprovacao.reprovado')}
            </span>
          )
        )}
      </div>

      {/* Prévia do criativo */}
      <div className="px-5 py-4 space-y-3">
        {galeria && <ArquivosGaleria arquivos={ad.arquivos} nome={ad.nome} onAmpliar={setAmpliado} />}
        {ampliado && <Lightbox src={ampliado} alt={ad.nome || t('aprovacao.criativo')} onClose={() => setAmpliado(null)} />}
        {!galeria && ad.attachmentUrl && ad.mediaKind === 'image' && (
          <div className="relative w-fit mx-auto max-w-full group">
            <img
              src={ad.attachmentUrl}
              alt={ad.nome || t('aprovacao.criativo')}
              onClick={() => setExpanded(true)}
              className="max-h-[420px] w-auto max-w-full rounded-xl border border-rl-border cursor-zoom-in"
            />
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="absolute top-2 right-2 p-2 rounded-lg bg-black/55 text-white hover:bg-black/75 transition-all"
              title={t('aprovacao.expandirImagem')}
              aria-label={t('aprovacao.expandirImagem')}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}
        {expanded && ad.attachmentUrl && ad.mediaKind === 'image' && (
          <Lightbox src={ad.attachmentUrl} alt={ad.nome || t('aprovacao.criativo')} onClose={() => setExpanded(false)} />
        )}
        {!galeria && ad.attachmentUrl && ad.mediaKind === 'video' && (
          <video
            src={ad.attachmentUrl}
            controls
            playsInline
            className="max-h-[420px] w-auto max-w-full rounded-xl border border-rl-border mx-auto"
          />
        )}
        {!galeria && ad.attachmentUrl && (ad.mediaKind === 'pdf' || ad.mediaKind === 'other') && (
          <a
            href={ad.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-rl-purple font-semibold hover:underline"
          >
            <Paperclip className="w-4 h-4" /> {t('aprovacao.abrirArquivoNome', { nome: ad.attachmentName || t('aprovacao.anexo') })}
          </a>
        )}
        {ad.url && (isLp ? (
          <a
            href={ad.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-rl-green/40 text-rl-green text-sm font-bold hover:bg-rl-green/10 transition-all"
          >
            <ExternalLink className="w-4 h-4" /> {t('aprovacao.abrirLp')}
          </a>
        ) : (
          <a
            href={ad.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-rl-purple font-semibold hover:underline"
          >
            <ExternalLink className="w-4 h-4" /> {t('aprovacao.verNoLink')}
          </a>
        ))}
        {!ad.attachmentUrl && !ad.url && (
          <p className="text-xs text-rl-muted italic">
            {isLp ? t('aprovacao.lpSemLink') : t('aprovacao.semPrevia')}
          </p>
        )}
        {ad.observacao && (
          <p className="text-xs text-rl-subtle bg-rl-surface/50 border border-rl-border rounded-xl px-3 py-2">
            {ad.observacao}
          </p>
        )}
      </div>

      {/* Versões anteriores — pra comparar o que mudou desde a última reprovação */}
      {!isLp && Array.isArray(ad.versionHistory) && ad.versionHistory.length > 0 && (
        <VersionCompare versions={ad.versionHistory} />
      )}

      {/* Decisão já tomada — mostra o registro */}
      {decided && st === 'reprovado' && (
        <div className="px-5 pb-4 space-y-2">
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-red-500">{t('aprovacao.motivoReprovacao')}</p>
            <p className="text-sm text-rl-text mt-1 whitespace-pre-wrap">{ad.aprovacao.motivo}</p>
          </div>
          <div className="rounded-xl bg-rl-surface/60 border border-rl-border px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-rl-muted">{t('aprovacao.comoDeveria')}</p>
            <p className="text-sm text-rl-text mt-1 whitespace-pre-wrap">{ad.aprovacao.sugestao}</p>
          </div>
        </div>
      )}
      {decided && ad.aprovacao.decididoEm && (
        <p className="px-5 pb-4 text-[10px] text-rl-muted">
          {t(st === 'aprovado' ? 'aprovacao.aprovadoEm' : 'aprovacao.reprovadoEm', { quando: fmtDateTime(ad.aprovacao.decididoEm) })}
          {ad.aprovacao.enviadoEm && <> · {t('aprovacao.enviadoEm', { quando: fmtDateTime(ad.aprovacao.enviadoEm) })}</>}
        </p>
      )}

      {/* Ações — só pra pendentes (e só com permissão de decidir) */}
      {!decided && !readOnly && (
        <div className="px-5 pb-5">
          {mode !== 'reprovando' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => decide('aprovado')}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {t('aprovacao.aprovar')}
              </button>
              <button
                onClick={() => setMode('reprovando')}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-300 text-red-600 text-sm font-bold hover:bg-red-50 transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> {t('aprovacao.reprovar')}
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <div>
                <label className="text-xs font-bold text-rl-text uppercase tracking-wide mb-1 block">
                  {t('aprovacao.porQue')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder={t('aprovacao.porQuePlaceholder')}
                  className="input-field w-full resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-rl-text uppercase tracking-wide mb-1 block">
                  {isLp ? t('aprovacao.comoLp') : t('aprovacao.comoAnuncio')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={sugestao}
                  onChange={(e) => setSugestao(e.target.value)}
                  rows={3}
                  placeholder={t('aprovacao.comoPlaceholder')}
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
                  {t('comum.cancelar')}
                </button>
                <button
                  onClick={() => decide('reprovado')}
                  disabled={submitting || !canReprovar}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {t('aprovacao.enviarReprovacao')}
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

// ─── Comparação com versões anteriores ────────────────────────────────────────
// Quando o time reprova... corrige e sobe uma mídia nova, a versão antiga fica
// guardada aqui pra o cliente ver lado a lado o que mudou desde a última rodada.
// Arquivos de um criativo lado a lado: feed e story da mesma peça, ou os cards
// do carrossel em sequência (com rolagem lateral).
const FORMATO_LABEL = { feed: 'Feed', story: 'Story' }

function ArquivosGaleria({ arquivos, nome, onAmpliar, compacta = false }) {
  const { t } = useI18n()
  const carrossel = arquivos.some((a) => a.formato === 'card')
  const altura = compacta ? 'max-h-[160px]' : carrossel ? 'max-h-[280px]' : 'max-h-[380px]'
  return (
    <div className={`flex gap-3 ${carrossel ? 'overflow-x-auto pb-2' : 'flex-wrap justify-center items-end'}`}>
      {arquivos.map((a, i) => (
        <figure key={i} className="shrink-0 space-y-1 max-w-full">
          {a.url && a.mediaKind === 'image' && (
            <img
              src={a.url}
              alt={`${nome || t('aprovacao.criativo')} ${i + 1}`}
              onClick={onAmpliar ? () => onAmpliar(a.url) : undefined}
              className={`${altura} w-auto max-w-full rounded-xl border border-rl-border ${onAmpliar ? 'cursor-zoom-in' : ''}`}
            />
          )}
          {a.url && a.mediaKind === 'video' && (
            <video src={a.url} controls playsInline className={`${altura} w-auto max-w-full rounded-xl border border-rl-border`} />
          )}
          {a.url && (a.mediaKind === 'pdf' || a.mediaKind === 'other') && (
            <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-rl-purple font-semibold hover:underline">
              <Paperclip className="w-3.5 h-3.5" /> {a.name ? t('aprovacao.abrirNome', { nome: a.name }) : t('aprovacao.abrirArquivo')}
            </a>
          )}
          <figcaption className="text-[10px] font-bold uppercase tracking-wide text-rl-muted text-center">
            {carrossel ? t('aprovacao.card', { n: i + 1 }) : FORMATO_LABEL[a.formato] || t('aprovacao.arquivoN', { n: i + 1 })}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

function VersionCompare({ versions }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const sorted = versions.slice().sort((a, b) => (b.version || 0) - (a.version || 0))

  return (
    <div className="px-5 pb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-rl-border bg-rl-surface/40 text-xs font-bold text-rl-subtle hover:text-rl-text transition-all"
      >
        <span className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" /> {t('aprovacao.comparar', { count: sorted.length })}
        </span>
        <span className="text-[10px] text-rl-muted">{open ? t('aprovacao.ocultar') : t('aprovacao.ver')}</span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map((v) => (
            <div key={v.version} className="rounded-xl border border-rl-border bg-rl-surface/30 overflow-hidden">
              <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-rl-border/60">
                <span className="text-[11px] font-bold text-rl-text">{t('aprovacao.versao', { n: v.version })}</span>
                {v.aprovacao?.status === 'reprovado' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">
                    <XCircle className="w-3 h-3" /> {t('aprovacao.reprovado')}
                  </span>
                )}
              </div>
              <div className="p-3 space-y-2">
                {v.arquivos?.length > 1 && <ArquivosGaleria arquivos={v.arquivos} nome={t('aprovacao.versao', { n: v.version })} compacta />}
                {!(v.arquivos?.length > 1) && v.attachmentUrl && v.mediaKind === 'image' && (
                  <img src={v.attachmentUrl} alt={t('aprovacao.versao', { n: v.version })} className="max-h-[220px] w-auto max-w-full mx-auto rounded-lg border border-rl-border" />
                )}
                {!(v.arquivos?.length > 1) && v.attachmentUrl && v.mediaKind === 'video' && (
                  <video src={v.attachmentUrl} controls playsInline className="max-h-[220px] w-auto max-w-full mx-auto rounded-lg border border-rl-border" />
                )}
                {!(v.arquivos?.length > 1) && v.attachmentUrl && (v.mediaKind === 'pdf' || v.mediaKind === 'other') && (
                  <a href={v.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-rl-purple font-semibold hover:underline">
                    <Paperclip className="w-3.5 h-3.5" /> {t('aprovacao.abrirArquivo')}
                  </a>
                )}
                {!v.attachmentUrl && v.url && (
                  <a href={v.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-rl-purple font-semibold hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" /> {t('aprovacao.verNoLink')}
                  </a>
                )}
                {v.aprovacao?.status === 'reprovado' && v.aprovacao?.motivo && (
                  <p className="text-[11px] text-rl-muted whitespace-pre-wrap">
                    <span className="font-semibold text-rl-subtle">{t('aprovacao.motivoReprovacao')}:</span> {v.aprovacao.motivo}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
