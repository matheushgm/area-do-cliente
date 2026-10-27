// Menu da página do cliente: "Visão geral" + cinco menus suspensos (Cliente, Projetos,
// Resultados, Planejamento, Criação) que juntam as abas do hub e
// os módulos. Substituiu a barra de abas do HubCentro e o botão "Módulos". Não há gaveta
// "Outros": item em teste fica no lugar onde é usado, com `beta: true` (selo no item).
// Compartilhamento fica fora do menu, num botão ao lado do "Modo Apresentação" (ClientProfile).
//
// Chave de item: 'aba:<id>' abre uma aba do hub (HubCentro); qualquer outra é o id de
// uma seção do ClientProfile. Os ids de seção NÃO podem ser renomeados (ver
// clientSections.js); o rótulo do menu é livre e vem daqui.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, CheckCircle2, LayoutDashboard, Kanban, StickyNote, Sparkles, Wrench } from 'lucide-react'
import ModulosMenu from './ModulosMenu'

const ABAS = {
  'aba:resumo': { label: 'Visão geral', icon: LayoutDashboard, color: 'text-rl-purple' },
  'aba:tarefas': { label: 'Tarefas', icon: Kanban, color: 'text-rl-purple' },
  'aba:anotacoes': { label: 'Anotações', icon: StickyNote, color: 'text-rl-gold' },
  'aba:sugestoes': { label: 'Sugestões', icon: Sparkles, color: 'text-rl-purple' },
  'aba:otimizacoes': { label: 'Otimizações', icon: Wrench, color: 'text-rl-cyan' },
}

export const MENU_CLIENTE = [
  // Ordem pedida pelo Matheus (2026-10-27): Cliente, Projetos, Resultados, Planejamento, Criação.
  { id: 'cliente', label: 'Cliente', grupos: [
    { label: 'Cadastro', itens: ['dados', 'banco-midia', 'links', 'anexos'] },
    { label: 'Estratégia', itens: ['kickoff', 'produtos', 'icp', 'oferta', 'estrategiav2', 'ferramentas'] },
  ] },
  { id: 'projeto', label: 'Projetos', grupos: [
    { itens: ['aba:tarefas', { id: 'atas', label: 'Reuniões' }, 'aba:anotacoes', 'jornada', 'nps'] },
  ] },
  // Otimização logo depois do desempenho: ler o resultado e agir.
  // `colunas: 1` = grupos um embaixo do outro (painel estreito, abre para a direita do botão)
  { id: 'resultados', label: 'Resultados', colunas: 1, grupos: [
    { label: 'Desempenho', itens: [{ id: 'trafego', label: 'Resultados de Tráfego' }, { id: 'resultados', label: 'Resultados de Funil' }] },
    { label: 'Otimização', itens: ['aba:sugestoes', 'aba:otimizacoes'] },
    { label: 'Leads e vendas', itens: [{ id: 'crm', beta: true }, 'bancodados'] },
  ] },
  { id: 'planejamento', label: 'Planejamento', grupos: [
    { itens: [
      { id: 'roi', label: 'Calc. de ROI' },
      { id: 'campaign', label: 'Plan. de campanhas' },
      { id: 'metalab', label: 'Lab. Meta Ads' },
      { id: 'googleads', label: 'Lab. Google Ads' },
    ] },
  ] },
  { id: 'criacao', label: 'Criação', grupos: [
    { label: 'Anúncios', itens: ['criativos', 'debriefing'] },
    { label: 'Landing pages', itens: [{ id: 'landingpage', label: 'Criação de LP' }, { id: 'lpcentral', label: 'Central de LPs' }, { id: 'clarity', beta: true }] },
  ] },
]

// Resolve o menu com ícone, cor e "preenchido" de cada módulo (NAV_ITEMS do ClientProfile)
export function montarMenu(modulos) {
  const porId = new Map(modulos.map((m) => [m.id, m]))
  return MENU_CLIENTE.map((menu) => ({
    ...menu,
    grupos: menu.grupos.map((g) => ({
      ...g,
      itens: g.itens.map((it) => {
        const id = typeof it === 'string' ? it : it.id
        const base = ABAS[id] || porId.get(id) || { label: id }
        return { ...base, id, label: (typeof it === 'object' && it.label) || base.label, beta: typeof it === 'object' && !!it.beta }
      }),
    })),
  }))
}

// Onde a chave está: { menu, grupo, item } (pro breadcrumb e pra marcar o menu ativo)
export function localizarNoMenu(menus, chave) {
  for (const menu of menus) for (const grupo of menu.grupos) {
    const item = grupo.itens.find((i) => i.id === chave)
    if (item) return { menu, grupo, item }
  }
  return null
}

function Badge({ n, destaque }) {
  if (!n) return null
  return <span className={`text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ${destaque ? 'bg-rl-purple text-white' : 'bg-rl-surface text-rl-muted'}`}>{n}</span>
}

function ItemMenu({ item, ativo, contagens, onClick }) {
  const Icon = item.icon
  const n = contagens[item.id] || 0
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors ${ativo ? 'bg-rl-purple/10 text-rl-purple font-semibold' : 'text-rl-subtle hover:bg-rl-surface hover:text-rl-text'}`}
    >
      {Icon && <Icon className={`w-4 h-4 shrink-0 ${ativo ? 'text-rl-purple' : item.color || 'text-rl-muted'}`} />}
      <span className="flex-1 min-w-0">{item.label}</span>
      {item.beta && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-rl-gold/15 text-rl-gold">Beta</span>}
      <Badge n={n} destaque={item.id === 'aba:sugestoes'} />
      {item.filled && !ativo && <CheckCircle2 className="w-3 h-3 shrink-0 text-rl-green opacity-80" />}
    </button>
  )
}

const COLUNAS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }
// cada grupo é uma coluna, a não ser que o menu diga `colunas`
const colunasDe = (menu) => menu.colunas || menu.grupos.length
// largura do painel por número de colunas
export const LARGURA_PAINEL = { 1: 'w-[280px]', 2: 'w-[540px]', 3: 'w-[760px]' }

function Grupos({ menu, ativa, contagens, onEscolher, lista = false }) {
  return (
    <div className={`grid gap-x-3 gap-y-2 ${lista ? '' : COLUNAS[colunasDe(menu)] || ''}`}>
      {menu.grupos.map((g, i) => (
        <div key={g.label || i} className="min-w-0">
          {g.label && <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-rl-muted">{g.label}</p>}
          <div className="space-y-0.5">
            {g.itens.map((it) => (
              <ItemMenu key={it.id} item={it} ativo={ativa === it.id} contagens={contagens} onClick={() => onEscolher(it.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Gatilho({ ativo, children, ...props }) {
  return (
    <button
      {...props}
      className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${ativo ? 'text-rl-text font-semibold' : 'text-rl-subtle hover:text-rl-text'}`}
    >
      {children}
      {ativo && <span className="absolute left-2 right-2 -bottom-px h-[3px] bg-rl-purple rounded-full" />}
    </button>
  )
}

// Painel do menu: abre para a direita, alinhado ao botão; se passar da borda da tela,
// recua só o que falta (mantendo 16px de margem) em vez de abrir para a esquerda.
function Painel({ largura, children }) {
  const ref = useRef(null)
  // mede antes da pintura e desloca direto no DOM (sem segundo render)
  useLayoutEffect(() => {
    const el = ref.current
    const r = el?.getBoundingClientRect()
    if (!r) return
    const sobra = window.innerWidth - 16 - r.right
    if (sobra < 0) el.style.transform = `translateX(${Math.max(sobra, 16 - r.left)}px)`
  }, [])
  return (
    <div
      ref={ref}
      role="menu"
      className={`absolute left-0 top-full mt-1.5 z-30 glass-card border border-rl-border shadow-xl p-2 max-w-[calc(100vw-2rem)] ${largura}`}
    >
      {children}
    </div>
  )
}

// Barra do desktop (e tablet): cada menu abre um painel com os grupos lado a lado.
// Com um menu aberto, passar o mouse em outro troca (como uma barra de menus).
export default function MenuCliente({ menus, ativa, contagens = {}, onEscolher, antes = null }) {
  const [aberto, setAberto] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(null) }
    const esc = (e) => { if (e.key === 'Escape') setAberto(null) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  const escolher = (chave) => { setAberto(null); onEscolher(chave) }
  const menuAtivo = localizarNoMenu(menus, ativa)?.menu.id
  const busca = menus.flatMap((m) => m.grupos.flatMap((g) => g.itens.map((it) => ({ ...it, grupo: [m.label, g.label].filter(Boolean).join(' · ') }))))
  const totalMenu = (menu) => menu.grupos.reduce((s, g) => s + g.itens.reduce((t, it) => t + (it.id === 'aba:sugestoes' ? contagens[it.id] || 0 : 0), 0), 0)

  return (
    <div ref={ref} className="glass-card border border-rl-border/60 px-2 hidden sm:flex items-center gap-1">
      {antes}
      <div className="flex flex-wrap items-center gap-0.5 min-w-0 flex-1">
        <Gatilho ativo={ativa === 'aba:resumo'} onClick={() => escolher('aba:resumo')}>
          <LayoutDashboard className="w-3.5 h-3.5" /> Visão geral
        </Gatilho>
        {menus.map((menu) => {
          const n = totalMenu(menu)
          return (
            <div key={menu.id} className="relative">
              <Gatilho
                ativo={menuAtivo === menu.id || aberto === menu.id}
                aria-haspopup="menu"
                aria-expanded={aberto === menu.id}
                onClick={() => setAberto((v) => (v === menu.id ? null : menu.id))}
                onMouseEnter={() => { if (aberto && aberto !== menu.id) setAberto(menu.id) }}
              >
                {menu.label}
                <Badge n={n} destaque />
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aberto === menu.id ? 'rotate-180' : ''}`} />
              </Gatilho>
              {aberto === menu.id && (
                <Painel largura={LARGURA_PAINEL[colunasDe(menu)] || LARGURA_PAINEL[3]}>
                  <Grupos menu={menu} ativa={ativa} contagens={contagens} onEscolher={escolher} />
                </Painel>
              )}
            </div>
          )
        })}
      </div>
      <ModulosMenu modulos={busca} onAbrir={onEscolher} />
    </div>
  )
}

// Versão em lista (drawer do mobile): os mesmos menus, um embaixo do outro
export function MenuClienteLista({ menus, ativa, contagens = {}, onEscolher }) {
  return (
    <div className="p-2 space-y-3">
      <ItemMenu item={{ id: 'aba:resumo', ...ABAS['aba:resumo'] }} ativo={ativa === 'aba:resumo'} contagens={contagens} onClick={() => onEscolher('aba:resumo')} />
      {menus.map((menu) => (
        <div key={menu.id}>
          <p className="px-2.5 pb-1 text-xs font-semibold text-rl-text flex items-center gap-1.5">
            {menu.label}
          </p>
          <Grupos menu={menu} lista ativa={ativa} contagens={contagens} onEscolher={onEscolher} />
        </div>
      ))}
    </div>
  )
}
