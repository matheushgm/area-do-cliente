import { useCallback, useMemo, useState } from 'react'
import {
  Sparkles, Search, Users, Skull, Lightbulb, FileText, CheckSquare,
  Plus, X, ChevronDown, ChevronUp, AlertTriangle, Check, Loader2, RotateCcw,
  Trophy, FileDown, Target,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../hooks/useToast'
import Toast from '../UI/Toast'
import MarkdownBlock from '../Criativos/MarkdownBlock'
import { streamClaude } from '../../lib/claude'
import { buildCachedPayload } from '../../lib/buildContext'
import { exportMecanismoUnicoPDF } from '../../lib/mecanismoUnicoPDF'
import {
  VILOES, TIPOS_PROVA, FORMATOS_NOME, TECNICAS,
  CRITERIOS_VALIDACAO, TESTE_AMIGO,
  countValidacao, vereditoValidacao,
} from './mecanismoUnicoData'

// Estado vazio inicial — usado quando project.mecanismoUnico ainda não existe.
const EMPTY = {
  // Seção 1
  concorrentes: [],
  padroesMercado: [],
  promessasComuns: [],
  // Seção 2
  tentativas: [],
  justificativas: [],
  quase: { conseguiu: '', faltou: '' },
  // Seção 3
  viloes: [],
  vilaoPrincipal: '',
  vilaoJustificativa: '',
  conexao: { vilao: '', problema: '', fracasso: '' },
  provas: [],
  provaTexto: '',
  // Seção 4
  diferentes: [],
  formatoNome: '',
  nomeMecanismo: '',
  tecnicas: {},  // { [techId]: 'texto preenchido' }
  // Seção 5
  euAjudo: '',
  aConseguir: '',
  atravesDo: '',
  porqueFalhou: { problema: '', razao: '', prova: '' },
  porqueFunciona: { explicacao: '', diferente: '', voce: '' },
  promessaPrazo: '',
  promessaResultado: '',
  // Seção 6
  validacao: {},          // { [criterioId]: 'sim' | 'nao' }
  testeAmigo: '',
  // IA
  aiAnalysis: null,        // pitch refinado
  positioningAI: null,      // posicionamento + ângulos alternativos
  updatedAt: null,
}

const SECOES = [
  { id: 'pesquisa',  label: 'Pesquisa de mercado',     Icon: Search,     color: 'rl-blue' },
  { id: 'cliente',   label: 'Mapeamento do cliente',    Icon: Users,      color: 'rl-cyan' },
  { id: 'problema',  label: 'Mecanismo do problema',    Icon: Skull,      color: 'rl-red' },
  { id: 'solucao',   label: 'Mecanismo da solução',     Icon: Lightbulb,  color: 'rl-gold' },
  { id: 'montagem',  label: 'Montagem final',           Icon: FileText,   color: 'rl-purple' },
  { id: 'validacao', label: 'Validação',                Icon: CheckSquare, color: 'rl-green' },
]

export default function MecanismoUnicoModule({ project }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()

  const persisted = project.mecanismoUnico || EMPTY
  const [data, setData] = useState(persisted)
  const [open, setOpen]   = useState({ pesquisa: true })
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

  // ── Montagem final calculada ───────────────────────────────────────────────
  const pitch = useMemo(() => buildPitch(data), [data])

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
- Saída em markdown com \`## Por que falhou\`, \`## Por que vai funcionar\`, \`## Promessa\`.`

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
        pitch || '(monte do zero)',
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
      showToast('Pitch refinado pela IA!')
    } catch (e) {
      console.error('[MecanismoUnico AI]', e)
      showToast('Erro ao gerar com IA. Tente novamente.', 'error')
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

Regras: português brasileiro consultivo, direto, sem jargão vazio. NÃO use travessões (—); use vírgula, dois-pontos ou ponto-final. Cada bloco com substância (não pode ser vazio nem genérico). Se algum dado estiver faltando, assuma o melhor cenário e diga "supondo X".`

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
      showToast('Posicionamento gerado!')
    } catch (e) {
      console.error('[MecanismoUnico positioning]', e)
      showToast('Erro ao gerar posicionamento. Tente novamente.', 'error')
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
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-rl-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-rl-text leading-tight">Mecanismo Único</h2>
          <p className="text-sm text-rl-subtle mt-0.5 max-w-2xl">
            Construa o &ldquo;por que ISSO vai funcionar pra mim&rdquo; que diferencia o cliente de todos os concorrentes. 6 seções guiadas que viram um pitch pronto.
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/30 transition-all shrink-0"
          title="Abre uma janela de impressão com tudo o que foi preenchido"
        >
          <FileDown className="w-3.5 h-3.5" /> Exportar PDF
        </button>
      </div>

      {/* Quote-blocks de introdução */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-rl-red/30 bg-rl-red/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-red mb-1">Parte 1</p>
          <p className="text-sm font-bold text-rl-text">Mecanismo do problema</p>
          <p className="text-xs text-rl-subtle mt-1">Por que falhou até agora</p>
        </div>
        <div className="rounded-xl border border-rl-green/30 bg-rl-green/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-green mb-1">Parte 2</p>
          <p className="text-sm font-bold text-rl-text">Mecanismo da solução</p>
          <p className="text-xs text-rl-subtle mt-1">Por que vai funcionar agora</p>
        </div>
      </div>

      {/* Seções colapsáveis */}
      {SECOES.map((s) => {
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
                <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold">Seção {SECOES.indexOf(s) + 1}</p>
                <h3 className="text-sm font-bold text-rl-text">{s.label}</h3>
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
          <h3 className="text-sm font-bold text-rl-text">Pitch montado (ao vivo)</h3>
          <span className="text-[10px] text-rl-muted ml-auto">atualiza conforme você preenche</span>
        </div>
        {pitch ? (
          <div className="rounded-xl bg-rl-surface/50 border border-rl-border p-4">
            <MarkdownBlock content={pitch} />
          </div>
        ) : (
          <p className="text-sm text-rl-muted text-center py-6 italic">
            Preencha a seção &ldquo;Montagem final&rdquo; pra ver o pitch aparecer aqui.
          </p>
        )}
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {data.aiAnalysis && !aiLoading && (
            <button
              onClick={handleGenerateAI}
              disabled={aiLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Regerar com IA
            </button>
          )}
          {!data.aiAnalysis && (
            <button
              onClick={handleGenerateAI}
              disabled={aiLoading || !pitch}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {aiLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Refinando...</>
                : <><Sparkles className="w-3.5 h-3.5" /> Refinar com IA</>
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
              Pitch refinado pela IA
            </h3>
          </div>
          <div className="border-t border-rl-border/60 pt-4">
            <MarkdownBlock content={aiStreaming || data.aiAnalysis} />
          </div>
        </div>
      )}

      {/* ── Construção de posicionamento com IA ─────────────────────────── */}
      <div className="glass-card p-5 space-y-4 border-2 border-rl-blue/30">
        <div className="flex items-center gap-2 flex-wrap">
          <Target className="w-4 h-4 text-rl-blue" />
          <h3 className="text-sm font-bold text-rl-text">
            Construir posicionamento com IA
          </h3>
          <span className="text-[10px] text-rl-muted ml-auto">
            usa todas as respostas das 6 seções
          </span>
        </div>
        <p className="text-xs text-rl-subtle leading-relaxed">
          A IA analisa tudo que você preencheu e devolve <strong>um posicionamento principal recomendado</strong>, com justificativa, mais 2-3 <strong>ângulos alternativos</strong> pra você testar e os próximos passos pra validar.
        </p>

        {!data.positioningAI && !posLoading && (
          <button
            onClick={handleGeneratePositioning}
            disabled={posLoading}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-rl-blue text-white shadow-glow hover:bg-rl-blue/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Target className="w-4 h-4" /> Construir posicionamento
          </button>
        )}

        {(posLoading || posStreaming) && (
          <div className="rounded-xl bg-rl-surface/50 border border-rl-blue/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Loader2 className="w-4 h-4 text-rl-blue animate-spin" />
              <span className="text-xs font-semibold text-rl-blue">Construindo posicionamento...</span>
            </div>
            {posStreaming && <MarkdownBlock content={posStreaming} />}
          </div>
        )}

        {data.positioningAI && !posLoading && (
          <>
            <div className="rounded-xl bg-rl-blue/5 border border-rl-blue/20 p-4">
              <MarkdownBlock content={data.positioningAI} />
            </div>
            <div className="flex items-center justify-end">
              <button
                onClick={handleGeneratePositioning}
                disabled={posLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Regerar
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
  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-rl-subtle italic">
        Antes de criar o mecanismo, entenda o que o mercado já oferece.
      </p>

      <DynamicTable
        title="Seus concorrentes"
        hint="Liste 3-5 concorrentes diretos e o que cada um entrega."
        columns={[
          { id: 'nome',   label: 'Concorrente', placeholder: 'Ex: Fulano' },
          { id: 'oferta', label: 'O que oferece', placeholder: 'Ex: Curso online + comunidade' },
        ]}
        rows={data.concorrentes}
        onChange={(rows) => set('concorrentes', rows)}
      />

      <DynamicStringList
        title="O que é padrão no mercado?"
        hint="O que todo mundo oferece igual (calls semanais, método em X passos, suporte WhatsApp...)"
        placeholder="Ex: Calls semanais"
        items={data.padroesMercado}
        onChange={(items) => set('padroesMercado', items)}
      />

      <DynamicStringList
        title="Promessas que todo mundo faz"
        hint='Frases batidas que você vê em todo lugar do seu nicho.'
        placeholder='Ex: "Escale seu faturamento"'
        items={data.promessasComuns}
        onChange={(items) => set('promessasComuns', items)}
      />

      <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-gold/5 border border-rl-gold/30">
        <AlertTriangle className="w-4 h-4 text-rl-gold mt-0.5 shrink-0" />
        <p className="text-xs text-rl-text leading-snug">
          <strong>Alerta:</strong> se você oferece as mesmas coisas que listou acima, você é igual aos outros. Use isso pra criar contraste nas próximas seções.
        </p>
      </div>
    </div>
  )
}

// ─── Seção 2: Mapeamento do cliente ───────────────────────────────────────────
function SecaoCliente({ data, set }) {
  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-rl-subtle italic">
        Entenda o que seu cliente já tentou e por que ele acha que não funcionou.
      </p>

      <DynamicTable
        title="O que ele já tentou antes de você?"
        hint=""
        columns={[
          { id: 'tentou',    label: 'O que tentou',  placeholder: 'Ex: Curso online' },
          { id: 'resultado', label: 'Resultado',     placeholder: 'Ex: Não aplicou' },
        ]}
        rows={data.tentativas}
        onChange={(rows) => set('tentativas', rows)}
      />

      <DynamicStringList
        title="Por que ELE acha que não funcionou?"
        hint='Use as palavras dele (não as suas). Ex: "Não tive tempo de aplicar"'
        placeholder='Ex: "Era muito complexo"'
        items={data.justificativas}
        onChange={(items) => set('justificativas', items)}
      />
    </div>
  )
}

// ─── Seção 3: Mecanismo do problema ───────────────────────────────────────────
function SecaoProblema({ data, set, setNested }) {
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
          <strong>Regra de ouro:</strong> o cliente NUNCA é culpado. A culpa é de algo que ele NÃO SABIA.
        </p>
      </div>

      <div>
        <Label>Passo 1 — Escolha o vilão</Label>
        <p className="text-[11px] text-rl-muted mb-2">Quem ou o que você pode culpar pelo fracasso?</p>
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
          <Field label="Meu vilão principal">
            <input
              type="text"
              value={data.vilaoPrincipal || ''}
              onChange={(e) => set('vilaoPrincipal', e.target.value)}
              placeholder="Resuma em uma frase"
              className="input-field w-full"
            />
          </Field>
          <Field label="Por que isso é vilão?">
            <input
              type="text"
              value={data.vilaoJustificativa || ''}
              onChange={(e) => set('vilaoJustificativa', e.target.value)}
              placeholder="A razão lógica"
              className="input-field w-full"
            />
          </Field>
        </div>
      </div>

      <div>
        <Label>Passo 2 — Conexão lógica</Label>
        <p className="text-[11px] text-rl-muted mb-2">
          [VILÃO] → causou [PROBLEMA] → que levou a [FRACASSO]
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={data.conexao?.vilao || ''}
            onChange={(e) => setNested('conexao', 'vilao', e.target.value)}
            placeholder="Vilão"
            className="input-field w-full"
          />
          <input
            type="text"
            value={data.conexao?.problema || ''}
            onChange={(e) => setNested('conexao', 'problema', e.target.value)}
            placeholder="Problema causado"
            className="input-field w-full"
          />
          <input
            type="text"
            value={data.conexao?.fracasso || ''}
            onChange={(e) => setNested('conexao', 'fracasso', e.target.value)}
            placeholder="Fracasso final"
            className="input-field w-full"
          />
        </div>
      </div>

      <div>
        <Label>Passo 3 — A prova</Label>
        <p className="text-[11px] text-rl-muted mb-2">
          Qual tipo de prova torna sua explicação crível?
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
          placeholder='Ex: "9 em cada 10 scripts da internet foram escritos por quem nunca vendeu acima de R$5.000"'
          className="input-field w-full resize-none"
        />
      </div>
    </div>
  )
}

// ─── Seção 4: Mecanismo da solução ────────────────────────────────────────────
function SecaoSolucao({ data, set, setNested }) {
  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-rl-subtle italic">
        Agora explique por que SEU método vai funcionar.
      </p>

      <DynamicTable
        title="Passo 1 — Defina o que é diferente"
        hint='Complete: "Diferente de... eu..."'
        columns={[
          { id: 'deles', label: 'Diferente de...', placeholder: 'Ex: cursos que dão teoria' },
          { id: 'voce',  label: 'Eu...',          placeholder: 'Ex: implemento do seu lado' },
        ]}
        rows={data.diferentes}
        onChange={(rows) => set('diferentes', rows)}
      />

      <div>
        <Label>Passo 2 — Dê um nome ao mecanismo</Label>
        <p className="text-[11px] text-rl-muted mb-2">Escolha um formato pro nome:</p>
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
                <div className="text-[10px] text-rl-muted">Ex: {f.exemplo}</div>
              </button>
            )
          })}
        </div>
        <Field label="Nome final do mecanismo">
          <input
            type="text"
            value={data.nomeMecanismo || ''}
            onChange={(e) => set('nomeMecanismo', e.target.value)}
            placeholder='Ex: "Método do Closer Interno"'
            className="input-field w-full"
            maxLength={80}
          />
        </Field>
      </div>

      <div>
        <Label>Passo 3 — Explique por que funciona</Label>
        <p className="text-[11px] text-rl-muted mb-2">Use uma ou mais técnicas:</p>
        <div className="space-y-3">
          {TECNICAS.map((t) => (
            <div key={t.id}>
              <p className="text-[11px] font-bold text-rl-text mb-1">{t.label}</p>
              <textarea
                value={(data.tecnicas || {})[t.id] || ''}
                onChange={(e) => setNested('tecnicas', t.id, e.target.value)}
                rows={2}
                placeholder={t.placeholder}
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
  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-rl-subtle italic">
        Junte tudo no esqueleto do pitch final.
      </p>

      <div className="space-y-3">
        <Field label="Eu ajudo:">
          <textarea
            value={data.euAjudo || ''}
            onChange={(e) => set('euAjudo', e.target.value)}
            rows={2}
            placeholder="Ex: Donos de agências que faturam entre R$50k e R$200k/mês e ainda são o principal vendedor"
            className="input-field w-full resize-none"
          />
        </Field>
        <Field label="A conseguir:">
          <textarea
            value={data.aConseguir || ''}
            onChange={(e) => set('aConseguir', e.target.value)}
            rows={2}
            placeholder="Ex: Contratar o primeiro closer que bate meta em 45 dias sem o dono participar"
            className="input-field w-full resize-none"
          />
        </Field>
        <Field label="Através do (nome do mecanismo):">
          <input
            type="text"
            value={data.atravesDo || data.nomeMecanismo || ''}
            onChange={(e) => set('atravesDo', e.target.value)}
            placeholder={data.nomeMecanismo || 'Ex: Método do Closer Interno'}
            className="input-field w-full"
          />
        </Field>
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <Label>Parte 1 — Por que falhou até agora</Label>
        <div className="space-y-2 mt-2">
          <textarea
            value={data.porqueFalhou?.problema || ''}
            onChange={(e) => setNested('porqueFalhou', 'problema', e.target.value)}
            rows={2}
            placeholder="Você não conseguiu... até agora porque..."
            className="input-field w-full resize-none"
          />
          <textarea
            value={data.porqueFalhou?.razao || ''}
            onChange={(e) => setNested('porqueFalhou', 'razao', e.target.value)}
            rows={2}
            placeholder="Isso acontece porque..."
            className="input-field w-full resize-none"
          />
          <textarea
            value={data.porqueFalhou?.prova || ''}
            onChange={(e) => setNested('porqueFalhou', 'prova', e.target.value)}
            rows={2}
            placeholder="[PROVA]: ..."
            className="input-field w-full resize-none"
          />
        </div>
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <Label>Parte 2 — Por que vai funcionar</Label>
        <div className="space-y-2 mt-2">
          <textarea
            value={data.porqueFunciona?.explicacao || ''}
            onChange={(e) => setNested('porqueFunciona', 'explicacao', e.target.value)}
            rows={2}
            placeholder="O [NOME DO MECANISMO]... funciona porque..."
            className="input-field w-full resize-none"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <textarea
              value={data.porqueFunciona?.diferente || ''}
              onChange={(e) => setNested('porqueFunciona', 'diferente', e.target.value)}
              rows={2}
              placeholder="Diferente de..."
              className="input-field w-full resize-none"
            />
            <textarea
              value={data.porqueFunciona?.voce || ''}
              onChange={(e) => setNested('porqueFunciona', 'voce', e.target.value)}
              rows={2}
              placeholder="...eu..."
              className="input-field w-full resize-none"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <Label>Promessa final</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <Field label="Em (prazo)">
            <input
              type="text"
              value={data.promessaPrazo || ''}
              onChange={(e) => set('promessaPrazo', e.target.value)}
              placeholder="Ex: 45 dias"
              className="input-field w-full"
            />
          </Field>
          <Field label="...você terá">
            <input
              type="text"
              value={data.promessaResultado || ''}
              onChange={(e) => set('promessaResultado', e.target.value)}
              placeholder="Ex: seu closer batendo meta sem você"
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
  function setCriterio(id, val) {
    set('validacao', { ...(data.validacao || {}), [id]: val })
  }

  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-rl-subtle italic">
        Marque cada critério. Mecanismo aprovado quando responder SIM em todos os 7.
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
                  Sim
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
                  Não
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
          Veredito ({count}/7)
        </p>
        <p className="text-sm font-bold" style={{ color: veredito.color }}>
          {veredito.label}
        </p>
      </div>

      <div>
        <Label>Teste do amigo</Label>
        <p className="text-[11px] text-rl-muted mb-2">
          Imagina contar o mecanismo pra um amigo no bar. Qual seria a reação?
        </p>
        <div className="space-y-2">
          {TESTE_AMIGO.map((t) => {
            const active = data.testeAmigo === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => set('testeAmigo', active ? '' : t.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${
                  active
                    ? t.id === 'aprovado'
                      ? 'bg-rl-green/10 border-rl-green/50 text-rl-green'
                      : 'bg-rl-red/10 border-rl-red/50 text-rl-red'
                    : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <span className="text-sm">{t.label}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  active
                    ? t.id === 'aprovado' ? 'text-rl-green' : 'text-rl-red'
                    : 'text-rl-muted'
                }`}>
                  → {t.resultado}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Building blocks reutilizáveis ────────────────────────────────────────────

function Label({ children }) {
  return (
    <p className="text-[11px] uppercase tracking-wider font-bold text-rl-text mb-1">
      {children}
    </p>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-rl-text mb-1">{label}</p>
      {children}
    </div>
  )
}

// Lista dinâmica de strings simples (adicionar / remover)
function DynamicStringList({ title, hint, placeholder, items = [], onChange }) {
  const [draft, setDraft] = useState('')

  function add() {
    const t = draft.trim()
    if (!t) return
    onChange([...(items || []), t])
    setDraft('')
  }

  function remove(i) {
    const next = [...items]
    next.splice(i, 1)
    onChange(next)
  }

  return (
    <div>
      <Label>{title}</Label>
      {hint && <p className="text-[11px] text-rl-muted mb-2">{hint}</p>}
      <div className="space-y-1.5">
        {(items || []).map((it, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rl-surface/60 border border-rl-border">
            <span className="text-sm text-rl-text flex-1">{it}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-1 text-rl-muted hover:text-red-400 transition-colors"
              aria-label="Remover"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder={placeholder}
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-rl-purple text-white hover:bg-rl-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

// Tabela dinâmica: cada row tem N colunas. Add row / remove row.
function DynamicTable({ title, hint, columns = [], rows = [], onChange }) {
  function add() {
    const empty = Object.fromEntries(columns.map((c) => [c.id, '']))
    onChange([...(rows || []), { id: crypto.randomUUID(), ...empty }])
  }

  function update(idx, colId, val) {
    const next = [...rows]
    next[idx] = { ...next[idx], [colId]: val }
    onChange(next)
  }

  function remove(idx) {
    const next = [...rows]
    next.splice(idx, 1)
    onChange(next)
  }

  return (
    <div>
      <Label>{title}</Label>
      {hint && <p className="text-[11px] text-rl-muted mb-2">{hint}</p>}
      <div className="space-y-2">
        {(rows || []).map((row, i) => (
          <div key={row.id || i} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) auto` }}>
            {columns.map((c) => (
              <input
                key={c.id}
                type="text"
                value={row[c.id] || ''}
                onChange={(e) => update(i, c.id, e.target.value)}
                placeholder={c.placeholder || c.label}
                className="input-field w-full"
              />
            ))}
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-2 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
              aria-label="Remover linha"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-dashed border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar linha
        </button>
      </div>
    </div>
  )
}

// ─── Pitch builder ────────────────────────────────────────────────────────────
function buildPitch(d) {
  const parts = []
  const header = [
    d.euAjudo ? `**Eu ajudo:** ${d.euAjudo}` : null,
    d.aConseguir ? `**A conseguir:** ${d.aConseguir}` : null,
    (d.atravesDo || d.nomeMecanismo) ? `**Através do:** ${d.atravesDo || d.nomeMecanismo}` : null,
  ].filter(Boolean).join('\n\n')
  if (header) parts.push(header)

  const falhou = [
    d.porqueFalhou?.problema,
    d.porqueFalhou?.razao,
    d.porqueFalhou?.prova,
  ].filter(Boolean).join(' ')
  if (falhou) parts.push(`## Por que falhou até agora\n\n${falhou}`)

  const funcionaParts = [
    d.porqueFunciona?.explicacao,
    (d.porqueFunciona?.diferente || d.porqueFunciona?.voce)
      ? `Diferente de ${d.porqueFunciona?.diferente || '...'}, ${d.porqueFunciona?.voce || '...'}.`
      : null,
  ].filter(Boolean).join(' ')
  if (funcionaParts) parts.push(`## Por que vai funcionar\n\n${funcionaParts}`)

  if (d.promessaPrazo || d.promessaResultado) {
    parts.push(`## Promessa\n\nEm ${d.promessaPrazo || '__'}, ${d.promessaResultado || '__'}.`)
  }

  return parts.join('\n\n')
}
