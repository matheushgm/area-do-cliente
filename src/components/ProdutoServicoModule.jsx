import { useState, useCallback, useEffect } from 'react'
import { Plus, X, Package, ShoppingBag, Briefcase, CheckCircle2, Sparkles, Loader2, AlertTriangle, Copy, CheckCheck, FileText, HelpCircle, ChevronDown } from 'lucide-react'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import { supabase } from '../lib/supabase'
import ReactMarkdown from 'react-markdown'
import VideoGuide from './VideoGuide'

// ─── System Prompt ─────────────────────────────────────────────────────────────
const SUMMARY_SYSTEM = `Você é um especialista em marketing e estratégia de produto. Sua função é transformar respostas brutas sobre um produto ou serviço em um documento de briefing claro, completo e altamente persuasivo.

O documento gerado deve educar qualquer pessoa envolvida no projeto — gestores de tráfego, designers, copywriters e estrategistas — sobre tudo o que precisam saber para trabalhar com este produto ou serviço.

Gere o documento seguindo EXATAMENTE esta estrutura:

## 📦 O Produto / Serviço

[Descrição clara e objetiva do que é e o que resolve — 2 a 3 parágrafos]

---

## 🎯 Para Quem é Este Produto

[Perfil detalhado do cliente ideal: quando precisa, em que momento da vida, qual dor resolve]

---

## ✨ Transformação: Antes e Depois

**Antes:** [Como é a vida do cliente sem o produto — seja específico e emocional]

**Depois:** [Como é a vida do cliente após usar — resultados concretos e mensuráveis]

---

## 🏆 Por Que Este e Não o do Concorrente

[Diferenciais competitivos claros e específicos — o que ninguém mais faz ou consegue copiar]

---

## 🚧 Objeções e Como Quebrá-las

[Liste as principais objeções com resposta direta para cada uma — formato: **Objeção:** → **Resposta:**]

---

## 📊 Provas e Resultados

[Cases, números, depoimentos, tempo de resultado — tudo que gera credibilidade]

---

## 🔥 Urgência e Escassez

[Por que agora? O que acontece se o cliente esperar? Janelas de oportunidade]

---

## 🛡️ Garantias e Segurança

[Garantias oferecidas e como lidar se der errado]

---

## 💡 Pontos de Atenção para a Equipe

[Insights estratégicos importantes para gestores, designers e copywriters — o que NÃO fazer, tons a evitar, palavras que convertem, etc.]

---

Diretrizes obrigatórias:
- Português brasileiro claro, direto e profissional
- Seja extremamente específico — zero generalidades
- Use os dados fornecidos literalmente sempre que possível
- Não use travessões (—) em nenhuma parte do output
- O documento deve ser acionável: qualquer pessoa que ler deve saber exatamente como comunicar este produto`

// ─── Questions ────────────────────────────────────────────────────────────────
const QUESTIONS = [
  { id: 'q1',  emoji: '🎯', label: 'O que seu produto resolve?' },
  { id: 'q2',  emoji: '⏰', label: 'Por que e em que momento o seu cliente precisa do seu produto/serviço?' },
  { id: 'q3',  emoji: '✨', label: 'Como é a vida dele depois de usar seu produto/serviço?' },
  { id: 'q4',  emoji: '🏆', label: 'Por que vou usar seu produto/serviço e não o do concorrente?' },
  { id: 'q5',  emoji: '🔥', label: 'Por que eu preciso comprar agora?' },
  { id: 'q6',  emoji: '😔', label: 'Como é a vida sem o seu produto/serviço?' },
  { id: 'q7',  emoji: '🚧', label: 'Quais são as principais desculpas que os clientes dão para não comprar?' },
  { id: 'q8',  emoji: '🔄', label: 'Já tentou resolver esse problema de outra forma antes? O que não funcionou?' },
  { id: 'q9',  emoji: '🤔', label: 'O que faz o cliente desconfiar de produtos como o seu?' },
  { id: 'q10', emoji: '📊', label: 'Tem cases de clientes com resultado mensurável?' },
  { id: 'q11', emoji: '⏱️', label: 'Quanto tempo leva para o cliente sentir o primeiro resultado?' },
  { id: 'q12', emoji: '💬', label: 'O que seus clientes mais elogiam espontaneamente?' },
  { id: 'q13', emoji: '💡', label: 'O que você faz que nenhum concorrente faz ou consegue copiar facilmente?' },
  { id: 'q14', emoji: '⚠️', label: 'O que acontece se o cliente esperar mais 3 meses para resolver isso?' },
  { id: 'q15', emoji: '📅', label: 'Existe alguma sazonalidade ou janela de oportunidade no seu mercado?' },
  { id: 'q16', emoji: '🛡️', label: 'Você oferece alguma garantia hoje? Se não, o que te impede?' },
  { id: 'q17', emoji: '🤝', label: 'Se der errado, o que você faz pelo cliente?' },
]

// ─── Questions Help ───────────────────────────────────────────────────────────
const QUESTIONS_HELP = {
  q1: {
    text: 'Descreva o problema principal que o seu produto ou serviço elimina da vida do cliente. Seja objetivo: qual é a dor, a dificuldade ou o incômodo que existia antes e que o seu produto veio resolver? Evite falar sobre funcionalidades ou características técnicas aqui. Foque no problema real que a pessoa tinha.',
    example: '"Meu produto resolve a dificuldade de pequenos empresários em controlar o estoque sem perder tempo com planilhas manuais."',
  },
  q2: {
    text: 'Pense no contexto de vida ou de trabalho do seu cliente. Qual é a situação específica que faz ele perceber que precisa do que você oferece? Existe um gatilho, uma data, uma fase ou um evento que antecede a compra? Quanto mais preciso você for aqui, mais certeiros serão os anúncios.',
    example: '"Ele percebe que precisa quando começa a perder vendas por falta de controle ou quando vai abrir uma segunda unidade."',
  },
  q3: {
    text: 'Descreva a transformação. Como o dia a dia do seu cliente muda depois que ele começa a usar o que você vende? O que ele consegue fazer que antes não conseguia? Como ele se sente? Pense na vida ideal que ele conquista, não nas funções do produto.',
    example: '"Ele consegue ver o estoque em tempo real pelo celular, para de perder vendas e dorme mais tranquilo sabendo que tudo está sob controle."',
  },
  q4: {
    text: 'Quais são os diferenciais reais que separam você da concorrência? Pense em atendimento, metodologia, resultado, prazo, garantia, exclusividade, experiência ou qualquer fator que faz um cliente que pesquisou as opções escolher você. Seja honesto e específico.',
    example: '"Somos os únicos que oferecem implementação em 48h com suporte por WhatsApp incluso no plano básico."',
  },
  q5: {
    text: 'O que cria urgência real na decisão do seu cliente? Pode ser uma janela de oportunidade, um custo crescente de não resolver o problema, uma limitação de vagas ou estoque, uma promoção com prazo ou simplesmente o prejuízo acumulado de adiar. Liste o que você usa ou poderia usar para justificar a compra imediata.',
    example: '"Cada mês sem controle de estoque significa perda média de R$3.000 em mercadoria não rastreada."',
  },
  q6: {
    text: 'Descreva a realidade do cliente antes da sua solução. Quais são as frustrações do dia a dia, os riscos que ele corre, as perdas que ele tem? Seja específico sobre as consequências de não resolver esse problema. Essa resposta é muito importante para criar empatia nos anúncios.',
    example: '"Ele perde tempo recontando estoque manualmente, descobre rupturas tarde demais e perde vendas sem saber exatamente onde está o erro."',
  },
  q7: {
    text: 'Liste as objeções mais comuns que você ouve no momento da venda: preço, tempo, "vou pensar", "não é o momento certo", "já tentei algo assim antes". Cada objeção que você listar vira uma resposta nos nossos anúncios e nas páginas de vendas.',
    example: '"É caro", "Minha equipe não vai adotar", "Agora não é o momento".',
  },
  q8: {
    text: 'Antes de chegar até você, o seu cliente provavelmente tentou outras soluções: planilhas, concorrentes, soluções caseiras, consultores. O que não deu certo? Por quê? Essa informação ajuda a mostrar que você entende a jornada do cliente e que sua solução é diferente do que ele já experimentou.',
    example: '"Já usou planilha no Excel, mas ninguém atualizava. Já contratou um sistema mais barato, mas o suporte era ruim."',
  },
  q9: {
    text: 'Existe algum histórico negativo no seu mercado? Promessas que não foram cumpridas por outros players? Mitos, medos ou preconceitos que fazem o cliente hesitar? Conhecendo essa desconfiança, criamos anúncios que antecipam e quebram essas barreiras antes mesmo do primeiro contato.',
    example: '"Clientes desconfiam porque já viram sistemas que prometem muito e na hora de usar são complicados demais."',
  },
  q10: {
    text: 'Relate resultados reais de clientes, com números sempre que possível. Quanto economizaram? Quanto cresceram? Em quanto tempo? Se tiver depoimentos ou prints de resultados, melhor ainda. Essa é a prova social mais poderosa que existe em anúncios.',
    example: '"A empresa X reduziu em 40% as perdas de estoque em 3 meses. A empresa Y cresceu 25% nas vendas no primeiro trimestre."',
  },
  q11: {
    text: 'Qual é o "tempo até o primeiro ganho"? Pode ser em horas, dias ou semanas. Esse dado é fundamental para reduzir o medo de comprar, porque ninguém quer esperar meses para ver se valeu a pena. Se tiver marcos intermediários de resultado, descreva-os.',
    example: '"Em até 48h após a implementação, o gestor já consegue ver o estoque completo em tempo real pelo app."',
  },
  q12: {
    text: 'Pense nos comentários que você mais ouve no pós-venda, nas avaliações, nas mensagens de WhatsApp. O que os clientes falam quando recomendam você para alguém? Essas palavras são ouro para os nossos anúncios porque são a voz real do seu público.',
    example: '"Facilidade de uso", "Suporte muito rápido", "Finalmente consegui ter controle de verdade".',
  },
  q13: {
    text: 'Aqui buscamos seu diferencial mais profundo: pode ser uma metodologia proprietária, uma combinação única de serviços, uma tecnologia exclusiva, um processo, um time especializado ou até uma posição de mercado difícil de replicar. Seja específico e honesto.',
    example: '"Somos os únicos com integração nativa ao sistema fiscal do cliente, sem necessidade de customização."',
  },
  q14: {
    text: 'Qual é o custo real da inação? Descreva as consequências concretas de postergar a decisão: prejuízos financeiros, problemas que se agravam, oportunidades perdidas, riscos que aumentam. Essa resposta ajuda a criar urgência verdadeira, sem precisar de pressão falsa.',
    example: '"Em 3 meses ele terá perdido em média R$9.000 em rupturas não rastreadas e processado mais uma safra com dado errado."',
  },
  q15: {
    text: 'Há épocas do ano em que a demanda pelo seu produto aumenta ou diminui? Existe alguma data, período ou evento que cria uma janela de oportunidade para comprar? Isso influencia diretamente o calendário das campanhas e as mensagens de urgência que usamos.',
    example: '"O pico de procura é em março, antes do início do segundo semestre. Quem não contrata até fevereiro geralmente espera mais um ano."',
  },
  q16: {
    text: 'Descreva qualquer garantia formal ou informal que você já pratica: devolução do dinheiro, garantia de resultado, período de teste, retrabalho sem custo. Se não oferece nenhuma, explique o que te impede, pois isso pode ser um ponto importante a trabalhar para aumentar a conversão.',
    example: '"Oferecemos 15 dias de teste gratuito sem cartão de crédito e reembolso total em até 30 dias sem questionamentos."',
  },
  q17: {
    text: 'Descreva seu protocolo real quando algo não sai como esperado. O que você faz concretamente para corrigir, compensar ou resolver a situação? Essa resposta mostra responsabilidade e reduz o medo de comprar, especialmente em clientes que já tiveram experiências ruins no passado.',
    example: '"Se o resultado não for alcançado no prazo prometido, refazemos a implementação sem custo adicional e acompanhamos até funcionar."',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return crypto.randomUUID()
}

function newProduto(label = '') {
  return {
    id: uid(),
    nome: label,
    tipo: 'produto',
    answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, ''])),
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ProdutoServicoModule({ project, onSave }) {
  const { updateProject } = useApp()
  const [produtos, setProdutos] = useState(() => {
    return project.produtos?.length ? project.produtos : [newProduto('Produto 1')]
  })
  const [activeIdx, setActiveIdx] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [summary, setSummary] = useState(null)
  const [genError, setGenError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [openHelp, setOpenHelp] = useState(null)

  const produto = produtos[activeIdx]

  // Sync summary display when switching between products
  useEffect(() => {
    setSummary(produto.summary || null)
    setGenError(null)
  }, [activeIdx, produto.id])

  const updateProduto = useCallback((patch) => {
    const next = produtos.map((p, i) => i === activeIdx ? { ...p, ...patch } : p)
    setProdutos(next)
    updateProject(project.id, { produtos: next })
  }, [activeIdx, produtos, project.id, updateProject])

  const updateAnswer = useCallback((qId, value) => {
    const next = produtos.map((p, i) =>
      i === activeIdx ? { ...p, answers: { ...p.answers, [qId]: value } } : p
    )
    setProdutos(next)
    updateProject(project.id, { produtos: next })
  }, [activeIdx, produtos, project.id, updateProject])

  const addProduto = () => {
    const next = newProduto(`Produto ${produtos.length + 1}`)
    setProdutos((prev) => [...prev, next])
    setActiveIdx(produtos.length)
  }

  const removeProduto = (idx) => {
    if (produtos.length === 1) return
    setProdutos((prev) => prev.filter((_, i) => i !== idx))
    setActiveIdx((prev) => Math.min(prev, produtos.length - 2))
  }

  const filledCount = QUESTIONS.filter((q) => produto.answers[q.id]?.trim()).length

  const generateSummary = useCallback(async () => {
    const answered = QUESTIONS.filter((q) => produto.answers[q.id]?.trim())
    if (answered.length < 5) {
      setGenError('Preencha pelo menos 5 perguntas antes de gerar o resumo.')
      return
    }
    setGenerating(true)
    setGenError(null)
    setSummary(null)

    const answersText = QUESTIONS
      .filter((q) => produto.answers[q.id]?.trim())
      .map((q) => `**${q.emoji} ${q.label}**\n${produto.answers[q.id].trim()}`)
      .join('\n\n')

    const instruction = `Produto / Serviço: ${produto.nome || 'Sem nome'}
Tipo: ${produto.tipo === 'servico' ? 'Serviço' : 'Produto Físico'}

${answersText}

Gere o documento de briefing completo baseado nessas informações.`

    try {
      const fullText = await streamClaude({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: SUMMARY_SYSTEM,
        messages: [{ role: 'user', content: instruction }],
        onChunk: (text) => setSummary(text),
      })

      // 1. Update local state + queue debounced Supabase write (normal flow)
      updateProduto({ summary: fullText })

      // 2. Immediate Supabase write — garante que o resumo sobrevive a um refresh
      //    antes do debounce de 1s disparar (delete+insert, mesmo padrão do AppContext)
      if (supabase) {
        const nextProdutos = produtos.map((p, i) =>
          i === activeIdx ? { ...p, summary: fullText } : p
        )
        await supabase.from('produtos').delete().eq('project_id', project.id)
        if (nextProdutos.length > 0) {
          const { error } = await supabase.from('produtos').insert(
            nextProdutos.map((p) => ({
              id:         crypto.randomUUID(),
              project_id: project.id,
              nome:       p.nome    || '',
              tipo:       p.tipo    || 'produto',
              answers:    p.answers || {},
              summary:    p.summary || null,
            }))
          )
          if (error) console.error('[Supabase] generateSummary save:', error.message)
        }
      }
    } catch (err) {
      setGenError(err.message || 'Erro ao gerar resumo. Tente novamente.')
    } finally {
      setGenerating(false)
    }
  }, [produto, updateProduto, produtos, activeIdx, project.id])

  const copySummary = () => {
    if (!summary) return
    navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <Package className="w-5 h-5 text-rl-gold" />
            Produto / Serviço
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            Documente os detalhes do produto ou serviço para embasar anúncios e estratégias
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <AutoSaveIndicator />
          <button
            onClick={generateSummary}
            disabled={generating}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando...</>
              : <><Sparkles className="w-4 h-4 text-rl-gold" />Gerar Resumo</>
            }
          </button>
        </div>
      </div>

      {/* Vídeo guia */}
      <VideoGuide videoId="awwUFJhqHOE" label="Como preencher o módulo de Produto / Serviço" />

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {produtos.map((p, i) => (
          <div key={p.id} className="flex items-center gap-1">
            <button
              onClick={() => setActiveIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeIdx === i
                  ? 'bg-gradient-rl text-white shadow-glow'
                  : 'bg-rl-surface text-rl-muted hover:text-rl-text'
              }`}
            >
              {p.nome || `Produto ${i + 1}`}
            </button>
            {produtos.length > 1 && (
              <button
                onClick={() => removeProduto(i)}
                className="p-1 rounded text-rl-muted/50 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addProduto}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-rl-muted hover:text-rl-text border border-dashed border-rl-border hover:border-rl-gold/40 transition-all"
        >
          <Plus className="w-3 h-3" /> Novo Produto
        </button>
      </div>

      {/* Product form */}
      <div className="space-y-4">

        {/* Name + Type */}
        <div className="glass-card p-5 space-y-4">
          <div>
            <label className="label-field">Nome do Produto / Serviço</label>
            <input
              type="text"
              value={produto.nome}
              onChange={(e) => updateProduto({ nome: e.target.value })}
              placeholder="Ex: Curso Online de Marketing Digital..."
              className="input-field"
            />
          </div>

          {/* Type toggle */}
          <div>
            <label className="label-field mb-2">Tipo</label>
            <div className="flex gap-3">
              <button
                onClick={() => updateProduto({ tipo: 'produto' })}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  produto.tipo === 'produto'
                    ? 'bg-rl-gold/10 border-rl-gold/40 text-rl-gold'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                Produto Físico
              </button>
              <button
                onClick={() => updateProduto({ tipo: 'servico' })}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  produto.tipo === 'servico'
                    ? 'bg-rl-blue/10 border-rl-blue/40 text-rl-blue'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                Serviço
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-rl-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-rl rounded-full transition-all duration-300"
              style={{ width: `${(filledCount / QUESTIONS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-rl-muted shrink-0">{filledCount}/{QUESTIONS.length} perguntas</span>
        </div>

        {/* Questions */}
        {QUESTIONS.map((q, idx) => {
          const help = QUESTIONS_HELP[q.id]
          const isOpen = openHelp === q.id
          return (
            <div key={q.id} className="glass-card p-5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-rl-text leading-snug">
                  <span className="text-rl-muted text-xs mr-2 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="mr-1.5">{q.emoji}</span>
                  {q.label}
                </p>
                {help && (
                  <button
                    onClick={() => setOpenHelp(isOpen ? null : q.id)}
                    className={`shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all ${
                      isOpen
                        ? 'bg-rl-blue/10 border-rl-blue/30 text-rl-blue'
                        : 'border-rl-border text-rl-muted hover:text-rl-blue hover:border-rl-blue/30'
                    }`}
                    title="Ver orientação"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {isOpen && help && (
                <div className="bg-rl-blue/5 border border-rl-blue/15 rounded-xl p-4 space-y-2 text-xs text-rl-text/80 leading-relaxed">
                  <p>{help.text}</p>
                  <p className="text-rl-muted italic border-l-2 border-rl-blue/30 pl-3">
                    <span className="font-semibold text-rl-blue not-italic">Exemplo: </span>
                    {help.example}
                  </p>
                </div>
              )}

              <textarea
                value={produto.answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                placeholder="Digite sua resposta..."
                rows={3}
                className="input-field resize-none text-sm leading-relaxed"
              />
            </div>
          )
        })}
      </div>

      {/* Error */}
      {genError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm">{genError}</p>
        </div>
      )}

      {/* Generated Summary */}
      {(summary || generating) && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-rl-gold" />
              <h3 className="text-sm font-semibold text-rl-text">Briefing do Produto / Serviço</h3>
              {generating && <Loader2 className="w-3.5 h-3.5 animate-spin text-rl-muted" />}
            </div>
            {summary && !generating && (
              <button
                onClick={copySummary}
                className="flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-text transition-colors"
              >
                {copied
                  ? <><CheckCheck className="w-3.5 h-3.5 text-rl-green" />Copiado!</>
                  : <><Copy className="w-3.5 h-3.5" />Copiar</>
                }
              </button>
            )}
          </div>

          <div className="prose prose-sm prose-invert max-w-none text-rl-text leading-relaxed
            [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-rl-text [&_h2]:mt-6 [&_h2]:mb-2
            [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-rl-text
            [&_strong]:text-rl-text [&_hr]:border-rl-border [&_hr]:my-4
            [&_p]:text-sm [&_p]:text-rl-text/90
            [&_ul]:space-y-1 [&_li]:text-sm [&_li]:text-rl-text/90">
            <ReactMarkdown>{summary || ''}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Save */}
      {onSave && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => onSave(produtos)}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Salvar Produtos / Serviços
          </button>
        </div>
      )}
    </div>
  )
}
