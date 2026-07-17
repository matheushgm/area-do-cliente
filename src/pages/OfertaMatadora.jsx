import { useState, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import { Zap, FileDown, CheckCircle2, Link2, Check } from 'lucide-react'
import { exportOfertaPDF } from '../utils/exportPDF'
import { streamClaude } from '../lib/claude'
import VideoGuide from '../components/VideoGuide'
import {
  hydrateOferta, GOM_SYSTEM_PROMPT, buildFinalPrompt,
} from '../components/OfertaWizard/ofertaShared'
import OfertaWizardShell, { computeFilledMap } from '../components/OfertaWizard/OfertaWizardShell'
import { StepFinal } from '../components/OfertaWizard/StepComponents'

export default function OfertaMatadora({ project, onSave }) {
  const { updateProject } = useApp()
  const [oferta, setOferta] = useState(() => hydrateOferta(project.ofertaData))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const set = useCallback((field, val) => {
    setOferta((prev) => {
      const next = { ...prev, [field]: val }
      updateProject(project.id, { ofertaData: next })
      return next
    })
  }, [project.id, updateProject])

  const filledMap = useMemo(() => computeFilledMap(oferta), [oferta])
  const hasContent = Object.entries(filledMap).some(([id, v]) => v && id !== 'final')

  const generate = async () => {
    setLoading(true); setError(null)
    set('generatedOffer', '')
    try {
      const fullText = await streamClaude({
        model: 'claude-sonnet-4-5',
        max_tokens: 16000,
        system: [{ type: 'text', text: GOM_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildFinalPrompt(project, oferta) }],
        onChunk: (text) => set('generatedOffer', text),
      })
      updateProject(project.id, { ofertaData: { ...oferta, generatedOffer: fullText } })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Link público — mesmo clientShareToken usado por Produto/Persona (/client/:token)
  const copyClientLink = () => {
    let token = project.clientShareToken
    if (!token) {
      token = crypto.randomUUID()
      updateProject(project.id, { clientShareToken: token })
    }
    const url = `${window.location.origin}/oferta/${token}`
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }

  return (
    <div className="space-y-6">
      <VideoGuide videoId="wMgDhGb8aAw" label="Como preencher o módulo de Oferta Matadora" />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <Zap className="w-5 h-5 text-rl-gold" /> Oferta Matadora
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            Linha de produção passo-a-passo baseada em $100M Offers (Alex Hormozi)
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <AutoSaveIndicator />
          <button
            onClick={copyClientLink}
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Copiar link para o cliente preencher sozinho"
          >
            {linkCopied ? <Check className="w-4 h-4 text-green-400" /> : <Link2 className="w-4 h-4" />}
            {linkCopied ? 'Link copiado!' : 'Link do Cliente'}
          </button>
          <button
            onClick={() => exportOfertaPDF(oferta, project)}
            disabled={!hasContent}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar PDF"
          >
            <FileDown className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      <OfertaWizardShell
        oferta={oferta}
        set={set}
        project={project}
        finalContent={
          <StepFinal
            onGenerate={generate}
            loading={loading}
            error={error}
            generatedOffer={oferta.generatedOffer}
          />
        }
        finalFooter={
          onSave && (
            <button
              onClick={() => onSave(oferta)}
              disabled={!hasContent}
              className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" /> Concluir Oferta Matadora
            </button>
          )
        }
      />
    </div>
  )
}
