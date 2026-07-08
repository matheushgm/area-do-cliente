import { useState, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import MarkdownBlock from '../components/Criativos/MarkdownBlock'
import { AD_TYPES, postCriativo, streamCriativo } from '../lib/criativosPublic'
import { FUNIS } from '../lib/funis'
import {
  Sparkles, Loader2, AlertTriangle, Lock, ArrowLeft, Image as ImageIcon, Video,
  CheckCircle2, RotateCcw, Copy, Check, Plus, X, ChevronLeft, Wand2, Layers, Filter,
} from 'lucide-react'

// Cada tipo de criativo gera 1 peça por nível de consciência (Eugene Schwartz).
const NIVEIS = 5
// Teto de blocos (tipo, no vídeo; dor x tipo, no estático) — espelha o servidor.
const MAX_BLOCOS = 8

const NIVEIS_LABEL =
  'Cada tipo gera 5 peças, uma por nível de consciência: inconsciente do problema, consciente do problema, da solução, do produto e totalmente consciente.'

export default function CriativosPublico() {
  const { projectId, token } = useParams()

  // 'gate' | 'select' | 'config' | 'generating' | 'result' | 'error' | 'history'
  const [status, setStatus] = useState('gate')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null) // { id, email, name }
  const [ctx, setCtx] = useState(null) // { companyName, dores, produtos, personas }
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [mode, setMode] = useState(null) // 'estatico' | 'video'
  const [selectedProduct, setSelectedProduct] = useState('') // id do produto (opcional)
  const [selectedPersona, setSelectedPersona] = useState('') // id da persona (opcional)
  const [funil, setFunil] = useState('') // id do funil escolhido
  const [detalhes, setDetalhes] = useState('') // particularidades deste anúncio
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)
  const abortRef = useRef(null)

  const [history, setHistory] = useState([]) // gerações do próprio usuário
  const [viewing, setViewing] = useState(null) // item do histórico aberto

  // Credenciais reenviadas em cada chamada (o servidor revalida no banco).
  const creds = () => ({ projectId, token, email: email.trim().toLowerCase(), password })

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

  // ── Login (email + senha) ───────────────────────────────────────────────────
  async function login() {
    if (!email.trim() || !password || busy) return
    setBusy(true); setError(null)
    try {
      const data = await postCriativo('login', creds())
      setCtx(data)
      setUser(data.user)
      setStatus('select')
    } catch (e) {
      setError(e.message || 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  // ── Histórico do próprio usuário ────────────────────────────────────────────
  async function openHistory() {
    setBusy(true); setError(null); setViewing(null)
    try {
      const data = await postCriativo('history', creds())
      setHistory(data.history || [])
      setStatus('history')
    } catch (e) {
      setError(e.message || 'Não foi possível carregar o histórico.')
    } finally {
      setBusy(false)
    }
  }

  // ── Vídeo: seleção de tipos ───────────────────────────────────────────────
  const videoTypes = Object.keys(adTypeConfig)

  function toggleVideoType(id) {
    setAdTypeConfig((prev) => {
      if (prev[id]) { const n = { ...prev }; delete n[id]; return n }
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
      if (types[typeId]) delete types[typeId]; else types[typeId] = true
      return { ...prev, [dorId]: { ...dor, types } }
    })
  }
  function confirmAddDor() {
    const t = newDorText.trim()
    if (!t) { setAddingDor(false); setNewDorText(''); return }
    const id = `custom_${crypto.randomUUID()}`
    setCustomDores((prev) => [...prev, { id, text: t }])
    setDorConfig((prev) => ({ ...prev, [id]: { types: {} } }))
    setNewDorText(''); setAddingDor(false)
  }

  // ── Gerar ─────────────────────────────────────────────────────────────────
  const isVideo = mode === 'video'
  const blocos = isVideo ? videoTypes.length : staticBlocos
  const totalPecas = blocos * NIVEIS
  const excedeu = blocos > MAX_BLOCOS
  const canGenerate = blocos > 0 && !excedeu && !!funil

  async function generate() {
    if (!canGenerate) return
    setStatus('generating'); setError(null); setResult(''); setCopied(false)
    abortRef.current = new AbortController()
    const detalhesTrim = detalhes.trim()
    const selection = isVideo
      ? { adTypes: videoTypes }
      : { dores: selectedDores.map((d) => ({ text: d.text, types: Object.keys(dorConfig[d.id].types) })) }
    try {
      const payload = { ...creds(), mode, funil, detalhes: detalhesTrim, productId: selectedProduct, personaId: selectedPersona, ...selection }
      const full = await streamCriativo('generate', payload, setResult, abortRef.current.signal)
      setResult(full)
      setStatus('result')
      // Salva no histórico do usuário (não bloqueia a tela).
      postCriativo('save', { ...creds(), mode, funil, detalhes: detalhesTrim, selection, content: full })
        .catch(() => {})
    } catch (e) {
      if (e.name === 'AbortError') return
      setError(e.message || 'Não foi possível gerar agora.')
      setStatus('error')
    }
  }

  function copyResult() {
    navigator.clipboard?.writeText(result || '').then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  function resetConfig() {
    setAdTypeConfig({}); setDorConfig({}); setCustomDores([]); setAddingDor(false); setNewDorText(''); setFunil(''); setDetalhes(''); setSelectedProduct(''); setSelectedPersona('')
  }

  // ══ RENDER ════════════════════════════════════════════════════════════════

  if (status === 'gate') {
    return (
      <Shell>
        <div className="glass-card p-8 max-w-md w-full">
          <div className="w-12 h-12 rounded-2xl bg-rl-purple/15 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-rl-purple" />
          </div>
          <h1 className="text-xl font-bold text-rl-text text-center mb-1">Área de Criação de Anúncios</h1>
          <p className="text-sm text-rl-muted text-center mb-6">Entre com o e-mail e a senha que a Revenue Lab enviou pra você.</p>
          <div className="space-y-3">
            <input
              type="email" autoFocus value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && login()}
              placeholder="Seu e-mail"
              className="input-field w-full text-base"
            />
            <input
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && login()}
              placeholder="Sua senha"
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
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando...</> : <>Entrar <Sparkles className="w-4 h-4" /></>}
          </button>
        </div>
      </Shell>
    )
  }

  if (status === 'select') {
    return (
      <Shell subtitle={ctx?.companyName}>
        <div className="w-full max-w-2xl space-y-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-rl-muted">
              {user?.name ? <>Olá, <span className="text-rl-text font-semibold">{user.name}</span> 👋</> : 'Bem-vindo 👋'}
            </p>
            <button onClick={openHistory} disabled={busy}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />} Meus anúncios
            </button>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-rl-text">Que tipo de anúncio você quer criar?</h1>
            <p className="text-sm text-rl-muted mt-1">A IA usa os dados da sua marca pra montar criativos sob medida.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'estatico', Icon: ImageIcon, color: 'rl-blue', title: 'Anúncio Estático', desc: 'Headlines e subheadlines para anúncios de imagem (Meta e Google). Metodologia ADIG.', tags: ['Headlines', 'ADIG', '5 níveis'] },
              { key: 'video', Icon: Video, color: 'rl-purple', title: 'Roteiro de Vídeo', desc: 'Roteiros de 30–60s com Gancho, Mensagem e CTA para Reels e YouTube.', tags: ['Reels', 'Gancho', '5 níveis'] },
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
                  {tags.map((t) => (
                    <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full bg-${color}/10 text-${color} border border-${color}/20 font-medium`}>{t}</span>
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
      try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
      catch { return '' }
    }
    return (
      <Shell subtitle={ctx?.companyName}>
        <div className="w-full max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { setViewing(null); setStatus('select') }}
              className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-bold text-rl-text">Meus anúncios</h1>
          </div>

          {viewing ? (
            <div className="space-y-4">
              <button onClick={() => setViewing(null)} className="flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-text">
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar à lista
              </button>
              <div className="flex items-center justify-end">
                <button onClick={() => navigator.clipboard?.writeText(viewing.content || '')}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
                  <Copy className="w-3.5 h-3.5" /> Copiar
                </button>
              </div>
              <div className="glass-card p-5 sm:p-6"><MarkdownBlock content={viewing.content || ''} /></div>
            </div>
          ) : history.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-sm text-rl-muted">Você ainda não gerou nenhum anúncio.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <button key={h.id} onClick={() => setViewing(h)}
                  className="w-full text-left glass-card p-4 hover:border-rl-purple/40 transition-all">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${h.mode === 'video' ? 'text-rl-purple bg-rl-purple/10 border-rl-purple/30' : 'text-rl-blue bg-rl-blue/10 border-rl-blue/30'}`}>
                      {h.mode === 'video' ? '🎬 Vídeo' : '🖼️ Estático'}
                    </span>
                    {h.funil_label && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted">{h.funil_label}</span>}
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
      <Shell subtitle={ctx?.companyName}>
        <div className="w-full max-w-2xl">
          <div className="glass-card p-6 sm:p-8">
            <div className="flex items-center gap-2 text-rl-purple mb-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-bold">Criando seus anúncios...</span>
            </div>
            {result
              ? <MarkdownBlock content={result} />
              : <p className="text-sm text-rl-muted">Analisando os dados da sua marca e escrevendo um criativo para cada nível de consciência. Isso leva alguns segundos.</p>}
          </div>
        </div>
      </Shell>
    )
  }

  if (status === 'error') {
    return (
      <Shell subtitle={ctx?.companyName}>
        <div className="glass-card p-8 text-center max-w-md w-full">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-rl-text mb-1">Tivemos um problema</h1>
          <p className="text-sm text-rl-muted mb-5">{error}</p>
          <button onClick={() => setStatus('config')} className="btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5">
            <RotateCcw className="w-4 h-4" /> Voltar e tentar de novo
          </button>
        </div>
      </Shell>
    )
  }

  if (status === 'result') {
    return (
      <Shell subtitle={ctx?.companyName}>
        <div className="w-full max-w-2xl space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-rl-green/15 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-rl-green" />
            </div>
            <h1 className="text-2xl font-bold text-rl-text">Seus anúncios estão prontos! 🎉</h1>
            <p className="text-sm text-rl-muted mt-1">Um criativo para cada nível de consciência. Copie, teste e escale.</p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button onClick={copyResult}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
              {copied ? <><Check className="w-3.5 h-3.5 text-rl-green" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar tudo</>}
            </button>
            <button onClick={() => setStatus('config')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
              <RotateCcw className="w-3.5 h-3.5" /> Gerar mais
            </button>
            <button onClick={() => { resetConfig(); setMode(null); setStatus('select') }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
              <ArrowLeft className="w-3.5 h-3.5" /> Trocar formato
            </button>
          </div>

          <div className="glass-card p-5 sm:p-6">
            <MarkdownBlock content={result} />
          </div>
        </div>
      </Shell>
    )
  }

  // ── Config ────────────────────────────────────────────────────────────────
  return (
    <Shell subtitle={ctx?.companyName}>
      <div className="w-full max-w-2xl space-y-5">
        <div className="flex items-start gap-3">
          <button onClick={() => { setMode(null); setError(null); setStatus('select') }}
            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all mt-0.5 shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              {isVideo ? <Video className="w-5 h-5 text-rl-purple" /> : <ImageIcon className="w-5 h-5 text-rl-blue" />}
              <h1 className="text-xl font-bold text-rl-text">{isVideo ? 'Roteiro de Vídeo' : 'Anúncio Estático'}</h1>
            </div>
            <p className="text-sm text-rl-muted mt-0.5 ml-7">
              {isVideo ? 'Escolha os tipos de gancho.' : 'Escolha as dores do seu cliente e o ângulo de cada anúncio.'}
            </p>
          </div>
        </div>

        {/* Foco: produto e/ou persona (opcional) */}
        {((ctx?.produtos?.length || 0) > 0 || (ctx?.personas?.length || 0) > 0) && (
          <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎯</span>
              <label className="text-sm font-bold text-rl-text">Foco deste anúncio <span className="text-rl-muted font-normal">(opcional)</span></label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(ctx?.produtos?.length || 0) > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-rl-text block mb-1">📦 Produto/serviço</label>
                  <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}
                    className="input-field w-full text-sm">
                    <option value="">Todos os produtos</option>
                    {ctx.produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}
              {(ctx?.personas?.length || 0) > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-rl-text block mb-1">👤 Persona / público</label>
                  <select value={selectedPersona}
                    onChange={(e) => { setSelectedPersona(e.target.value); setDorConfig({}) }}
                    className="input-field w-full text-sm">
                    <option value="">Todas as personas</option>
                    {ctx.personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            {!isVideo && personaName && (
              <p className="text-[11px] text-rl-blue leading-snug">As dores abaixo são só da persona <strong>{personaName}</strong>.</p>
            )}
          </div>
        )}

        {/* Explicação dos 5 níveis */}
        <div className="flex items-start gap-2 rounded-xl border border-rl-purple/30 bg-rl-purple/5 px-3 py-2.5">
          <Layers className="w-4 h-4 text-rl-purple shrink-0 mt-0.5" />
          <p className="text-[11px] text-rl-muted leading-snug">{NIVEIS_LABEL}</p>
        </div>

        {/* Seletor de funil (obrigatório) */}
        <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-rl-blue" />
            <label className="text-sm font-bold text-rl-text">Em que funil este anúncio vai rodar?</label>
          </div>
          <p className="text-[11px] text-rl-muted leading-snug">
            O funil define o objetivo e o CTA do anúncio (assistir aula, agendar reunião, baixar material, comprar...).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FUNIS.map((f) => {
              const on = funil === f.id
              return (
                <button key={f.id} onClick={() => setFunil(on ? '' : f.id)}
                  className={`flex items-start gap-2 rounded-lg p-2.5 text-left border transition-all ${on ? 'bg-rl-blue/10 border-rl-blue/50' : 'bg-rl-surface border-rl-border hover:border-rl-blue/30'}`}>
                  <span className="text-base leading-none mt-0.5">{f.icon}</span>
                  <span className="min-w-0">
                    <span className={`block text-xs font-bold leading-tight ${on ? 'text-rl-blue' : 'text-rl-text'}`}>{f.label}</span>
                    <span className="block text-[10px] text-rl-muted leading-tight mt-0.5">{f.meta}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Contador */}
        {blocos > 0 && (
          <p className={`text-[11px] font-bold ${excedeu ? 'text-red-400' : 'text-rl-purple'}`}>
            {blocos} {isVideo ? (blocos === 1 ? 'tipo' : 'tipos') : (blocos === 1 ? 'combinação' : 'combinações')} · {totalPecas} {isVideo ? (totalPecas === 1 ? 'roteiro' : 'roteiros') : 'headlines'}
            {excedeu && ` — máximo ${MAX_BLOCOS}`}
          </p>
        )}

        {/* ── Vídeo: tipos de gancho ─────────────────────────────────────── */}
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
                    <span className={`text-xs font-bold flex-1 ${selected ? 'text-rl-purple' : 'text-rl-text'}`}>{type.label}</span>
                    {selected && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rl-purple/20 text-rl-purple border border-rl-purple/30 shrink-0">
                        5 roteiros
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-rl-muted leading-snug mt-1 line-clamp-2">{type.desc}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Estático: dores + tipos por dor ────────────────────────────── */}
        {!isVideo && (
          <div className="space-y-2">
            {allDores.length === 0 && !addingDor && (
              <div className="rounded-xl border border-dashed border-rl-border py-6 text-center">
                <p className="text-sm text-rl-muted">Nenhuma dor cadastrada ainda.</p>
                <p className="text-xs text-rl-muted">Adicione a dor principal do seu cliente abaixo.</p>
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
                        Ângulo do anúncio {Object.keys(types).length > 0 && `· ${Object.keys(types).length * NIVEIS} headlines`}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {AD_TYPES.map((t) => {
                          const on = !!types[t.id]
                          return (
                            <button key={t.id} onClick={() => toggleDorType(dor.id, t.id)}
                              className={`text-[11px] px-2 py-1 rounded-lg border transition-all ${on ? 'bg-rl-purple/20 border-rl-purple/40 text-rl-purple font-semibold' : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text'}`}>
                              {t.emoji} {t.label}
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
                  rows={2} placeholder="Ex.: não consegue emagrecer mesmo fazendo dieta" className="input-field w-full text-sm resize-none" />
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={confirmAddDor} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-rl-green/10 border border-rl-green/30 text-rl-green hover:bg-rl-green/20 transition-all">
                    <Check className="w-3 h-3" /> Adicionar
                  </button>
                  <button onClick={() => { setAddingDor(false); setNewDorText('') }} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
                    <X className="w-3 h-3" /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingDor(true)}
                className="w-full flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl border border-dashed border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all">
                <Plus className="w-3.5 h-3.5" /> Adicionar outra dor
              </button>
            )}
          </div>
        )}

        {/* Detalhes específicos deste anúncio (opcional) */}
        <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-3 space-y-1.5">
          <label className="text-sm font-bold text-rl-text">Detalhes deste anúncio <span className="text-rl-muted font-normal">(opcional)</span></label>
          <p className="text-[11px] text-rl-muted leading-snug">
            Promoção, condição, prazo, produto específico, ângulo que você quer... A IA vai incorporar isso em todas as peças.
          </p>
          <textarea value={detalhes} onChange={(e) => setDetalhes(e.target.value)}
            rows={3} maxLength={1200}
            placeholder="Ex.: promoção de dia das mães, 30% off até domingo, brinde de frete grátis acima de R$199."
            className="input-field w-full text-sm resize-none" />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button onClick={generate} disabled={!canGenerate}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-3 disabled:opacity-50 disabled:cursor-not-allowed">
          <Wand2 className="w-4 h-4" />
          {excedeu
            ? `Reduza para no máximo ${MAX_BLOCOS}`
            : blocos > 0 && !funil
              ? 'Escolha o funil acima'
              : totalPecas > 0 ? `Gerar ${totalPecas} ${isVideo ? 'roteiros' : 'headlines'}` : 'Gerar meus anúncios'}
        </button>
      </div>
    </Shell>
  )
}

// ─── Casca pública (logo + fundo) ─────────────────────────────────────────────
function Shell({ children, subtitle }) {
  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col items-center justify-center px-4 py-10">
      <div className="flex items-center gap-2.5 mb-8">
        <img src="/logo-revenue-azul-2024.png" alt="Revenue Lab" className="h-8 w-auto object-contain" />
        <div className="flex items-center gap-1.5 text-rl-muted">
          <Sparkles className="w-4 h-4 text-rl-purple" />
          <span className="text-sm font-semibold text-rl-text">Criativos com IA{subtitle ? ` · ${subtitle}` : ''}</span>
        </div>
      </div>
      {children}
    </div>
  )
}
