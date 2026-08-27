import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import {
  Zap, FileDown, CheckCircle2, Link2, Check, Plus, Copy, Trash2, Star,
} from 'lucide-react'
import { exportOfertaPDF } from '../utils/exportPDF'
import { streamClaude } from '../lib/claude'
import VideoGuide from '../components/VideoGuide'
import {
  hydrateOferta, newOferta, uid, GOM_SYSTEM_PROMPT, buildFinalPrompt,
} from '../components/OfertaWizard/ofertaShared'
import OfertaWizardShell, { computeFilledMap } from '../components/OfertaWizard/OfertaWizardShell'
import { StepFinal } from '../components/OfertaWizard/StepComponents'

// Lista de ofertas do projeto, sempre com pelo menos um rascunho em branco.
function initialList(project) {
  const rows = project.ofertas?.length
    ? project.ofertas
    : (project.ofertaData ? [project.ofertaData] : [])
  const list = rows.map((o) => ({
    ...hydrateOferta(o),
    id:        o.id || uid(),
    createdAt: o.createdAt || null,
  }))
  if (list.length) return list
  return [{ ...newOferta(), id: uid(), createdAt: new Date().toISOString(), principal: true }]
}

const rotulo = (oferta, i) => oferta.nome?.trim() || `Oferta ${i + 1}`

export default function OfertaMatadora({ project, onSave }) {
  const { updateProject } = useApp()
  const [list, setList] = useState(() => initialList(project))
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)

  // Sem seleção explícita, abre na oferta principal (ou na primeira da lista).
  const oferta = useMemo(
    () => list.find((o) => o.id === activeId) || list.find((o) => o.principal) || list[0],
    [list, activeId],
  )

  // `set` é chamado a cada chunk do streaming da IA — manter a referência estável
  // e ler a oferta ativa de um ref evita perder texto ao trocar de aba no meio.
  const activeIdRef = useRef(oferta.id)
  useEffect(() => { activeIdRef.current = oferta.id }, [oferta.id])

  const commit = useCallback((next) => {
    setList(next)
    updateProject(project.id, { ofertas: next })
  }, [project.id, updateProject])

  const set = useCallback((field, val) => {
    setList((prev) => {
      const next = prev.map((o) => (o.id === activeIdRef.current ? { ...o, [field]: val } : o))
      updateProject(project.id, { ofertas: next })
      return next
    })
  }, [project.id, updateProject])

  // ── Ações sobre a lista de ofertas ────────────────────────────────────────
  const novaOferta = () => {
    const nova = { ...newOferta(), id: uid(), createdAt: new Date().toISOString() }
    commit([...list, nova])
    setActiveId(nova.id)
  }

  const duplicarOferta = () => {
    const copia = {
      ...oferta,
      id:        uid(),
      createdAt: new Date().toISOString(),
      nome:      oferta.nome?.trim() ? `${oferta.nome} (cópia)` : '',
      principal: false,
    }
    commit([...list, copia])
    setActiveId(copia.id)
  }

  const excluirOferta = () => {
    const i = list.findIndex((o) => o.id === oferta.id)
    if (!window.confirm(`Excluir "${rotulo(oferta, i)}"? Essa ação não pode ser desfeita.`)) return
    const restante = list.filter((o) => o.id !== oferta.id)
    if (!restante.length) {
      const vazia = { ...newOferta(), id: uid(), createdAt: new Date().toISOString(), principal: true }
      commit([vazia])
      setActiveId(vazia.id)
      return
    }
    if (!restante.some((o) => o.principal)) restante[0] = { ...restante[0], principal: true }
    commit(restante)
    setActiveId(restante[Math.max(0, i - 1)].id)
  }

  const definirPrincipal = () => {
    commit(list.map((o) => ({ ...o, principal: o.id === oferta.id })))
  }

  const ehPrincipal = (o, i) => (list.some((x) => x.principal) ? !!o.principal : i === 0)

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
      set('generatedOffer', fullText)
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
      <VideoGuide
        videoId="tLOx9Wjq7wo"
        label="Como preencher o módulo de Oferta Matadora"
        defaultOpen
      />

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

      {/* Ofertas do cliente */}
      <div className="glass-card p-3 space-y-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {list.map((o, i) => {
            const active = o.id === oferta.id
            return (
              <button
                key={o.id}
                onClick={() => setActiveId(o.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all shrink-0 ${
                  active ? 'bg-rl-gold/15 text-rl-text font-semibold' : 'text-rl-muted hover:bg-rl-border/40'
                }`}
              >
                {ehPrincipal(o, i) && <Star className="w-3 h-3 text-rl-gold fill-rl-gold" />}
                {rotulo(o, i)}
              </button>
            )
          })}
          <button
            onClick={novaOferta}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap text-rl-gold hover:bg-rl-gold/10 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Nova oferta
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-rl-border/50 pt-3">
          <input
            value={oferta.nome || ''}
            onChange={(e) => set('nome', e.target.value)}
            placeholder={`Nome desta oferta (ex.: ${rotulo(oferta, list.indexOf(oferta))})`}
            className="input-field flex-1 min-w-[220px] text-sm"
          />
          <button
            onClick={definirPrincipal}
            disabled={ehPrincipal(oferta, list.indexOf(oferta))}
            className="btn-secondary flex items-center gap-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            title="A oferta principal é a que alimenta LP, criativos e estratégia"
          >
            <Star className="w-3.5 h-3.5" /> Principal
          </button>
          <button
            onClick={duplicarOferta}
            className="btn-secondary flex items-center gap-1.5 text-xs"
            title="Duplicar esta oferta"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicar
          </button>
          <button
            onClick={excluirOferta}
            className="btn-secondary flex items-center gap-1.5 text-xs text-rl-red"
            title="Excluir esta oferta"
          >
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </button>
        </div>
        <p className="text-[11px] text-rl-muted">
          Cada aba é uma oferta completa e salva separadamente. A marcada como
          principal (★) é a que os outros módulos usam e a que o cliente preenche
          pelo link público.
        </p>
      </div>

      <OfertaWizardShell
        key={oferta.id}
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
              onClick={() => onSave(list)}
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
