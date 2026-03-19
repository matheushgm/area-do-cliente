import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { supabase, getSignedUrl } from '../lib/supabase'
import { SQUAD_COLORS, BUSINESS_LABELS, CONTRACT_MODEL_LABELS } from '../lib/constants'
import { fmtCurrency, initials } from '../lib/utils'
import { useToast } from '../hooks/useToast'
import Toast from '../components/UI/Toast'
import {
  Camera, X, CheckCircle2, ClipboardList, BarChart3,
  Users, Zap, CalendarDays, Building2,
  Globe, Phone, TrendingUp, Star, FileDown,
  Paperclip, Clapperboard, LayoutTemplate, Activity, FlaskConical, Search, Layers, ImagePlay, Map, Package,
  Plus, Link2, PanelLeftClose, PanelLeftOpen, ChevronDown, Users2,
  LayoutDashboard, Check, Instagram, HardDrive,
} from 'lucide-react'
import ROICalculator from '../components/ROICalculator'
import PersonaCreator from './PersonaCreator'
import OfertaMatadora from './OfertaMatadora'
import CampaignPlanner from '../components/CampaignPlanner'
import AnexosModule from '../components/AnexosModule'
import CriativosModule from '../components/CriativosModule'
import LandingPageModule from '../components/LandingPageModule'
import ResultadosModule from '../components/ResultadosModule'
import MetaLabModule from '../components/MetaLabModule'
import GoogleAdsModule from '../components/GoogleAdsModule'
import EstrategiaModule from '../components/EstrategiaModule'
import EstrategiaV2Module from '../components/EstrategiaV2Module'
import ProdutoServicoModule from '../components/ProdutoServicoModule'
import BancoMidiaModule from '../components/BancoMidiaModule'
import LinksModule from '../components/LinksModule'
import { exportClientProfilePDF, exportProdutoServicoPDF } from '../utils/exportPDF'
import OnboardingContent from '../components/ClientProfile/OnboardingContent'

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientProfile({ project: projectProp }) {
  const { updateProject, projects, squads, teamMembers } = useApp()
  const logoInputRef = useRef(null)

  const project = projects.find((p) => p.id === projectProp.id) || projectProp

  const [activeSection, setActiveSection] = useState('dados')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [logoSignedUrl, setLogoSignedUrl] = useState(null)
  const [squadOpen, setSquadOpen] = useState(false)
  const squadRef = useRef(null)
  const [linkStep,         setLinkStep]         = useState('idle') // 'idle' | 'dropdown' | 'input'
  const [linkPickedType,   setLinkPickedType]   = useState(null)
  const [linkInput,        setLinkInput]        = useState('')
  const [linkLabel,        setLinkLabel]        = useState('')
  const linkRef = useRef(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef(null)
  const [overflowFrom, setOverflowFrom] = useState(Infinity)
  const pillsRowRef = useRef(null)
  const allLinksCountRef = useRef(0)
  const prevContainerWidthRef = useRef(0)
  const [squadTooltipPos, setSquadTooltipPos] = useState(null)
  const squadBadgeRef = useRef(null)
  const { toast, showToast } = useToast()

  useEffect(() => {
    if (!project.logoUrl) { setLogoSignedUrl(null); return }
    getSignedUrl('brand-logos', project.logoUrl).then(setLogoSignedUrl)
  }, [project.logoUrl])

  useEffect(() => {
    if (!squadOpen) return
    function handleClickOutside(e) {
      if (squadRef.current && !squadRef.current.contains(e.target)) setSquadOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [squadOpen])

  useEffect(() => {
    if (linkStep === 'idle') return
    function handleClickOutside(e) {
      if (linkRef.current && !linkRef.current.contains(e.target)) {
        setLinkStep('idle'); setLinkPickedType(null); setLinkInput(''); setLinkLabel('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [linkStep])

  useEffect(() => {
    if (!overflowOpen) return
    function handleClickOutside(e) {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) setOverflowOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [overflowOpen])

  // ResizeObserver: detecta overflow e re-exibe pills quando o container cresce
  useEffect(() => {
    const row = pillsRowRef.current
    if (!row) return
    function recalc() {
      if (!pillsRowRef.current) return
      const rowRect = pillsRowRef.current.getBoundingClientRect()
      const containerWidth = rowRect.width
      const children = Array.from(pillsRowRef.current.children)
      let cutoff = children.length
      for (let i = 0; i < children.length; i++) {
        if (children[i].getBoundingClientRect().right > rowRect.right + 1) { cutoff = i; break }
      }
      const prevWidth = prevContainerWidthRef.current
      prevContainerWidthRef.current = containerWidth
      // Container cresceu + todas as pills atuais cabem + há pills no overflow → tenta mostrar tudo
      if (cutoff === children.length && children.length < allLinksCountRef.current && containerWidth > prevWidth + 1) {
        setOverflowFrom(Infinity)
      } else {
        setOverflowFrom(cutoff)
      }
    }
    const ro = new ResizeObserver(recalc)
    ro.observe(row)
    requestAnimationFrame(recalc)
    return () => ro.disconnect()
  }, [])

  // Links mudaram: reseta para re-medir com todos os pills
  useEffect(() => {
    prevContainerWidthRef.current = 0
    setOverflowFrom(Infinity)
  }, [project.links, project.dashboardUrl])

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const path = `${project.id}/logo`
    const { error } = await supabase.storage.from('brand-logos').upload(path, file, { upsert: true })
    if (error) { console.error('[Logo] upload:', error.message); return }
    updateProject(project.id, { logoUrl: path })
  }

  function handleSaveOnboarding(data) { updateProject(project.id, data); showToast('Dados do cliente salvos!') }
  function handleSaveROI(calc, result) { updateProject(project.id, { roiCalc: calc, roiResult: result }); showToast('ROI salvo!') }
  function handleSavePersonas(personas) { updateProject(project.id, { personas }); setActiveSection('produtos'); showToast('Personas salvas!') }
  function handleSaveProdutos(produtos) { updateProject(project.id, { produtos }); showToast('Produtos salvos!') }
  function handleSaveOferta(ofertaData) { updateProject(project.id, { ofertaData }); showToast('Oferta salva!') }
  function handleSaveCampaign(plan) { updateProject(project.id, { campaignPlan: plan }); showToast('Planejamento salvo!') }
  function handleSaveEstrategia(estrategiaData) { updateProject(project.id, { estrategia: estrategiaData }); showToast('Estratégia salva!') }
  function handleSaveEstrategiaV2(data) { updateProject(project.id, { estrategiaV2: data }); showToast('Análise salva!') }
  function handleSaveLinks(links) { updateProject(project.id, { links }); showToast('Links salvos!') }


  function resetLinkState() {
    setLinkStep('idle'); setLinkPickedType(null); setLinkInput(''); setLinkLabel('')
  }

  function handleSaveLink() {
    const raw = linkInput.trim()
    if (!raw) return
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    if (linkPickedType === 'dashboard') {
      updateProject(project.id, { dashboardUrl: url })
    } else if (linkPickedType === 'outro') {
      updateProject(project.id, { links: { ...lnk, outros: [...(lnk.outros || []), { label: linkLabel || 'Link', url }] } })
    } else {
      updateProject(project.id, { links: { ...lnk, [linkPickedType]: url } })
    }
    resetLinkState()
  }

  const companyInitials = initials(project.companyName)
  const hasROI          = !!project.roiResult
  const hasPersonas     = project.personas?.length > 0
  const hasOferta       = !!(project.ofertaData?.nome || project.ofertaData?.resultadoSonho)
  const hasCampaignPlan = !!(project.campaignPlan?.totalBudget > 0 && project.campaignPlan?.channels?.length > 0)
  const hasProdutos     = (project.produtos || []).length > 0 && !!(project.produtos[0]?.nome || project.produtos[0]?.answers?.q1)
  const hasGoogleAds    = (project.googleAds || []).length > 0
  const lnk             = project.links || {}
  const hasLinks        = !!(lnk.instagram || lnk.website || lnk.googleDrive || (lnk.outros || []).length > 0)
  const hasEstrategia   = !!project.estrategia?.narrativa
  const hasEstrategiaV2 = !!(project.estrategiaV2?.problemas?.length || project.estrategiaV2?.swot?.forcas)
  const hasBancoMidia   = !!(project.brandKit?.logo || (project.brandKit?.cores || []).length > 0 || (project.brandFotos || []).length > 0 || (project.brandVideos || []).length > 0)
  const hasAnexos       = (project.attachments || []).length > 0
  const hasLandingPages = (project.landingPages || []).length > 0
  const hasResultados   = !!project.resultados?.modelo

  const NAV_ITEMS = [
    { id: 'dados',        label: 'Dados do Cliente',        icon: ClipboardList,  color: 'text-rl-cyan',   filled: true },
    { id: 'roi',          label: 'Calculadora de ROI',       icon: BarChart3,      color: 'text-rl-purple', filled: hasROI },
    { id: 'icp',          label: 'Personas',                 icon: Users,          color: 'text-rl-blue',   filled: hasPersonas },
    { id: 'produtos',     label: 'Produto / Serviço',        icon: Package,        color: 'text-rl-gold',   filled: hasProdutos },
    { id: 'oferta',       label: 'Oferta Matadora',          icon: Zap,            color: 'text-rl-gold',   filled: hasOferta },
    { id: 'campaign',     label: 'Campanhas',                icon: CalendarDays,   color: 'text-rl-green',  filled: hasCampaignPlan },
    { id: 'anexos',       label: 'Anexos',                   icon: Paperclip,      color: 'text-rl-gold',   filled: hasAnexos },
    { id: 'criativos',    label: 'Criativos com IA',         icon: Clapperboard,   color: 'text-rl-cyan',   filled: false },
    { id: 'landingpage',  label: 'Landing Page com IA',      icon: LayoutTemplate, color: 'text-rl-green',  filled: hasLandingPages },
    { id: 'resultados',   label: 'Resultados',               icon: Activity,       color: 'text-rl-purple', filled: hasResultados },
    { id: 'metalab',      label: 'Lab. Meta Ads',            icon: FlaskConical,   color: 'text-rl-purple', filled: !!project.metaLabBudget },
    { id: 'googleads',    label: 'Google Ads com IA',        icon: Search,         color: 'text-rl-cyan',   filled: hasGoogleAds },
    { id: 'bancomídia',   label: 'Banco de Mídia',           icon: ImagePlay,      color: 'text-rl-blue',   filled: hasBancoMidia },
    { id: 'estrategia',   label: 'Estratégia Digital',       icon: Layers,         color: 'text-rl-purple', filled: hasEstrategia },
    { id: 'estrategiav2', label: 'Análise Competitiva',      icon: Map,            color: 'text-rl-blue',   filled: hasEstrategiaV2 },
    { id: 'links',        label: 'Links Importantes',        icon: Link2,          color: 'text-rl-cyan',   filled: hasLinks },
  ]

  function renderContent() {
    switch (activeSection) {
      case 'dados':        return <OnboardingContent project={project} onSave={handleSaveOnboarding} />
      case 'roi':          return <ROICalculator project={project} onSave={handleSaveROI} />
      case 'icp':          return <PersonaCreator project={project} onSave={handleSavePersonas} />
      case 'produtos':     return (
        <div className="space-y-4">
          {hasProdutos && (
            <div className="flex justify-end">
              <button
                onClick={() => exportProdutoServicoPDF(project)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <FileDown className="w-4 h-4" />
                Exportar PDF
              </button>
            </div>
          )}
          <ProdutoServicoModule project={project} onSave={handleSaveProdutos} />
        </div>
      )
      case 'oferta':       return <OfertaMatadora project={project} onSave={handleSaveOferta} />
      case 'campaign':     return <CampaignPlanner project={project} onSave={handleSaveCampaign} />
      case 'anexos':       return <AnexosModule project={project} />
      case 'criativos':    return <CriativosModule project={project} />
      case 'landingpage':  return <LandingPageModule project={project} />
      case 'resultados':   return <ResultadosModule project={project} />
      case 'metalab':      return <MetaLabModule project={project} />
      case 'googleads':    return <GoogleAdsModule project={project} />
      case 'bancomídia':   return <BancoMidiaModule project={project} />
      case 'estrategia':   return <EstrategiaModule project={project} onSave={handleSaveEstrategia} />
      case 'estrategiav2': return <EstrategiaV2Module project={project} onSave={handleSaveEstrategiaV2} />
      case 'links':        return <LinksModule project={project} onSave={handleSaveLinks} />
      default:             return null
    }
  }

  return (
    <div className="space-y-0">

      {/* ── Profile Header ──────────────────────────────────────────────── */}
      <div className="glass-card border border-rl-green/20">
        <div className="relative h-32 bg-gradient-to-br from-rl-purple/20 via-rl-blue/10 to-rl-cyan/5 overflow-hidden rounded-t-xl">
          <div className="absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: 'radial-gradient(circle, #164496 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
          <div className="absolute top-4 left-4">
            <button
              onClick={() => setSidebarVisible((v) => !v)}
              title={sidebarVisible ? 'Ocultar sidebar' : 'Exibir sidebar'}
              className={`p-2 rounded-lg border transition-all duration-150 ${
                sidebarVisible
                  ? 'bg-rl-purple/20 border-rl-purple/40 text-rl-purple'
                  : 'bg-rl-surface/60 border-rl-border text-rl-muted hover:border-rl-purple/30 hover:text-rl-purple'
              }`}
            >
              {sidebarVisible ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-rl-green/20 border border-rl-green/30 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 text-rl-green" />
            <span className="text-xs font-semibold text-rl-green">Onboarding Completo</span>
          </div>
        </div>

        <div className="relative px-6 pb-6">
          <div className="absolute -top-12 left-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl border-4 border-rl-bg bg-rl-surface overflow-hidden flex items-center justify-center shadow-xl">
                {logoSignedUrl
                  ? <img src={logoSignedUrl} alt="Logo" className="w-full h-full object-cover" />
                  : <span className="text-2xl font-black text-rl-purple">{companyInitials}</span>
                }
              </div>
              <button
                onClick={() => logoInputRef.current?.click()}
                className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Alterar logo"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>

          <div className="pt-14">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black text-rl-text">{project.companyName}</h1>
                <p className="text-sm text-rl-muted mt-0.5">
                  {BUSINESS_LABELS[project.businessType] || project.businessType}
                  {project.responsibleName && ` · ${project.responsibleName}`}
                  {project.responsibleRole && ` · ${project.responsibleRole}`}
                </p>
                {(project.contractDate || project.contractModel || project.contractValue) && (
                  <p className="text-xs text-rl-muted mt-1 flex items-center gap-1.5 flex-wrap">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    {project.contractDate && (
                      <span>{new Date(project.contractDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    )}
                    {project.contractModel && (
                      <>
                        {project.contractDate && <span className="opacity-40">·</span>}
                        <span>{CONTRACT_MODEL_LABELS[project.contractModel] || project.contractModel}</span>
                      </>
                    )}
                    {project.contractValue && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="font-semibold text-rl-subtle">{fmtCurrency(project.contractValue)}{project.contractModel === 'assessoria' ? '/mês' : ''}</span>
                      </>
                    )}
                  </p>
                )}
                {/* ── Squad Assignment ──────────────────────────────────── */}
                {(() => {
                  const currentSquadIdx = squads.findIndex((s) => s.id === project.squad)
                  const currentSquad    = currentSquadIdx >= 0 ? squads[currentSquadIdx] : null
                  const currentColors   = currentSquad ? SQUAD_COLORS[currentSquadIdx % SQUAD_COLORS.length] : null

                  const resolveMembers = (sq) =>
                    (sq.members || []).map((m) => {
                      const profile = teamMembers.find((t) => t.id === m.profile_id)
                      return { name: profile?.name || m.profile_id, role: m.role }
                    })

                  return (
                    <div className="mt-3 relative inline-block" ref={squadRef}>
                      {currentSquad ? (
                        <div className="flex items-center gap-3">
                          {/* Squad badge — click to change, hover to preview members */}
                          <button
                            ref={squadBadgeRef}
                            onClick={() => setSquadOpen((v) => !v)}
                            onMouseEnter={() => {
                              if (!squadBadgeRef.current) return
                              const rect = squadBadgeRef.current.getBoundingClientRect()
                              setSquadTooltipPos({ x: rect.left, y: rect.top })
                            }}
                            onMouseLeave={() => setSquadTooltipPos(null)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-semibold text-xs transition-all shrink-0 ${currentColors.bg} ${currentColors.border} ${currentColors.text}`}
                          >
                            <Users2 className="w-3.5 h-3.5" />
                            {currentSquad.emoji} {currentSquad.name}
                            <ChevronDown className="w-3 h-3 opacity-60" />
                          </button>
                          {squadTooltipPos && resolveMembers(currentSquad).length > 0 && createPortal(
                            <div
                              style={{ position: 'fixed', left: squadTooltipPos.x, top: squadTooltipPos.y - 8, transform: 'translateY(-100%)' }}
                              className="z-[9999] pointer-events-none"
                            >
                              <div className="glass-card border border-rl-border shadow-xl py-2 px-3 rounded-xl min-w-[180px]">
                                <p className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider mb-1.5">{currentSquad.name}</p>
                                {resolveMembers(currentSquad).map((m, i) => (
                                  <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                                    <span className="text-xs text-rl-text whitespace-nowrap">{m.name}</span>
                                    <span className="text-[10px] text-rl-muted whitespace-nowrap">{m.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>,
                            document.body
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setSquadOpen((v) => !v)}
                          className="flex items-center gap-1.5 text-xs text-rl-muted border border-dashed border-rl-border px-3 py-1.5 rounded-full hover:border-rl-purple/40 hover:text-rl-purple transition-all"
                        >
                          <Users2 className="w-3.5 h-3.5" />
                          Designar Squad
                        </button>
                      )}

                      {/* Dropdown */}
                      {squadOpen && (
                        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[220px] glass-card border border-rl-border shadow-2xl p-1.5 space-y-0.5">
                          {squads.length === 0 && (
                            <p className="px-3 py-2 text-xs text-rl-muted">Nenhum squad cadastrado.</p>
                          )}
                          {squads.map((sq, idx) => {
                            const colors = SQUAD_COLORS[idx % SQUAD_COLORS.length]
                            const members = resolveMembers(sq)
                            return (
                              <button
                                key={sq.id}
                                onClick={() => { updateProject(project.id, { squad: sq.id }); setSquadOpen(false) }}
                                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                                  project.squad === sq.id
                                    ? `${colors.bg} ${colors.text} border ${colors.border}`
                                    : 'hover:bg-rl-surface text-rl-text'
                                }`}
                              >
                                <span className="text-base">{sq.emoji || '👥'}</span>
                                <div>
                                  <p className="font-bold leading-tight">{sq.name}</p>
                                  {members.length > 0 && (
                                    <p className="text-[10px] opacity-60 leading-tight">{members.map((m) => m.name).join(' · ')}</p>
                                  )}
                                </div>
                                {project.squad === sq.id && <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0" />}
                              </button>
                            )
                          })}
                          {project.squad && (
                            <button
                              onClick={() => { updateProject(project.id, { squad: null }); setSquadOpen(false) }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-rl-muted hover:bg-rl-surface transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                              Remover Squad
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div className="flex flex-col items-end gap-3 min-w-0 max-w-[70%]">

                {/* ── Links + Dashboard ── */}
                {(() => {
                  const hiddenFromHeader = lnk.hiddenFromHeader || []
                  const allLinks = [
                    project.dashboardUrl && {
                      key: 'dashboard', label: 'Dashboard', href: project.dashboardUrl,
                      Icon: LayoutDashboard, pill: 'bg-rl-cyan/10 border-rl-cyan/30 text-rl-cyan',
                      onRemove: () => updateProject(project.id, { dashboardUrl: null }),
                    },
                    lnk.instagram && !hiddenFromHeader.includes('instagram') && {
                      key: 'instagram', label: 'Instagram', href: lnk.instagram.startsWith('http') ? lnk.instagram : `https://${lnk.instagram}`,
                      Icon: Instagram, pill: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
                      onRemove: () => updateProject(project.id, { links: { ...lnk, instagram: '' } }),
                    },
                    lnk.website && !hiddenFromHeader.includes('website') && {
                      key: 'website', label: 'Website', href: lnk.website.startsWith('http') ? lnk.website : `https://${lnk.website}`,
                      Icon: Globe, pill: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
                      onRemove: () => updateProject(project.id, { links: { ...lnk, website: '' } }),
                    },
                    lnk.googleDrive && !hiddenFromHeader.includes('googleDrive') && {
                      key: 'googleDrive', label: 'Google Drive', href: lnk.googleDrive.startsWith('http') ? lnk.googleDrive : `https://${lnk.googleDrive}`,
                      Icon: HardDrive, pill: 'bg-green-500/10 border-green-500/30 text-green-400',
                      onRemove: () => updateProject(project.id, { links: { ...lnk, googleDrive: '' } }),
                    },
                    ...(lnk.outros || []).filter(o => o.url && !o.hidden).map((outro, i) => ({
                      key: `outro-${i}`, label: outro.label || 'Link', href: outro.url.startsWith('http') ? outro.url : `https://${outro.url}`,
                      Icon: Link2, pill: 'bg-rl-purple/10 border-rl-purple/30 text-rl-purple',
                      onRemove: () => updateProject(project.id, { links: { ...lnk, outros: (lnk.outros || []).filter((_, idx) => idx !== i) } }),
                    })),
                  ].filter(Boolean)
                  allLinksCountRef.current = allLinks.length
                  const visibleLinks = allLinks.slice(0, overflowFrom)
                  const overflow = allLinks.slice(overflowFrom)

                  return (
                    <div className="flex items-center gap-2 w-full">
                      {/* Pills row — só as visíveis; ResizeObserver detecta quando mais pills cabem */}
                      <div ref={pillsRowRef} className="flex items-center gap-2 flex-nowrap overflow-hidden flex-1 min-w-0">
                        {visibleLinks.map(({ key, label, href, Icon, pill, onRemove }) => (
                          <div key={key} className={`shrink-0 group relative flex items-center px-4 py-2 rounded-xl border text-sm font-semibold ${pill}`}>
                            <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity pr-4">
                              <Icon className="w-4 h-4" />{label}
                            </a>
                            <button onClick={onRemove} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 bg-white text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all" title="Remover"><X className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>

                      {/* Botão overflow "Mais N" — fora do overflow-hidden, sempre visível */}
                      {overflow.length > 0 && (
                        <div className="shrink-0 relative" ref={overflowRef}>
                          <button
                            onClick={() => setOverflowOpen(o => !o)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted text-sm font-medium hover:border-rl-purple/40 hover:text-rl-purple transition-all"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />Mais {overflow.length}
                          </button>
                          {overflowOpen && (
                            <div className="absolute right-0 top-full mt-1 z-50 glass-card p-1 min-w-[180px] shadow-lg border border-rl-border">
                              {overflow.map(({ key, label, href, Icon, pill, onRemove }) => (
                                <div key={key} className="group relative flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-rl-surface transition-all">
                                  <a href={href} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 text-sm font-medium flex-1 min-w-0 hover:opacity-80 transition-opacity ${pill.split(' ').find(c => c.startsWith('text-'))}`}>
                                    <Icon className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{label}</span>
                                  </a>
                                  <button onClick={() => { onRemove(); if (overflow.length === 1) setOverflowOpen(false) }} className="shrink-0 rounded p-0.5 text-rl-muted/50 hover:text-red-400 transition-colors" title="Remover"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Botão + Link com dropdown e popover */}
                      <div className="shrink-0 relative" ref={linkRef}>
                        <button
                          onClick={() => setLinkStep(s => s === 'idle' ? 'dropdown' : 'idle')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-rl-border text-rl-muted text-sm hover:border-rl-purple/40 hover:text-rl-purple transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />Link
                        </button>

                        {/* Dropdown de tipos */}
                        {linkStep === 'dropdown' && (
                          <div className="absolute right-0 top-full mt-1 z-50 glass-card p-1 min-w-[180px] shadow-lg border border-rl-border">
                            {[
                              { id: 'instagram',   label: 'Instagram',    Icon: Instagram,       color: 'text-pink-400',  hide: !!lnk.instagram        },
                              { id: 'website',     label: 'Website',      Icon: Globe,           color: 'text-blue-400',  hide: !!lnk.website          },
                              { id: 'googleDrive', label: 'Google Drive', Icon: HardDrive,       color: 'text-green-400', hide: !!lnk.googleDrive      },
                              { id: 'dashboard',   label: 'Dashboard',    Icon: LayoutDashboard, color: 'text-rl-cyan',   hide: !!project.dashboardUrl },
                              { id: 'outro',       label: 'Personalizado', Icon: Link2,          color: 'text-rl-purple', hide: false                  },
                            ].filter(o => !o.hide).map(({ id, label, Icon, color }) => (
                              <button
                                key={id}
                                onClick={() => { setLinkPickedType(id); setLinkInput(''); setLinkLabel(''); setLinkStep('input') }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-rl-text hover:bg-rl-surface transition-all"
                              >
                                <Icon className={`w-4 h-4 ${color} shrink-0`} />{label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Popover de input */}
                        {linkStep === 'input' && (() => {
                          const opts = [
                            { id: 'instagram',   label: 'Instagram',    Icon: Instagram,       color: 'text-pink-400',  placeholder: 'https://instagram.com/...' },
                            { id: 'website',     label: 'Website',      Icon: Globe,           color: 'text-blue-400',  placeholder: 'https://www.empresa.com.br' },
                            { id: 'googleDrive', label: 'Google Drive', Icon: HardDrive,       color: 'text-green-400', placeholder: 'https://drive.google.com/...' },
                            { id: 'dashboard',   label: 'Dashboard',    Icon: LayoutDashboard, color: 'text-rl-cyan',   placeholder: 'https://lookerstudio.google.com/...' },
                            { id: 'outro',       label: 'Personalizado', Icon: Link2,          color: 'text-rl-purple', placeholder: 'https://...' },
                          ]
                          const opt = opts.find(o => o.id === linkPickedType) || opts[0]
                          return (
                            <div className="absolute right-0 top-full mt-2 z-50 glass-card p-4 shadow-glow w-96 space-y-3 border border-rl-border">
                              <p className={`text-sm font-semibold flex items-center gap-1.5 ${opt.color}`}>
                                <opt.Icon className="w-4 h-4" />{opt.label}
                              </p>
                              {linkPickedType === 'outro' && (
                                <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Nome da plataforma..." className="input-field w-full" />
                              )}
                              <div className="flex gap-2 items-center">
                                <input
                                  autoFocus
                                  value={linkInput}
                                  onChange={(e) => setLinkInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLink(); if (e.key === 'Escape') resetLinkState() }}
                                  placeholder={opt.placeholder}
                                  className="input-field flex-1"
                                />
                                <button onClick={handleSaveLink} className="w-9 h-9 flex items-center justify-center rounded-lg bg-rl-green/10 border border-rl-green/30 text-rl-green hover:bg-rl-green/20 transition-all"><Check className="w-4 h-4" /></button>
                                <button onClick={resetLinkState} className="w-9 h-9 flex items-center justify-center rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"><X className="w-4 h-4" /></button>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-panel layout ─────────────────────────────────────────────── */}
      <div className="flex gap-4 pt-4 items-stretch">

        {/* Sidebar nav */}
        {sidebarVisible && <div className="w-64 shrink-0">
          <div className="glass-card p-2 sticky top-20">
            {NAV_ITEMS.map(({ id, label, icon: Icon, color, filled }) => {
              const isActive = activeSection === id
              return (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-rl-purple text-white shadow-sm'
                      : 'text-rl-subtle hover:bg-rl-bg hover:text-rl-text'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : color}`} />
                  <span className="truncate flex-1 text-left">{label}</span>
                  {filled && !isActive && (
                    <CheckCircle2 className="w-3 h-3 shrink-0 text-rl-green opacity-80" />
                  )}
                </button>
              )
            })}
          </div>
        </div>}

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          <div className="glass-card p-6">
            {renderContent()}
          </div>
        </div>

      </div>

      <Toast toast={toast} />
    </div>
  )
}
