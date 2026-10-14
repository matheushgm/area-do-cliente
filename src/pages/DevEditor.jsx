// Preview sem login do editor de Markdown (só em DEV): /dev/editor
// Renderiza os cards de criativo (CreativeResultBlock) com conteúdo no formato
// real, um refino de IA simulado e os blocos de leitura da Central/portal, pra
// testar edição, toolbar flutuante e a ida e volta do markdown sem Supabase.
import { useState } from 'react'
import CreativeResultBlock from '../components/Criativos/CreativeResultBlock'
import { replaceAdInContent } from '../components/Criativos/ResultBlock'
import MarkdownView from '../components/Editor/MarkdownView'
import MarkdownEditor from '../components/Editor/MarkdownEditor'
import TextoEditavelIA from '../components/Editor/TextoEditavelIA'
import { ObservacoesEditor, ObservacoesLeitura } from '../components/UI/ObservacoesCampo'

const ANALISE = `## Pilar: Aquisição

**Diagnóstico:** o tráfego pago depende de um único canal e a taxa de conversão da LP está abaixo de 2%.

**Hipótese da raiz:** a oferta não está clara acima da dobra.

1. Reescrever a headline com a promessa principal (1 semana)
2. Testar 3 criativos de topo (2 semanas)
3. Instalar o pixel de conversão de formulário (3 dias)

## Pilar: Retenção

Sem rotina de acompanhamento pós-venda. Risco: churn em 90 dias.`

// Refino simulado do TextoEditavelIA: devolve o texto com uma marca no fim.
async function refinarFakeTexto(texto, trecho, instrucao, onChunk) {
  const alvo = `${texto.trim()}\n\n*(refinado${trecho ? ` no trecho "${trecho.slice(0, 30)}"` : ''}: ${instrucao.slice(0, 40)})*`
  for (let i = 1; i <= 6; i++) {
    await new Promise((r) => setTimeout(r, 80))
    onChunk(alvo.slice(0, Math.ceil((alvo.length * i) / 6)))
  }
  return alvo
}

const VIDEO = `# ROTEIRO 1: Tese: O que você não enxerga também degrada | Ângulo: Mito | Nível: Inconsciente do problema

**GANCHO (0s – 5s):**
Existe uma crença no mercado fitness de que limpeza visível é limpeza completa.

**DESENVOLVIMENTO (5s – 20s):**
Mas acontece o seguinte: álcool em gel e produtos multiuso limpam a superfície sem proteger o material.

**CTA (50s – 60s):**
Candidata-se para receber uma proposta. Link na bio.

**📝 LEGENDA DO POST:** 🏋️ O que você não enxerga também degrada.

---

# ROTEIRO 2: Tese: Escolher entre premium e custo baixo é falso dilema | Ângulo: Dilema | Nível: Inconsciente do problema

**GANCHO (0s – 5s):**
Tem um momento em que o gestor olha pro orçamento de limpeza e pensa: continuo com o genérico?

**CTA (50s – 60s):**
Candidata-se para receber uma proposta.`

const ESTATICO = `# DOR: "O álcool pode estar ressecando o couro dos seus equipamentos." | 🎣 Clickbait

### 1
- Headline: O que ninguém contou para você sobre o álcool nos equipamentos da sua academia
- Subheadline: Descubra por que donos de academias premium estão abandonando o álcool

---

# DOR: "Seus alunos ainda usam borrifador e pano?" | 📊 Comparação

### 1
- Headline: Academias comuns usam borrifador e pano - academias referência usam lenços profissionais
- Subheadline: A diferença não está só no equipamento`

// Refino simulado: devolve o criativo com um rodapé, em "streaming".
async function refinarFake(_i, chunk, note, onChunk) {
  const alvo = `${chunk.trim()}\n\n*(refinado: ${note.slice(0, 60).replace(/\n/g, ' ')})*`
  for (let i = 1; i <= 8; i++) {
    await new Promise((r) => setTimeout(r, 90))
    onChunk(alvo.slice(0, Math.ceil((alvo.length * i) / 8)))
  }
  return alvo
}

export default function DevEditor() {
  const [video, setVideo] = useState(VIDEO)
  const [estatico, setEstatico] = useState(ESTATICO)
  const [livre, setLivre] = useState('Texto **livre** com _itálico_ e uma lista:\n\n- um\n- dois')
  const [leitura, setLeitura] = useState(false)
  const [analise, setAnalise] = useState(ANALISE)
  const [obs, setObs] = useState(
    'Cliente PRÉ-PAGO.\n\n- Loja Centro: R$ 1.200\n- Loja Norte: R$ 3.000'
  )

  return (
    <div className="min-h-screen bg-rl-bg text-rl-text p-6 space-y-10 max-w-5xl mx-auto">
      <section className="space-y-3">
        <h1 className="text-lg font-bold">Vídeo — CreativeResultBlock</h1>
        <CreativeResultBlock
          content={video}
          type="video"
          companyName="Dev"
          onChunkChange={(i, novo) => setVideo((c) => replaceAdInContent(c, i, novo))}
          onRefine={refinarFake}
        />
        <details>
          <summary className="text-xs text-rl-muted cursor-pointer">Markdown atual (vídeo)</summary>
          <pre
            data-testid="md-video"
            className="text-[11px] whitespace-pre-wrap bg-rl-surface border border-rl-border rounded-xl p-3 mt-2"
          >
            {video}
          </pre>
        </details>
      </section>

      <section className="space-y-3">
        <h1 className="text-lg font-bold">Estático — CreativeResultBlock</h1>
        <CreativeResultBlock
          content={estatico}
          type="estatico"
          companyName="Dev"
          onChunkChange={(i, novo) => setEstatico((c) => replaceAdInContent(c, i, novo))}
        />
        <details>
          <summary className="text-xs text-rl-muted cursor-pointer">
            Markdown atual (estático)
          </summary>
          <pre
            data-testid="md-estatico"
            className="text-[11px] whitespace-pre-wrap bg-rl-surface border border-rl-border rounded-xl p-3 mt-2"
          >
            {estatico}
          </pre>
        </details>
      </section>

      <section className="space-y-3">
        <h1 className="text-lg font-bold">
          TextoEditavelIA — texto gerado pela IA (Kickoff, Mecanismo, Produto)
        </h1>
        <div className="glass-card p-5">
          <TextoEditavelIA valor={analise} onSalvar={setAnalise} onRefinar={refinarFakeTexto} />
        </div>
        <details>
          <summary className="text-xs text-rl-muted cursor-pointer">
            Markdown atual (análise)
          </summary>
          <pre
            data-testid="md-analise"
            className="text-[11px] whitespace-pre-wrap bg-rl-surface border border-rl-border rounded-xl p-3 mt-2"
          >
            {analise}
          </pre>
        </details>
      </section>

      <section className="space-y-3">
        <h1 className="text-lg font-bold">Observações do cliente (editor + leitura)</h1>
        <div className="glass-card p-5 space-y-4">
          <ObservacoesEditor
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={5}
            placeholder="Observações…"
            rodape="Salva automaticamente (simulado)"
          />
          <div className="border-t border-rl-border pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted mb-1">
              Leitura (HubInformacoes)
            </p>
            <ObservacoesLeitura texto={obs} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h1 className="text-lg font-bold">Contexto .ln — descrição e comentário da tarefa</h1>
        <div className="ln rounded-lg border border-ln-ink/5 bg-ln-panel p-4 space-y-4">
          <div>
            <p className="ln-label mb-1">Descrição (leitura, md-prose--13)</p>
            <MarkdownView content={livre} className="md-prose--13 text-ln-t2" />
          </div>
          <div>
            <p className="ln-label mb-1">Comentário (composer nu)</p>
            <div className="ln-card flex items-end gap-2 px-3 py-2 focus-within:border-ln-accent/60">
              <MarkdownEditor
                value={obs}
                onChange={setObs}
                minHeight={24}
                placeholder="Escreva um comentário..."
                className="md-editor--nu md-editor--13 flex-1 min-w-0 text-ln-t1"
              />
              <button type="button" className="ln-primary !px-2">
                Enviar
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h1 className="text-lg font-bold">Editor solto + leitura (Central / portal)</h1>
        <label className="text-xs flex items-center gap-2">
          <input type="checkbox" checked={leitura} onChange={(e) => setLeitura(e.target.checked)} />{' '}
          somente leitura
        </label>
        <MarkdownEditor
          value={livre}
          onChange={setLivre}
          readOnly={leitura}
          minHeight={120}
          placeholder="Digite…"
        />
        <div className="rounded-xl border border-rl-blue/30 bg-rl-blue/5 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-blue mb-2">
            MarkdownView (12px, como na Central)
          </p>
          <MarkdownView content={livre} className="md-prose--xs" />
        </div>
        <pre
          data-testid="md-livre"
          className="text-[11px] whitespace-pre-wrap bg-rl-surface border border-rl-border rounded-xl p-3"
        >
          {livre}
        </pre>
      </section>
    </div>
  )
}
