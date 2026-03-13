import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { Plus, X, Sparkles, Loader2, AlertTriangle, CheckCircle2, Zap, FileDown } from 'lucide-react'
import { exportOfertaPDF } from '../utils/exportPDF'
import { streamClaude } from '../lib/claude'

// ─── GOM System Prompt (baseado no criador-de-oferta-matadora skill) ──────────
const GOM_SYSTEM_PROMPT = `Você é um especialista em marketing e criação de ofertas irresistíveis com domínio completo da metodologia de Alex Hormozi do livro $100M Offers.

A Equação de Valor: Valor = (Sonho Desejado × Probabilidade Percebida) / (Tempo de Espera × Esforço)

Quando receber o rascunho de oferta do usuário, sua missão é:
1. Analisar cada elemento preenchido
2. Potencializar a linguagem tornando-a mais específica, emocional e orientada a STATUS
3. Identificar lacunas e sugerir melhorias
4. Apresentar a oferta final refinada no formato estruturado abaixo

Use EXATAMENTE esta estrutura em markdown:

### 🎯 NOME DA OFERTA (Fórmula M-A-G-I-C)
[Nome refinado e variações]

### ✨ RESULTADO SONHADO (com STATUS)
[Resultado vívido conectado a como o cliente será visto pelos outros]

### 💡 POR QUE VAI FUNCIONAR
[Mecanismo único, provas e argumentos de probabilidade percebida]

### ⚡ VELOCIDADE
[Primeira vitória emocional — quando e o quê]

### 🤝 ESFORÇO MÍNIMO
[O que o cliente faz e o que você elimina para ele — done-for-you]

### 🎁 STACK DE VALOR (Bônus)
Para cada bônus, apresente: nome atraente, valor em R$ atribuído, obstáculo que resolve.
Total do stack de valor: R$X

### 🛡️ GARANTIA
[Tipo + condições + o que acontece se não atingir]

### 🔥 ESCASSEZ / URGÊNCIA
[Por que agir AGORA — o que se perde esperando]

### 🗣️ PITCH FINAL
[Pitch completo em linguagem direta, como se estivesse vendendo ao vivo]

Responda sempre em português do Brasil. Seja específico com números, prazos e resultados mensuráveis.`

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
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return (
          <p key={i} className="text-sm font-bold text-rl-text mt-4 mb-1">{line.replace('### ', '')}</p>
        )
        if (line.startsWith('## ')) return (
          <p key={i} className="text-base font-bold text-rl-purple mt-4 mb-1">{line.replace('## ', '')}</p>
        )
        if (line.trim() === '') return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-xs text-rl-muted leading-relaxed">
            {line.replace(/\*\*(.*?)\*\*/g, '$1')}
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

  const set = useCallback((field, val) => setOferta((prev) => ({ ...prev, [field]: val })), [])

  const buildPrompt = () => {
    const bonusValidos = oferta.bonus.filter((b) => b.trim())
    const bonusText = bonusValidos.length
      ? bonusValidos.map((b, i) => `${i + 1}. ${b}`).join('\n')
      : 'Não informado'

    return `Refine e potencialize esta oferta para a empresa **${project.companyName}** (${project.businessType || 'empresa'}):

**Nome da Oferta:** ${oferta.nome || 'Não informado'}

**Resultado do Sonho:**
${oferta.resultadoSonho || 'Não informado'}

**Por que vai funcionar:**
${oferta.porqueVaiFuncionar || 'Não informado'}

**Velocidade:**
${oferta.velocidade || 'Não informado'}

**Esforço Mínimo do Cliente:**
${oferta.esforcoMinimo || 'Não informado'}

**Bônus inclusos:**
${bonusText}

**Garantia:**
${oferta.garantia || 'Não informado'}

**Escassez / Urgência:**
${oferta.escassez || 'Não informado'}

Com base nesses dados, crie a Grande Oferta Matadora completa e refinada seguindo sua metodologia.`
  }

  const generate = async () => {
    setLoading(true)
    setError(null)
    // Limpa geração anterior durante o streaming
    set('generatedOffer', '')
    try {
      const fullText = await streamClaude({
        model:      'claude-sonnet-4-5',
        max_tokens: 4000,
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
        <button
          onClick={() => exportOfertaPDF(oferta, project)}
          disabled={!hasContent}
          className="btn-secondary flex items-center gap-2 text-sm shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Exportar PDF"
        >
          <FileDown className="w-4 h-4" />
          PDF
        </button>
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
