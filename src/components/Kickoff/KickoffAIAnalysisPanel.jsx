import { useState } from 'react'
import { Sparkles, Loader2, AlertTriangle, RotateCcw } from 'lucide-react'
import { streamClaude } from '../../lib/claude'
import { buildCachedPayload } from '../../lib/buildContext'
import MarkdownBlock from '../Criativos/MarkdownBlock'
import { PILLARS_BY_ID } from './KickoffQuestions'

const SYSTEM_PROMPT = `Você é um consultor sênior de Revenue Lab analisando o diagnóstico de kickoff de um cliente. Receberá: tipo de negócio, respostas do questionário, scores por pilar (0-100), pilares mais fracos e ações sugeridas.

Sua tarefa: aprofundar cada um dos 3 pilares mais fracos com:
1. Diagnóstico específico (2-3 frases conectando às respostas dadas)
2. Hipótese da raiz do problema
3. Plano de ação concreto em 3-5 etapas com prazo sugerido
4. Riscos de não atacar

Não use travessões. Português brasileiro consultivo, direto, sem jargão vazio. Saída em markdown com \`## Pilar: [nome]\` por bloco.`

function formatInstruction({ project, kickoff, questions }) {
  const answersTable = questions
    .map((q) => {
      const raw = kickoff.answers?.[q.id]
      if (raw == null || raw === '' || (Array.isArray(raw) && !raw.length)) return null
      const display = Array.isArray(raw)
        ? raw.join(', ')
        : typeof raw === 'string' || typeof raw === 'number'
          ? String(raw)
          : JSON.stringify(raw)
      return `- ${q.label}\n  → ${display}`
    })
    .filter(Boolean)
    .join('\n')

  const scoresTable = Object.entries(kickoff.scores || {})
    .map(([pid, score]) => {
      const pillar = PILLARS_BY_ID[pid]
      return `- ${pillar?.label || pid}: ${score}/100`
    })
    .join('\n')

  const weaknessesTable = (kickoff.weaknesses || [])
    .map((wid, i) => {
      const pillar = PILLARS_BY_ID[wid]
      const score = kickoff.scores?.[wid] ?? 0
      const action = kickoff.nextSteps?.[i] || ''
      return `${i + 1}. ${pillar?.label || wid} — score ${score} — ação sugerida: ${action}`
    })
    .join('\n')

  return [
    `Empresa: ${project.companyName || project.company_name || 'Cliente'}`,
    `Tipo de negócio: ${kickoff.businessType}`,
    `Score geral: ${kickoff.totalScore}/100 (${kickoff.stageLabel})`,
    '',
    '## Respostas',
    answersTable || '(sem respostas)',
    '',
    '## Scores por pilar',
    scoresTable,
    '',
    '## Pilares mais fracos (foque aqui)',
    weaknessesTable,
    '',
    'Aprofunde os 3 pilares mais fracos seguindo o formato pedido no system.',
  ].join('\n')
}

export default function KickoffAIAnalysisPanel({
  project,
  kickoff,
  questions,
  existing,
  onSave,
}) {
  const [streaming, setStreaming] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setStreaming('')
    try {
      const { system, messages } = buildCachedPayload({
        systemPrompt: SYSTEM_PROMPT,
        project,
        instruction: formatInstruction({ project, kickoff, questions }),
      })
      const fullText = await streamClaude({
        model:      'claude-sonnet-4-5',
        max_tokens: 4000,
        system,
        messages,
        onChunk:    (text) => setStreaming(text),
      })
      onSave(fullText)
    } catch (e) {
      console.error('[KickoffAI]', e)
      setError(e?.message || 'Erro ao gerar análise.')
    } finally {
      setLoading(false)
      setStreaming('')
    }
  }

  // Já existe análise salva
  if (existing && !loading) {
    return (
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rl-purple" />
            <h3 className="text-sm font-bold text-rl-text">Análise aprofundada (IA)</h3>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Regenerar
          </button>
        </div>
        <div className="border-t border-rl-border/60 pt-4">
          <MarkdownBlock content={existing} />
        </div>
      </div>
    )
  }

  // Streaming em andamento
  if (loading) {
    return (
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-rl-purple animate-spin" />
          <h3 className="text-sm font-bold text-rl-text">Gerando análise...</h3>
        </div>
        {streaming && (
          <div className="border-t border-rl-border/60 pt-4">
            <MarkdownBlock content={streaming} />
          </div>
        )}
      </div>
    )
  }

  // CTA inicial
  return (
    <div className="glass-card p-5 border-2 border-dashed border-rl-purple/30 text-center space-y-3">
      <Sparkles className="w-8 h-8 text-rl-purple mx-auto" />
      <div>
        <h3 className="text-sm font-bold text-rl-text">Análise aprofundada com IA</h3>
        <p className="text-xs text-rl-muted mt-1 max-w-md mx-auto">
          O Claude analisa as respostas e aprofunda os 3 pilares mais fracos com diagnóstico,
          raiz do problema, plano de ação e riscos. ~10 segundos.
        </p>
      </div>
      <button
        onClick={handleGenerate}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
      >
        <Sparkles className="w-4 h-4" />
        Gerar análise com IA
      </button>
      {error && (
        <div className="flex items-center gap-2 justify-center text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}
    </div>
  )
}
