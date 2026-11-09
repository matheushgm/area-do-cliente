import { useState, useEffect, useCallback, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import MarkdownBlock from '../components/Criativos/MarkdownBlock'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { streamClaude, instrucaoDeIdioma } from '../lib/claude'
import { useI18n } from '../i18n'
import { supabase } from '../lib/supabase'
import {
  PRODUTO_QS, CLIENTE_QS, ALL_QS, EMPTY_ANSWERS, SPLIT,
  SYSTEM_GERAR, SYSTEM_REFINAR, buildUserBrief, publicLink,
} from '../lib/roteirosExpress'
import {
  Clapperboard, Menu, Sparkles, Loader2, Wand2, Lock,
  Package, Users, RotateCcw, AlertTriangle, CheckCircle2, PenLine, Send,
  Inbox, PenSquare, Link2, Copy, Check, Trash2, ChevronDown, RefreshCw, Clock,
  Building2, Mail, Phone,
} from 'lucide-react'

// Persistência local do rascunho de criação manual.
const STORAGE_KEY = 'rl_roteiros_express_v1'
const STATUS_BADGE = {
  novo:      { label: 'roteiros.status.novo',      cls: 'text-rl-blue bg-rl-blue/10 border-rl-blue/30' },
  gerado:    { label: 'roteiros.status.gerado',    cls: 'text-rl-green bg-rl-green/10 border-rl-green/30' },
  arquivado: { label: 'roteiros.status.arquivado', cls: 'text-rl-muted bg-rl-surface border-rl-border' },
}

function fmtDate(iso, locale) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function RoteirosExpress() {
  const { openSidebar } = useOutletContext()
  const { toast, showToast } = useToast()
  const { t, locale } = useI18n()
  const [tab, setTab] = useState('criar') // 'criar' | 'respostas'

  // ── Estado de criação ──────────────────────────────────────────────────────
  const [answers, setAnswers] = useState(EMPTY_ANSWERS)
  const [scripts, setScripts] = useState([]) // [{ content, refineUsed }]
  const [step, setStep] = useState('form') // 'form' | 'result'
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState(null)
  const [sourceResponseId, setSourceResponseId] = useState(null) // resposta de origem (DB)

  // refino por card
  const [refiningIdx, setRefiningIdx] = useState(null)
  const [refineNote, setRefineNote] = useState('')
  const [refineStream, setRefineStream] = useState('')

  // ── Estado das respostas (banco) ───────────────────────────────────────────
  const [responses, setResponses] = useState([])
  const [loadingResponses, setLoadingResponses] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [copied, setCopied] = useState(false)

  const shareUrl = typeof window !== 'undefined' ? publicLink(window.location.origin) : ''

  // ── Carregar/salvar rascunho local ─────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved.answers) setAnswers({ ...EMPTY_ANSWERS, ...saved.answers })
      if (Array.isArray(saved.scripts) && saved.scripts.length) {
        setScripts(saved.scripts)
        setStep('result')
      }
    } catch { /* ignora cache corrompido */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, scripts }))
    } catch { /* storage cheio — segue sem persistir */ }
  }, [answers, scripts])

  // ── Buscar respostas do banco ──────────────────────────────────────────────
  const fetchResponses = useCallback(async () => {
    setLoadingResponses(true)
    const { data, error: err } = await supabase
      .from('roteiros_express')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) showToast(t('roteiros.toast.erroCarregar'), 'error')
    else setResponses(data || [])
    setLoadingResponses(false)
  }, [showToast, t])

  useEffect(() => {
    if (tab === 'respostas') fetchResponses()
  }, [tab, fetchResponses])

  const allFilled = useMemo(() => ALL_QS.every((q) => (answers[q.id] || '').trim()), [answers])
  const setAnswer = useCallback((id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }, [])

  // ── Gerar os 2 roteiros ────────────────────────────────────────────────────
  const generate = useCallback(async (fromAnswers, respId = null) => {
    const src = fromAnswers || answers
    if (!ALL_QS.every((q) => (src[q.id] || '').trim()) || loading) return
    setLoading(true)
    setError(null)
    setStreamingText('')
    setStep('result')
    try {
      const fullText = await streamClaude({
        model: 'claude-sonnet-4-5',
        max_tokens: 8000,
        // O texto é dividido só pelo delimitador [[ROTEIRO]], que não depende do idioma.
        system: SYSTEM_GERAR + instrucaoDeIdioma({ rotulos: true }),
        messages: [{ role: 'user', content: buildUserBrief(src) }],
        onChunk: (txt) => setStreamingText(txt.replace(/—/g, '-')),
      })
      const clean = fullText.replace(/—/g, '-')
      const parts = clean.split(SPLIT).map((s) => s.trim()).filter(Boolean).slice(0, 2)
      const finalParts = parts.length ? parts : [clean.trim()]
      const newScripts = finalParts.map((content) => ({ content, refineUsed: false }))
      setScripts(newScripts)

      // Persiste de volta na resposta de origem (se veio do banco).
      if (respId && supabase) {
        await supabase.from('roteiros_express')
          .update({ status: 'gerado', scripts: newScripts })
          .eq('id', respId)
        setResponses((prev) => prev.map((r) =>
          r.id === respId ? { ...r, status: 'gerado', scripts: newScripts } : r))
      }
    } catch (e) {
      setError(e.message || t('roteiros.toast.erroGerar'))
      setStep('form')
    } finally {
      setLoading(false)
      setStreamingText('')
    }
  }, [answers, loading, t])

  // ── Refinar um roteiro (1x por roteiro) ────────────────────────────────────
  const startRefine = (idx) => { setRefiningIdx(idx); setRefineNote(''); setRefineStream('') }

  const applyRefine = useCallback(async (idx) => {
    const note = refineNote.trim()
    if (!note || loading) return
    setLoading(true)
    setError(null)
    setRefineStream('')
    try {
      const original = scripts[idx].content
      const fullText = await streamClaude({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: SYSTEM_REFINAR + instrucaoDeIdioma({ rotulos: true }),
        messages: [{ role: 'user', content: `## ROTEIRO ORIGINAL\n\n${original}\n\n## PEDIDO DE REFINAMENTO\n\n${note}` }],
        onChunk: (txt) => setRefineStream(txt.replace(/—/g, '-')),
      })
      const clean = fullText.replace(/—/g, '-').trim()
      const updated = scripts.map((s, i) => (i === idx ? { content: clean, refineUsed: true } : s))
      setScripts(updated)
      setRefiningIdx(null); setRefineNote(''); setRefineStream('')
      showToast(t('roteiros.toast.refinado'))
      if (sourceResponseId && supabase) {
        await supabase.from('roteiros_express').update({ scripts: updated }).eq('id', sourceResponseId)
      }
    } catch (e) {
      setError(e.message || t('roteiros.toast.erroRefinar'))
    } finally {
      setLoading(false)
    }
  }, [refineNote, scripts, loading, showToast, sourceResponseId, t])

  // ── Recomeçar ──────────────────────────────────────────────────────────────
  const reset = () => {
    if (!window.confirm(t('roteiros.toast.confirmarNovo'))) return
    setAnswers(EMPTY_ANSWERS); setScripts([]); setStep('form'); setError(null)
    setRefiningIdx(null); setRefineNote(''); setSourceResponseId(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
  }

  // ── Usar uma resposta do banco para gerar ──────────────────────────────────
  const runFromResponse = (r) => {
    const merged = { ...EMPTY_ANSWERS, ...(r.answers || {}) }
    setAnswers(merged)
    setSourceResponseId(r.id)
    setScripts([])
    setRefiningIdx(null)
    setError(null)
    setTab('criar')
    setStep('form')
    generate(merged, r.id)
  }

  const deleteResponse = async (r) => {
    if (!window.confirm(t('roteiros.toast.confirmarExcluir'))) return
    if (supabase) await supabase.from('roteiros_express').delete().eq('id', r.id)
    setResponses((prev) => prev.filter((x) => x.id !== r.id))
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      showToast(t('roteiros.link.linkCopiado'))
      setTimeout(() => setCopied(false), 1800)
    } catch {
      showToast(t('roteiros.link.naoCopiou'), 'error')
    }
  }

  return (
    <>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button onClick={openSidebar} aria-label={t('roteiros.abrirMenu')}
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
              <Clapperboard className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-rl-text text-sm">{t('roteiros.titulo')}</span>
          </div>
        </div>

        <main className="flex-1 px-6 py-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rl-purple/10 flex items-center justify-center shrink-0">
                  <Clapperboard className="w-5 h-5 text-rl-purple" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-rl-text">{t('roteiros.titulo')}</h1>
                  <p className="text-sm text-rl-muted">
                    {t('roteiros.subtitulo')}
                  </p>
                </div>
              </div>
              {tab === 'criar' && step === 'result' && (
                <button onClick={reset} disabled={loading}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all disabled:opacity-50">
                  <RotateCcw className="w-3.5 h-3.5" /> {t('roteiros.novoRoteiro')}
                </button>
              )}
            </div>

            {/* ── Link público compartilhável ─────────────────── */}
            <div className="glass-card p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-rl-purple/10 flex items-center justify-center shrink-0">
                <Link2 className="w-4 h-4 text-rl-purple" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-rl-text">{t('roteiros.link.titulo')}</p>
                <p className="text-[11px] text-rl-muted mb-2">
                  {t('roteiros.link.descricao')}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="input-field flex-1 text-xs font-mono !py-1.5 truncate"
                  />
                  <button onClick={copyLink}
                    className="btn-primary flex items-center gap-1.5 text-xs px-3 py-2 shrink-0">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? t('roteiros.link.copiado') : t('comum.copiar')}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Abas ───────────────────────────────────────── */}
            <div className="flex items-center gap-1 border-b border-rl-border">
              <TabBtn active={tab === 'criar'} onClick={() => setTab('criar')} Icon={PenSquare} label={t('roteiros.abas.criar')} />
              <TabBtn active={tab === 'respostas'} onClick={() => setTab('respostas')} Icon={Inbox}
                label={responses.length ? t('roteiros.abas.respostasN', { n: responses.length }) : t('roteiros.abas.respostas')} />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* ════════════ ABA: CRIAR ════════════ */}
            {tab === 'criar' && step === 'form' && (
              <>
                {sourceResponseId && (
                  <p className="text-[11px] text-rl-blue">{t('roteiros.form.aPartirDeResposta')}</p>
                )}
                <QuestionGroup Icon={Package} title={t('roteiros.form.grupoProduto')}
                  questions={PRODUTO_QS} answers={answers} onChange={setAnswer} />
                <QuestionGroup Icon={Users} title={t('roteiros.form.grupoCliente')}
                  questions={CLIENTE_QS} answers={answers} onChange={setAnswer} />
                <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                  <p className="text-xs text-rl-muted">
                    {allFilled ? t('roteiros.form.tudoPreenchido') : t('roteiros.form.preencha')}
                  </p>
                  <button onClick={() => generate(answers, sourceResponseId)} disabled={!allFilled || loading}
                    className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {t('roteiros.form.gerar')}
                  </button>
                </div>
              </>
            )}

            {tab === 'criar' && step === 'result' && (
              <div className="space-y-5">
                {loading && scripts.length === 0 && (
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-3 text-rl-purple">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-wider">{t('roteiros.resultado.escrevendo')}</span>
                    </div>
                    <MarkdownBlock content={streamingText || t('roteiros.resultado.analisando')} />
                  </div>
                )}

                {scripts.map((script, idx) => {
                  const isRefiningThis = refiningIdx === idx
                  const showStream = loading && isRefiningThis && refineStream
                  return (
                    <div key={idx} className="glass-card p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full text-rl-purple bg-rl-purple/10 border border-rl-purple/30">
                          <Clapperboard className="w-3 h-3" /> {t('roteiros.resultado.roteiroN', { n: idx + 1 })}
                        </span>
                        {script.refineUsed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rl-green">
                            <CheckCircle2 className="w-3 h-3" /> {t('roteiros.resultado.refinado')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rl-muted">
                            <Wand2 className="w-3 h-3" /> {t('roteiros.resultado.refinoDisponivel')}
                          </span>
                        )}
                      </div>

                      <MarkdownBlock content={showStream ? refineStream : script.content} />

                      {!script.refineUsed && !loading && (
                        isRefiningThis ? (
                          <div className="rounded-xl border border-rl-purple/30 bg-rl-purple/5 p-3 space-y-2">
                            <label className="text-[11px] font-bold text-rl-text flex items-center gap-1.5">
                              <PenLine className="w-3.5 h-3.5 text-rl-purple" />
                              {t('roteiros.resultado.ajustar')}
                            </label>
                            <textarea autoFocus value={refineNote} onChange={(e) => setRefineNote(e.target.value)}
                              rows={3} placeholder={t('roteiros.resultado.ajustarPh')}
                              className="input-field w-full text-sm resize-none" />
                            <p className="text-[10px] text-rl-muted">
                              {t('roteiros.resultado.atencaoAntes')} <strong>{t('roteiros.resultado.atencaoNegrito')}</strong> {t('roteiros.resultado.atencaoDepois')}
                            </p>
                            <div className="flex items-center gap-2">
                              <button onClick={() => applyRefine(idx)} disabled={!refineNote.trim()}
                                className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5 disabled:opacity-50">
                                <Send className="w-3.5 h-3.5" /> {t('roteiros.resultado.aplicar')}
                              </button>
                              <button onClick={() => { setRefiningIdx(null); setRefineNote('') }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
                                {t('comum.cancelar')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => startRefine(idx)}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all">
                            <Wand2 className="w-3.5 h-3.5" /> {t('roteiros.resultado.refinar')}
                          </button>
                        )
                      )}

                      {script.refineUsed && (
                        <div className="flex items-center gap-1.5 text-[11px] text-rl-muted">
                          <Lock className="w-3 h-3" /> {t('roteiros.resultado.refinoUsado')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ════════════ ABA: RESPOSTAS ════════════ */}
            {tab === 'respostas' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-rl-muted">
                    {loadingResponses ? t('comum.carregando') : t(responses.length === 1 ? 'roteiros.respostas.noBanco.um' : 'roteiros.respostas.noBanco.outros', { n: responses.length })}
                  </p>
                  <button onClick={fetchResponses} disabled={loadingResponses}
                    className="flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-text transition-all disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingResponses ? 'animate-spin' : ''}`} /> {t('roteiros.respostas.atualizar')}
                  </button>
                </div>

                {!loadingResponses && responses.length === 0 && (
                  <div className="glass-card p-10 text-center">
                    <Inbox className="w-10 h-10 text-rl-muted mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-rl-muted">{t('roteiros.respostas.nenhuma')}</p>
                    <p className="text-xs text-rl-muted mt-1">{t('roteiros.respostas.compartilhe')}</p>
                  </div>
                )}

                {responses.map((r) => {
                  const expanded = expandedId === r.id
                  const badge = STATUS_BADGE[r.status] || STATUS_BADGE.novo
                  return (
                    <div key={r.id} className="glass-card overflow-hidden">
                      <div className="p-4 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-rl-text truncate">
                              {r.nome || t('roteiros.respostas.semIdentificacao')}
                            </span>
                            {r.empresa && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-rl-blue bg-rl-blue/10 border border-rl-blue/30 px-1.5 py-0.5 rounded-full">
                                <Building2 className="w-2.5 h-2.5" /> {r.empresa}
                              </span>
                            )}
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
                              {t(badge.label)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-rl-muted">
                            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDate(r.created_at, locale)}</span>
                            {r.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {r.email}</span>}
                            {r.telefone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {r.telefone}</span>}
                          </div>
                          <p className="text-xs text-rl-muted mt-1.5 line-clamp-1">
                            <span className="text-rl-text/70 font-medium">{t('roteiros.respostas.vende')}</span> {r.answers?.p1 || '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setExpandedId(expanded ? null : r.id)}
                            title={t('roteiros.respostas.verRespostas')}
                            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
                            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                          </button>
                          <button onClick={() => deleteResponse(r)} title={t('comum.excluir')}
                            className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="border-t border-rl-border px-4 py-4 space-y-3 bg-rl-surface/30">
                          <AnswerList Icon={Package} title={t('roteiros.respostas.produtoServico')} qs={PRODUTO_QS} answers={r.answers} />
                          <AnswerList Icon={Users} title={t('roteiros.respostas.cliente')} qs={CLIENTE_QS} answers={r.answers} />

                          {Array.isArray(r.scripts) && r.scripts.length > 0 && (
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center gap-1.5">
                                <Clapperboard className="w-3.5 h-3.5 text-rl-purple" />
                                <h4 className="text-[10px] font-bold text-rl-purple uppercase tracking-wider">
                                  {t('roteiros.respostas.roteirosRecebidos')}
                                </h4>
                              </div>
                              {r.scripts.map((s, i) => (
                                <div key={i} className="rounded-lg border border-rl-border bg-rl-bg/40 p-3">
                                  <MarkdownBlock content={s.content} />
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <button onClick={() => runFromResponse(r)} disabled={loading}
                              className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5 disabled:opacity-50">
                              <Sparkles className="w-3.5 h-3.5" />
                              {r.status === 'gerado' ? t('roteiros.respostas.gerarNovamente') : t('roteiros.respostas.gerar2')}
                            </button>
                            {r.status === 'gerado' && (
                              <span className="text-[10px] text-rl-green inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> {t('roteiros.respostas.jaGerados')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <Toast toast={toast} />
    </>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────
function TabBtn({ active, onClick, Icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
        active ? 'border-rl-purple text-rl-purple' : 'border-transparent text-rl-muted hover:text-rl-text'
      }`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  )
}

function QuestionGroup({ Icon, title, questions, answers, onChange }) {
  const { t } = useI18n()
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-rl-purple/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-rl-purple" />
        </div>
        <h2 className="text-sm font-bold text-rl-text">{title}</h2>
      </div>
      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id}>
            <label className="text-[13px] font-semibold text-rl-text block">
              <span className="text-rl-purple mr-1">{i + 1}.</span>{t(`roteiros.perguntas.${q.id}.label`)}
            </label>
            {q.hint && <p className="text-[11px] text-rl-muted mb-1.5">{t(`roteiros.perguntas.${q.id}.hint`)}</p>}
            <textarea value={answers[q.id]} onChange={(e) => onChange(q.id, e.target.value)}
              rows={2} placeholder={t(`roteiros.perguntas.${q.id}.ph`)} className="input-field w-full text-sm resize-none" />
          </div>
        ))}
      </div>
    </div>
  )
}

function AnswerList({ Icon, title, qs, answers }) {
  const { t } = useI18n()
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-rl-purple" />
        <h4 className="text-[10px] font-bold text-rl-purple uppercase tracking-wider">{title}</h4>
      </div>
      <div className="space-y-2">
        {qs.map((q) => (
          <div key={q.id}>
            <p className="text-[11px] font-semibold text-rl-muted">{t(`roteiros.perguntas.${q.id}.label`)}</p>
            <p className="text-sm text-rl-text">{answers?.[q.id] || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
