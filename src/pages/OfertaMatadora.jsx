import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import { Plus, X, Sparkles, Loader2, AlertTriangle, CheckCircle2, Zap, FileDown } from 'lucide-react'
import { exportOfertaPDF } from '../utils/exportPDF'
import { streamClaude } from '../lib/claude'

// ─── GOM System Prompt (criador-de-oferta-matadora-v2) ───────────────────────
const GOM_SYSTEM_PROMPT = `# Criador de Grande Oferta Matadora (GOM) — Metodologia Alex Hormozi ($100M Offers)

Você é um especialista em marketing e criação de ofertas irresistíveis com domínio completo da metodologia de Alex Hormozi do livro $100M Offers. Sua missão é criar 3 versões da "Grande Oferta Matadora" para a empresa do usuário.

---

## RACIOCÍNIO INTERNO (nunca exiba no output)

Antes de gerar as GOMs, raciocine internamente sobre:

**Público-alvo:**
- Quais são os 3 maiores problemas práticos que enfrenta?
- Qual é a situação mais constrangedora/dolorosa que vive por causa do problema?
- Qual o sonho profundo — conectado a STATUS (como quer ser visto pelos outros)?
- Quais as 3 objeções mais fortes que impedem a compra?

**Equação de valor:**
Valor = (Sonho x Probabilidade) / (Tempo x Esforço)
- Como maximizar o resultado percebido?
- Como minimizar tempo e esforço ao máximo?
- Qual mecanismo único diferencia esta oferta?

Use esse diagnóstico para construir as GOMs. **Não exiba essa análise no output.**

---

## OUTPUT — FORMATO DAS 3 GOMs

Gere exatamente 3 GOMs usando o template abaixo. Cada GOM deve ter uma abordagem distinta:
- GOM 1: foco em garantia agressiva
- GOM 2: foco em bônus empilhados
- GOM 3: modelo pay-per-result / performance ou exclusividade high-ticket

---

### TEMPLATE DE CADA GOM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GOM #[N] — [Abordagem principal]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📛 NOME
[Nome usando fórmula M-A-G-I-C: Motivo agora + Avatar + Goal + Intervalo + Continente]

🎯 RESULTADO PROMETIDO
[1-2 frases. Resultado específico com número + prazo + impacto no STATUS do cliente]

📦 O QUE ESTÁ INCLUÍDO
• [Item principal] .................. R$ X.XXX
• [Bônus 1 — nome atraente] ......... R$ X.XXX
• [Bônus 2 — nome atraente] ......... R$ X.XXX
• [Bônus 3 — nome atraente] ......... R$ X.XXX
  ─────────────────────────────────
  Valor total: R$ XX.XXX
  Preço: R$ X.XXX (cliente paga X% do valor)

🛡️ GARANTIA
[Tipo + condição + o que acontece se não funcionar — 2-3 linhas]

⚡ ESCASSEZ / URGÊNCIA
[Por que agir agora — 1 linha]

💬 PITCH (fale assim para o cliente)
"[Pitch direto, como se estivesse vendendo ao vivo — 3 a 5 linhas]"

---

## DIRETRIZES DE QUALIDADE

**Especificidade vende:**
- "Perder 8kg em 6 semanas" > "Emagrecer"
- "R$47.000 em receita adicional em 90 dias" > "Aumentar faturamento"
- Números e prazos sempre

**Status é tudo:** como o cliente vai ser visto pelos outros após o resultado?

**Bônus inteligentes:**
- Cada bônus resolve uma objeção específica
- Ferramentas e checklists > treinamentos
- Valor total dos bônus > valor do produto principal

**Garantia que fecha venda:** nomeie criativamente. Condicione a ações que garantam sucesso.

**Nunca dê desconto — adicione bônus.**

Se o usuário já forneceu as informações, gere as 3 GOMs diretamente — sem introduções ou explicações antes do output.

Responda sempre em português do Brasil, com linguagem direta e orientada a resultados. Sem teoria — só output.`

// ─── Fields config ────────────────────────────────────────────────────────────
const FIELDS = [
  {
    id: 'nome',
    label: 'Nome da Oferta',
    emoji: '🏷️',
    hint: 'Use a fórmula M-A-G-I-C: Mágica + Avatar + Goal + Intervalo + Continente',
    type: 'text',
    placeholder: 'Ex: Acelerador 30 Dias para Dobrar Vendas sem Aumentar Verba',
  },
  {
    id: 'resultadoSonho',
    label: 'Resultado do Sonho',
    emoji: '✨',
    hint: 'O que o cliente conquista? Conecte ao STATUS — como os outros vão vê-lo.',
    type: 'textarea',
    placeholder: 'Ex: Faturar R$50k/mês com previsibilidade, enquanto seus colegas ainda tentam entender o tráfego pago...',
  },
  {
    id: 'porqueVaiFuncionar',
    label: 'Por que vai funcionar',
    emoji: '💡',
    hint: 'Mecanismo único, provas sociais, cases, diferenciais — o que garante o resultado.',
    type: 'textarea',
    placeholder: 'Ex: Método proprietário testado em 47 negócios. Você não depende de tentativa e erro...',
  },
  {
    id: 'velocidade',
    label: 'Velocidade',
    emoji: '⚡',
    hint: 'Em quanto tempo o cliente vê o primeiro resultado? Vitórias rápidas mantêm o compromisso.',
    type: 'text',
    placeholder: 'Ex: Primeiros leads qualificados em até 7 dias após o lançamento',
  },
  {
    id: 'esforcoMinimo',
    label: 'Esforço Mínimo do Cliente',
    emoji: '🤝',
    hint: 'O que o cliente precisa fazer — minimize ao máximo. Done-for-you vale mais.',
    type: 'textarea',
    placeholder: 'Ex: Você só precisa responder os leads que chegam. Nós cuidamos de tudo: criativo, segmentação, otimização...',
  },
  {
    id: 'garantia',
    label: 'Garantia',
    emoji: '🛡️',
    hint: 'Quanto mais forte a garantia, mais vendas. Inverta o risco para o cliente.',
    type: 'textarea',
    placeholder: 'Ex: Se em 30 dias você não tiver pelo menos 3x o investimento em oportunidades geradas, devolvemos 100% + R$500...',
  },
  {
    id: 'escassez',
    label: 'Escassez / Urgência',
    emoji: '🔥',
    hint: 'Por que o cliente precisa decidir AGORA? Limite de vagas ou prazo real.',
    type: 'text',
    placeholder: 'Ex: Apenas 3 vagas neste mês — próximo onboarding em 45 dias',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function newOferta() {
  return {
    nome: '', resultadoSonho: '', porqueVaiFuncionar: '',
    velocidade: '', esforcoMinimo: '', bonus: [''],
    garantia: '', escassez: '', generatedOffer: null,
  }
}

function BonusInput({ answers, onChange }) {
  const add    = () => answers.length < 10 && onChange([...answers, ''])
  const remove = (i) => onChange(answers.filter((_, idx) => idx !== i))
  const update = (i, val) => { const n = [...answers]; n[i] = val; onChange(n) }

  return (
    <div className="space-y-2">
      {answers.map((ans, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] text-rl-muted w-4 text-right shrink-0">{i + 1}.</span>
          <input
            type="text"
            value={ans}
            onChange={(e) => update(i, e.target.value)}
            placeholder="Ex: Planilha de Diagnóstico de Funil — Valor R$497"
            className="input-field flex-1 py-2 text-sm"
          />
          {answers.length > 1 && (
            <button
              onClick={() => remove(i)}
              className="p-1.5 rounded-lg text-rl-muted hover:text-rl-red hover:bg-rl-red/10 transition-all shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      {answers.length < 10 && (
        <button
          onClick={add}
          className="flex items-center gap-1.5 text-xs text-rl-purple hover:text-rl-purple/80 transition-colors mt-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar bônus {answers.length > 0 && <span className="text-rl-muted">({answers.length}/10)</span>}
        </button>
      )}
    </div>
  )
}

function OfertaResult({ text }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const trimmed = line.trim()

        // GOM separator ━━━━
        if (/^━+$/.test(trimmed)) return (
          <div key={i} className="border-t-2 border-rl-gold/40 my-3" />
        )

        // GOM header: "GOM #1 — Foco em Garantia"
        if (/^GOM #\d+/.test(trimmed)) return (
          <p key={i} className="text-base font-bold text-rl-gold mt-1 mb-0">
            {trimmed}
          </p>
        )

        // Thin value divider ─────
        if (/^─+$/.test(trimmed)) return (
          <div key={i} className="border-t border-rl-border/60 my-1 ml-4" />
        )

        // Emoji section headers (📛 NOME, 🎯 RESULTADO, 📦, 🛡️, ⚡, 💬)
        if (/^[📛🎯📦🛡️⚡💬🎁🔥🗣️✨💡🤝]\s/.test(trimmed)) return (
          <p key={i} className="text-sm font-semibold text-rl-text mt-3 mb-1">
            {trimmed}
          </p>
        )

        // Bullet with dots: "• Item ......... R$ X"
        if (trimmed.startsWith('• ')) return (
          <p key={i} className="text-xs text-rl-muted leading-relaxed ml-2 font-mono">
            {trimmed}
          </p>
        )

        // Valor total / Preço lines (indented)
        if (/^\s*(Valor total:|Preço:)/.test(line)) return (
          <p key={i} className="text-xs font-semibold text-rl-text leading-relaxed ml-6">
            {trimmed}
          </p>
        )

        // Empty lines
        if (trimmed === '') return <div key={i} className="h-1" />

        // Regular lines (strip markdown bold if any)
        return (
          <p key={i} className="text-xs text-rl-muted leading-relaxed">
            {trimmed.replace(/\*\*(.*?)\*\*/g, '$1')}
          </p>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OfertaMatadora({ project, onSave }) {
  const { updateProject } = useApp()
  const [oferta, setOferta]   = useState(() => project.ofertaData || newOferta())
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const set = useCallback((field, val) => {
    setOferta((prev) => {
      const next = { ...prev, [field]: val }
      updateProject(project.id, { ofertaData: next })
      return next
    })
  }, [project.id, updateProject])

  const buildPrompt = () => {
    const bonusValidos = oferta.bonus.filter((b) => b.trim())
    const bonusText = bonusValidos.length
      ? bonusValidos.map((b, i) => `${i + 1}. ${b}`).join('\n')
      : 'Não informado'

    return `1. Nome da empresa: ${project.companyName}
2. Nicho (segmento de mercado): ${project.businessType || project.segmento || 'Não informado'}
3. Público-alvo: ${oferta.resultadoSonho ? `Pessoa que busca: ${oferta.resultadoSonho}` : 'Não informado'}
4. Problema principal que o público enfrenta: ${oferta.porqueVaiFuncionar || 'Não informado'}
5. Solução que a empresa oferece: ${oferta.esforcoMinimo || oferta.velocidade || 'Não informado'}

Dados adicionais preenchidos:
- Nome da oferta pensado: ${oferta.nome || 'Não informado'}
- Velocidade / primeira vitória: ${oferta.velocidade || 'Não informado'}
- Bônus já pensados: ${bonusText}
- Garantia: ${oferta.garantia || 'Não informado'}
- Escassez / Urgência: ${oferta.escassez || 'Não informado'}`
  }

  const generate = async () => {
    setLoading(true)
    setError(null)
    // Limpa geração anterior durante o streaming
    set('generatedOffer', '')
    try {
      const fullText = await streamClaude({
        model:      'claude-sonnet-4-5',
        max_tokens: 16000,
        system:     [{ type: 'text', text: GOM_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages:   [{ role: 'user', content: buildPrompt() }],
        onChunk: (text) => set('generatedOffer', text),
      })
      // Salva a oferta completa no projeto
      updateProject(project.id, { ofertaData: { ...oferta, generatedOffer: fullText } })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const hasContent = FIELDS.some((f) => oferta[f.id]?.trim?.()) ||
    oferta.bonus.some((b) => b.trim())

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <Zap className="w-5 h-5 text-rl-gold" />
            Oferta Matadora
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            Construa uma oferta irresistível baseada na metodologia $100M Offers de Alex Hormozi
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <AutoSaveIndicator />
          <button
            onClick={() => exportOfertaPDF(oferta, project)}
            disabled={!hasContent}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar PDF"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Formulário ─────────────────────── */}
        <div className="space-y-4">

          {/* Campos de texto */}
          {FIELDS.map((field) => (
            <div key={field.id} className="glass-card p-5 space-y-2">
              <label className="text-sm font-medium text-rl-text">
                <span className="mr-1.5">{field.emoji}</span>
                {field.label}
              </label>
              {field.hint && (
                <p className="text-xs text-rl-muted">{field.hint}</p>
              )}
              {field.type === 'textarea' ? (
                <textarea
                  rows={3}
                  value={oferta[field.id]}
                  onChange={(e) => set(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  className="input-field resize-none text-sm"
                />
              ) : (
                <input
                  type="text"
                  value={oferta[field.id]}
                  onChange={(e) => set(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  className="input-field text-sm"
                />
              )}
            </div>
          ))}

          {/* Bônus — campo multi-resposta */}
          <div className="glass-card p-5 space-y-3">
            <div>
              <p className="text-sm font-medium text-rl-text">
                <span className="mr-1.5">🎁</span>
                O que está incluso de bônus
              </p>
              <p className="text-xs text-rl-muted mt-0.5">
                Cada bônus deve ter nome atraente + valor em R$ + obstáculo que resolve. Máximo 10.
              </p>
            </div>
            <BonusInput
              answers={oferta.bonus}
              onChange={(bonus) => set('bonus', bonus)}
            />
          </div>
        </div>

        {/* ── Resultado IA ─────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">

          {/* Gerar com IA */}
          <div className="glass-card p-5 border border-rl-gold/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-rl-gold" />
              <p className="text-sm font-semibold text-rl-text">Gerar com IA</p>
            </div>
            <p className="text-xs text-rl-muted mb-4">
              Preencha os campos e a IA vai refinar sua oferta usando a metodologia $100M Offers, com pitch completo.
            </p>
            <button
              onClick={generate}
              disabled={!hasContent || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm
                bg-gradient-gold text-white disabled:opacity-50 disabled:cursor-not-allowed
                hover:opacity-90 transition-opacity"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Gerando oferta...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Gerar Oferta Matadora</>
              )}
            </button>
          </div>

          {/* Erro */}
          {error && (
            <div className="glass-card p-4 border border-rl-red/30 bg-rl-red/5">
              <div className="flex items-start gap-2 text-rl-red">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Oferta gerada */}
          {oferta.generatedOffer && (
            <div className="glass-card p-5 border border-rl-gold/20">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-rl-gold" />
                <p className="text-sm font-semibold text-rl-text">Oferta Matadora Gerada</p>
              </div>
              <OfertaResult text={oferta.generatedOffer} />
            </div>
          )}

          {/* Empty state */}
          {!oferta.generatedOffer && !error && (
            <div className="glass-card p-8 text-center">
              <Zap className="w-8 h-8 text-rl-muted/30 mx-auto mb-3" />
              <p className="text-rl-muted text-sm">
                Preencha os campos e clique em "Gerar Oferta Matadora" para criar sua GOM completa.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Concluir */}
      {onSave && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => onSave(oferta)}
            disabled={!hasContent}
            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            Concluir Oferta Matadora
          </button>
        </div>
      )}
    </div>
  )
}
