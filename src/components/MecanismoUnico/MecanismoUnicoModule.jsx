import { useCallback, useMemo, useState } from 'react'
import {
  Sparkles, Search, Users, Skull, Lightbulb, FileText, CheckSquare,
  ChevronDown, ChevronUp, AlertTriangle, Check, Loader2, RotateCcw,
  Trophy, FileDown, Target, LayoutList, Footprints, Link2,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../hooks/useToast'
import Toast from '../UI/Toast'
import MarkdownView from '../Editor/MarkdownView'
import TextoEditavelIA from '../Editor/TextoEditavelIA'
import { streamClaude } from '../../lib/claude'
import { buildCachedPayload } from '../../lib/buildContext'
import { exportMecanismoUnicoPDF } from '../../lib/mecanismoUnicoPDF'
import VideoGuide from '../VideoGuide'
import {
  VILOES, TIPOS_PROVA, FORMATOS_NOME, TECNICAS,
  CRITERIOS_VALIDACAO, TESTE_AMIGO,
  countValidacao, vereditoValidacao,
} from './mecanismoUnicoData'
import { hydrateMecanismo, buildPitch } from './mecanismoShared'
import { Label, Field, DynamicStringList, DynamicTable } from './Fields'
import MecanismoWizardShell from './MecanismoWizardShell'
import { StepPitchPreview } from './WizardSteps'
import { useI18n } from '../../i18n'
import { instrucaoDeIdioma } from '../../lib/claude'

// Rótulo = mecanismo.secoes.<id>, traduzido no render.
const SECOES = [
  { id: 'pesquisa',  Icon: Search,     color: 'rl-blue' },
  { id: 'cliente',   Icon: Users,      color: 'rl-cyan' },
  { id: 'problema',  Icon: Skull,      color: 'rl-red' },
  { id: 'solucao',   Icon: Lightbulb,  color: 'rl-gold' },
  { id: 'montagem',  Icon: FileText,   color: 'rl-purple' },
  { id: 'validacao', Icon: CheckSquare, color: 'rl-green' },
]

export default function MecanismoUnicoModule({ project }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()
  const { t, lang } = useI18n()

  const [data, setData] = useState(() => hydrateMecanismo(project.mecanismoUnico))
  const [open, setOpen]   = useState({ pesquisa: true })
  const [view, setView]   = useState('guiado')   // 'guiado' | 'secoes'
  const [linkCopied, setLinkCopied] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStreaming, setAiStreaming] = useState('')
  const [posLoading, setPosLoading] = useState(false)
  const [posStreaming, setPosStreaming] = useState('')

  // Persiste cada mudança via updateProject (já tem debounce 1s)
  const persist = useCallback((next) => {
    const withTimestamp = { ...next, updatedAt: new Date().toISOString() }
    setData(withTimestamp)
    updateProject(project.id, { mecanismoUnico: withTimestamp })
  }, [project.id, updateProject])

  const set = (field, val) => persist({ ...data, [field]: val })
  const setNested = (parent, field, val) => persist({
    ...data,
    [parent]: { ...(data[parent] || {}), [field]: val },
  })

  // ── Toggle de seção ────────────────────────────────────────────────────────
  function toggle(id) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Link público — mesmo clientShareToken dos outros módulos ───────────────
  function copyClientLink() {
    let token = project.clientShareToken
    if (!token) {
      token = crypto.randomUUID()
      updateProject(project.id, { clientShareToken: token })
    }
    navigator.clipboard.writeText(`${window.location.origin}/mecanismo/${token}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }

  // ── Montagem final calculada ───────────────────────────────────────────────
  // lang nas dependências: os rótulos do pitch seguem o idioma da tela.
  const pitch = useMemo(() => buildPitch(data), [data, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── IA: refina o pitch ─────────────────────────────────────────────────────
  async function handleGenerateAI() {
    setAiLoading(true)
    setAiStreaming('')
    try {
      const SYSTEM = `Você é um especialista em posicionamento e diferenciação de negócios usando a metodologia de Mecanismo Único da XPN Digital.

Receberá os dados preenchidos no playbook do cliente + um pitch montado. Sua tarefa: polir o pitch final em português brasileiro persuasivo, mantendo a estrutura em 3 blocos:

1. **Por que falhou até agora** — culpa o vilão (não o cliente), faz a conexão lógica e cita a prova
2. **Por que vai funcionar** — apresenta o mecanismo nomeado, explica a diferença, usa as técnicas escolhidas
3. **Promessa final** — prazo + resultado tangível

Regras:
- Não use travessões (—). Use vírgulas, dois-pontos ou ponto-final.
- Conversational, direto, sem jargão vazio.
- Cada bloco com 2-4 frases.
- Saída em markdown com \`## Por que falhou\`, \`## Por que vai funcionar\`, \`## Promessa\`.` + instrucaoDeIdioma({ rotulos: true })

      const instruction = [
        '## Dados preenchidos no playbook',
        '',
        `Concorrentes mapeados: ${(data.concorrentes || []).map(c => `${c.nome}: ${c.oferta}`).join(' · ') || '(vazio)'}`,
        `Padrões do mercado: ${(data.padroesMercado || []).join(', ') || '(vazio)'}`,
        `Promessas comuns: ${(data.promessasComuns || []).join(', ') || '(vazio)'}`,
        '',
        `Já tentou antes: ${(data.tentativas || []).map(t => `${t.tentou} → ${t.resultado}`).join(' · ') || '(vazio)'}`,
        `Justificativas do cliente: ${(data.justificativas || []).join(' · ') || '(vazio)'}`,
        '',
        `Vilão principal: ${data.vilaoPrincipal || '(vazio)'}`,
        `Por que é vilão: ${data.vilaoJustificativa || '(vazio)'}`,
        `Conexão lógica: ${data.conexao?.vilao || '?'} → ${data.conexao?.problema || '?'} → ${data.conexao?.fracasso || '?'}`,
        `Prova: ${data.provaTexto || '(vazio)'}`,
        '',
        `Diferenciais: ${(data.diferentes || []).map(d => `diferente de ${d.deles}, eu ${d.voce}`).join(' · ') || '(vazio)'}`,
        `Nome do mecanismo: ${data.nomeMecanismo || '(vazio)'}`,
        ...Object.entries(data.tecnicas || {}).map(([k, v]) => `Técnica ${k}: ${v}`),
        '',
        `Eu ajudo: ${data.euAjudo || '(vazio)'}`,
        `A conseguir: ${data.aConseguir || '(vazio)'}`,
        `Através do: ${data.atravesDo || data.nomeMecanismo || '(vazio)'}`,
        `Promessa: em ${data.promessaPrazo || '?'}, ${data.promessaResultado || '?'}`,
        '',
        '## Pitch montado automaticamente (use como base, mas refine)',
        '',
        buildPitch(data, { pt: true }) || '(monte do zero)',
        '',
        'Refine seguindo o formato do system. Mantenha tudo verdadeiro com base nos dados.',
      ].join('\n')

      const { system, messages } = buildCachedPayload({
        systemPrompt: SYSTEM,
        project,
        instruction,
      })
      const fullText = await streamClaude({
        model:      'claude-sonnet-4-5',
        max_tokens: 3000,
        system,
        messages,
        onChunk:    (text) => setAiStreaming(text),
      })
      persist({ ...data, aiAnalysis: fullText })
      showToast(t('mecanismo.toast.pitchRefinado'))
    } catch (e) {
      console.error('[MecanismoUnico AI]', e)
      showToast(t('mecanismo.toast.erroIA'), 'error')
    } finally {
      setAiLoading(false)
      setAiStreaming('')
    }
  }

  // ── IA: constrói posicionamento + ângulos alternativos ────────────────────
  async function handleGeneratePositioning() {
    setPosLoading(true)
    setPosStreaming('')
    try {
      const SYSTEM = `Você é um estrategista sênior de posicionamento de marca. Receberá todas as informações que o time da Revenue Lab levantou sobre um cliente — pesquisa de mercado, mapeamento do cliente, mecanismo do problema, mecanismo da solução e a montagem inicial do pitch.

Sua tarefa: construir UM posicionamento principal recomendado, bem fundamentado e diferenciado, e em seguida sugerir 2-3 ângulos alternativos de posicionamento que o time pode considerar.

Formato OBRIGATÓRIO (markdown):

## Posicionamento principal recomendado
Uma sentença de posicionamento (10-20 palavras), seguida de 2-3 parágrafos justificando POR QUE esse é o ângulo mais forte com base nos dados.

## Por que esse posicionamento funciona
3-4 bullets ligando o posicionamento aos dados (vilão, diferenciais, público, mercado).

## Ângulos alternativos a considerar
2-3 alternativas, cada uma com:
- **Nome do ângulo** — sentença de posicionamento (10-15 palavras)
- Quando faz sentido: 1 frase
- Risco/limitação: 1 frase

## Próximos passos pra validar
3 ações concretas pra testar o posicionamento principal nos próximos 30 dias.

Regras: português brasileiro consultivo, direto, sem jargão vazio. NÃO use travessões (—); use vírgula, dois-pontos ou ponto-final. Cada bloco com substância (não pode ser vazio nem genérico). Se algum dado estiver faltando, assuma o melhor cenário e diga "supondo X".` + instrucaoDeIdioma({ rotulos: true })

      const instruction = [
        '## Pesquisa de mercado',
        `Concorrentes: ${(data.concorrentes || []).map(c => `${c.nome}: ${c.oferta}`).join(' · ') || '(vazio)'}`,
        `Padrões do mercado: ${(data.padroesMercado || []).join(', ') || '(vazio)'}`,
        `Promessas comuns: ${(data.promessasComuns || []).join(', ') || '(vazio)'}`,
        '',
        '## Mapeamento do cliente',
        `Tentou antes: ${(data.tentativas || []).map(t => `${t.tentou} → ${t.resultado}`).join(' · ') || '(vazio)'}`,
        `Justificativas do cliente: ${(data.justificativas || []).join(' · ') || '(vazio)'}`,
        '',
        '## Mecanismo do problema',
        `Vilão principal: ${data.vilaoPrincipal || '(vazio)'}`,
        `Por que é vilão: ${data.vilaoJustificativa || '(vazio)'}`,
        `Conexão lógica: ${data.conexao?.vilao || '?'} → ${data.conexao?.problema || '?'} → ${data.conexao?.fracasso || '?'}`,
        `Prova: ${data.provaTexto || '(vazio)'}`,
        '',
        '## Mecanismo da solução',
        `Diferenciais: ${(data.diferentes || []).map(d2 => `diferente de ${d2.deles}, eu ${d2.voce}`).join(' · ') || '(vazio)'}`,
        `Nome do mecanismo: ${data.nomeMecanismo || '(vazio)'}`,
        ...Object.entries(data.tecnicas || {}).filter(([, v]) => v).map(([k, v]) => `Técnica ${k}: ${v}`),
        '',
        '## Pitch montado',
        `Eu ajudo: ${data.euAjudo || '(vazio)'}`,
        `A conseguir: ${data.aConseguir || '(vazio)'}`,
        `Através do: ${data.atravesDo || data.nomeMecanismo || '(vazio)'}`,
        `Promessa: em ${data.promessaPrazo || '?'}, ${data.promessaResultado || '?'}`,
        '',
        'Construa o posicionamento principal + 2-3 ângulos alternativos seguindo o formato pedido no system.',
      ].join('\n')

      const { system, messages } = buildCachedPayload({
        systemPrompt: SYSTEM,
        project,
        instruction,
      })
      const fullText = await streamClaude({
        model:      'claude-sonnet-4-5',
        max_tokens: 4000,
        system,
        messages,
        onChunk:    (text) => setPosStreaming(text),
      })
      persist({ ...data, positioningAI: fullText })
      showToast(t('mecanismo.toast.posGerado'))
    } catch (e) {
      console.error('[MecanismoUnico positioning]', e)
      showToast(t('mecanismo.toast.erroPos'), 'error')
    } finally {
      setPosLoading(false)
      setPosStreaming('')
    }
  }

  // ── PDF export ────────────────────────────────────────────────────────────
  function handleExportPDF() {
    exportMecanismoUnicoPDF({ project, mecanismoUnico: data })
  }

  const validacaoCount = countValidacao(data.validacao)
  const veredito = vereditoValidacao(data.validacao)

  return (
    <div className="space-y-6">
      <VideoGuide
        videoId="DIftYYJlf_g"
        label={t('mecanismo.videoGuia')}
        defaultOpen
      />

      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-rl-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-rl-text leading-tight">{t('mecanismo.titulo')}</h2>
          <p className="text-sm text-rl-subtle mt-0.5 max-w-2xl">
            {t('mecanismo.descricao')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copyClientLink}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/30 transition-all"
            title={t('mecanismo.linkTitle')}
          >
            {linkCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Link2 className="w-3.5 h-3.5" />}
            {linkCopied ? t('mecanismo.linkCopiado') : t('mecanismo.linkCliente')}
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/30 transition-all"
            title={t('mecanismo.pdfTitle')}
          >
            <FileDown className="w-3.5 h-3.5" /> {t('mecanismo.exportarPdf')}
          </button>
        </div>
      </div>

      {/* Seletor de visão — guiado (passo-a-passo) ou seções (tudo na tela) */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-rl-surface border border-rl-border w-fit">
        {[
          { id: 'guiado', label: t('mecanismo.visoes.guiado'), Icon: Footprints, hint: t('mecanismo.visoes.guiadoHint') },
          { id: 'secoes', label: t('mecanismo.visoes.secoes'), Icon: LayoutList, hint: t('mecanismo.visoes.secoesHint') },
        ].map((v) => {
          const active = view === v.id
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              title={v.hint}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all ${
                active ? 'bg-rl-purple text-white' : 'text-rl-muted hover:text-rl-text'
              }`}
            >
              <v.Icon className="w-3.5 h-3.5" /> {v.label}
            </button>
          )
        })}
      </div>

      {/* Quote-blocks de introdução */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-rl-red/30 bg-rl-red/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-red mb-1">{t('mecanismo.parte', { n: 1 })}</p>
          <p className="text-sm font-bold text-rl-text">{t('mecanismo.secoes.problema')}</p>
          <p className="text-xs text-rl-subtle mt-1">{t('mecanismo.parte1Desc')}</p>
        </div>
        <div className="rounded-xl border border-rl-green/30 bg-rl-green/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-green mb-1">{t('mecanismo.parte', { n: 2 })}</p>
          <p className="text-sm font-bold text-rl-text">{t('mecanismo.secoes.solucao')}</p>
          <p className="text-xs text-rl-subtle mt-1">{t('mecanismo.parte2Desc')}</p>
        </div>
      </div>

      {/* Visão guiada — wizard passo-a-passo (mesma trilha do link do cliente) */}
      {view === 'guiado' && (
        <MecanismoWizardShell
          data={data}
          set={set}
          setNested={setNested}
          finalContent={<StepPitchPreview data={data} />}
          finalFooter={
            <button
              onClick={() => setView('secoes')}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <LayoutList className="w-4 h-4" /> {t('mecanismo.verTudo')}
            </button>
          }
        />
      )}

      {/* Seções colapsáveis */}
      {view === 'secoes' && SECOES.map((s) => {
        const isOpen = !!open[s.id]
        const Icon = s.Icon
        return (
          <div key={s.id} className="glass-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(s.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-rl-surface/40 transition-colors text-left"
            >
              <div className={`w-9 h-9 rounded-xl bg-${s.color}/10 flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 text-${s.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold">{t('mecanismo.secao', { n: SECOES.indexOf(s) + 1 })}</p>
                <h3 className="text-sm font-bold text-rl-text">{t(`mecanismo.secoes.${s.id}`)}</h3>
              </div>
              {isOpen
                ? <ChevronUp className="w-4 h-4 text-rl-muted" />
                : <ChevronDown className="w-4 h-4 text-rl-muted" />
              }
            </button>
            {isOpen && (
              <div className="px-5 pb-5 border-t border-rl-border/60">
                {s.id === 'pesquisa'  && <SecaoPesquisa  data={data} set={set} />}
                {s.id === 'cliente'   && <SecaoCliente   data={data} set={set} />}
                {s.id === 'problema'  && <SecaoProblema  data={data} set={set} setNested={setNested} />}
                {s.id === 'solucao'   && <SecaoSolucao   data={data} set={set} setNested={setNested} />}
                {s.id === 'montagem'  && <SecaoMontagem  data={data} set={set} setNested={setNested} pitch={pitch} />}
                {s.id === 'validacao' && <SecaoValidacao data={data} set={set} count={validacaoCount} veredito={veredito} />}
              </div>
            )}
          </div>
        )
      })}

      {/* Pitch ao vivo (sempre visível abaixo) */}
      <div className="glass-card p-5 border-2 border-rl-purple/30 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-rl-gold" />
          <h3 className="text-sm font-bold text-rl-text">{t('mecanismo.pitchAoVivo')}</h3>
          <span className="text-[10px] text-rl-muted ml-auto">{t('mecanismo.pitchAtualiza')}</span>
        </div>
        {pitch ? (
          <div className="rounded-xl bg-rl-surface/50 border border-rl-border p-4">
            <MarkdownView content={pitch} />
          </div>
        ) : (
          <p className="text-sm text-rl-muted text-center py-6 italic">
            {t('mecanismo.pitchVazio')}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {data.aiAnalysis && !aiLoading && (
            <button
              onClick={handleGenerateAI}
              disabled={aiLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {t('mecanismo.regerarIA')}
            </button>
          )}
          {!data.aiAnalysis && (
            <button
              onClick={handleGenerateAI}
              disabled={aiLoading || !pitch}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {aiLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('mecanismo.refinando')}</>
                : <><Sparkles className="w-3.5 h-3.5" /> {t('mecanismo.refinarIA')}</>
              }
            </button>
          )}
        </div>
      </div>

      {/* IA result (pitch refinado) */}
      {(data.aiAnalysis || aiStreaming) && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            {aiLoading
              ? <Loader2 className="w-4 h-4 text-rl-purple animate-spin" />
              : <Sparkles className="w-4 h-4 text-rl-purple" />
            }
            <h3 className="text-sm font-bold text-rl-text">
              {t('mecanismo.pitchRefinado')}
            </h3>
          </div>
          <div className="border-t border-rl-border/60 pt-4">
            {aiLoading ? (
              <MarkdownView content={aiStreaming} />
            ) : (
              <TextoEditavelIA
                valor={data.aiAnalysis}
                onSalvar={(md) => persist({ ...data, aiAnalysis: md })}
                project={project}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Construção de posicionamento com IA ─────────────────────────── */}
      <div className="glass-card p-5 space-y-4 border-2 border-rl-blue/30">
        <div className="flex items-center gap-2 flex-wrap">
          <Target className="w-4 h-4 text-rl-blue" />
          <h3 className="text-sm font-bold text-rl-text">
            {t('mecanismo.posTitulo')}
          </h3>
          <span className="text-[10px] text-rl-muted ml-auto">
            {t('mecanismo.posUsa')}
          </span>
        </div>
        <p className="text-xs text-rl-subtle leading-relaxed">
          {t('mecanismo.posDesc1')}<strong>{t('mecanismo.posDescPrincipal')}</strong>{t('mecanismo.posDesc2')}<strong>{t('mecanismo.posDescAngulos')}</strong>{t('mecanismo.posDesc3')}
        </p>

        {!data.positioningAI && !posLoading && (
          <button
            onClick={handleGeneratePositioning}
            disabled={posLoading}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-rl-blue text-white shadow-glow hover:bg-rl-blue/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Target className="w-4 h-4" /> {t('mecanismo.construirPos')}
          </button>
        )}

        {(posLoading || posStreaming) && (
          <div className="rounded-xl bg-rl-surface/50 border border-rl-blue/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Loader2 className="w-4 h-4 text-rl-blue animate-spin" />
              <span className="text-xs font-semibold text-rl-blue">{t('mecanismo.construindoPos')}</span>
            </div>
            {posStreaming && <MarkdownView content={posStreaming} />}
          </div>
        )}

        {data.positioningAI && !posLoading && (
          <>
            <div className="rounded-xl bg-rl-blue/5 border border-rl-blue/20 p-4">
              <TextoEditavelIA
                valor={data.positioningAI}
                onSalvar={(md) => persist({ ...data, positioningAI: md })}
                project={project}
              />
            </div>
            <div className="flex items-center justify-end">
              <button
                onClick={handleGeneratePositioning}
                disabled={posLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" /> {t('mecanismo.regerar')}
              </button>
            </div>
          </>
        )}
      </div>

      <Toast toast={toast} />
    </div>
  )
}

// ─── Seção 1: Pesquisa de mercado ─────────────────────────────────────────────
function SecaoPesquisa({ data, set }) {
  const { t } = useI18n()
  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-rl-subtle italic">
        {t('mecanismo.pesquisaIntro')}
      </p>

      <DynamicTable
        title={t('mecanismoPassos.campos.seusConcorrentes')}
        hint={t('mecanismo.pesquisaConcorrentesHint')}
        columns={[
          { id: 'nome',   label: t('mecanismoPassos.campos.concorrente'), placeholder: t('mecanismoPassos.campos.concorrentePh') },
          { id: 'oferta', label: t('mecanismoPassos.campos.oQueOferece'), placeholder: t('mecanismoPassos.campos.oQueOferecePh') },
        ]}
        rows={data.concorrentes}
        onChange={(rows) => set('concorrentes', rows)}
      />

      <DynamicStringList
        title={t('mecanismoPassos.campos.padraoMercado')}
        hint={t('mecanismo.pesquisaPadraoHint')}
        placeholder={t('mecanismoPassos.campos.padraoMercadoPh')}
        items={data.padroesMercado}
        onChange={(items) => set('padroesMercado', items)}
      />

      <DynamicStringList
        title={t('mecanismoPassos.campos.promessasComuns')}
        hint={t('mecanismoPassos.campos.promessasComunsHint')}
        placeholder={t('mecanismoPassos.campos.promessasComunsPh')}
        items={data.promessasComuns}
        onChange={(items) => set('promessasComuns', items)}
      />

      <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-gold/5 border border-rl-gold/30">
        <AlertTriangle className="w-4 h-4 text-rl-gold mt-0.5 shrink-0" />
        <p className="text-xs text-rl-text leading-snug">
          <strong>{t('mecanismoPassos.campos.alerta')}</strong> {t('mecanismo.pesquisaAlerta')}
        </p>
      </div>
    </div>
  )
}

// ─── Seção 2: Mapeamento do cliente ───────────────────────────────────────────
function SecaoCliente({ data, set }) {
  const { t } = useI18n()
  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-rl-subtle italic">
        {t('mecanismo.clienteIntro')}
      </p>

      <DynamicTable
        title={t('mecanismoPassos.campos.jaTentou')}
        hint=""
        columns={[
          { id: 'tentou',    label: t('mecanismoPassos.campos.oQueTentou'), placeholder: t('mecanismoPassos.campos.oQueTentouPh') },
          { id: 'resultado', label: t('mecanismoPassos.campos.resultado'), placeholder: t('mecanismoPassos.campos.resultadoPh') },
        ]}
        rows={data.tentativas}
        onChange={(rows) => set('tentativas', rows)}
      />

      <DynamicStringList
        title={t('mecanismoPassos.campos.porqueNaoFuncionou')}
        hint={t('mecanismo.clienteJustificativasHint')}
        placeholder={t('mecanismoPassos.campos.porqueNaoFuncionouPh')}
        items={data.justificativas}
        onChange={(items) => set('justificativas', items)}
      />
    </div>
  )
}

// ─── Seção 3: Mecanismo do problema ───────────────────────────────────────────
function SecaoProblema({ data, set, setNested }) {
  const { t } = useI18n()
  const viloesSelected = new Set(data.viloes || [])
  const provasSelected = new Set(data.provas || [])

  function toggleVilao(id) {
    const next = new Set(viloesSelected)
    next.has(id) ? next.delete(id) : next.add(id)
    set('viloes', [...next])
  }

  function toggleProva(id) {
    const next = new Set(provasSelected)
    next.has(id) ? next.delete(id) : next.add(id)
    set('provas', [...next])
  }

  return (
    <div className="space-y-5 pt-4">
      <div className="p-3 rounded-xl bg-rl-purple/5 border border-rl-purple/30">
        <p className="text-xs text-rl-text">
          <strong>{t('mecanismoPassos.campos.regraDeOuro')}</strong> {t('mecanismo.problemaRegra')}
        </p>
      </div>

      <div>
        <Label>{t('mecanismo.problemaPasso1')}</Label>
        <p className="text-[11px] text-rl-muted mb-2">{t('mecanismoPassos.campos.quemCulpar')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VILOES.map((v) => {
            const checked = viloesSelected.has(v.id)
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggleVilao(v.id)}
                className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all flex items-center gap-2 ${
                  checked
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                  checked ? 'border-rl-purple bg-rl-purple' : 'border-rl-border'
                }`}>
                  {checked && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span>{v.label}</span>
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <Field label={t('mecanismoPassos.campos.vilaoPrincipal')}>
            <input
              type="text"
              value={data.vilaoPrincipal || ''}
              onChange={(e) => set('vilaoPrincipal', e.target.value)}
              placeholder={t('mecanismoPassos.campos.vilaoPrincipalPh')}
              className="input-field w-full"
            />
          </Field>
          <Field label={t('mecanismoPassos.campos.porqueVilao')}>
            <input
              type="text"
              value={data.vilaoJustificativa || ''}
              onChange={(e) => set('vilaoJustificativa', e.target.value)}
              placeholder={t('mecanismoPassos.campos.porqueVilaoPh')}
              className="input-field w-full"
            />
          </Field>
        </div>
      </div>

      <div>
        <Label>{t('mecanismo.problemaPasso2')}</Label>
        <p className="text-[11px] text-rl-muted mb-2">
          {t('mecanismoPassos.campos.cadeia')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={data.conexao?.vilao || ''}
            onChange={(e) => setNested('conexao', 'vilao', e.target.value)}
            placeholder={t('mecanismoPassos.campos.vilao')}
            className="input-field w-full"
          />
          <input
            type="text"
            value={data.conexao?.problema || ''}
            onChange={(e) => setNested('conexao', 'problema', e.target.value)}
            placeholder={t('mecanismoPassos.campos.problemaCausado')}
            className="input-field w-full"
          />
          <input
            type="text"
            value={data.conexao?.fracasso || ''}
            onChange={(e) => setNested('conexao', 'fracasso', e.target.value)}
            placeholder={t('mecanismoPassos.campos.fracassoFinal')}
            className="input-field w-full"
          />
        </div>
      </div>

      <div>
        <Label>{t('mecanismo.problemaPasso3')}</Label>
        <p className="text-[11px] text-rl-muted mb-2">
          {t('mecanismoPassos.campos.qualProva')}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          {TIPOS_PROVA.map((p) => {
            const checked = provasSelected.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProva(p.id)}
                className={`text-center px-2 py-2 rounded-lg border text-[11px] font-semibold transition-all ${
                  checked
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <textarea
          value={data.provaTexto || ''}
          onChange={(e) => set('provaTexto', e.target.value)}
          rows={2}
          placeholder={t('mecanismoPassos.campos.provaPh')}
          className="input-field w-full resize-none"
        />
      </div>
    </div>
  )
}

// ─── Seção 4: Mecanismo da solução ────────────────────────────────────────────
function SecaoSolucao({ data, set, setNested }) {
  const { t } = useI18n()
  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-rl-subtle italic">
        {t('mecanismo.solucaoIntro')}
      </p>

      <DynamicTable
        title={t('mecanismo.solucaoPasso1')}
        hint={t('mecanismoPassos.campos.completeDiferente')}
        columns={[
          { id: 'deles', label: t('mecanismoPassos.campos.diferenteDe'), placeholder: t('mecanismoPassos.campos.diferenteDePh') },
          { id: 'voce',  label: t('mecanismoPassos.campos.eu'), placeholder: t('mecanismoPassos.campos.euPh') },
        ]}
        rows={data.diferentes}
        onChange={(rows) => set('diferentes', rows)}
      />

      <div>
        <Label>{t('mecanismo.solucaoPasso2')}</Label>
        <p className="text-[11px] text-rl-muted mb-2">{t('mecanismo.solucaoFormato')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          {FORMATOS_NOME.map((f) => {
            const active = data.formatoNome === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => set('formatoNome', active ? '' : f.id)}
                className={`text-left px-3 py-2 rounded-xl border text-xs transition-all ${
                  active
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <div className="font-bold">{f.label}</div>
                <div className="text-[10px] text-rl-muted">{t('mecanismoPassos.campos.exemploCurto', { texto: f.exemplo })}</div>
              </button>
            )
          })}
        </div>
        <Field label={t('mecanismoPassos.campos.nomeFinal')}>
          <input
            type="text"
            value={data.nomeMecanismo || ''}
            onChange={(e) => set('nomeMecanismo', e.target.value)}
            placeholder={t('mecanismoPassos.campos.nomeFinalPh')}
            className="input-field w-full"
            maxLength={80}
          />
        </Field>
      </div>

      <div>
        <Label>{t('mecanismo.solucaoPasso3')}</Label>
        <p className="text-[11px] text-rl-muted mb-2">{t('mecanismo.solucaoTecnicas')}</p>
        <div className="space-y-3">
          {TECNICAS.map((tc) => (
            <div key={tc.id}>
              <p className="text-[11px] font-bold text-rl-text mb-1">{tc.label}</p>
              <textarea
                value={(data.tecnicas || {})[tc.id] || ''}
                onChange={(e) => setNested('tecnicas', tc.id, e.target.value)}
                rows={2}
                placeholder={tc.placeholder}
                className="input-field w-full resize-none"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Seção 5: Montagem final ──────────────────────────────────────────────────
function SecaoMontagem({ data, set, setNested }) {
  const { t } = useI18n()
  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-rl-subtle italic">
        {t('mecanismo.montagemIntro')}
      </p>

      <div className="space-y-3">
        <Field label={t('mecanismoPassos.campos.euAjudo')}>
          <textarea
            value={data.euAjudo || ''}
            onChange={(e) => set('euAjudo', e.target.value)}
            rows={2}
            placeholder={t('mecanismoPassos.campos.euAjudoPh')}
            className="input-field w-full resize-none"
          />
        </Field>
        <Field label={t('mecanismoPassos.campos.aConseguir')}>
          <textarea
            value={data.aConseguir || ''}
            onChange={(e) => set('aConseguir', e.target.value)}
            rows={2}
            placeholder={t('mecanismoPassos.campos.aConseguirPh')}
            className="input-field w-full resize-none"
          />
        </Field>
        <Field label={t('mecanismoPassos.campos.atravesDo')}>
          <input
            type="text"
            value={data.atravesDo || data.nomeMecanismo || ''}
            onChange={(e) => set('atravesDo', e.target.value)}
            placeholder={data.nomeMecanismo || t('mecanismoPassos.campos.atravesDoPh')}
            className="input-field w-full"
          />
        </Field>
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <Label>{t('mecanismoPassos.campos.parte1')}</Label>
        <div className="space-y-2 mt-2">
          <textarea
            value={data.porqueFalhou?.problema || ''}
            onChange={(e) => setNested('porqueFalhou', 'problema', e.target.value)}
            rows={2}
            placeholder={t('mecanismoPassos.campos.falhouProblemaPh')}
            className="input-field w-full resize-none"
          />
          <textarea
            value={data.porqueFalhou?.razao || ''}
            onChange={(e) => setNested('porqueFalhou', 'razao', e.target.value)}
            rows={2}
            placeholder={t('mecanismoPassos.campos.falhouRazaoPh')}
            className="input-field w-full resize-none"
          />
          <textarea
            value={data.porqueFalhou?.prova || ''}
            onChange={(e) => setNested('porqueFalhou', 'prova', e.target.value)}
            rows={2}
            placeholder={t('mecanismoPassos.campos.falhouProvaPh')}
            className="input-field w-full resize-none"
          />
        </div>
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <Label>{t('mecanismoPassos.campos.parte2')}</Label>
        <div className="space-y-2 mt-2">
          <textarea
            value={data.porqueFunciona?.explicacao || ''}
            onChange={(e) => setNested('porqueFunciona', 'explicacao', e.target.value)}
            rows={2}
            placeholder={t('mecanismoPassos.campos.funcionaExplicacaoPh')}
            className="input-field w-full resize-none"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <textarea
              value={data.porqueFunciona?.diferente || ''}
              onChange={(e) => setNested('porqueFunciona', 'diferente', e.target.value)}
              rows={2}
              placeholder={t('mecanismoPassos.campos.funcionaDiferentePh')}
              className="input-field w-full resize-none"
            />
            <textarea
              value={data.porqueFunciona?.voce || ''}
              onChange={(e) => setNested('porqueFunciona', 'voce', e.target.value)}
              rows={2}
              placeholder={t('mecanismoPassos.campos.funcionaVocePh')}
              className="input-field w-full resize-none"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <Label>{t('mecanismoPassos.campos.promessaFinal')}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <Field label={t('mecanismoPassos.campos.prazo')}>
            <input
              type="text"
              value={data.promessaPrazo || ''}
              onChange={(e) => set('promessaPrazo', e.target.value)}
              placeholder={t('mecanismoPassos.campos.prazoPh')}
              className="input-field w-full"
            />
          </Field>
          <Field label={t('mecanismoPassos.campos.resultadoPromessa')}>
            <input
              type="text"
              value={data.promessaResultado || ''}
              onChange={(e) => set('promessaResultado', e.target.value)}
              placeholder={t('mecanismoPassos.campos.resultadoPromessaPh')}
              className="input-field w-full"
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

// ─── Seção 6: Validação ───────────────────────────────────────────────────────
function SecaoValidacao({ data, set, count, veredito }) {
  const { t } = useI18n()
  function setCriterio(id, val) {
    set('validacao', { ...(data.validacao || {}), [id]: val })
  }

  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-rl-subtle italic">
        {t('mecanismo.validacaoIntro')}
      </p>

      <div className="space-y-2">
        {CRITERIOS_VALIDACAO.map((c, i) => {
          const cur = (data.validacao || {})[c.id]
          return (
            <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-rl-surface/40 border border-rl-border/60">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-rl-text">
                  {i + 1}. {c.label} <span className="text-rl-muted font-normal">— {c.desc}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setCriterio(c.id, cur === 'sim' ? '' : 'sim')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                    cur === 'sim'
                      ? 'bg-rl-green/15 border border-rl-green/40 text-rl-green'
                      : 'bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text'
                  }`}
                >
                  {t('mecanismoPassos.campos.sim')}
                </button>
                <button
                  type="button"
                  onClick={() => setCriterio(c.id, cur === 'nao' ? '' : 'nao')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                    cur === 'nao'
                      ? 'bg-rl-red/15 border border-rl-red/40 text-rl-red'
                      : 'bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text'
                  }`}
                >
                  {t('mecanismoPassos.campos.nao')}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="rounded-xl p-4 border-l-4"
        style={{
          background: `${veredito.color}10`,
          borderLeftColor: veredito.color,
        }}
      >
        <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: veredito.color }}>
          {t('mecanismoPassos.campos.veredito', { count })}
        </p>
        <p className="text-sm font-bold" style={{ color: veredito.color }}>
          {veredito.label}
        </p>
      </div>

      <div>
        <Label>{t('mecanismoPassos.campos.testeAmigo')}</Label>
        <p className="text-[11px] text-rl-muted mb-2">
          {t('mecanismoPassos.campos.testeAmigoHint')}
        </p>
        <div className="space-y-2">
          {TESTE_AMIGO.map((ta) => {
            const active = data.testeAmigo === ta.id
            return (
              <button
                key={ta.id}
                type="button"
                onClick={() => set('testeAmigo', active ? '' : ta.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${
                  active
                    ? ta.id === 'aprovado'
                      ? 'bg-rl-green/10 border-rl-green/50 text-rl-green'
                      : 'bg-rl-red/10 border-rl-red/50 text-rl-red'
                    : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <span className="text-sm">{ta.label}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  active
                    ? ta.id === 'aprovado' ? 'text-rl-green' : 'text-rl-red'
                    : 'text-rl-muted'
                }`}>
                  → {ta.resultado}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
