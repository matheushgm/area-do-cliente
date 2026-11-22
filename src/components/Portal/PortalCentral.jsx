// Central de anúncios do portal: o cliente vê, por mês, o que espera a aprovação dele e o
// que já aprovou, separado em Roteiros, Imagens e Vídeos (e Landing pages, quando houver).
// Decide ali mesmo (aprovar, pedir ajuste, editar o texto e aprovar) e a tela já passa para o
// próximo pendente. Os dados vêm de usePortalCentral (Portal.jsx), que o Início também usa.
import { useEffect, useMemo, useState } from 'react'
import {
  Loader2, RefreshCw, CheckCircle2, AlertCircle, Clock, X, ChevronLeft, ChevronRight, Play, FileText,
  Image as ImageIcon, Film, LayoutTemplate, ExternalLink, Pencil, Check, MessageSquareWarning, Inbox,
} from 'lucide-react'
import { CATEGORIAS, STATUS, contarCentral, mesesDaCentral, nomeDoMes, noMes, dataCurta } from '../../lib/portalCentral'
import { copyParaCliente } from '../../lib/copyParaCliente'
import { portalDecidirCopy, portalDecidirPeca } from '../../lib/portal'
import MarkdownView from '../Editor/MarkdownView'

const ICONE_CAT = { roteiro: FileText, imagem: ImageIcon, video: Film, lp: LayoutTemplate }

function StatusPill({ status, editado }) {
  const s = STATUS[status] || STATUS.pendente
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: s.cor, background: s.fundo }}>
      {status === 'aprovado' ? <Check className="w-3 h-3" strokeWidth={3} /> : status === 'reprovado' ? <MessageSquareWarning className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {s.label}{status === 'aprovado' && editado ? ' c/ ajustes' : ''}
    </span>
  )
}

// ── Miniatura do cartão ──────────────────────────────────────────────────────
function Miniatura({ item }) {
  const Ic = ICONE_CAT[item.categoria] || FileText
  if (item.kind === 'copy') {
    const texto = copyParaCliente(item.conteudo).replace(/[*#>_`|]/g, '').replace(/\n{2,}/g, '\n').trim()
    return (
      <div className="h-full bg-rl-surface p-3.5 overflow-hidden relative">
        <p className="text-[12.5px] leading-relaxed text-rl-text/80 whitespace-pre-line line-clamp-[8]">{texto || 'Sem texto.'}</p>
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-rl-surface to-transparent" />
      </div>
    )
  }
  const a = item.arquivos?.[0]
  if (a?.mediaKind === 'image') return <img src={a.url} alt="" loading="lazy" className="h-full w-full object-cover bg-rl-surface" />
  if (a?.mediaKind === 'video') {
    return (
      <div className="h-full w-full relative bg-black">
        <video src={`${a.url}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center"><span className="w-11 h-11 rounded-full bg-black/55 text-white inline-flex items-center justify-center"><Play className="w-5 h-5 ml-0.5" fill="currentColor" /></span></span>
      </div>
    )
  }
  return <div className="h-full w-full bg-rl-surface flex items-center justify-center text-rl-muted"><Ic className="w-8 h-8" /></div>
}

function Cartao({ item, onAbrir, podeDecidir, onAprovarRapido, decidindo }) {
  const quadrado = item.kind !== 'copy'
  return (
    <div className="group glass-card !p-0 overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
      <button type="button" onClick={onAbrir} className={`block w-full text-left ${quadrado ? 'aspect-[4/5]' : 'h-44'} overflow-hidden`} aria-label={`Abrir ${item.titulo}`}>
        <Miniatura item={item} />
      </button>
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onAbrir} className="min-w-0 text-left">
            <p className="text-sm font-semibold text-rl-text leading-snug line-clamp-2">{item.titulo}</p>
            <p className="text-[11px] text-rl-muted mt-0.5 truncate">{[item.formato, item.arquivos?.length > 1 ? `${item.arquivos.length} arquivos` : null, item.versao > 1 ? `versão ${item.versao}` : null, dataCurta(item.enviadoEm)].filter(Boolean).join(' · ')}</p>
          </button>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <StatusPill status={item.status} editado={item.editado} />
          {item.status === 'pendente' && podeDecidir ? (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={onAbrir} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface">Ver</button>
              <button type="button" disabled={decidindo} onClick={onAprovarRapido} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1 disabled:opacity-60">
                {decidindo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" strokeWidth={3} />} Aprovar
              </button>
            </div>
          ) : (
            <button type="button" onClick={onAbrir} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface">Abrir</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Detalhe (tela cheia) com a decisão ───────────────────────────────────────
function Midia({ item }) {
  const [i, setI] = useState(0)
  const arqs = item.arquivos || []
  useEffect(() => { setI(0) }, [item.id])
  if (item.kind === 'copy') {
    return (
      <div className="h-full overflow-y-auto p-5 sm:p-8 bg-rl-card">
        <div className="max-w-2xl mx-auto"><MarkdownView content={copyParaCliente(item.conteudo)} codigo={false} /></div>
      </div>
    )
  }
  if (item.kind === 'lp' || !arqs.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center bg-rl-surface">
        <LayoutTemplate className="w-10 h-10 text-rl-muted" />
        {item.link ? (
          <a href={item.link} target="_blank" rel="noreferrer" className="btn-primary inline-flex items-center gap-2 text-sm"><ExternalLink className="w-4 h-4" /> Abrir {item.kind === 'lp' ? 'a página' : 'a peça'}</a>
        ) : <p className="text-sm text-rl-muted">Sem arquivo para mostrar.</p>}
        {item.link && <p className="text-xs text-rl-muted break-all max-w-md">{item.link}</p>}
      </div>
    )
  }
  const a = arqs[Math.min(i, arqs.length - 1)]
  return (
    <div className="h-full relative bg-black flex items-center justify-center">
      {a.mediaKind === 'video'
        ? <video key={a.url} src={a.url} controls playsInline className="max-h-full max-w-full" />
        : a.mediaKind === 'image'
          ? <img key={a.url} src={a.url} alt={a.name || ''} className="max-h-full max-w-full object-contain" />
          : <a href={a.url} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-2 text-sm"><ExternalLink className="w-4 h-4" /> Abrir {a.name || 'arquivo'}</a>}
      {arqs.length > 1 && (
        <>
          <button type="button" onClick={() => setI((x) => (x - 1 + arqs.length) % arqs.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-black inline-flex items-center justify-center" aria-label="Arquivo anterior"><ChevronLeft className="w-5 h-5" /></button>
          <button type="button" onClick={() => setI((x) => (x + 1) % arqs.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-black inline-flex items-center justify-center" aria-label="Próximo arquivo"><ChevronRight className="w-5 h-5" /></button>
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-2.5 py-1 rounded-full bg-black/60 text-white">{a.formato === 'story' ? 'Story · ' : a.formato === 'feed' ? 'Feed · ' : ''}{i + 1} de {arqs.length}</span>
        </>
      )}
    </div>
  )
}

function Decisao({ item, podeDecidir, onDecidir }) {
  const [modo, setModo] = useState(null) // null | 'ajuste' | 'editar'
  const [motivo, setMotivo] = useState('')
  const [sugestao, setSugestao] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  useEffect(() => { setModo(null); setMotivo(''); setSugestao(''); setErro(null); setTexto(copyParaCliente(item.conteudo || '')) }, [item.id, item.conteudo])

  async function decidir(decision, extra = {}) {
    setEnviando(true); setErro(null)
    try { await onDecidir(item, { decision, ...extra }) } catch (e) { setErro(e?.message || 'Não consegui salvar. Tente de novo.') }
    setEnviando(false)
  }

  if (item.status !== 'pendente') {
    return (
      <div className="space-y-3">
        <StatusPill status={item.status} editado={item.editado} />
        {item.decididoEm && <p className="text-xs text-rl-muted">Decidido em {dataCurta(item.decididoEm)}</p>}
        {item.status === 'reprovado' && (
          <div className="rounded-xl bg-rl-surface p-3 space-y-2 text-sm">
            {item.motivo && <div><p className="text-[11px] font-semibold text-rl-muted">O que não ficou bom</p><p className="text-rl-text whitespace-pre-line">{item.motivo}</p></div>}
            {item.sugestao && <div><p className="text-[11px] font-semibold text-rl-muted">Como deveria ficar</p><p className="text-rl-text whitespace-pre-line">{item.sugestao}</p></div>}
            <p className="text-xs text-rl-muted">O time já recebeu e manda uma nova versão para você aprovar.</p>
          </div>
        )}
      </div>
    )
  }
  if (!podeDecidir) return <p className="text-sm text-rl-muted">Esperando aprovação. Este acesso é só para visualizar.</p>

  if (modo === 'ajuste') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-rl-text">Pedir ajuste</p>
        <label className="block">
          <span className="text-[12px] font-semibold text-rl-muted">O que não ficou bom?</span>
          <textarea autoFocus rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input-field w-full mt-1 text-sm" placeholder="Ex.: a cor do fundo não combina com a marca" />
        </label>
        <label className="block">
          <span className="text-[12px] font-semibold text-rl-muted">Como deveria ficar?</span>
          <textarea rows={3} value={sugestao} onChange={(e) => setSugestao(e.target.value)} className="input-field w-full mt-1 text-sm" placeholder="Ex.: usar o azul do logo e trocar a foto pela da loja" />
        </label>
        {erro && <p className="text-xs font-semibold text-red-500">{erro}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setModo(null)} className="btn-secondary text-sm flex-1">Voltar</button>
          <button type="button" disabled={enviando || !motivo.trim() || !sugestao.trim()} onClick={() => decidir('reprovado', { motivo: motivo.trim(), sugestao: sugestao.trim() })} className="flex-1 text-sm font-semibold rounded-xl px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />} Enviar pedido de ajuste
          </button>
        </div>
      </div>
    )
  }
  if (modo === 'editar') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-rl-text">Ajuste o texto e aprove</p>
        <textarea autoFocus rows={12} value={texto} onChange={(e) => setTexto(e.target.value)} className="input-field w-full text-sm font-mono leading-relaxed" />
        <p className="text-xs text-rl-muted">O time recebe o seu texto e mantém o original guardado.</p>
        {erro && <p className="text-xs font-semibold text-red-500">{erro}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setModo(null)} className="btn-secondary text-sm flex-1">Cancelar</button>
          <button type="button" disabled={enviando || !texto.trim()} onClick={() => decidir('aprovado', { conteudo: texto })} className="flex-1 text-sm font-semibold rounded-xl px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />} Aprovar com ajustes
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2.5">
      <button type="button" disabled={enviando} onClick={() => decidir('aprovado')} className="w-full text-sm font-semibold rounded-xl px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />} Aprovar
      </button>
      {item.kind === 'copy' && (
        <button type="button" onClick={() => setModo('editar')} className="w-full btn-secondary text-sm inline-flex items-center justify-center gap-2"><Pencil className="w-4 h-4" /> Editar o texto e aprovar</button>
      )}
      <button type="button" onClick={() => setModo('ajuste')} className="w-full text-sm font-semibold rounded-xl px-4 py-2.5 border border-red-500/30 text-red-600 hover:bg-red-500/10 inline-flex items-center justify-center gap-2"><MessageSquareWarning className="w-4 h-4" /> Pedir ajuste</button>
      {erro && <p className="text-xs font-semibold text-red-500">{erro}</p>}
      <p className="text-[11px] text-rl-muted text-center pt-1">Atalhos: A aprova · ← → navegam · Esc fecha</p>
    </div>
  )
}

function Detalhe({ item, posicao, total, onFechar, onAnterior, onProxima, podeDecidir, onDecidir }) {
  useEffect(() => {
    const h = (e) => {
      if (/input|textarea|select/i.test(e.target?.tagName || '')) return
      if (e.key === 'Escape') onFechar()
      else if (e.key === 'ArrowLeft') onAnterior()
      else if (e.key === 'ArrowRight') onProxima()
      else if ((e.key === 'a' || e.key === 'A') && podeDecidir && item.status === 'pendente') onDecidir(item, { decision: 'aprovado' }).catch(() => {})
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [item, onFechar, onAnterior, onProxima, podeDecidir, onDecidir])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  const Ic = ICONE_CAT[item.categoria] || FileText
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-stretch sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-label={item.titulo}>
      <div className="absolute inset-0" onClick={onFechar} aria-hidden="true" />
      <div className="relative w-full max-w-6xl h-full sm:h-[min(860px,92vh)] bg-rl-card sm:rounded-2xl overflow-hidden flex flex-col lg:flex-row shadow-2xl">
        <div className="flex-1 min-h-[45vh] lg:min-h-0 min-w-0">
          <Midia item={item} />
        </div>
        <aside className="w-full lg:w-[360px] shrink-0 border-t lg:border-t-0 lg:border-l border-rl-border flex flex-col max-h-[55vh] lg:max-h-none">
          <div className="px-5 py-3 border-b border-rl-border flex items-center gap-2">
            <button type="button" onClick={onAnterior} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface" aria-label="Anterior"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs text-rl-muted tabular-nums">{posicao} de {total}</span>
            <button type="button" onClick={onProxima} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface" aria-label="Próximo"><ChevronRight className="w-4 h-4" /></button>
            <button type="button" onClick={onFechar} className="ml-auto p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface" aria-label="Fechar"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rl-muted inline-flex items-center gap-1.5"><Ic className="w-3.5 h-3.5" />{item.formato || CATEGORIAS.find((c) => c.id === item.categoria)?.singular}</p>
              <h3 className="text-lg font-bold text-rl-text leading-snug mt-1">{item.titulo}</h3>
              <p className="text-xs text-rl-muted mt-1">{[item.grupo, item.enviadoEm && `enviado em ${dataCurta(item.enviadoEm)}`, item.versao > 1 && `versão ${item.versao}`].filter(Boolean).join(' · ')}</p>
            </div>
            {item.observacao && <p className="text-sm text-rl-text bg-rl-surface rounded-xl p-3 whitespace-pre-line">{item.observacao}</p>}
            {item.copy && (
              <details className="rounded-xl bg-rl-surface p-3 group" open>
                <summary className="text-[12px] font-semibold text-rl-muted cursor-pointer select-none">Texto do anúncio</summary>
                <div className="mt-2 text-sm"><MarkdownView content={item.copy} codigo={false} /></div>
              </details>
            )}
            {item.link && item.kind === 'ad' && <a href={item.link} target="_blank" rel="noreferrer" className="text-sm text-rl-blue inline-flex items-center gap-1.5 hover:underline"><ExternalLink className="w-4 h-4" /> Ver a peça no link</a>}
            <Decisao item={item} podeDecidir={podeDecidir} onDecidir={onDecidir} />
            {item.historico?.length > 0 && (
              <div className="pt-2 border-t border-rl-border">
                <p className="text-[11px] font-semibold text-rl-muted mb-1.5">Versões anteriores</p>
                <ul className="space-y-1.5">
                  {item.historico.map((v) => (
                    <li key={v.version} className="text-xs text-rl-muted">
                      Versão {v.version}{v.aprovacao?.status === 'reprovado' && v.aprovacao?.motivo ? `: você pediu "${v.aprovacao.motivo}"` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ── Tela ─────────────────────────────────────────────────────────────────────
const FILTROS = [
  { id: 'pendente', label: 'Para aprovar' },
  { id: 'aprovado', label: 'Aprovados' },
  { id: 'reprovado', label: 'Pedidos de ajuste' },
  { id: 'todos', label: 'Todos' },
]

export default function PortalCentral({ projectId, token, level, central }) {
  const { itens, carregando, erro, recarregar, aplicarDecisao } = central
  const podeDecidir = level === 'edit'
  const meses = useMemo(() => mesesDaCentral(itens), [itens])
  const [mes, setMes] = useState(() => meses[0])
  const categorias = useMemo(() => CATEGORIAS.filter((c) => c.id !== 'lp' || itens.some((i) => i.categoria === 'lp')), [itens])
  const contagem = useMemo(() => contarCentral(itens, mes), [itens, mes])
  const [cat, setCat] = useState(null)
  const [filtro, setFiltro] = useState(null)
  const [aberto, setAberto] = useState(null) // id
  const [decidindo, setDecidindo] = useState(null)
  const [aviso, setAviso] = useState(null)

  // Abre na primeira aba com pendência (senão Roteiros) e no filtro que faz sentido.
  const catAtual = cat || categorias.find((c) => contagem[c.id]?.pendente)?.id || categorias[0]?.id
  const doCat = contagem[catAtual] || { pendente: 0, aprovado: 0, reprovado: 0, total: 0 }
  const filtroAtual = filtro || (doCat.pendente ? 'pendente' : 'aprovado')
  const lista = useMemo(() => itens.filter((i) => i.categoria === catAtual && noMes(i, mes) && (filtroAtual === 'todos' || i.status === filtroAtual)), [itens, catAtual, mes, filtroAtual])

  useEffect(() => { if (!aviso) return undefined; const h = setTimeout(() => setAviso(null), 3500); return () => clearTimeout(h) }, [aviso])

  const indice = aberto ? lista.findIndex((i) => i.id === aberto) : -1
  const itemAberto = indice >= 0 ? lista[indice] : (aberto ? itens.find((i) => i.id === aberto) : null)

  async function decidir(item, { decision, motivo, sugestao, conteudo }) {
    if (item.kind === 'copy') await portalDecidirCopy(projectId, token, { levaId: item.levaId, itemId: item.itemId, decision, motivo, sugestao, conteudo })
    else await portalDecidirPeca(projectId, token, { id: item.id, kind: item.kind === 'lp' ? 'lp' : 'ad', decision, motivo, sugestao })
    // próximo pendente da mesma lista, para aprovar em sequência
    const pendentes = lista.filter((i) => i.status === 'pendente' && i.id !== item.id)
    const depois = pendentes.find((i) => lista.indexOf(i) > lista.indexOf(item)) || pendentes[0] || null
    aplicarDecisao(item.id, { status: decision, motivo: motivo || null, sugestao: sugestao || null, editado: !!conteudo, conteudo, decididoEm: new Date().toISOString() })
    setAviso(decision === 'aprovado' ? `"${item.titulo}" aprovado.` : 'Pedido de ajuste enviado para o time.')
    if (aberto) setAberto(depois ? depois.id : null)
  }

  async function aprovarRapido(item) {
    setDecidindo(item.id)
    try { await decidir(item, { decision: 'aprovado' }) } catch (e) { setAviso(e?.message || 'Não consegui aprovar agora.') }
    setDecidindo(null)
  }

  if (carregando && !itens.length) return <div className="glass-card p-10 flex justify-center text-rl-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>
  if (erro && !itens.length) {
    return (
      <div className="glass-card p-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 mx-auto text-red-400" />
        <p className="text-sm text-rl-text">{erro}</p>
        <button type="button" onClick={recarregar} className="btn-secondary text-sm">Tentar de novo</button>
      </div>
    )
  }

  const totalPend = contagem.todos.pendente
  return (
    <div className="space-y-4">
      {/* Resumo do mês */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <label htmlFor="central-mes" className="text-xs font-semibold text-rl-muted">Mês</label>
            <select id="central-mes" value={mes || ''} onChange={(e) => setMes(e.target.value || null)} className="input-field !py-1.5 !pr-8 text-sm font-semibold">
              {meses.map((m) => <option key={m} value={m}>{nomeDoMes(m)}</option>)}
              <option value="">Todos os meses</option>
            </select>
          </div>
          <button type="button" onClick={recarregar} disabled={carregando} className="text-xs font-semibold text-rl-muted hover:text-rl-text inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-rl-surface">
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
          <div className="rounded-xl p-3 sm:p-4" style={{ background: 'rgba(245, 158, 11, 0.10)' }}>
            <p className="text-[11px] sm:text-xs font-semibold text-amber-700 dark:text-amber-400">Esperando você</p>
            <p className="text-2xl sm:text-3xl font-bold text-rl-text tabular-nums mt-0.5">{totalPend}</p>
          </div>
          <div className="rounded-xl p-3 sm:p-4" style={{ background: 'rgba(16, 185, 129, 0.10)' }}>
            <p className="text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400">Aprovados{mes ? ` em ${nomeDoMes(mes, { curto: true }).toLowerCase()}` : ''}</p>
            <p className="text-2xl sm:text-3xl font-bold text-rl-text tabular-nums mt-0.5">{contagem.todos.aprovado}</p>
          </div>
          <div className="rounded-xl p-3 sm:p-4 bg-rl-surface">
            <p className="text-[11px] sm:text-xs font-semibold text-rl-muted">Ajustes pedidos</p>
            <p className="text-2xl sm:text-3xl font-bold text-rl-text tabular-nums mt-0.5">{contagem.todos.reprovado}</p>
          </div>
        </div>
        <p className="text-[11px] text-rl-muted mt-2.5">O que espera aprovação aparece em qualquer mês; aprovados e ajustes contam no mês da decisão.</p>
      </div>

      {/* Abas por tipo */}
      <div className={`grid gap-2 ${categorias.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-3'}`} role="tablist">
        {categorias.map((c) => {
          const n = contagem[c.id]
          const Ic = ICONE_CAT[c.id]
          const ativo = c.id === catAtual
          return (
            <button
              key={c.id} type="button" role="tab" aria-selected={ativo}
              onClick={() => { setCat(c.id); setFiltro(null) }}
              className={`text-left rounded-2xl border p-2.5 sm:p-4 transition min-w-0 ${ativo ? 'border-rl-purple bg-rl-purple/[0.06] ring-1 ring-rl-purple' : 'border-rl-border bg-rl-card hover:border-rl-purple/40'}`}
            >
              <span className="flex items-center gap-2">
                <span className={`hidden sm:inline-flex w-8 h-8 rounded-lg items-center justify-center shrink-0 ${ativo ? 'bg-rl-purple text-white' : 'bg-rl-surface text-rl-muted'}`}><Ic className="w-4 h-4" /></span>
                <span className="text-sm sm:text-[15px] font-bold text-rl-text">{c.label}</span>
              </span>
              <span className="mt-2 sm:mt-2.5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs">
                <span className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap ${n.pendente ? 'text-amber-700 dark:text-amber-400' : 'text-rl-muted'}`}><Clock className="w-3.5 h-3.5 shrink-0" /><b className="tabular-nums">{n.pendente}</b> <span className="sm:hidden">pendentes</span><span className="hidden sm:inline">para aprovar</span></span>
                <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /><b className="tabular-nums">{n.aprovado}</b> {n.aprovado === 1 ? 'aprovado' : 'aprovados'}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Filtro de status */}
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const n = f.id === 'todos' ? doCat.total : doCat[f.id]
          const ativo = f.id === filtroAtual
          return (
            <button key={f.id} type="button" onClick={() => setFiltro(f.id)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${ativo ? 'bg-rl-text text-rl-card border-rl-text' : 'border-rl-border text-rl-muted hover:text-rl-text'}`}>
              {f.label} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          )
        })}
      </div>

      {lista.length ? (
        <div className={`grid gap-3 sm:gap-4 ${catAtual === 'roteiro' ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'}`}>
          {lista.map((it) => (
            <Cartao key={it.id} item={it} podeDecidir={podeDecidir} decidindo={decidindo === it.id} onAbrir={() => setAberto(it.id)} onAprovarRapido={() => aprovarRapido(it)} />
          ))}
        </div>
      ) : (
        <div className="glass-card p-10 text-center">
          <Inbox className="w-8 h-8 mx-auto text-rl-muted mb-2" />
          <p className="text-sm font-semibold text-rl-text">
            {filtroAtual === 'pendente' ? `Nenhum${catAtual === 'imagem' ? 'a' : ''} ${CATEGORIAS.find((c) => c.id === catAtual)?.singular} esperando você.` : 'Nada aqui neste mês.'}
          </p>
          {filtroAtual === 'pendente' && doCat.aprovado > 0 && <button type="button" onClick={() => setFiltro('aprovado')} className="mt-3 text-sm font-semibold text-rl-purple hover:underline">Ver os {doCat.aprovado} aprovados</button>}
        </div>
      )}

      {itemAberto && (
        <Detalhe
          item={itemAberto}
          posicao={indice >= 0 ? indice + 1 : 1}
          total={lista.length || 1}
          podeDecidir={podeDecidir}
          onDecidir={decidir}
          onFechar={() => setAberto(null)}
          onAnterior={() => lista.length && setAberto(lista[(Math.max(indice, 0) - 1 + lista.length) % lista.length].id)}
          onProxima={() => lista.length && setAberto(lista[(Math.max(indice, 0) + 1) % lista.length].id)}
        />
      )}

      {aviso && (
        <div className="fixed bottom-5 right-5 z-[60] glass-card px-4 py-3 shadow-xl flex items-center gap-2 text-sm text-rl-text animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> {aviso}
        </div>
      )}
    </div>
  )
}
