import { useState, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import MarkdownBlock from '../components/Criativos/MarkdownBlock'
import { AD_TYPES, postCriativo, streamCriativo } from '../lib/criativosPublic'
import {
  Sparkles, Loader2, AlertTriangle, Lock, ArrowLeft, Image as ImageIcon, Video,
  CheckCircle2, RotateCcw, Copy, Check, Plus, X, ChevronLeft, Wand2,
} from 'lucide-react'

export default function CriativosPublico() {
  const { projectId, token } = useParams()

  // 'gate' | 'select' | 'config' | 'generating' | 'result' | 'error'
  const [status, setStatus] = useState('gate')
  const [password, setPassword] = useState('')
  const [ctx, setCtx] = useState(null) // { companyName, dores, produtos, personas }
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [mode, setMode] = useState(null) // 'estatico' | 'video'
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)
  const abortRef = useRef(null)

  // ── Config: vídeo ─────────────────────────────────────────────────────────
  const [adTypeConfig, setAdTypeConfig] = useState({}) // { [typeId]: qty }

  // ── Config: estático (dores) ──────────────────────────────────────────────
  const [customDores, setCustomDores] = useState([]) // [{ id, text }]
  const [dorConfig, setDorConfig] = useState({}) // { [dorId]: { types: { [typeId]: qty } } }
  const [addingDor, setAddingDor] = useState(false)
  const [newDorText, setNewDorText] = useState('')

  const allDores = useMemo(() => {
    const parsed = (ctx?.dores || []).map((d) => ({ id: d.id, text: d.text, personaName: d.personaName }))
    return [...parsed, ...customDores.map((d) => ({ ...d, isCustom: true }))]
  }, [ctx, customDores])

  // ── Auth (senha) ──────────────────────────────────────────────────────────
  async function unlock() {
    if (!password.trim() || busy) return
    setBusy(true); setError(null)
    try {
      const data = await postCriativo('auth', { projectId, token, password: password.trim() })
      setCtx(data)
      setStatus('select')
    } catch (e) {
      setError(e.message || 'Não foi possível acessar.')
    } finally {
      setBusy(false)
    }
  }

  // ── Seleção de tipos (vídeo) ──────────────────────────────────────────────
  const videoTypes = Object.entries(adTypeConfig).map(([id, qty]) => ({ id, qty }))
  const videoTotal = videoTypes.reduce((s, t) => s + t.qty, 0)

  function toggleVideoType(id) {
    setAdTypeConfig((prev) => {
      if (prev[id]) { const n = { ...prev }; delete n[id]; return n }
      return { ...prev, [id]: 1 }
    })
  }
  function bumpVideoQty(id, delta) {
    setAdTypeConfig((prev) => ({ ...prev, [id]: Math.max(1, Math.min(10, (prev[id] || 1) + delta)) }))
  }

  // ── Seleção de dores + tipos (estático) ───────────────────────────────────
  const selectedDores = allDores.filter((d) => dorConfig[d.id])
  const staticTotal = selectedDores.reduce(
    (s, d) => s + Object.values(dorConfig[d.id]?.types || {}).reduce((a, q) => a + q, 0), 0
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
      if (types[typeId]) delete types[typeId]; else types[typeId] = 1
      return { ...prev, [dorId]: { ...dor, types } }
    })
  }
  function bumpDorTypeQty(dorId, typeId, delta) {
    setDorConfig((prev) => {
      const dor = prev[dorId]
      return { ...prev, [dorId]: { ...dor, types: { ...dor.types, [typeId]: Math.max(1, Math.min(10, (dor.types[typeId] || 1) + delta)) } } }
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
  function canGenerate() {
    if (mode === 'video') return videoTypes.length > 0
    return selectedDores.some((d) => Object.keys(dorConfig[d.id]?.types || {}).length > 0)
  }

  async function generate() {
    if (!canGenerate()) return
    setStatus('generating'); setError(null); setResult(''); setCopied(false)
    abortRef.current = new AbortController()
    try {
      const payload = { projectId, token, password: password.trim(), mode }
      if (mode === 'video') {
        payload.adTypes = videoTypes
      } else {
        payload.dores = selectedDores.map((d) => ({
          text: d.text,
          types: Object.entries(dorConfig[d.id].types).map(([id, qty]) => ({ id, qty })),
        }))
      }
      const full = await streamCriativo('generate', payload, setResult, abortRef.current.signal)
      setResult(full)
      setStatus('result')
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
    setAdTypeConfig({}); setDorConfig({}); setCustomDores([]); setAddingDor(false); setNewDorText('')
  }

  // ══ RENDER ════════════════════════════════════════════════════════════════

  // ── Gate (senha) ──────────────────────────────────────────────────────────
  if (status === 'gate') {
    return (
      <Shell>
        <div className="glass-card p-8 max-w-md w-full">
          <div className="w-12 h-12 rounded-2xl bg-rl-purple/15 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-rl-purple" />
          </div>
          <h1 className="text-xl font-bold text-rl-text text-center mb-1">Área de Criação de Anúncios</h1>
          <p className="text-sm text-rl-muted text-center mb-6">Digite a senha de acesso que a Revenue Lab enviou pra você.</p>
          <input
            type="password" autoFocus value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && unlock()}
            placeholder="Senha de acesso"
            className="input-field w-full text-base text-center"
          />
          {error && (
            <div className="flex items-start gap-2 mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <button onClick={unlock} disabled={!password.trim() || busy}
            className="btn-primary w-full mt-4 flex items-center justify-center gap-2 text-sm py-2.5 disabled:opacity-50">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</> : <>Acessar <Sparkles className="w-4 h-4" /></>}
          </button>
        </div>
      </Shell>
    )
  }

  // ── Seleção de formato ────────────────────────────────────────────────────
  if (status === 'select') {
    return (
      <Shell subtitle={ctx?.companyName}>
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-rl-text">Que tipo de anúncio você quer criar?</h1>
            <p className="text-sm text-rl-muted mt-1">A IA usa os dados da sua marca pra montar criativos sob medida.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'estatico', Icon: ImageIcon, color: 'rl-blue', title: 'Anúncio Estático', desc: 'Headlines, subheadlines e copy para anúncios de imagem (Meta e Google). Metodologia ADIG.', tags: ['Headlines', 'Copy', 'ADIG'] },
              { key: 'video', Icon: Video, color: 'rl-purple', title: 'Roteiro de Vídeo', desc: 'Roteiros de 30–60s com Gancho, Mensagem e CTA para Reels e YouTube.', tags: ['Reels', 'Gancho', 'CTA'] },
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

  // ── Gerando ───────────────────────────────────────────────────────────────
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
              : <p className="text-sm text-rl-muted">Analisando os dados da sua marca e montando os criativos. Isso leva alguns segundos.</p>}
          </div>
        </div>
      </Shell>
    )
  }

  // ── Erro ──────────────────────────────────────────────────────────────────
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

  // ── Resultado ─────────────────────────────────────────────────────────────
  if (status === 'result') {
    return (
      <Shell subtitle={ctx?.companyName}>
        <div className="w-full max-w-2xl space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-rl-green/15 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-rl-green" />
            </div>
            <h1 className="text-2xl font-bold text-rl-text">Seus anúncios estão prontos! 🎉</h1>
            <p className="text-sm text-rl-muted mt-1">Copie, teste e escale. Você pode gerar quantos quiser.</p>
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
  const isVideo = mode === 'video'
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
              {isVideo ? 'Escolha os tipos de gancho e a quantidade.' : 'Escolha as dores do seu cliente e o ângulo de cada anúncio.'}
            </p>
          </div>
        </div>

        {/* ── Vídeo: tipos de gancho ─────────────────────────────────────── */}
        {isVideo && (
          <div>
            {videoTypes.length > 0 && (
              <p className="text-[11px] font-bold text-rl-purple mb-2">
                {videoTypes.length} tipo{videoTypes.length !== 1 ? 's' : ''} · {videoTotal} roteiro{videoTotal !== 1 ? 's' : ''}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AD_TYPES.map((type) => {
                const selected = (adTypeConfig[type.id] || 0) > 0
                const qty = adTypeConfig[type.id] || 1
                return (
                  <div key={type.id}
                    onClick={() => toggleVideoType(type.id)}
                    className={`rounded-xl p-3 text-left cursor-pointer transition-all border ${selected ? 'bg-rl-purple/10 border-rl-purple/50' : 'bg-rl-surface border-rl-border hover:border-rl-purple/30'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{type.emoji}</span>
                      <span className={`text-xs font-bold flex-1 ${selected ? 'text-rl-purple' : 'text-rl-text'}`}>{type.label}</span>
                      {selected && (
                        <Stepper qty={qty} onDec={(e) => { e.stopPropagation(); bumpVideoQty(type.id, -1) }} onInc={(e) => { e.stopPropagation(); bumpVideoQty(type.id, 1) }} />
                      )}
                    </div>
                    <p className="text-[10px] text-rl-muted leading-snug mt-1 line-clamp-2">{type.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Estático: dores + tipos por dor ────────────────────────────── */}
        {!isVideo && (
          <div className="space-y-2">
            {staticTotal > 0 && (
              <p className="text-[11px] font-bold text-rl-purple">
                {selectedDores.length} dor{selectedDores.length !== 1 ? 'es' : ''} · {staticTotal} variaç{staticTotal !== 1 ? 'ões' : 'ão'}
              </p>
            )}
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
                      <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wide">Ângulo do anúncio</p>
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
                      {Object.keys(types).length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {Object.entries(types).map(([tid, qty]) => {
                            const t = AD_TYPES.find((x) => x.id === tid)
                            return (
                              <div key={tid} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-rl-purple/10 border border-rl-purple/30">
                                <span className="text-sm shrink-0">{t.emoji}</span>
                                <span className="text-xs font-medium text-rl-purple flex-1">{t.label}</span>
                                <Stepper qty={qty} onDec={() => bumpDorTypeQty(dor.id, tid, -1)} onInc={() => bumpDorTypeQty(dor.id, tid, 1)} />
                              </div>
                            )
                          })}
                        </div>
                      )}
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

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button onClick={generate} disabled={!canGenerate()}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-3 disabled:opacity-50 disabled:cursor-not-allowed">
          <Wand2 className="w-4 h-4" /> Gerar meus anúncios
        </button>
      </div>
    </Shell>
  )
}

// ─── Stepper de quantidade ────────────────────────────────────────────────────
function Stepper({ qty, onInc, onDec }) {
  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <button onClick={onDec} className="w-5 h-5 rounded flex items-center justify-center text-rl-purple hover:bg-rl-purple/20 text-sm font-bold leading-none">−</button>
      <span className="text-xs font-bold text-rl-purple min-w-[1.25rem] text-center">{qty}</span>
      <button onClick={onInc} className="w-5 h-5 rounded flex items-center justify-center text-rl-purple hover:bg-rl-purple/20 text-sm font-bold leading-none">+</button>
    </div>
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
