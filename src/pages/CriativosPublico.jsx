import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import MarkdownBlock from '../components/Criativos/MarkdownBlock'
import { AD_TYPES, postCriativo, streamCriativo, rotuloTipoAnuncio, descTipoAnuncio } from '../lib/criativosPublic'
import { FUNIS, rotuloFunil, metaFunil } from '../lib/funis'
import { NIVEIS_CONSCIENCIA, NIVEIS_BY_ID, distribute, QTD_PRESETS, rotuloNivel, dicaNivel } from '../lib/niveisConsciencia'
import { useI18n } from '../i18n'
import {
  Sparkles, Loader2, AlertTriangle, Lock, ArrowLeft, ArrowRight, Image as ImageIcon, Video,
  CheckCircle2, RotateCcw, Copy, Check, Plus, X, ChevronLeft, Wand2, Layers,
} from 'lucide-react'

// Máximo de blocos (tipos no vídeo, dor x tipo no estático) e teto de peças por
// geração no link do cliente. Espelha o servidor (api/criativos-public.js).
const MAX_BLOCOS = 3
const MAX_PECAS = 15

// Divide o output da IA em peças individuais (um roteiro / um bloco de dor por
// card). Usa o separador "---" (que as prompts pedem); se não houver, cai nos
// cabeçalhos ## ROTEIRO / ## ANÚNCIO / # DOR.
function splitAds(content) {
  const text = (content || '').replace(/\r/g, '').trim()
  if (!text) return []
  let parts = text.split(/\n\s*---\s*\n/).map((s) => s.trim()).filter(Boolean)
  if (parts.length <= 1) {
    parts = text.split(/(?=^#{1,3}\s+(?:ROTEIRO|AN[ÚU]NCIO|DOR)\b)/im).map((s) => s.trim()).filter(Boolean)
  }
  return parts
}

// O histórico grava o rótulo do funil em português; se é um funil do catálogo, mostra
// a tradução, senão como veio.
function rotuloFunilGravado(label) {
  const f = FUNIS.find((x) => x.label === label)
  return f ? rotuloFunil(f.id) : label
}

// Renderiza cada peça em seu próprio card, bem separada das outras.
function ResultCards({ content }) {
  const ads = splitAds(content)
  if (!ads.length) return null
  return (
    <div className="space-y-3">
      {ads.map((ad, i) => (
        <div key={i} className="glass-card p-5 sm:p-6 relative">
          <span className="absolute -top-2 left-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-purple text-white shadow-sm">
            {i + 1}
          </span>
          <MarkdownBlock content={ad} />
        </div>
      ))}
    </div>
  )
}

export default function CriativosPublico() {
  const { projectId, token } = useParams()
  return <CriativosTool auth={{ projectId, token }} />
}

// Ferramenta reutilizável. `auth` = { projectId, token } (link público: pede
// e-mail + senha na tela) ou { projectId, portal } (sessão do portal: entra
// direto). `embedded` tira o fundo/logo de página inteira.
export function CriativosTool({ auth, embedded = false }) {
  const { t, locale } = useI18n()
  const { projectId, token } = auth
  const viaPortal = !!auth.portal

  // 'gate' | 'loading' | 'select' | 'config' | 'generating' | 'result' | 'error' | 'history'
  const [status, setStatus] = useState(viaPortal ? 'loading' : 'gate')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null) // { id, email, name }
  const [ctx, setCtx] = useState(null) // { companyName, dores, produtos, personas }
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [mode, setMode] = useState(null) // 'estatico' | 'video'
  const [stepIdx, setStepIdx] = useState(0) // passo do wizard de config
  const [selectedProduct, setSelectedProduct] = useState('') // id do produto (opcional)
  const [selectedPersona, setSelectedPersona] = useState('') // id da persona (opcional)
  const [funil, setFunil] = useState('') // id do funil escolhido
  const [nivel, setNivel] = useState('') // nível de consciência do público
  const [quantidade, setQuantidade] = useState(5) // total de peças da geração
  const [detalhes, setDetalhes] = useState('') // particularidades deste anúncio
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)
  const abortRef = useRef(null)

  const [history, setHistory] = useState([]) // gerações do próprio usuário
  const [viewing, setViewing] = useState(null) // item do histórico aberto

  // Credenciais reenviadas em cada chamada (o servidor revalida no banco).
  const creds = () => (viaPortal
    ? { projectId, portal: auth.portal }
    : { projectId, token, email: email.trim().toLowerCase(), password })

  // Config: vídeo → { [typeId]: true }
  const [adTypeConfig, setAdTypeConfig] = useState({})
  // Config: estático → { [dorId]: { types: { [typeId]: true } } }
  const [dorConfig, setDorConfig] = useState({})
  const [customDores, setCustomDores] = useState([])
  const [addingDor, setAddingDor] = useState(false)
  const [newDorText, setNewDorText] = useState('')

  const personaName = useMemo(
    () => (ctx?.personas || []).find((p) => p.id === selectedPersona)?.name || '',
    [ctx, selectedPersona]
  )

  const allDores = useMemo(() => {
    let parsed = (ctx?.dores || []).map((d) => ({ id: d.id, text: d.text, personaName: d.personaName }))
    // Se uma persona foi escolhida, mostra só as dores dela.
    if (personaName) parsed = parsed.filter((d) => d.personaName === personaName)
    return [...parsed, ...customDores.map((d) => ({ ...d, isCustom: true }))]
  }, [ctx, customDores, personaName])

  // Passos do wizard de configuração. O passo "foco" (produto/persona) só existe
  // se o cliente tiver produtos ou personas cadastrados.
  const steps = useMemo(() => {
    const hasFoco = (ctx?.produtos?.length || 0) > 0 || (ctx?.personas?.length || 0) > 0
    return [...(hasFoco ? ['foco'] : []), 'funil', 'nivel', 'tipo', 'obs']
  }, [ctx])
  const step = steps[Math.min(stepIdx, steps.length - 1)]

  // ── Login (email + senha) ───────────────────────────────────────────────────
  async function login() {
    if (!viaPortal && (!email.trim() || !password)) return
    if (busy) return
    setBusy(true); setError(null)
    try {
      const data = await postCriativo('login', creds())
      setCtx(data)
      setUser(data.user)
      setStatus('select')
    } catch (e) {
      setError(e.message || t('criativosPublico.erroEntrar'))
      if (viaPortal) setStatus('error')
    } finally {
      setBusy(false)
    }
  }

  // Pelo portal não há tela de senha: carrega o contexto ao montar.
  useEffect(() => {
    if (viaPortal) login()
  }, [auth.portal]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Histórico do próprio usuário ────────────────────────────────────────────
  async function openHistory() {
    setBusy(true); setError(null); setViewing(null)
    try {
      const data = await postCriativo('history', creds())
      setHistory(data.history || [])
      setStatus('history')
    } catch (e) {
      setError(e.message || t('criativosPublico.erroHistorico'))
    } finally {
      setBusy(false)
    }
  }

  // ── Vídeo: seleção de tipos ───────────────────────────────────────────────
  const videoTypes = Object.keys(adTypeConfig)

  function toggleVideoType(id) {
    setAdTypeConfig((prev) => {
      if (prev[id]) { const n = { ...prev }; delete n[id]; return n }
      if (Object.keys(prev).length >= MAX_BLOCOS) return prev // trava no máximo
      return { ...prev, [id]: true }
    })
  }

  // ── Estático: dores + tipos por dor ───────────────────────────────────────
  const selectedDores = allDores.filter((d) => dorConfig[d.id])
  const staticBlocos = selectedDores.reduce(
    (s, d) => s + Object.keys(dorConfig[d.id]?.types || {}).length, 0
  )

  function toggleDor(id) {
    setDorConfig((prev) => {
      if (prev[id]) { const n = { ...prev }; delete n[id]; return n }
      return { ...prev, [id]: { types: {} } }
    })
  }
  function toggleDorType(dorId, typeId) {
    setDorConfig((prev) => {
      const dor = prev[dorId] || { types: {} }
      const types = { ...dor.types }
      if (types[typeId]) {
        delete types[typeId]
      } else {
        // total de combinações já escolhidas em todas as dores
        const total = Object.values(prev).reduce((s, d) => s + Object.keys(d?.types || {}).length, 0)
        if (total >= MAX_BLOCOS) return prev // trava no máximo
        types[typeId] = true
      }
      return { ...prev, [dorId]: { ...dor, types } }
    })
  }
  function confirmAddDor() {
    const texto = newDorText.trim()
    if (!texto) { setAddingDor(false); setNewDorText(''); return }
    const id = `custom_${crypto.randomUUID()}`
    setCustomDores((prev) => [...prev, { id, text: texto }])
    setDorConfig((prev) => ({ ...prev, [id]: { types: {} } }))
    setNewDorText(''); setAddingDor(false)
  }

  // ── Gerar ─────────────────────────────────────────────────────────────────
  const isVideo = mode === 'video'
  const blocos = isVideo ? videoTypes.length : staticBlocos
  const totalPecas = quantidade
  const excedeu = blocos > MAX_BLOCOS
  // Cada bloco precisa de pelo menos 1 peça — senão a distribuição zeraria algum.
  const qtdInsuficiente = blocos > 0 && quantidade < blocos
  // Quantas peças cada bloco recebe: distribute(8, 3) → [3, 3, 2]
  const split = distribute(quantidade, blocos)
  const canGenerate = blocos > 0 && !excedeu && !qtdInsuficiente && !!funil && !!nivel

  async function generate() {
    if (!canGenerate) return
    setStatus('generating'); setError(null); setResult(''); setCopied(false)
    abortRef.current = new AbortController()
    const detalhesTrim = detalhes.trim()
    const selection = isVideo
      ? { adTypes: videoTypes }
      : { dores: selectedDores.map((d) => ({ text: d.text, types: Object.keys(dorConfig[d.id].types) })) }
    try {
      const payload = { ...creds(), mode, funil, nivel, quantidade, detalhes: detalhesTrim, productId: selectedProduct, personaId: selectedPersona, ...selection }
      const full = await streamCriativo('generate', payload, setResult, abortRef.current.signal)
      setResult(full)
      setStatus('result')
      // Salva no histórico do usuário (não bloqueia a tela).
      postCriativo('save', { ...creds(), mode, funil, detalhes: detalhesTrim, selection, content: full })
        .catch(() => {})
    } catch (e) {
      if (e.name === 'AbortError') return
      setError(e.message || t('criativosPublico.erroGerar'))
      setStatus('error')
    }
  }

  function copyResult() {
    navigator.clipboard?.writeText(result || '').then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  function resetConfig() {
    setAdTypeConfig({}); setDorConfig({}); setCustomDores([]); setAddingDor(false); setNewDorText(''); setFunil(''); setDetalhes(''); setSelectedProduct(''); setSelectedPersona(''); setStepIdx(0)
  }

  // Pode avançar do passo atual?
  function canAdvance(s) {
    if (s === 'funil') return !!funil
    if (s === 'nivel') return !!nivel
    if (s === 'tipo') return blocos > 0 && !excedeu && !qtdInsuficiente
    return true // 'foco' e 'obs' são livres
  }
  function nextStep() {
    if (!canAdvance(step)) return
    setError(null)
    setStepIdx((i) => Math.min(i + 1, steps.length - 1))
  }
  function prevStep() {
    setError(null)
    if (stepIdx === 0) { setMode(null); setStatus('select'); return }
    setStepIdx((i) => Math.max(i - 1, 0))
  }

  // ══ RENDER ════════════════════════════════════════════════════════════════

  if (status === 'loading') {
    return (
      <Shell embedded={embedded}>
        <div className="flex items-center gap-2 text-sm text-rl-muted py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> {t('comum.carregando')}
        </div>
      </Shell>
    )
  }

  if (status === 'gate') {
    return (
      <Shell embedded={embedded}>
        <div className="glass-card p-8 max-w-md w-full">
          <div className="w-12 h-12 rounded-2xl bg-rl-purple/15 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-rl-purple" />
          </div>
          <h1 className="text-xl font-bold text-rl-text text-center mb-1">{t('criativosPublico.gateTitulo')}</h1>
          <p className="text-sm text-rl-muted text-center mb-6">{t('criativosPublico.gateInstrucao')}</p>
          <div className="space-y-3">
            <input
              type="email" autoFocus value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && login()}
              placeholder={t('criativosPublico.seuEmail')}
              className="input-field w-full text-base"
            />
            <input
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && login()}
              placeholder={t('criativosPublico.suaSenha')}
              className="input-field w-full text-base"
            />
          </div>
          {error && (
            <div className="flex items-start gap-2 mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <button onClick={login} disabled={!email.trim() || !password || busy}
            className="btn-primary w-full mt-4 flex items-center justify-center gap-2 text-sm py-2.5 disabled:opacity-50">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('criativosPublico.entrando')}</> : <>{t('criativosPublico.entrar')} <Sparkles className="w-4 h-4" /></>}
          </button>
        </div>
      </Shell>
    )
  }

  if (status === 'select') {
    return (
      <Shell subtitle={ctx?.companyName} embedded={embedded}>
        <div className="w-full max-w-2xl space-y-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-rl-muted">
              {user?.name ? <>{t('criativosPublico.ola')} <span className="text-rl-text font-semibold">{user.name}</span> 👋</> : `${t('criativosPublico.bemVindo')} 👋`}
            </p>
            <button onClick={openHistory} disabled={busy}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />} {t('criativosPublico.meusAnuncios')}
            </button>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-rl-text">{t('criativosPublico.qualTipo')}</h1>
            <p className="text-sm text-rl-muted mt-1">{t('criativosPublico.qualTipoDica')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'estatico', Icon: ImageIcon, color: 'rl-blue', title: t('criativosPublico.estatico'), desc: t('criativosPublico.estaticoDesc'), tags: ['Headlines', 'ADIG', t('criativosPublico.cincoNiveis')] },
              { key: 'video', Icon: Video, color: 'rl-purple', title: t('criativosPublico.video'), desc: t('criativosPublico.videoDesc'), tags: ['Reels', t('criativosPublico.gancho'), t('criativosPublico.cincoNiveis')] },
            ].map(({ key, Icon, color, title, desc, tags }) => (
              <button key={key}
                onClick={() => { setMode(key); resetConfig(); setError(null); setStatus('config') }}
                className={`glass-card p-6 text-left hover:border-${color}/50 hover:shadow-glow transition-all group`}>
                <div className={`w-12 h-12 rounded-2xl bg-${color}/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-6 h-6 text-${color}`} />
                </div>
                <h3 className="text-base font-bold text-rl-text mb-1">{title}</h3>
                <p className="text-xs text-rl-muted leading-relaxed mb-4">{desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full bg-${color}/10 text-${color} border border-${color}/20 font-medium`}>{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </Shell>
    )
  }

  // ── Histórico do usuário ────────────────────────────────────────────────────
  if (status === 'history') {
    const fmt = (iso) => {
      try { return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
      catch { return '' }
    }
    return (
      <Shell subtitle={ctx?.companyName} embedded={embedded}>
        <div className="w-full max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { setViewing(null); setStatus('select') }}
              className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-bold text-rl-text">{t('criativosPublico.meusAnuncios')}</h1>
          </div>

          {viewing ? (
            <div className="space-y-4">
              <button onClick={() => setViewing(null)} className="flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-text">
                <ArrowLeft className="w-3.5 h-3.5" /> {t('criativosPublico.voltarLista')}
              </button>
              <div className="flex items-center justify-end">
                <button onClick={() => navigator.clipboard?.writeText(viewing.content || '')}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
                  <Copy className="w-3.5 h-3.5" /> {t('comum.copiar')}
                </button>
              </div>
              <ResultCards content={viewing.content || ''} />
            </div>
          ) : history.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-sm text-rl-muted">{t('criativosPublico.semHistorico')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <button key={h.id} onClick={() => setViewing(h)}
                  className="w-full text-left glass-card p-4 hover:border-rl-purple/40 transition-all">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${h.mode === 'video' ? 'text-rl-purple bg-rl-purple/10 border-rl-purple/30' : 'text-rl-blue bg-rl-blue/10 border-rl-blue/30'}`}>
                      {h.mode === 'video' ? `🎬 ${t('criativosPublico.videoCurto')}` : `🖼️ ${t('criativosPublico.estaticoCurto')}`}
                    </span>
                    {h.funil_label && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted">{rotuloFunilGravado(h.funil_label)}</span>}
                    <span className="text-[11px] text-rl-muted ml-auto">{fmt(h.created_at)}</span>
                  </div>
                  {h.detalhes && <p className="text-xs text-rl-muted mt-1.5 line-clamp-1">{h.detalhes}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      </Shell>
    )
  }

  if (status === 'generating') {
    return (
      <Shell subtitle={ctx?.companyName} embedded={embedded}>
        <div className="w-full max-w-2xl">
          <div className="glass-card p-6 sm:p-8">
            <div className="flex items-center gap-2 text-rl-purple mb-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-bold">{t('criativosPublico.criando')}</span>
            </div>
            {!result && <p className="text-sm text-rl-muted">{t('criativosPublico.criandoDica')}</p>}
          </div>
          {result && <div className="mt-3"><ResultCards content={result} /></div>}
        </div>
      </Shell>
    )
  }

  if (status === 'error') {
    return (
      <Shell subtitle={ctx?.companyName} embedded={embedded}>
        <div className="glass-card p-8 text-center max-w-md w-full">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-rl-text mb-1">{t('criativosPublico.problema')}</h1>
          <p className="text-sm text-rl-muted mb-5">{error}</p>
          <button onClick={() => (ctx ? setStatus('config') : login())} className="btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5">
            <RotateCcw className="w-4 h-4" /> {t('criativosPublico.tentarDeNovo')}
          </button>
        </div>
      </Shell>
    )
  }

  if (status === 'result') {
    return (
      <Shell subtitle={ctx?.companyName} embedded={embedded}>
        <div className="w-full max-w-2xl space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-rl-green/15 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-rl-green" />
            </div>
            <h1 className="text-2xl font-bold text-rl-text">{t('criativosPublico.prontos')} 🎉</h1>
            <p className="text-sm text-rl-muted mt-1">{t('criativosPublico.prontosDica')}</p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button onClick={copyResult}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
              {copied ? <><Check className="w-3.5 h-3.5 text-rl-green" /> {t('comum.copiado')}</> : <><Copy className="w-3.5 h-3.5" /> {t('criativosPublico.copiarTudo')}</>}
            </button>
            <button onClick={() => setStatus('config')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
              <RotateCcw className="w-3.5 h-3.5" /> {t('criativosPublico.gerarMais')}
            </button>
            <button onClick={() => { resetConfig(); setMode(null); setStatus('select') }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
              <ArrowLeft className="w-3.5 h-3.5" /> {t('criativosPublico.trocarFormato')}
            </button>
          </div>

          <ResultCards content={result} />
        </div>
      </Shell>
    )
  }

  // ── Config (wizard passo a passo) ───────────────────────────────────────────
  const stepTitle = {
    foco: t('criativosPublico.passos.foco'),
    funil: t('criativosPublico.passos.funil'),
    tipo: isVideo ? t('criativosPublico.passos.tipoVideo') : t('criativosPublico.passos.tipoEstatico'),
    obs: t('criativosPublico.passos.obs'),
  }[step]
  const isLast = step === 'obs'

  return (
    <Shell subtitle={ctx?.companyName} embedded={embedded}>
      <div className="w-full max-w-2xl space-y-5">
        {/* Cabeçalho + progresso */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            {isVideo ? <Video className="w-4 h-4 text-rl-purple" /> : <ImageIcon className="w-4 h-4 text-rl-blue" />}
            <span className="text-[11px] font-bold uppercase tracking-wider text-rl-muted">{isVideo ? t('criativosPublico.video') : t('criativosPublico.estatico')}</span>
            <span className="ml-auto text-[11px] font-semibold text-rl-muted tabular-nums">{t('criativosPublico.passoDe', { n: stepIdx + 1, total: steps.length })}</span>
          </div>
          <div className="h-1.5 rounded-full bg-rl-surface overflow-hidden">
            <div className="h-full bg-gradient-rl rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-rl-text">{stepTitle}</h1>

        {/* ── Passo: foco (produto/persona) ────────────────────────────────── */}
        {step === 'foco' && (
          <div className="space-y-3">
            <p className="text-sm text-rl-muted">{t('criativosPublico.focoDica')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(ctx?.produtos?.length || 0) > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-rl-text block mb-1">📦 {t('criativosPublico.produto')}</label>
                  <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}
                    className="input-field w-full text-sm">
                    <option value="">{t('criativosPublico.todosProdutos')}</option>
                    {ctx.produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}
              {(ctx?.personas?.length || 0) > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-rl-text block mb-1">👤 {t('criativosPublico.persona')}</label>
                  <select value={selectedPersona}
                    onChange={(e) => { setSelectedPersona(e.target.value); setDorConfig({}) }}
                    className="input-field w-full text-sm">
                    <option value="">{t('criativosPublico.todasPersonas')}</option>
                    {ctx.personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            {!isVideo && personaName && (
              <p className="text-[11px] text-rl-blue leading-snug">{t('criativosPublico.doresDaPersonaProximo')} <strong>{personaName}</strong>.</p>
            )}
          </div>
        )}

        {/* ── Passo: funil ─────────────────────────────────────────────────── */}
        {step === 'funil' && (
          <div className="space-y-3">
            <p className="text-sm text-rl-muted">{t('criativosPublico.funilDica')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FUNIS.map((f) => {
                const on = funil === f.id
                return (
                  <button key={f.id} onClick={() => setFunil(on ? '' : f.id)}
                    className={`flex items-start gap-2 rounded-lg p-2.5 text-left border transition-all ${on ? 'bg-rl-blue/10 border-rl-blue/50' : 'bg-rl-surface border-rl-border hover:border-rl-blue/30'}`}>
                    <span className="text-base leading-none mt-0.5">{f.icon}</span>
                    <span className="min-w-0">
                      <span className={`block text-xs font-bold leading-tight ${on ? 'text-rl-blue' : 'text-rl-text'}`}>{rotuloFunil(f.id)}</span>
                      <span className="block text-[10px] text-rl-muted leading-tight mt-0.5">{metaFunil(f.id)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Passo: nível de consciência do público ───────────────────────── */}
        {step === 'nivel' && (
          <div className="space-y-3">
            <p className="text-sm text-rl-muted">
              {t('criativosPublico.nivelDica')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {NIVEIS_CONSCIENCIA.map((n) => {
                const on = nivel === n.id
                return (
                  <button key={n.id} onClick={() => setNivel(on ? '' : n.id)}
                    className={`flex items-start gap-2 rounded-lg p-2.5 text-left border transition-all ${on ? 'bg-rl-purple/10 border-rl-purple/50' : 'bg-rl-surface border-rl-border hover:border-rl-purple/30'}`}>
                    <span className={`text-[10px] font-bold leading-none mt-0.5 w-4 h-4 shrink-0 rounded-full flex items-center justify-center ${on ? 'bg-rl-purple text-white' : 'bg-rl-border/60 text-rl-muted'}`}>
                      {n.num}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-xs font-bold leading-tight ${on ? 'text-rl-purple' : 'text-rl-text'}`}>{rotuloNivel(n.id)}</span>
                      <span className="block text-[10px] text-rl-muted leading-tight mt-0.5">{dicaNivel(n.id)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Passo: tipo de mensagem (ganchos / dores + ângulo) ───────────── */}
        {step === 'tipo' && (
          <div className="space-y-3">
            {nivel && (
              <div className="flex items-start gap-2 rounded-xl border border-rl-purple/30 bg-rl-purple/5 px-3 py-2.5">
                <Layers className="w-4 h-4 text-rl-purple shrink-0 mt-0.5" />
                <p className="text-[11px] text-rl-muted leading-snug">
                  {t('criativosPublico.publicoNivel')}{' '}
                  <strong className="text-rl-text">{rotuloNivel(nivel).toLowerCase()}</strong>{' '}
                  ({dicaNivel(nivel).toLowerCase()}).
                </p>
              </div>
            )}

            {/* Quantidade total desta geração */}
            <div className="rounded-xl border border-rl-border bg-rl-surface/40 px-3 py-2.5 space-y-2">
              <p className="text-[11px] text-rl-muted leading-snug">
                {isVideo ? t('criativosPublico.quantosVideo') : t('criativosPublico.quantosEstatico')}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {QTD_PRESETS.map((q) => (
                  <button key={q} onClick={() => setQuantidade(q)}
                    className={`w-10 h-8 rounded-lg text-xs font-bold border transition-all ${quantidade === q ? 'bg-rl-blue/10 border-rl-blue/50 text-rl-blue' : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-blue/30 hover:text-rl-text'}`}>
                    {q}
                  </button>
                ))}
                <span className="text-[10px] text-rl-muted px-1">{t('comum.ou')}</span>
                <input
                  type="number" min={1} max={MAX_PECAS} value={quantidade}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    setQuantidade(Number.isNaN(v) ? 1 : Math.min(Math.max(v, 1), MAX_PECAS))
                  }}
                  className="input-field w-20 text-sm"
                />
              </div>
              {qtdInsuficiente && (
                <p className="text-[11px] text-red-400 leading-snug">
                  {t(isVideo ? 'criativosPublico.qtdInsuficienteVideo' : 'criativosPublico.qtdInsuficienteEstatico', { qtd: quantidade, blocos })}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-rl-muted">
                {t('criativosPublico.escolhaAte')} <strong className="text-rl-text">{MAX_BLOCOS}</strong>{' '}
                {t(isVideo ? 'criativosPublico.escolhaAteVideo' : 'criativosPublico.escolhaAteEstatico', { max: MAX_PECAS })}
              </p>
              {blocos > 0 && (
                <p className="text-[11px] font-bold text-rl-purple whitespace-nowrap">
                  {blocos}/{MAX_BLOCOS} · {t(isVideo ? 'criativosPublico.nRoteiros' : 'criativosPublico.nHeadlines', { count: totalPecas })}
                </p>
              )}
            </div>

            {/* Vídeo: tipos de gancho */}
            {isVideo && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AD_TYPES.map((type) => {
                  const selected = !!adTypeConfig[type.id]
                  return (
                    <div key={type.id}
                      onClick={() => toggleVideoType(type.id)}
                      className={`rounded-xl p-3 text-left cursor-pointer transition-all border ${selected ? 'bg-rl-purple/10 border-rl-purple/50' : 'bg-rl-surface border-rl-border hover:border-rl-purple/30'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{type.emoji}</span>
                        <span className={`text-xs font-bold flex-1 ${selected ? 'text-rl-purple' : 'text-rl-text'}`}>{rotuloTipoAnuncio(type.id)}</span>
                        {selected && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rl-purple/20 text-rl-purple border border-rl-purple/30 shrink-0">
                            {t('criativosPublico.nRoteiros', { count: split[videoTypes.indexOf(type.id)] ?? 0 })}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-rl-muted leading-snug mt-1 line-clamp-2">{descTipoAnuncio(type.id)}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Estático: dores + ângulo por dor */}
            {!isVideo && (
              <div className="space-y-2">
                {personaName && (
                  <p className="text-[11px] text-rl-blue leading-snug">{t('criativosPublico.doresDaPersona')} <strong>{personaName}</strong>.</p>
                )}
                {allDores.length === 0 && !addingDor && (
                  <div className="rounded-xl border border-dashed border-rl-border py-6 text-center">
                    <p className="text-sm text-rl-muted">{t('criativosPublico.semDores')}</p>
                    <p className="text-xs text-rl-muted">{t('criativosPublico.semDoresDica')}</p>
                  </div>
                )}

                {allDores.map((dor) => {
                  const selected = !!dorConfig[dor.id]
                  const types = dorConfig[dor.id]?.types || {}
                  return (
                    <div key={dor.id} className={`rounded-xl p-3 border transition-all ${selected ? 'bg-rl-purple/10 border-rl-purple/50' : 'bg-rl-surface border-rl-border hover:border-rl-purple/30'}`}>
                      <div className="flex items-start gap-2.5 cursor-pointer" onClick={() => toggleDor(dor.id)}>
                        <div className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${selected ? 'bg-rl-purple border-rl-purple' : 'border-rl-border'}`}>
                          {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${selected ? 'text-rl-purple font-medium' : 'text-rl-text'}`}>{dor.text}</p>
                          {dor.personaName && <p className="text-[10px] text-rl-muted mt-0.5">{dor.personaName}</p>}
                        </div>
                        {dor.isCustom && (
                          <button onClick={(e) => { e.stopPropagation(); setCustomDores((p) => p.filter((d) => d.id !== dor.id)); setDorConfig((p) => { const n = { ...p }; delete n[dor.id]; return n }) }}
                            className="p-1 rounded hover:bg-red-400/10 text-rl-muted hover:text-red-400 shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {selected && (
                        <div className="mt-3 pl-6 space-y-2">
                          <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wide">
                            {t('criativosPublico.angulo')} {Object.keys(types).length > 0 && `· ${t('criativosPublico.nCombinacoes', { count: Object.keys(types).length })}`}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {AD_TYPES.map((tipo) => {
                              const on = !!types[tipo.id]
                              return (
                                <button key={tipo.id} onClick={() => toggleDorType(dor.id, tipo.id)}
                                  className={`text-[11px] px-2 py-1 rounded-lg border transition-all ${on ? 'bg-rl-purple/20 border-rl-purple/40 text-rl-purple font-semibold' : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text'}`}>
                                  {tipo.emoji} {rotuloTipoAnuncio(tipo.id)}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {addingDor ? (
                  <div className="rounded-xl p-3 border bg-rl-surface border-rl-purple/40">
                    <textarea autoFocus value={newDorText} onChange={(e) => setNewDorText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmAddDor() } if (e.key === 'Escape') { setAddingDor(false); setNewDorText('') } }}
                      rows={2} placeholder={t('criativosPublico.dorPlaceholder')} className="input-field w-full text-sm resize-none" />
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={confirmAddDor} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-rl-green/10 border border-rl-green/30 text-rl-green hover:bg-rl-green/20 transition-all">
                        <Check className="w-3 h-3" /> {t('comum.adicionar')}
                      </button>
                      <button onClick={() => { setAddingDor(false); setNewDorText('') }} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
                        <X className="w-3 h-3" /> {t('comum.cancelar')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingDor(true)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl border border-dashed border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all">
                    <Plus className="w-3.5 h-3.5" /> {t('criativosPublico.outraDor')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Passo: observação (opcional) ─────────────────────────────────── */}
        {step === 'obs' && (
          <div className="space-y-3">
            <p className="text-sm text-rl-muted">{t('criativosPublico.obsDica')}</p>
            <textarea value={detalhes} onChange={(e) => setDetalhes(e.target.value)}
              rows={4} maxLength={5000} autoFocus
              placeholder={t('criativosPublico.obsPlaceholder')}
              className="input-field w-full text-sm resize-none" />
            <p className="text-[11px] text-rl-muted text-right tabular-nums">{detalhes.length} / 5000</p>
            {/* Resumo das escolhas */}
            <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-3 text-[11px] text-rl-muted space-y-0.5">
              <p><span className="text-rl-text font-semibold">{t('criativosPublico.resumoFunil')}:</span> {funil ? rotuloFunil(funil) : '—'}</p>
              <p><span className="text-rl-text font-semibold">{t('criativosPublico.resumoConsciencia')}:</span> {nivel ? t('criativosPublico.nivelN', { n: NIVEIS_BY_ID[nivel].num, nome: rotuloNivel(nivel) }) : '—'}</p>
              <p><span className="text-rl-text font-semibold">{t('criativosPublico.resumoTotal')}:</span> {t(isVideo ? 'criativosPublico.nRoteiros' : 'criativosPublico.nHeadlines', { count: totalPecas })} ({t(isVideo ? 'criativosPublico.nTipos' : 'criativosPublico.nCombinacoes', { count: blocos })})</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Navegação do wizard */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button onClick={prevStep}
            className="flex items-center gap-1.5 text-sm px-3 py-2.5 rounded-xl text-rl-muted hover:text-rl-text transition-all">
            <ArrowLeft className="w-4 h-4" /> {t('comum.voltar')}
          </button>
          {isLast ? (
            <button onClick={generate} disabled={!canGenerate}
              className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <Wand2 className="w-4 h-4" /> {totalPecas > 0 ? t(isVideo ? 'criativosPublico.gerarNRoteiros' : 'criativosPublico.gerarNHeadlines', { count: totalPecas }) : t('criativosPublico.gerarAnuncios')}
            </button>
          ) : (
            <button onClick={nextStep} disabled={!canAdvance(step)}
              className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
              {step === 'funil' && !funil
                ? t('criativosPublico.escolhaFunil')
                : step === 'nivel' && !nivel
                  ? t('criativosPublico.escolhaNivel')
                  : step === 'tipo' && !blocos
                    ? t('criativosPublico.selecioneUm')
                    : t('criativosPublico.continuar')}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </Shell>
  )
}

// ─── Casca pública (logo + fundo) ─────────────────────────────────────────────
function Shell({ children, subtitle, embedded = false }) {
  const { t } = useI18n()
  if (embedded) {
    return <div className="flex flex-col items-center px-0 py-2">{children}</div>
  }
  return (
    <div className="fx min-h-screen bg-gradient-dark flex flex-col items-center justify-center px-4 py-10">
      <div className="flex items-center gap-2.5 mb-8">
        <img src="/verta/logo-azul.png" alt="Verta" className="h-7 w-auto object-contain" />
        <div className="flex items-center gap-1.5 text-rl-muted">
          <Sparkles className="w-4 h-4 text-rl-purple" />
          <span className="text-sm font-semibold text-rl-text">{t('criativosPublico.shell')}{subtitle ? ` · ${subtitle}` : ''}</span>
        </div>
      </div>
      {children}
    </div>
  )
}
