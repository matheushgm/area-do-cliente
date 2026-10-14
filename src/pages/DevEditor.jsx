// Preview sem login do editor de Markdown (só em DEV): /dev/editor
// Renderiza os cards de criativo (CreativeResultBlock) com conteúdo no formato
// real, um refino de IA simulado e os blocos de leitura da Central/portal, pra
// testar edição, toolbar flutuante e a ida e volta do markdown sem Supabase.
import { useState } from 'react'
import CreativeResultBlock from '../components/Criativos/CreativeResultBlock'
import { replaceAdInContent } from '../components/Criativos/ResultBlock'
import MarkdownView from '../components/Editor/MarkdownView'
import MarkdownEditor from '../components/Editor/MarkdownEditor'

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
