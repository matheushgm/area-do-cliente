import {
  Sparkles, FileDown, RotateCcw, Pencil, Compass, Target,
} from 'lucide-react'
import KickoffRadar from './KickoffRadar'
import KickoffPillarBars from './KickoffPillarBars'
import KickoffAIAnalysisPanel from './KickoffAIAnalysisPanel'
import { PILLARS_BY_ID } from './KickoffQuestions'

export default function KickoffResultView({
  project,
  kickoff,
  questions,
  onRestart,
  onEdit,
  onSaveAi,
  onExportPdf,
}) {
  const stageColor = kickoff.stageColor || '#7C3AED'
  const businessLabel = {
    b2b: 'B2B',
    b2c: 'B2C',
    hibrido: 'Híbrido (B2B + B2C)',
  }[kickoff.businessType] || kickoff.businessType

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho com estágio + score ────────────────────────────── */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ background: stageColor }}
        />
        <div className="pl-3 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-rl-muted font-semibold mb-1">
              Diagnóstico Kickoff · {businessLabel}
            </p>
            <h2 className="text-2xl font-black text-rl-text leading-tight">
              {kickoff.stageLabel}
            </h2>
            <p className="text-sm text-rl-muted mt-1.5 max-w-2xl">
              {kickoff.stageDesc}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div
              className="text-5xl font-black tabular-nums"
              style={{ color: stageColor }}
            >
              {kickoff.totalScore}
            </div>
            <div className="text-xs text-rl-muted font-semibold">/ 100</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="pl-3 mt-4 pt-4 border-t border-rl-border/60 flex items-center gap-2 flex-wrap">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
          >
            <Pencil className="w-3.5 h-3.5" /> Editar respostas
          </button>
          <button
            onClick={onRestart}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Refazer
          </button>
          <div className="flex-1" />
          <button
            onClick={onExportPdf}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/30 transition-all"
          >
            <FileDown className="w-3.5 h-3.5" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* ── Mapa visual: radar + barras ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Compass className="w-4 h-4 text-rl-cyan" />
            <h3 className="text-sm font-bold text-rl-text">Radar dos 9 pilares</h3>
          </div>
          <KickoffRadar
            pillarScores={kickoff.scores}
            width={420}
            height={420}
            fillColor={stageColor}
          />
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-rl-gold" />
            <h3 className="text-sm font-bold text-rl-text">Mapa de fraquezas</h3>
            <span className="text-[10px] text-rl-muted ml-auto">ordenado do pior pro melhor</span>
          </div>
          <KickoffPillarBars pillarScores={kickoff.scores} />
        </div>
      </div>

      {/* ── Próximos passos prioritários ─────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-rl-purple" />
          <h3 className="text-sm font-bold text-rl-text">Próximos passos prioritários</h3>
          <span className="text-[10px] text-rl-muted ml-auto">3 pilares mais fracos</span>
        </div>
        <ol className="space-y-3">
          {kickoff.nextSteps?.map((step, i) => {
            const weakness = kickoff.weaknesses?.[i]
            const pillar = weakness ? PILLARS_BY_ID[weakness] : null
            return (
              <li key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-rl-purple/10 border border-rl-purple/30 text-rl-purple text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </div>
                <div>
                  {pillar && (
                    <p className="text-[10px] uppercase tracking-wide text-rl-muted font-semibold mb-0.5">
                      Pilar: {pillar.label} · score {kickoff.scores?.[weakness] ?? 0}
                    </p>
                  )}
                  <p className="text-sm text-rl-text leading-snug">{step}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* ── Análise IA (botão opcional) ──────────────────────────────── */}
      <KickoffAIAnalysisPanel
        project={project}
        kickoff={kickoff}
        questions={questions}
        existing={kickoff.aiAnalysis}
        onSave={onSaveAi}
      />
    </div>
  )
}
