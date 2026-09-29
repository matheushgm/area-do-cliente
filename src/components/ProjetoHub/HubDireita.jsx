// Coluna direita da página do cliente: cartões recolhíveis com o resumo dos
// módulos de acesso rápido (Jornada, Central de anúncios, LPs, Campanhas,
// Anexos, Links, NPS, Atas). Clicar no título abre o módulo no centro.
import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Map as MapIcon, Megaphone, LayoutTemplate, CalendarDays,
  Paperclip, Link2, Star, NotebookPen, ExternalLink, Plus, Globe, Instagram, HardDrive, Kanban, LayoutDashboard,
} from 'lucide-react'
import { PHASES, computeProgress, getModuleStatus } from '../Jornada/jornadaPhases'
import { fmtCurrency } from '../../lib/utils'

function Card({ icon: Icon, titulo, contagem, onAbrir, onAdicionar, aberto: abertoInicial = true, children }) {
  const [aberto, setAberto] = useState(abertoInicial)
  return (
    <div className="glass-card border border-rl-border/60">
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={onAbrir} className="flex items-center gap-2 min-w-0 flex-1 text-left group" title="Abrir módulo">
          <span className="w-7 h-7 rounded-full flex items-center justify-center fx-soft"><Icon className="w-3.5 h-3.5" /></span>
          <span className="text-sm font-semibold text-rl-text group-hover:text-rl-purple truncate">{titulo}</span>
          {contagem != null && <span className="text-[11px] text-rl-muted">({contagem})</span>}
        </button>
        {onAdicionar && (
          <button onClick={onAdicionar} className="flex items-center gap-1 text-xs text-rl-subtle hover:text-rl-purple px-1.5 py-1 rounded-md hover:bg-rl-surface transition-colors">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        )}
        <button onClick={() => setAberto((v) => !v)} className="p-1 rounded-md text-rl-muted hover:text-rl-text hover:bg-rl-surface" aria-label={aberto ? 'Recolher' : 'Expandir'}>
          {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
      {aberto && <div className="px-4 pb-4 border-t border-rl-border/60 pt-3">{children}</div>}
    </div>
  )
}

function Vazio({ texto, sub }) {
  return (
    <div className="text-center py-3">
      <p className="text-sm text-rl-subtle">{texto}</p>
      {sub && <p className="text-xs text-rl-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function Linha({ label, valor, href }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-rl-muted truncate">{label}</span>
      {href
        ? <a href={href} target="_blank" rel="noreferrer" className="text-rl-purple hover:underline truncate flex items-center gap-1 max-w-[60%]"><span className="truncate">{valor}</span><ExternalLink className="w-3 h-3 shrink-0" /></a>
        : <span className="text-rl-text font-medium truncate max-w-[60%]">{valor}</span>}
    </div>
  )
}

const ADS_STATUS = { para_subir: 'Para subir', em_andamento: 'Em andamento', finalizado: 'Finalizado' }
const LP_STATUS = { em_producao: 'Em produção', no_ar: 'No ar', desativada: 'Desativada' }

export default function HubDireita({ project, onNavigate, modulos = null }) {
  const progresso = computeProgress(project)
  const proximo = (() => {
    for (const fase of PHASES) for (const m of fase.modules) if (getModuleStatus(project, m.id) !== 'concluido') return m
    return null
  })()

  const ads = project.debriefing?.ads || []
  const adsPorStatus = ads.reduce((acc, a) => { const s = a.status || 'para_subir'; acc[s] = (acc[s] || 0) + 1; return acc }, {})
  const lps = project.lpCentral?.lps || []
  const lpsPorStatus = lps.reduce((acc, l) => { const s = l.status || 'em_producao'; acc[s] = (acc[s] || 0) + 1; return acc }, {})
  const plano = project.campaignPlan
  const anexos = project.attachments || []
  const lnk = project.links || {}
  const links = [
    project.dashboardUrl && { label: 'Dashboard', href: project.dashboardUrl, Icon: LayoutDashboard },
    project.clickupListUrl && { label: 'ClickUp', href: project.clickupListUrl, Icon: Kanban },
    lnk.website && { label: 'Website', href: lnk.website, Icon: Globe },
    lnk.instagram && { label: 'Instagram', href: lnk.instagram, Icon: Instagram },
    lnk.googleDrive && { label: 'Google Drive', href: lnk.googleDrive, Icon: HardDrive },
    ...((lnk.outros || []).map((o) => ({ label: o.label || 'Link', href: o.url, Icon: Link2 }))),
  ].filter(Boolean).map((l) => ({ ...l, href: /^https?:\/\//i.test(l.href) ? l.href : `https://${l.href}` }))
  const respostasNps = (project.npsMarcos || []).flatMap((m) => (m.respostas || []).map((r) => ({ ...r, marco: m.nome || m.label })))
  const mediaNps = respostasNps.length ? respostasNps.reduce((a, r) => a + Number(r.score ?? r.nota ?? 0), 0) / respostasNps.length : null

  return (
    <div className="space-y-3">
      <Card icon={MapIcon} color="text-rl-cyan" titulo="Jornada" contagem={`${progresso.done}/${progresso.total}`} onAbrir={() => onNavigate('jornada')}>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-rl-muted">Progresso geral</span>
          <span className="font-bold text-rl-green">{progresso.percent}%</span>
        </div>
        <div className="h-2 rounded-full bg-rl-surface overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-rl-green to-rl-purple" style={{ width: `${progresso.percent}%` }} />
        </div>
        {proximo
          ? <p className="text-xs text-rl-muted mt-2">Próxima etapa: <button onClick={() => onNavigate(proximo.viaFerramentas ? 'ferramentas' : proximo.id, proximo.viaFerramentas ? proximo.id : null)} className="font-semibold text-rl-text hover:text-rl-purple">{proximo.label}</button></p>
          : <p className="text-xs text-rl-green mt-2">Jornada concluída</p>}
      </Card>

      {modulos}

      <Card icon={Megaphone} color="text-rl-purple" titulo="Central de anúncios" contagem={ads.length} onAbrir={() => onNavigate('debriefing')} onAdicionar={() => onNavigate('debriefing')}>
        {ads.length === 0 ? <Vazio texto="Sem anúncios" sub="Nenhum anúncio cadastrado na central" /> : (
          <div>
            {Object.entries(ADS_STATUS).map(([k, label]) => adsPorStatus[k] ? <Linha key={k} label={label} valor={adsPorStatus[k]} /> : null)}
            {adsPorStatus.para_subir > 0 && <p className="text-[11px] text-rl-gold mt-1">{adsPorStatus.para_subir} anúncio{adsPorStatus.para_subir > 1 ? 's' : ''} aguardando subir</p>}
          </div>
        )}
      </Card>

      <Card icon={LayoutTemplate} color="text-rl-green" titulo="Central de Landing Pages" contagem={lps.length} onAbrir={() => onNavigate('lpcentral')} onAdicionar={() => onNavigate('lpcentral')}>
        {lps.length === 0 ? <Vazio texto="Sem landing pages" sub="Nenhuma LP cadastrada" /> : (
          <div>
            {Object.entries(LP_STATUS).map(([k, label]) => lpsPorStatus[k] ? <Linha key={k} label={label} valor={lpsPorStatus[k]} /> : null)}
            {lps.filter((l) => l.status === 'no_ar' && l.url).slice(0, 3).map((l) => (
              <Linha key={l.id || l.url} label={l.nome || l.name || 'LP'} valor="abrir" href={l.url} />
            ))}
          </div>
        )}
      </Card>

      <Card icon={CalendarDays} color="text-rl-green" titulo="Campanhas" onAbrir={() => onNavigate('campaign')} aberto={false}>
        {!(plano?.totalBudget > 0) ? <Vazio texto="Sem planejamento" sub="Defina verba e canais no módulo Campanhas" /> : (
          <div>
            <Linha label="Verba mensal" valor={fmtCurrency(plano.totalBudget)} />
            <Linha label="Canais" valor={(plano.channels || []).map((c) => c.name || c.label || c).join(', ') || '—'} />
          </div>
        )}
      </Card>

      <Card icon={Paperclip} color="text-rl-gold" titulo="Anexos" contagem={anexos.length} onAbrir={() => onNavigate('anexos')} onAdicionar={() => onNavigate('anexos')} aberto={false}>
        {anexos.length === 0 ? <Vazio texto="Sem anexos" sub="Nenhum arquivo vinculado a este projeto" /> : (
          <ul className="space-y-1">
            {anexos.slice(0, 5).map((a, i) => <li key={a.id || i} className="text-sm text-rl-text truncate">{a.name || a.nome || a.filename || 'Arquivo'}</li>)}
            {anexos.length > 5 && <li className="text-xs text-rl-muted">+{anexos.length - 5} arquivos</li>}
          </ul>
        )}
      </Card>

      <Card icon={Link2} color="text-rl-cyan" titulo="Links importantes" contagem={links.length} onAbrir={() => onNavigate('links')} onAdicionar={() => onNavigate('links')}>
        {links.length === 0 ? <Vazio texto="Sem links" sub="Cadastre site, Instagram, Drive e outros" /> : (
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.label + l.href}>
                <a href={l.href} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-rl-text hover:text-rl-purple py-1">
                  <l.Icon className="w-3.5 h-3.5 text-rl-muted shrink-0" /><span className="truncate">{l.label}</span><ExternalLink className="w-3 h-3 text-rl-muted ml-auto shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card icon={Star} color="text-rl-gold" titulo="NPS" contagem={respostasNps.length} onAbrir={() => onNavigate('nps')} aberto={false}>
        {respostasNps.length === 0 ? <Vazio texto="Sem respostas" sub="Nenhum marco de NPS respondido" /> : (
          <div>
            <Linha label="Nota média" valor={mediaNps.toFixed(1).replace('.', ',')} />
            <Linha label="Respostas" valor={respostasNps.length} />
          </div>
        )}
      </Card>

      <Card icon={NotebookPen} color="text-rl-purple" titulo="Atas de reunião" onAbrir={() => onNavigate('atas')} onAdicionar={() => onNavigate('atas')} aberto={false}>
        <p className="text-xs text-rl-muted">As reuniões aparecem na aba Reuniões da timeline.</p>
      </Card>
    </div>
  )
}
