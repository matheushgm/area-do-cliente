import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppSidebar from '../components/AppSidebar'
import MarkdownBlock from '../components/Criativos/MarkdownBlock'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { streamClaude } from '../lib/claude'
import {
  Clapperboard, Menu, Sparkles, Loader2, Wand2, Lock,
  Package, Users, RotateCcw, AlertTriangle, CheckCircle2, PenLine, Send,
} from 'lucide-react'

// ─── Persistência local (ferramenta global, fora de projeto) ──────────────────
const STORAGE_KEY = 'rl_roteiros_express_v1'

// ─── Perguntas do questionário (5 produto + 5 cliente) ────────────────────────
const PRODUTO_QS = [
  { id: 'p1', label: 'O que você vende?', hint: 'Produto ou serviço, em poucas palavras.', ph: 'Ex.: Curso online de confeitaria para iniciantes' },
  { id: 'p2', label: 'Qual a maior transformação que você entrega?', hint: 'O resultado real que o cliente alcança.', ph: 'Ex.: Sair do zero e vender o primeiro bolo em 30 dias' },
  { id: 'p3', label: 'O que te diferencia dos concorrentes?', hint: 'Seu diferencial ou mecanismo único.', ph: 'Ex.: Método com receitas testadas e suporte no WhatsApp' },
  { id: 'p4', label: 'Qual a sua oferta ou condição especial?', hint: 'Garantia, frete grátis, desconto, bônus...', ph: 'Ex.: 7 dias de garantia + 3 ebooks de bônus' },
  { id: 'p5', label: 'Qual ação a pessoa deve tomar?', hint: 'A chamada para ação (CTA) do anúncio.', ph: 'Ex.: Chamar no WhatsApp para garantir a vaga' },
]

const CLIENTE_QS = [
  { id: 'c1', label: 'Quem é o seu cliente ideal?', hint: 'Idade, gênero, profissão, contexto.', ph: 'Ex.: Mulheres de 30 a 45 anos que querem renda extra em casa' },
  { id: 'c2', label: 'Qual a maior dor dele hoje?', hint: 'O problema que mais incomoda.', ph: 'Ex.: Está endividada e sem tempo para um emprego fixo' },
  { id: 'c3', label: 'Qual o maior sonho ou desejo dele?', hint: 'Ligado ao que você vende.', ph: 'Ex.: Ter o próprio negócio e liberdade financeira' },
  { id: 'c4', label: 'Qual a principal objeção ou medo?', hint: 'O que o impede de comprar.', ph: 'Ex.: Acha que é difícil e que não tem talento para isso' },
  { id: 'c5', label: 'Como ele costuma comprar?', hint: 'Online, loja física, indicação...', ph: 'Ex.: Compra pelo celular, descobre coisas no Instagram' },
]

const ALL_QS = [...PRODUTO_QS, ...CLIENTE_QS]
const EMPTY_ANSWERS = Object.fromEntries(ALL_QS.map((q) => [q.id, '']))

// Delimitador que a IA usa para separar os 2 roteiros (some no display)
const SPLIT = '[[ROTEIRO]]'

// ─── System prompts (metodologia Laboratório de Anúncios) ─────────────────────
const SYSTEM_GERAR = `Você é um especialista em roteiros de vídeos de anúncios online de alta conversão, usando a estrutura do Laboratório de Anúncios (Revenue Lab). Os vídeos têm 30 a 60 segundos e rodam no Meta Ads (Reels/Feed) e YouTube Ads.

A partir das informações de produto e de cliente fornecidas, crie EXATAMENTE 2 roteiros de vídeo altamente persuasivos, prontos para o cliente usar como anúncio. Use ganchos e etapas de funil DIFERENTES entre os dois (ex.: um para quem ainda não tem consciência do problema e outro para quem já busca uma solução).

Cada roteiro segue a ESTRUTURA DO LABORATÓRIO DE ANÚNCIOS (4 etapas):

## ROTEIRO [N]: Gancho [Tipo] | [Etapa do Funil]

**GANCHO (0s - 3s):**
[frase exata, disruptiva e contra-intuitiva, que para o scroll nos 3 primeiros segundos e conversa direto com o público]

**MENSAGEM (3s - 45s):**
[narração que leva o público do Ponto A ao Ponto B, mostrando o sonho, reduzindo a percepção de dificuldade, o tempo e o sacrifício para alcançá-lo. Integre a quebra das objeções de forma natural, nunca como um bloco separado]

**CTA FINAL (45s - 60s):**
[reforça a promessa do gancho + um motivo claro de urgência ou escassez + a ação exata que a pessoa deve tomar]

**📝 LEGENDA DO POST:** [legenda curta com emojis para acompanhar o vídeo]

Regras críticas:
- O GANCHO precisa quebrar o padrão nos PRIMEIROS 3 SEGUNDOS. Seja contra-intuitivo e específico ao público.
- A quebra de objeções deve estar INTEGRADA à mensagem, nunca isolada.
- O CTA deve reforçar a promessa e ter um gatilho de urgência ou escassez específico.
- Português brasileiro conversacional, direto e energético. Fale com "você".
- Seja específico ao negócio informado, nunca genérico.
- NÃO use travessões (—) em nenhuma parte do roteiro.
- NÃO inclua sugestões de cena ou direção visual.
- NÃO use emojis no corpo do roteiro — use emojis apenas na LEGENDA DO POST.
- Gere APENAS os 2 roteiros, sem introdução, sem tabelas e sem comentários ao final.
- Separe os 2 roteiros com uma linha contendo exatamente: ${SPLIT}`

const SYSTEM_REFINAR = `Você é um especialista em roteiros de vídeos de anúncios de alta conversão (Laboratório de Anúncios / Revenue Lab).

Você vai receber um roteiro já pronto e um pedido de ajuste do usuário. Reescreva o roteiro COMPLETO aplicando o pedido, mantendo a mesma estrutura:

## ROTEIRO: Gancho [Tipo] | [Etapa do Funil]
**GANCHO (0s - 3s):** ...
**MENSAGEM (3s - 45s):** ...
**CTA FINAL (45s - 60s):** ...
**📝 LEGENDA DO POST:** ...

Regras:
- Mantenha o gancho forte nos 3 primeiros segundos e a quebra de objeções integrada à mensagem.
- Português brasileiro conversacional, persuasivo e específico ao negócio.
- NÃO use travessões (—). NÃO inclua sugestões de cena. Emojis apenas na legenda.
- Devolva APENAS o roteiro reescrito, sem comentários antes ou depois.`

function buildUserBrief(answers) {
  const linhas = (qs) => qs.map((q, i) => `${i + 1}. ${q.label} ${answers[q.id]?.trim() || '(não informado)'}`).join('\n')
  return `## PRODUTO / SERVIÇO
${linhas(PRODUTO_QS)}

## CLIENTE / PÚBLICO-ALVO
${linhas(CLIENTE_QS)}

Com base nisso, gere os 2 roteiros de vídeo seguindo a estrutura do Laboratório de Anúncios.`
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function RoteirosExpress() {
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [answers, setAnswers] = useState(EMPTY_ANSWERS)
  const [scripts, setScripts] = useState([]) // [{ content, refineUsed }]
  const [step, setStep] = useState('form') // 'form' | 'result'

  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState(null)

  // refino por card
  const [refiningIdx, setRefiningIdx] = useState(null)
  const [refineNote, setRefineNote] = useState('')
  const [refineStream, setRefineStream] = useState('')

  // ── Carregar/salvar estado local ───────────────────────────────────────────
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

  const allFilled = useMemo(() => ALL_QS.every((q) => (answers[q.id] || '').trim()), [answers])

  const setAnswer = useCallback((id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }, [])

  // ── Gerar os 2 roteiros ────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!allFilled || loading) return
    setLoading(true)
    setError(null)
    setStreamingText('')
    setStep('result')
    try {
      const fullText = await streamClaude({
        model: 'claude-sonnet-4-5',
        max_tokens: 8000,
        system: SYSTEM_GERAR,
        messages: [{ role: 'user', content: buildUserBrief(answers) }],
        onChunk: (t) => setStreamingText(t.replace(/—/g, '-')),
      })
      const clean = fullText.replace(/—/g, '-')
      const parts = clean
        .split(SPLIT)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 2)
      const finalParts = parts.length ? parts : [clean.trim()]
      setScripts(finalParts.map((content) => ({ content, refineUsed: false })))
    } catch (e) {
      setError(e.message || 'Erro ao gerar os roteiros.')
      setStep('form')
    } finally {
      setLoading(false)
      setStreamingText('')
    }
  }, [allFilled, answers, loading])

  // ── Refinar um roteiro (1x por roteiro) ────────────────────────────────────
  const startRefine = (idx) => {
    setRefiningIdx(idx)
    setRefineNote('')
    setRefineStream('')
  }

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
        system: SYSTEM_REFINAR,
        messages: [{
          role: 'user',
          content: `## ROTEIRO ORIGINAL\n\n${original}\n\n## PEDIDO DE REFINAMENTO\n\n${note}`,
        }],
        onChunk: (t) => setRefineStream(t.replace(/—/g, '-')),
      })
      const clean = fullText.replace(/—/g, '-').trim()
      setScripts((prev) => prev.map((s, i) => (i === idx ? { content: clean, refineUsed: true } : s)))
      setRefiningIdx(null)
      setRefineNote('')
      setRefineStream('')
      showToast('Roteiro refinado!')
    } catch (e) {
      setError(e.message || 'Erro ao refinar o roteiro.')
    } finally {
      setLoading(false)
    }
  }, [refineNote, scripts, loading, showToast])

  // ── Recomeçar (limpa tudo) ─────────────────────────────────────────────────
  const reset = () => {
    if (!window.confirm('Começar um novo roteiro? Isto vai limpar as respostas e os 2 roteiros atuais.')) return
    setAnswers(EMPTY_ANSWERS)
    setScripts([])
    setStep('form')
    setError(null)
    setRefiningIdx(null)
    setRefineNote('')
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
  }

  return (
    <div className="min-h-screen flex bg-gradient-dark">
      <AppSidebar
        filter="roteiros"
        setFilter={() => navigate('/')}
        counts={{}}
        activeAccounts={[]}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu de navegação"
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
              <Clapperboard className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-rl-text text-sm">Roteiros Express</span>
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
                  <h1 className="text-xl font-bold text-rl-text">Roteiros Express</h1>
                  <p className="text-sm text-rl-muted">
                    Responda 10 perguntas rápidas e a IA cria 2 roteiros de vídeo prontos para anunciar.
                  </p>
                </div>
              </div>
              {step === 'result' && (
                <button
                  onClick={reset}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Novo roteiro
                </button>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* ── Etapa: formulário ───────────────────────────── */}
            {step === 'form' && (
              <>
                <QuestionGroup
                  Icon={Package}
                  title="Sobre o produto ou serviço"
                  questions={PRODUTO_QS}
                  answers={answers}
                  onChange={setAnswer}
                />
                <QuestionGroup
                  Icon={Users}
                  title="Sobre o seu cliente"
                  questions={CLIENTE_QS}
                  answers={answers}
                  onChange={setAnswer}
                />

                <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                  <p className="text-xs text-rl-muted">
                    {allFilled
                      ? 'Tudo preenchido. Gere seus 2 roteiros.'
                      : 'Preencha as 10 perguntas para liberar a geração.'}
                  </p>
                  <button
                    onClick={generate}
                    disabled={!allFilled || loading}
                    className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Gerar meus 2 roteiros
                  </button>
                </div>
              </>
            )}

            {/* ── Etapa: resultado ────────────────────────────── */}
            {step === 'result' && (
              <div className="space-y-5">
                {/* Streaming inicial (antes de partir em cards) */}
                {loading && scripts.length === 0 && (
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-3 text-rl-purple">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-wider">Escrevendo seus roteiros...</span>
                    </div>
                    <MarkdownBlock content={streamingText || 'Analisando o público e montando os ganchos...'} />
                  </div>
                )}

                {scripts.map((script, idx) => {
                  const isRefiningThis = refiningIdx === idx
                  const showStream = loading && isRefiningThis && refineStream
                  return (
                    <div key={idx} className="glass-card p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full text-rl-purple bg-rl-purple/10 border border-rl-purple/30">
                          <Clapperboard className="w-3 h-3" /> ROTEIRO {idx + 1}
                        </span>
                        {script.refineUsed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rl-green">
                            <CheckCircle2 className="w-3 h-3" /> Refinado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rl-muted">
                            <Wand2 className="w-3 h-3" /> 1 refinamento disponível
                          </span>
                        )}
                      </div>

                      <MarkdownBlock content={showStream ? refineStream : script.content} />

                      {/* Refino */}
                      {!script.refineUsed && !loading && (
                        isRefiningThis ? (
                          <div className="rounded-xl border border-rl-purple/30 bg-rl-purple/5 p-3 space-y-2">
                            <label className="text-[11px] font-bold text-rl-text flex items-center gap-1.5">
                              <PenLine className="w-3.5 h-3.5 text-rl-purple" />
                              O que você quer ajustar neste roteiro?
                            </label>
                            <textarea
                              autoFocus
                              value={refineNote}
                              onChange={(e) => setRefineNote(e.target.value)}
                              rows={3}
                              placeholder="Ex.: deixe o gancho mais agressivo e cite o preço promocional."
                              className="input-field w-full text-sm resize-none"
                            />
                            <p className="text-[10px] text-rl-muted">
                              Atenção: você tem apenas <strong>1 refinamento</strong> por roteiro.
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => applyRefine(idx)}
                                disabled={!refineNote.trim()}
                                className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5 disabled:opacity-50"
                              >
                                <Send className="w-3.5 h-3.5" /> Aplicar refinamento
                              </button>
                              <button
                                onClick={() => { setRefiningIdx(null); setRefineNote('') }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => startRefine(idx)}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all"
                          >
                            <Wand2 className="w-3.5 h-3.5" /> Refinar este roteiro
                          </button>
                        )
                      )}

                      {script.refineUsed && (
                        <div className="flex items-center gap-1.5 text-[11px] text-rl-muted">
                          <Lock className="w-3 h-3" /> Refinamento já utilizado neste roteiro.
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
    </div>
  )
}

// ─── Grupo de perguntas ───────────────────────────────────────────────────────
function QuestionGroup({ Icon, title, questions, answers, onChange }) {
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
              <span className="text-rl-purple mr-1">{i + 1}.</span>{q.label}
            </label>
            {q.hint && <p className="text-[11px] text-rl-muted mb-1.5">{q.hint}</p>}
            <textarea
              value={answers[q.id]}
              onChange={(e) => onChange(q.id, e.target.value)}
              rows={2}
              placeholder={q.ph}
              className="input-field w-full text-sm resize-none"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
