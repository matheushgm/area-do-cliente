import { printDocument, docHeader, PAGE_CSS } from '../lib/printDoc'
import { escapeHtml } from '../lib/utils'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircle2, Loader2, AlertTriangle, Plus, X,
  Package, Users, HelpCircle, ChevronDown, Edit2,
} from 'lucide-react'
import VideoGuide from '../components/VideoGuide'
import { t, useI18n, idiomaAtual } from '../i18n'
const tFora = t // `t` solto (fora do render): no componente o nome é do hook

// ─── Perguntas de cada módulo ─────────────────────────────────────────────────
// Os textos vêm do i18n (getters: saem no idioma atual na hora da leitura). As perguntas
// de Produto são as mesmas do módulo interno (namespace `produto`); as de Persona são
// próprias deste formulário (`formCliente.persona`). Os ids/keys são chaves gravadas.
const comTextos = (lista, base, chave) => lista.map((q) => Object.defineProperties(q, {
  label: { get: () => t(`${base}.${q[chave]}.label`), enumerable: true },
}))

const PRODUTO_QUESTIONS = comTextos([
  { id: 'q1',  emoji: '🎯' },
  { id: 'q2',  emoji: '⏰' },
  { id: 'q3',  emoji: '✨' },
  { id: 'q4',  emoji: '🏆' },
  { id: 'q5',  emoji: '🔥' },
  { id: 'q6',  emoji: '😔' },
  { id: 'q7',  emoji: '🚧' },
  { id: 'q8',  emoji: '🔄' },
  { id: 'q9',  emoji: '🤔' },
  { id: 'q10', emoji: '📊' },
  { id: 'q11', emoji: '⏱️' },
  { id: 'q12', emoji: '💬' },
  { id: 'q13', emoji: '💡' },
  { id: 'q14', emoji: '⚠️' },
  { id: 'q15', emoji: '📅' },
  { id: 'q16', emoji: '🛡️' },
  { id: 'q17', emoji: '🤝' },
], 'produto.perguntas', 'id')

const PERSONA_QUESTIONS = comTextos([
  { key: 'resultado', emoji: '🎯' },
  { key: 'acoes',     emoji: '⚡' },
  { key: 'tempo',     emoji: '⏱️' },
  { key: 'objecoes',  emoji: '🚧' },
  { key: 'sonhos',    emoji: '✨' },
  { key: 'erros',     emoji: '❌' },
  { key: 'medos',     emoji: '😰' },
  { key: 'sinais',    emoji: '🔍' },
  { key: 'habitos',   emoji: '🔄' },
], 'formCliente.persona', 'key').map((q) => Object.defineProperty(q, 'hint', {
  get: () => t(`formCliente.persona.${q.key}.hint`), enumerable: true,
}))

// ─── Ajuda de cada pergunta de Produto ────────────────────────────────────────
function ajudaDe(id) {
  return { text: t(`produto.perguntas.${id}.ajuda`), example: t(`produto.perguntas.${id}.exemplo`) }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return crypto.randomUUID() }

function newProduto(n) {
  return {
    id: uid(),
    nome: n || 'Produto 1',
    tipo: 'produto',
    answers: Object.fromEntries(PRODUTO_QUESTIONS.map((q) => [q.id, ''])),
  }
}

function newPersona(n) {
  return {
    id: uid(),
    name: n || 'Persona 1',
    answers: Object.fromEntries(PERSONA_QUESTIONS.map((q) => [q.key, []])),
  }
}

// Convert array ↔ textarea string
const arrToText = (arr) => (Array.isArray(arr) ? arr.join('\n') : arr || '')
const textToArr = (text) =>
  text.split('\n').map((s) => s.trim()).filter(Boolean)

// ─── Analytics / Form tracking ────────────────────────────────────────────────

function trackFormSubmit(formName, extra = {}) {
  // 1. GTM dataLayer — funciona com trigger de Evento Personalizado
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event: 'form_submit', form_name: formName, ...extra })

  // 2. Elemento <form> real + evento submit nativo
  //    Necessário para o trigger built-in "Form Submission" do GTM
  const form = document.createElement('form')
  form.id = `rl-form-${formName}`
  form.setAttribute('data-form-name', formName)
  Object.entries(extra).forEach(([k, v]) => {
    const inp = document.createElement('input')
    inp.type = 'hidden'; inp.name = k; inp.value = v ?? ''
    form.appendChild(inp)
  })
  document.body.appendChild(form)
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  document.body.removeChild(form)
}

// ─── PDF generators (client-facing) ──────────────────────────────────────────

const PDF_CSS = PAGE_CSS + `
  .block { border: 1px solid #D8E0F0; border-radius: 10px; padding: 16px; margin-bottom: 20px; page-break-inside: avoid; }
  .block-title { font-size: 15px; font-weight: 700; color: #164496; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #D8E0F0; }
  .qa-item { margin-bottom: 10px; }
  .qa-label { font-size: 10px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .qa-value { font-size: 12px; color: #334155; line-height: 1.6; white-space: pre-wrap; }
  .info-box { background: #F0F7FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px; color: #1e40af; }
  @media print { .block { page-break-inside: avoid; } }
`

const escPDF = escapeHtml

function openPDF(htmlBody, docTitle) {
  printDocument({ title: docTitle, css: PDF_CSS, body: docHeader({ title: docTitle }) + htmlBody })
}

function generateProdutoPDF(companyName, produtosArr) {
  const infoBox = `<div class="info-box">📋 ${escPDF(t('formCliente.pdf.aviso'))}</div>`
  const blocksHTML = produtosArr.map((p) => {
    const tipo = p.tipo === 'servico' ? t('produto.servico') : t('produto.produtoFisico')
    const qaHTML = PRODUTO_QUESTIONS.map((q) => {
      const ans = (p.answers[q.id] || '').trim()
      if (!ans) return ''
      return `<div class="qa-item"><div class="qa-label">${escPDF(q.emoji)} ${escPDF(q.label)}</div><div class="qa-value">${escPDF(ans)}</div></div>`
    }).join('')
    return `<div class="block"><div class="block-title">${escPDF(p.nome || t('formCliente.pdf.produto'))} <span style="font-size:11px;font-weight:400;color:#94A3B8;">(${escPDF(tipo)})</span></div>${qaHTML || `<div class="qa-value" style="color:#94A3B8">${escPDF(t('formCliente.pdf.nenhumaResposta'))}</div>`}</div>`
  }).join('')
  openPDF(infoBox + blocksHTML, t('formCliente.pdf.tituloProduto', { empresa: companyName }))
}

function generatePersonaPDF(companyName, personasArr) {
  const infoBox = `<div class="info-box">📋 ${escPDF(t('formCliente.pdf.aviso'))}</div>`
  const blocksHTML = personasArr.map((p) => {
    const qaHTML = PERSONA_QUESTIONS.map((q) => {
      const val = arrToText(p.answers[q.key]).trim()
      if (!val) return ''
      return `<div class="qa-item"><div class="qa-label">${escPDF(q.emoji)} ${escPDF(q.label)}</div><div class="qa-value">${escPDF(val)}</div></div>`
    }).join('')
    return `<div class="block"><div class="block-title">${escPDF(p.name || t('formCliente.pdf.persona'))}</div>${qaHTML || `<div class="qa-value" style="color:#94A3B8">${escPDF(t('formCliente.pdf.nenhumaResposta'))}</div>`}</div>`
  }).join('')
  openPDF(infoBox + blocksHTML, t('formCliente.pdf.tituloPersonas', { empresa: companyName }))
}

// ─── Save status indicator ────────────────────────────────────────────────────
function SaveBadge({ status }) {
  const { t } = useI18n()
  if (status === 'saving') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-muted">
      <Loader2 className="w-3 h-3 animate-spin" /> {t('comum.salvando')}
    </span>
  )
  if (status === 'saved') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-green">
      <CheckCircle2 className="w-3 h-3" /> {t('comum.salvo')}
    </span>
  )
  return null
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientForm() {
  const { token } = useParams()
  const { t } = useI18n()

  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [companyName, setCompanyName] = useState('')

  // Section state
  const [activeTab, setActiveTab] = useState('produto')

  // Produto state
  const [produtos, setProdutos]   = useState([newProduto()])
  const [activeProdIdx, setActiveProdIdx] = useState(0)
  // One-question-at-a-time state
  const [currentProdutoQ, setCurrentProdutoQ] = useState(0)
  const [currentPersonaQ, setCurrentPersonaQ] = useState(0)
  const [helpOpen, setHelpOpen]     = useState(false)
  const [questionError, setQuestionError] = useState(null)

  // Persona state
  const [personas, setPersonas]   = useState([newPersona()])
  const [activePerIdx, setActivePerIdx] = useState(0)

  // Save status per module
  const [saveStatus, setSaveStatus] = useState({ produto: 'idle', persona: 'idle' })

  const debounceRefs = useRef({})

  // ── Load data on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/client-form?token=${encodeURIComponent(token)}`, { headers: { 'X-Idioma': idiomaAtual() } })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || tFora('formCliente.erroCarregar'))

        setCompanyName(data.companyName || '')

        if (data.produtos?.length) {
          const mapped = data.produtos.map((p) => ({
            ...p,
            answers: { ...Object.fromEntries(PRODUTO_QUESTIONS.map((q) => [q.id, ''])), ...p.answers },
          }))
          setProdutos(mapped)
          const first = mapped[0]
          const firstUnanswered = PRODUTO_QUESTIONS.findIndex(q => !first.answers[q.id]?.trim())
          setCurrentProdutoQ(firstUnanswered === -1 ? PRODUTO_QUESTIONS.length : firstUnanswered)
        }

        if (data.personas?.length) {
          const mapped = data.personas.map((p) => ({
            ...p,
            answers: { ...Object.fromEntries(PERSONA_QUESTIONS.map((q) => [q.key, []])), ...p.answers },
          }))
          setPersonas(mapped)
          const firstP = mapped[0]
          const firstUnansweredP = PERSONA_QUESTIONS.findIndex(q => !arrToText(firstP.answers[q.key]).trim())
          setCurrentPersonaQ(firstUnansweredP === -1 ? PERSONA_QUESTIONS.length : firstUnansweredP)
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  // ── Debounced save ─────────────────────────────────────────────────────────
  const scheduleSave = useCallback((mod, payload) => {
    clearTimeout(debounceRefs.current[mod])
    setSaveStatus((s) => ({ ...s, [mod]: 'saving' }))
    debounceRefs.current[mod] = setTimeout(async () => {
      try {
        const res = await fetch('/api/client-form', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Idioma': idiomaAtual() },
          body:    JSON.stringify({ token, module: mod, data: payload }),
        })
        if (!res.ok) throw new Error()
        setSaveStatus((s) => ({ ...s, [mod]: 'saved' }))
        setTimeout(() => setSaveStatus((s) => ({ ...s, [mod]: 'idle' })), 2500)
      } catch {
        setSaveStatus((s) => ({ ...s, [mod]: 'idle' }))
      }
    }, 1500)
  }, [token])

  // ── Produto handlers ───────────────────────────────────────────────────────
  const updateProdutoAnswer = (qId, value) => {
    const next = produtos.map((p, i) =>
      i === activeProdIdx ? { ...p, answers: { ...p.answers, [qId]: value } } : p
    )
    setProdutos(next)
    scheduleSave('produtos', { produtos: next })
  }

  const updateProdutoField = (field, value) => {
    const next = produtos.map((p, i) =>
      i === activeProdIdx ? { ...p, [field]: value } : p
    )
    setProdutos(next)
    scheduleSave('produtos', { produtos: next })
  }

  const addProduto = () => {
    const next = [...produtos, newProduto(`Produto ${produtos.length + 1}`)]
    setProdutos(next)
    setActiveProdIdx(next.length - 1)
    scheduleSave('produtos', { produtos: next })
  }

  const removeProduto = (idx) => {
    if (produtos.length === 1) return
    const next = produtos.filter((_, i) => i !== idx)
    setProdutos(next)
    setActiveProdIdx(Math.min(activeProdIdx, next.length - 1))
    scheduleSave('produtos', { produtos: next })
  }

  // ── Persona handlers ───────────────────────────────────────────────────────
  const updatePersonaAnswer = (key, value) => {
    // Armazena a string crua enquanto o usuário digita — NÃO converter para array aqui,
    // pois textToArr() faz .trim() por linha e apagaria os espaços a cada tecla
    // (impedindo digitar espaço entre palavras). A conversão para array acontece
    // só no "Avançar"/"Concluir" (textToArr(val) no onClick do botão).
    const next = personas.map((p, i) =>
      i === activePerIdx ? { ...p, answers: { ...p.answers, [key]: value } } : p
    )
    setPersonas(next)
    scheduleSave('personas', { personas: next })
  }

  const updatePersonaName = (value) => {
    const next = personas.map((p, i) =>
      i === activePerIdx ? { ...p, name: value } : p
    )
    setPersonas(next)
    scheduleSave('personas', { personas: next })
  }

  const addPersona = () => {
    const next = [...personas, newPersona(`Persona ${personas.length + 1}`)]
    setPersonas(next)
    setActivePerIdx(next.length - 1)
    scheduleSave('personas', { personas: next })
  }

  const removePersona = (idx) => {
    if (personas.length === 1) return
    const next = personas.filter((_, i) => i !== idx)
    setPersonas(next)
    setActivePerIdx(Math.min(activePerIdx, next.length - 1))
    scheduleSave('personas', { personas: next })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-rl-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-rl-purple animate-spin" />
          <p className="text-rl-muted text-sm">{t('formCliente.carregando')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-rl-dark flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-rl-text">{t('formCliente.linkInvalido')}</h2>
          <p className="text-sm text-rl-muted">{error}</p>
        </div>
      </div>
    )
  }

  const TABS = [
    { id: 'produto', label: t('formCliente.abaProduto'), icon: Package, color: 'text-rl-gold' },
    { id: 'persona', label: t('formCliente.abaPersonas'), icon: Users,   color: 'text-rl-blue' },
  ]

  const produto = produtos[activeProdIdx]
  const persona = personas[activePerIdx]

  return (
    <div className="min-h-screen bg-rl-dark">
      {/* Header */}
      <div className="border-b border-rl-border bg-rl-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-rl-muted font-medium uppercase tracking-wider">{t('formCliente.cabecalho')}</p>
            <h1 className="text-lg font-bold text-rl-text">{companyName}</h1>
          </div>
          <SaveBadge status={saveStatus[activeTab === 'produto' ? 'produtos' : 'personas']} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Instrução */}
        <div className="glass-card p-5 border-l-4 border-rl-purple">
          <p className="text-sm text-rl-text font-medium mb-1">{t('formCliente.comoPreencher')}</p>
          <p className="text-sm text-rl-muted leading-relaxed">
            {t('formCliente.comoPreencherTexto')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setQuestionError(null)
                setHelpOpen(false)
                setActiveTab(tab.id)
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-rl text-white border-transparent shadow-glow'
                  : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : tab.color}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── PRODUTO / SERVIÇO ──────────────────────────────────────────────── */}
        {activeTab === 'produto' && (
          <div className="space-y-4">

            <VideoGuide videoId="awwUFJhqHOE" label={t('produto.video')} />

            {/* Sub-tabs de produto */}
            <div className="flex gap-2 flex-wrap">
              {produtos.map((p, i) => (
                <div key={p.id} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setActiveProdIdx(i)
                      const p = produtos[i]
                      const firstUnanswered = PRODUTO_QUESTIONS.findIndex(q => !p.answers[q.id]?.trim())
                      setCurrentProdutoQ(firstUnanswered === -1 ? PRODUTO_QUESTIONS.length : firstUnanswered)
                      setHelpOpen(false)
                      setQuestionError(null)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activeProdIdx === i
                        ? 'bg-rl-gold/20 text-rl-gold border border-rl-gold/40'
                        : 'bg-rl-surface text-rl-muted border border-rl-border hover:text-rl-text'
                    }`}
                  >
                    {p.nome || t('produto.nomePadrao', { n: i + 1 })}
                  </button>
                  {produtos.length > 1 && (
                    <button onClick={() => removeProduto(i)} className="p-1 text-rl-muted/50 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addProduto} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-rl-muted hover:text-rl-text border border-dashed border-rl-border hover:border-rl-gold/40 transition-all">
                <Plus className="w-3 h-3" /> {t('produto.novoProduto')}
              </button>
            </div>

            {/* Nome + Tipo */}
            <div className="glass-card p-5 space-y-4">
              <div>
                <label className="label-field">{t('produto.nome')}</label>
                <input
                  value={produto.nome}
                  onChange={(e) => updateProdutoField('nome', e.target.value)}
                  placeholder={t('produto.nomePlaceholder')}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-field mb-2">{t('produto.tipo')}</label>
                <div className="flex gap-3">
                  {[
                    { value: 'produto', label: t('produto.produtoFisico') },
                    { value: 'servico', label: t('produto.servico') },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateProdutoField('tipo', opt.value)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                        produto.tipo === opt.value
                          ? 'bg-rl-gold/10 border-rl-gold/40 text-rl-gold'
                          : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Respondidas — exibidas acima */}
            {PRODUTO_QUESTIONS.slice(0, currentProdutoQ).map((q, idx) => (
              <div key={q.id} className="glass-card p-4 border border-rl-green/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-rl-green shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-rl-muted mb-0.5">
                      <span className="mr-1">{q.emoji}</span>{q.label}
                    </p>
                    <p className="text-sm text-rl-text mt-0.5 whitespace-pre-wrap break-words leading-snug">
                      {produto.answers[q.id]}
                    </p>
                  </div>
                  <button
                    onClick={() => { setCurrentProdutoQ(idx); setHelpOpen(false); setQuestionError(null) }}
                    className="shrink-0 p-1.5 text-rl-muted hover:text-rl-text hover:bg-rl-surface/60 rounded-lg transition-all"
                    title={t('formCliente.editarResposta')}
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {/* Pergunta ativa — surge abaixo */}
            {currentProdutoQ < PRODUTO_QUESTIONS.length && (() => {
              const q      = PRODUTO_QUESTIONS[currentProdutoQ]
              const help   = ajudaDe(q.id)
              const ans    = produto.answers[q.id] || ''
              const isLast = currentProdutoQ === PRODUTO_QUESTIONS.length - 1
              const pct    = Math.round((currentProdutoQ / PRODUTO_QUESTIONS.length) * 100)
              return (
                <div className="glass-card p-5 space-y-3 border border-rl-purple/40">
                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-rl-muted mb-2">
                      <span>{t('formCliente.perguntaDe', { n: currentProdutoQ + 1, total: PRODUTO_QUESTIONS.length })}</span>
                      <span>{t('formCliente.concluidoPct', { pct })}</span>
                    </div>
                    <div className="w-full bg-rl-border/30 rounded-full h-1">
                      <div className="bg-gradient-rl h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-rl-text leading-snug">
                      <span className="mr-1.5">{q.emoji}</span>{q.label}
                    </p>
                    {help && (
                      <button
                        onClick={() => setHelpOpen(v => !v)}
                        className={`shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all ${
                          helpOpen ? 'bg-rl-blue/10 border-rl-blue/30 text-rl-blue' : 'border-rl-border text-rl-muted hover:text-rl-blue hover:border-rl-blue/30'
                        }`}
                      >
                        <HelpCircle className="w-3 h-3" />
                        <ChevronDown className={`w-3 h-3 transition-transform ${helpOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                  {/* Help */}
                  {helpOpen && help && (
                    <div className="bg-rl-blue/5 border border-rl-blue/15 rounded-xl p-4 space-y-2 text-xs text-rl-text/80 leading-relaxed">
                      <p>{help.text}</p>
                      <p className="text-rl-muted italic border-l-2 border-rl-blue/30 pl-3">
                        <span className="font-semibold text-rl-blue not-italic">{t('produto.exemplo')}</span>
                        {help.example}
                      </p>
                    </div>
                  )}
                  {/* Textarea */}
                  <textarea
                    autoFocus
                    value={ans}
                    onChange={(e) => { updateProdutoAnswer(q.id, e.target.value); setQuestionError(null) }}
                    placeholder={t('produto.respostaPlaceholder')}
                    rows={4}
                    className="input-field resize-none text-sm leading-relaxed"
                  />
                  {/* Error */}
                  {questionError && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {questionError}
                    </p>
                  )}
                  {/* Avançar */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (!ans.trim()) { setQuestionError(t('formCliente.respondaParaAvancar')); return }
                        setQuestionError(null); setHelpOpen(false)
                        const nextProdutos = produtos.map((p, i) =>
                          i === activeProdIdx ? { ...p, answers: { ...p.answers, [q.id]: ans } } : p
                        )
                        setCurrentProdutoQ(n => n + 1)
                        if (isLast) {
                          generateProdutoPDF(companyName, nextProdutos)
                          trackFormSubmit('produto_servico', { company: companyName, token })
                          if (currentPersonaQ >= PERSONA_QUESTIONS.length) {
                            trackFormSubmit('briefing_completo', { company: companyName, token })
                          }
                        }
                      }}
                      className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl font-semibold bg-gradient-rl text-white hover:opacity-90 transition-all"
                    >
                      {isLast ? <><CheckCircle2 className="w-4 h-4" /> {t('formCliente.concluirProduto')}</> : <>{t('formCliente.avancar')}</>}
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Concluído */}
            {currentProdutoQ >= PRODUTO_QUESTIONS.length && (
              <div className="glass-card p-6 text-center border border-rl-green/30 bg-rl-green/5">
                <CheckCircle2 className="w-10 h-10 text-rl-green mx-auto mb-3" />
                <p className="text-sm font-semibold text-rl-text">{t('formCliente.produtoConcluido')}</p>
                <p className="text-xs text-rl-muted mt-1">{t('formCliente.podeEditar')}</p>
              </div>
            )}

          </div>
        )}

        {/* ── PERSONAS ──────────────────────────────────────────────────────── */}
        {activeTab === 'persona' && (
          <div className="space-y-4">

            <VideoGuide videoId="hpMy2Th9YrA" label={t('personas.video')} />

            {/* Sub-tabs de persona */}
            <div className="flex gap-2 flex-wrap">
              {personas.map((p, i) => (
                <div key={p.id} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setActivePerIdx(i)
                      const p = personas[i]
                      const firstUnanswered = PERSONA_QUESTIONS.findIndex(q => !arrToText(p.answers[q.key]).trim())
                      setCurrentPersonaQ(firstUnanswered === -1 ? PERSONA_QUESTIONS.length : firstUnanswered)
                      setHelpOpen(false); setQuestionError(null)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activePerIdx === i
                        ? 'bg-rl-blue/20 text-rl-blue border border-rl-blue/40'
                        : 'bg-rl-surface text-rl-muted border border-rl-border hover:text-rl-text'
                    }`}
                  >
                    {p.name || t('personas.nomePadrao', { n: i + 1 })}
                  </button>
                  {personas.length > 1 && (
                    <button onClick={() => removePersona(i)} className="p-1 text-rl-muted/50 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addPersona}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-rl-muted hover:text-rl-text border border-dashed border-rl-border hover:border-rl-blue/40 transition-all"
              >
                <Plus className="w-3 h-3" /> {t('personas.nova')}
              </button>
            </div>

            {/* Nome da persona */}
            <div className="glass-card p-5">
              <label className="label-field">{t('formCliente.nomePersona')}</label>
              <input
                value={persona.name}
                onChange={(e) => updatePersonaName(e.target.value)}
                placeholder={t('formCliente.nomePersonaPlaceholder')}
                className="input-field"
              />
            </div>

            {/* Respondidas — exibidas acima */}
            {PERSONA_QUESTIONS.slice(0, currentPersonaQ).map((q, idx) => {
              const val = arrToText(persona.answers[q.key])
              return (
                <div key={q.key} className="glass-card p-4 border border-rl-green/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-rl-green shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-rl-muted mb-0.5">
                        <span className="mr-1">{q.emoji}</span>{q.label}
                      </p>
                      <p className="text-sm text-rl-text mt-0.5 whitespace-pre-wrap break-words leading-snug">{val}</p>
                    </div>
                    <button
                      onClick={() => { setCurrentPersonaQ(idx); setHelpOpen(false); setQuestionError(null) }}
                      className="shrink-0 p-1.5 text-rl-muted hover:text-rl-text hover:bg-rl-surface/60 rounded-lg transition-all"
                      title={t('formCliente.editarResposta')}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Pergunta ativa — surge abaixo */}
            {currentPersonaQ < PERSONA_QUESTIONS.length && (() => {
              const q      = PERSONA_QUESTIONS[currentPersonaQ]
              const val    = arrToText(persona.answers[q.key])
              const isLast = currentPersonaQ === PERSONA_QUESTIONS.length - 1
              const pct    = Math.round((currentPersonaQ / PERSONA_QUESTIONS.length) * 100)
              return (
                <div className="glass-card p-5 space-y-3 border border-rl-blue/40">
                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-rl-muted mb-2">
                      <span>{t('formCliente.perguntaDe', { n: currentPersonaQ + 1, total: PERSONA_QUESTIONS.length })}</span>
                      <span>{t('formCliente.concluidoPct', { pct })}</span>
                    </div>
                    <div className="w-full bg-rl-border/30 rounded-full h-1">
                      <div className="bg-gradient-rl h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-rl-text">
                    <span className="mr-1.5">{q.emoji}</span>{q.label}
                  </p>
                  {q.hint && <p className="text-xs text-rl-muted">{q.hint}</p>}
                  <textarea
                    autoFocus
                    value={val}
                    onChange={(e) => { updatePersonaAnswer(q.key, e.target.value); setQuestionError(null) }}
                    placeholder={t('formCliente.respostaPersonaPlaceholder')}
                    rows={4}
                    className="input-field resize-none text-sm leading-relaxed"
                  />
                  {questionError && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {questionError}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        if (!val.trim()) { setQuestionError(t('formCliente.respondaParaAvancar')); return }
                        setQuestionError(null); setHelpOpen(false)
                        const nextPersonas = personas.map((p, i) =>
                          i === activePerIdx ? { ...p, answers: { ...p.answers, [q.key]: textToArr(val) } } : p
                        )
                        setCurrentPersonaQ(n => n + 1)
                        if (isLast) {
                          generatePersonaPDF(companyName, nextPersonas)
                          trackFormSubmit('personas', { company: companyName, token })
                          if (currentProdutoQ >= PRODUTO_QUESTIONS.length) {
                            trackFormSubmit('briefing_completo', { company: companyName, token })
                          }
                        }
                      }}
                      className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl font-semibold bg-gradient-rl text-white hover:opacity-90 transition-all"
                    >
                      {isLast ? <><CheckCircle2 className="w-4 h-4" /> {t('formCliente.concluirPersonas')}</> : <>{t('formCliente.avancar')}</>}
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Concluído */}
            {currentPersonaQ >= PERSONA_QUESTIONS.length && (
              <div className="glass-card p-6 text-center border border-rl-green/30 bg-rl-green/5">
                <CheckCircle2 className="w-10 h-10 text-rl-green mx-auto mb-3" />
                <p className="text-sm font-semibold text-rl-text">{t('formCliente.personasConcluidas')}</p>
                <p className="text-xs text-rl-muted mt-1">{t('formCliente.podeEditar')}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 pb-8 text-center">
          <p className="text-xs text-rl-muted">
            {t('formCliente.rodape')}
          </p>
          <p className="text-xs text-rl-muted/50 mt-1">Revenue Lab © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}
