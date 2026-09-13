// Tabela de capacidade do time (módulo Atividades, visual do Linear).
// Recebe as pessoas já enriquecidas por enriquecerPessoa e só desenha:
// não busca dado nem altera conta. Toda ação sobe pelos callbacks.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, Loader2, MoreHorizontal, PanelRight, Plus, RefreshCw } from 'lucide-react'
import {
  NIVEIS, DIAS, weekday, agruparPessoas, diaDe, tomOcupacao,
  fmtHoras, fmtPct, fmtDiaCurto, iniciais, primeiroNome,
} from '../../lib/atividadesCarga'

// ─── Colunas ─────────────────────────────────────────────────────────────────

const COLUNAS = [
  { id: 'saude',     label: '',              w: 24 },
  { id: 'pessoa',    label: 'Pessoa',        w: 240 },
  { id: 'ocupacao',  label: 'Ocupação 10d',  w: 160 },
  { id: 'dias',      label: '10 dias',       w: 96 },
  { id: 'hoje',      label: 'Hoje',          w: 84, dir: 'right' },
  { id: 'fila',      label: 'Fila',          w: 88, dir: 'right' },
  { id: 'atrasadas', label: 'Atrasadas',     w: 88, dir: 'right' },
  { id: 'semdata',   label: 'Sem data',      w: 64, dir: 'right' },
  { id: 'zumbis',    label: 'Zumbis',        w: 64, dir: 'right' },
  { id: 'proxlivre', label: 'Próx. livre',   w: 96 },
  { id: 'alem',      label: 'Além',          w: 64, dir: 'right' },
  { id: 'acoes',     label: '',              w: 28 },
]
const OCULTAVEIS = new Set(['semdata', 'zumbis', 'alem', 'proxlivre', 'hoje'])
const SEM_OCULTAS = []

const ALINHA = { left: 'justify-start text-left', right: 'justify-end text-right' }
const ALTURA_LINHA = { normal: 'h-10', denso: 'h-8' }
const LARGURA_SKELETON = {
  ocupacao: 'w-28', dias: 'w-20', hoje: 'w-12', fila: 'w-12', atrasadas: 'w-12',
  semdata: 'w-5', zumbis: 'w-5', proxlivre: 'w-16', alem: 'w-8',
}
const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ln-t2'
const MENU_LARGURA = 220
const MENU_ALTURA = 96

/** '2026-09-19' → 'sex 19' (título da coluna Hoje quando há dia selecionado). */
function rotuloDia(iso) {
  if (!iso) return 'Hoje'
  return `${DIAS[weekday(iso)].toLowerCase()} ${Number(String(iso).slice(8, 10))}`
}
/** 5.5 → '5,5' (sem o "h", para o formato "5,5 / 6h"). */
function semH(h) {
  return fmtHoras(h).replace(/h$/, '')
}
function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`
}

// ─── Peças ───────────────────────────────────────────────────────────────────

/** Ponto de saúde 8px. sem_leitura = anel tracejado; suspeito = ponto cinza com "?". */
export function HealthDot({ saude, className = '' }) {
  const nivel = saude?.nivel || 'sem_leitura'
  const cfg = NIVEIS[nivel] || NIVEIS.sem_leitura
  const texto = saude?.texto || cfg.label
  if (nivel === 'sem_leitura') {
    return <span role="img" aria-label={texto} title={texto} className={`inline-block w-2 h-2 rounded-full border border-dashed border-ln-t4 ${className}`} />
  }
  if (saude?.suspeito) {
    return (
      <span role="img" aria-label={texto} title={texto} className={`relative inline-block w-2 h-2 ${className}`}>
        <span className="absolute inset-0 rounded-full bg-ln-t4" />
        <span className="absolute -top-1.5 -right-1.5 text-[10px] leading-none font-semibold text-ln-t4">?</span>
      </span>
    )
  }
  return <span role="img" aria-label={texto} title={texto} className={`inline-block w-2 h-2 rounded-full ${cfg.dot} ${className}`} />
}

const ESCALA_BARRA = 130

/** Barra de ocupação dos próximos 10 dias úteis: atrasadas + carga futura até 100%, excedente hachurado até 130%. */
export function OccupancyBar({ totais, className = '' }) {
  const cap = Number(totais?.capacidadeProximosDias) || 0
  const horas = Number(totais?.horasProximosDias) || 0
  const atrasadas = Math.min(Number(totais?.horasAtrasadas) || 0, horas)
  const pct = cap > 0 ? (horas / cap) * 100 : Number(totais?.ocupacaoProximosDias) || 0
  const pctAtrasadas = cap > 0 ? (atrasadas / cap) * 100 : 0
  const total = Math.max(0, Math.min(ESCALA_BARRA, pct))
  const wAtr = Math.min(pctAtrasadas, 100, total)
  const wFut = Math.max(0, Math.min(total, 100) - wAtr)
  const wExc = Math.max(0, total - 100)
  const pos = (v) => `${(v / ESCALA_BARRA) * 100}%`
  const tom = tomOcupacao(pct)
  const rotulo = fmtPct(totais?.ocupacaoProximosDias ?? pct)
  const title = `${rotulo} dos próximos 10 dias úteis · ${fmtHoras(horas)} de ${fmtHoras(cap)}${atrasadas > 0 ? ` · ${fmtHoras(atrasadas)} atrasadas contadas em hoje` : ''}`
  return (
    <div className={`flex items-center gap-2 ${className}`} title={title}>
      <div className="relative w-[100px] h-3 shrink-0">
        <div className="absolute inset-x-0 top-[3px] h-1.5 rounded-full bg-ln-ink/[0.06] overflow-hidden">
          {wAtr > 0 && <div className="absolute inset-y-0 bg-ln-red" style={{ left: 0, width: pos(wAtr) }} />}
          {wFut > 0 && <div className="absolute inset-y-0 bg-ln-brand/70" style={{ left: pos(wAtr), width: pos(wFut) }} />}
          {wExc > 0 && <div className="absolute inset-y-0 ln-hatch" style={{ left: pos(100), width: pos(wExc) }} />}
        </div>
        <div aria-hidden="true" className="absolute top-0 bottom-0 w-px bg-ln-t4/60" style={{ left: pos(100) }} />
      </div>
      <span className={`text-xs tabular ${tom.text}`}>{rotulo}</span>
    </div>
  )
}

const FILL_BARRA = { vazia: 'fill-ln-t4/30', normal: 'fill-ln-brand/60', cheia: 'fill-ln-yellow', estouro: 'fill-ln-red' }

/** Dez barrinhas de carga/capacidade por dia útil (svg 96x20). */
export function SparkBars10d({ spark = [], resumo = [], hoje = null, diaSelecionado = null, className = '' }) {
  const n = Math.min(10, Math.max(spark?.length || 0, resumo?.length || 0))
  const yCap = 20 - 20 / 1.3
  const barras = []
  for (let i = 0; i < n; i++) {
    const d = resumo?.[i] || null
    const bruto = spark?.[i] ?? (d && d.capacidade ? d.carga / d.capacidade : 0)
    const v = Number(bruto) || 0
    const h = Math.max(1, (Math.min(v, 1.3) / 1.3) * 20)
    const tipo = v <= 0 ? 'vazia' : (d?.excedente || 0) > 0 ? 'estouro' : v >= 1 ? 'cheia' : 'normal'
    const apagada = !!diaSelecionado && d?.data !== diaSelecionado
    const title = d
      ? `${fmtDiaCurto(d.data)} · ${fmtHoras(d.carga)} de ${fmtHoras(d.capacidade)} · ${plural(d.tarefas || 0, 'tarefa', 'tarefas')}`
      : `Dia ${i + 1} · ${fmtPct(v * 100)}`
    barras.push({ i, x: i * 9, h, tipo, apagada, title, hoje: !!hoje && d?.data === hoje })
  }
  return (
    <svg
      viewBox="0 0 96 20"
      width="96"
      height="20"
      role="img"
      aria-label={n ? `Carga dos próximos ${plural(n, 'dia útil', 'dias úteis')}` : 'Sem leitura da agenda'}
      className={`overflow-visible shrink-0 ${className}`}
    >
      {n > 0 && <line x1="0" y1={yCap} x2="87" y2={yCap} strokeWidth="1" strokeDasharray="2 2" className="stroke-ln-t4/50" />}
      {barras.map((b) => (
        <g key={b.i} className={b.apagada ? 'opacity-40' : ''}>
          <rect x={b.x} y={20 - b.h} width="6" height={b.h} rx="1" className={FILL_BARRA[b.tipo]}>
            <title>{b.title}</title>
          </rect>
          {b.hoje && <circle cx={b.x + 3} cy="22" r="1.5" className="fill-ln-t2" />}
        </g>
      ))}
    </svg>
  )
}

// ─── Cabeçalho de grupo, item de menu, linha ─────────────────────────────────

function GrupoHeader({ grupo, aberto, onToggle }) {
  const cfg = grupo.nivel ? NIVEIS[grupo.nivel] : null
  return (
    <div className="px-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        title={aberto ? `Recolher ${grupo.label}` : `Expandir ${grupo.label}`}
        className={`w-full h-9 px-2 rounded-lg flex items-center gap-2 text-left transition-colors duration-150 hover:bg-ln-ink/[0.03] ${FOCO}`}
      >
        {aberto ? <ChevronDown className="w-3.5 h-3.5 text-ln-t4 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-ln-t4 shrink-0" />}
        {cfg && <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />}
        <span className="text-[13px] font-medium text-ln-t2 truncate">{grupo.label}</span>
        <span className="text-[13px] text-ln-t3 tabular">{grupo.pessoas.length}</span>
      </button>
    </div>
  )
}

function ItemMenu({ icone: Icone, onClick, children }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex items-center gap-2 w-full h-7 px-2 rounded-md text-xs text-ln-t2 transition-colors duration-150 hover:bg-ln-ink/5 ${FOCO}`}
    >
      <Icone className="w-3.5 h-3.5 text-ln-t3 shrink-0" />
      <span className="truncate">{children}</span>
    </button>
  )
}

function LinhaSkeleton({ colunas, gridStyle, denso }) {
  return (
    <div className={`grid items-center gap-x-2 mx-2 px-2 ${ALTURA_LINHA[denso ? 'denso' : 'normal']}`} style={gridStyle} aria-hidden="true">
      {colunas.map((c) => {
        if (c.id === 'saude') return <span key={c.id} className="ln-shimmer w-2 h-2 rounded-full justify-self-center" />
        if (c.id === 'pessoa') {
          return (
            <span key={c.id} className="flex items-center gap-2">
              <span className="ln-shimmer w-5 h-5 rounded-full shrink-0" />
              <span className="ln-shimmer h-3 w-32 rounded" />
            </span>
          )
        }
        if (c.id === 'acoes') return <span key={c.id} />
        return (
          <span key={c.id} className={`flex ${ALINHA[c.dir || 'left']}`}>
            <span className={`ln-shimmer inline-block h-3 rounded ${LARGURA_SKELETON[c.id] || 'w-10'}`} />
          </span>
        )
      })}
    </div>
  )
}

function Linha({ pessoa, colunas, gridStyle, hoje, diaSelecionado, selecionada, denso, loading, menuAberto, onAbrir, onNova, onRecarregar, onMenu }) {
  const t = pessoa.totais || {}
  const nome = pessoa.nome || 'Sem nome'
  const estado = pessoa.erro ? 'erro' : pessoa.api ? 'ok' : loading ? 'carregando' : 'sem_api'
  const hojeRef = hoje || pessoa.hoje || null
  const departamento = pessoa.departamentos?.[0] || ''
  const abrir = (aba) => (e) => { e.stopPropagation(); onAbrir?.(pessoa, aba) }

  const celulaOk = (col) => {
    switch (col.id) {
      case 'ocupacao':
        return <OccupancyBar totais={t} />
      case 'dias':
        return <SparkBars10d spark={pessoa.spark} resumo={pessoa.resumo} hoje={hojeRef} diaSelecionado={diaSelecionado} />
      case 'hoje': {
        const dia = diaSelecionado ? diaDe(pessoa, diaSelecionado) : pessoa.diaHoje || null
        if (!dia) return <span className="text-xs text-ln-t4 truncate">{diaSelecionado ? 'sem dado' : 'fim de semana'}</span>
        const estourou = dia.carga > dia.capacidade
        const title = `${fmtDiaCurto(dia.data)} · ${plural(dia.tarefas || 0, 'tarefa', 'tarefas')}${dia.excedente > 0 ? ` · ${fmtHoras(dia.excedente)} de estouro` : ''}`
        return <span className={`text-xs tabular whitespace-nowrap ${estourou ? 'text-ln-red' : 'text-ln-t3'}`} title={title}>{semH(dia.carga)} / {fmtHoras(dia.capacidade)}</span>
      }
      case 'fila': {
        const n = Number(t.consideradas) || 0
        const semEst = (pessoa.pctSemEstimativa || 0) > 30
        return (
          <button type="button" onClick={abrir('fila')} title={`${plural(n, 'tarefa', 'tarefas')} com data nos próximos 10 dias úteis · abrir a fila`} className={`text-xs tabular whitespace-nowrap text-ln-t3 hover:text-ln-t1 rounded transition-colors duration-150 ${FOCO}`}>
            {n} · {fmtHoras(t.horasConsideradas)}
            {semEst && <span className="text-ln-t4" title={`${pessoa.pctSemEstimativa}% da fila sem estimativa no ClickUp: horas estimadas pelo tipo ou dificuldade`}>*</span>}
          </button>
        )
      }
      case 'atrasadas': {
        const n = Number(t.atrasadas) || 0
        return (
          <button type="button" onClick={abrir('atrasadas')} title="Atrasadas contadas: caem em hoje no cálculo · abrir a lista" className={`text-xs tabular whitespace-nowrap rounded transition-colors duration-150 ${n > 0 ? 'text-ln-red hover:text-ln-red' : 'text-ln-t4 hover:text-ln-t2'} ${FOCO}`}>
            {n > 0 ? `${n} · ${fmtHoras(t.horasAtrasadas)}` : '0'}
          </button>
        )
      }
      case 'semdata': {
        const n = Number(t.semData) || 0
        return (
          <button type="button" onClick={abrir('semdata')} title="Tarefas sem data, fora do cálculo · abrir a lista" className={`text-xs tabular rounded transition-colors duration-150 ${n > 0 ? 'text-ln-t3 hover:text-ln-t1' : 'text-ln-t4 hover:text-ln-t2'} ${FOCO}`}>
            {n}
          </button>
        )
      }
      case 'zumbis': {
        const n = Number(t.zumbis) || 0
        return (
          <button type="button" onClick={abrir('zumbis')} title="Atrasadas há tempo demais, fora do cálculo · abrir a lista" className={`rounded transition-colors duration-150 ${FOCO}`}>
            {n > 0
              ? <span className="inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium tabular bg-ln-orange/15 text-ln-orange">{n}</span>
              : <span className="text-xs tabular text-ln-t4">0</span>}
          </button>
        )
      }
      case 'proxlivre':
        return pessoa.proximoDiaLivre
          ? <span className="text-xs tabular text-ln-t3 whitespace-nowrap" title="Primeiro dia útil com folga na agenda">{fmtDiaCurto(pessoa.proximoDiaLivre)}</span>
          : <span className="text-xs text-ln-t4 whitespace-nowrap" title="Nenhum dia com folga nos próximos 10 dias úteis">10+ dias</span>
      case 'alem': {
        const alem = Number(t.alemDoHorizonte) || 0
        const sobra = Number(t.sobraFinal) || 0
        if (sobra > 0) return <span className="text-xs tabular text-ln-red" title={`Não cabe nem em 60 dias úteis: ${fmtHoras(sobra)} sobram`}>{fmtHoras(alem)}</span>
        return <span className="text-xs tabular text-ln-t4" title="Horas que não cabem nos próximos 10 dias úteis">{fmtHoras(alem)}</span>
      }
      default:
        return null
    }
  }

  const celula = (col) => {
    if (col.id === 'saude') {
      return <div key={col.id} className="flex items-center justify-center"><HealthDot saude={pessoa.saude} /></div>
    }
    if (col.id === 'pessoa') {
      return (
        <div key={col.id} className="flex items-center gap-2 min-w-0">
          <span aria-hidden="true" className="w-5 h-5 rounded-full bg-ln-brand/20 text-ln-brand text-[10px] font-semibold flex items-center justify-center shrink-0">
            {pessoa.avatar || iniciais(nome)}
          </span>
          <div className="flex items-baseline gap-1 min-w-0 whitespace-nowrap">
            <button type="button" onClick={abrir()} title={`Abrir ${nome}`} className={`truncate text-[13px] font-medium text-ln-t2 hover:text-ln-t1 rounded transition-colors duration-150 ${FOCO}`}>
              {nome}
            </button>
            {departamento && <span className="text-xs text-ln-t3 truncate max-w-[104px]">· {departamento}</span>}
            <span className="text-xs text-ln-t4 shrink-0 tabular">{fmtHoras(pessoa.capacidadeDia || 6)}/d</span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNova?.(pessoa) }}
            title={`Nova atividade para ${primeiroNome(nome)}`}
            aria-label={`Nova atividade para ${nome}`}
            className={`ml-auto shrink-0 w-5 h-5 rounded flex items-center justify-center text-ln-t3 bg-ln-ink/5 hover:bg-ln-ink/10 hover:text-ln-t2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 ${FOCO}`}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )
    }
    if (col.id === 'acoes') {
      return (
        <div key={col.id} className="flex items-center justify-center">
          <button
            type="button"
            data-ln-menu-trigger="1"
            onClick={(e) => onMenu(e, pessoa)}
            aria-haspopup="menu"
            aria-expanded={menuAberto}
            aria-label={`Ações de ${nome}`}
            title="Ações"
            className={`ln-iconbtn w-6 h-6 transition-opacity ${menuAberto ? 'opacity-100 bg-ln-ink/5' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'} ${FOCO}`}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
    if (estado === 'carregando') {
      return (
        <div key={col.id} className={`flex ${ALINHA[col.dir || 'left']}`} aria-hidden="true">
          <span className={`ln-shimmer inline-block h-3 rounded ${LARGURA_SKELETON[col.id] || 'w-10'}`} />
        </div>
      )
    }
    return <div key={col.id} className={`flex items-center min-w-0 ${ALINHA[col.dir || 'left']}`}>{celulaOk(col)}</div>
  }

  const semLeitura = estado === 'erro' || estado === 'sem_api'
  const textoSemLeitura = estado === 'erro' ? 'Não consegui ler o ClickUp' : pessoa.saude?.texto || 'Sem leitura'
  const podeRecarregar = estado === 'erro' || !!pessoa.clickupId

  return (
    <div
      onClick={() => onAbrir?.(pessoa)}
      data-selecionada={selecionada ? '1' : undefined}
      className={`group grid items-center gap-x-2 mx-2 px-2 cursor-pointer ln-row-hover ${ALTURA_LINHA[denso ? 'denso' : 'normal']} ${selecionada ? 'bg-ln-ink/[0.04] hover:bg-ln-ink/[0.05]' : ''}`}
      style={gridStyle}
    >
      {semLeitura
        ? (
          <>
            {celula(colunas[0])}
            {celula(colunas[1])}
            <div className="flex items-center gap-1.5 min-w-0" style={{ gridColumn: '3 / -2' }}>
              <span className="text-xs text-ln-t4 truncate" title={pessoa.erro || pessoa.saude?.texto || ''}>{textoSemLeitura}</span>
              {podeRecarregar && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRecarregar?.(pessoa) }}
                  title={`Recarregar ${primeiroNome(nome)} do ClickUp`}
                  aria-label={`Recarregar ${nome} do ClickUp`}
                  className={`ln-iconbtn w-6 h-6 shrink-0 ${FOCO}`}
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>
            {celula(colunas[colunas.length - 1])}
          </>
        )
        : colunas.map(celula)}
    </div>
  )
}

// ─── Tabela ──────────────────────────────────────────────────────────────────

/**
 * @param {object}   p
 * @param {Array}    p.pessoas            pessoas enriquecidas (enriquecerPessoa)
 * @param {string}   p.hoje               yyyy-mm-dd
 * @param {boolean}  p.loading            leitura do ClickUp em andamento
 * @param {'saude'|'departamento'|'nenhum'} p.agrupar
 * @param {string|null} p.filtroNivel     nível de saúde para filtrar
 * @param {string|null} p.diaSelecionado  dia da linha de calor (yyyy-mm-dd)
 * @param {string|null} p.selecionadaId   profileId da pessoa aberta no painel
 * @param {boolean}  p.denso              linhas de 32px
 * @param {function} p.onAbrirPessoa      (pessoa, aba?) abre o painel
 * @param {function} p.onNovaAtividadePara (pessoa)
 * @param {function} p.onRecarregar       (pessoa)
 * @param {string[]} p.colunasOcultas     ids: 'semdata' | 'zumbis' | 'alem' | 'proxlivre' | 'hoje'
 */
export default function TeamTable({
  pessoas = [], hoje = null, loading = false, agrupar = 'saude', filtroNivel = null, diaSelecionado = null,
  selecionadaId = null, denso = false, onAbrirPessoa, onNovaAtividadePara, onRecarregar, colunasOcultas = SEM_OCULTAS,
}) {
  const [aberta, setAberta] = useState(true)
  const [recolhidos, setRecolhidos] = useState({})
  const [menu, setMenu] = useState(null)
  const menuRef = useRef(null)

  const colunas = useMemo(
    () => COLUNAS.filter((c) => !(OCULTAVEIS.has(c.id) && colunasOcultas.includes(c.id))),
    [colunasOcultas],
  )
  const gridStyle = useMemo(() => ({ gridTemplateColumns: colunas.map((c) => `${c.w}px`).join(' ') }), [colunas])
  const grupos = useMemo(() => agruparPessoas(pessoas, agrupar, filtroNivel), [pessoas, agrupar, filtroNivel])
  const total = grupos.reduce((s, g) => s + g.pessoas.length, 0)
  const lidas = pessoas.filter((p) => p.api).length
  const pessoaMenu = menu ? pessoas.find((p) => p.profileId === menu.id) || null : null

  const abrirMenu = (e, pessoa) => {
    e.stopPropagation()
    if (menu?.id === pessoa.profileId) { setMenu(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    const acima = r.bottom + MENU_ALTURA + 8 > window.innerHeight
    setMenu({
      id: pessoa.profileId,
      left: Math.max(8, Math.min(r.right - MENU_LARGURA, window.innerWidth - MENU_LARGURA - 8)),
      top: acima ? Math.max(8, r.top - MENU_ALTURA - 4) : r.bottom + 4,
    })
  }
  const fecharMenu = () => setMenu(null)
  const acaoMenu = (fn) => () => { fecharMenu(); fn?.() }

  useEffect(() => {
    if (!menu) return undefined
    const onDown = (e) => {
      if (e.target.closest?.('[data-ln-menu-trigger]')) return
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null)
    }
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null) }
    const onScroll = () => setMenu(null)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    menuRef.current?.querySelector('button')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [menu])

  const alternarGrupo = (id) => setRecolhidos((r) => ({ ...r, [id]: !r[id] }))
  const carregandoVazio = loading && pessoas.length === 0

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 h-9 flex items-center gap-1.5 px-3 bg-ln-panel border-b border-ln-ink/5">
        <button
          type="button"
          onClick={() => setAberta((v) => !v)}
          aria-expanded={aberta}
          aria-label={aberta ? 'Recolher capacidade do time' : 'Expandir capacidade do time'}
          title={aberta ? 'Recolher' : 'Expandir'}
          className={`ln-iconbtn w-5 h-5 ${FOCO}`}
        >
          {aberta ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <span className="text-[13px] font-medium text-ln-t2">Capacidade do time</span>
        <span className="text-[13px] text-ln-t3 tabular">· {total}</span>
        {loading && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-ln-t4 tabular whitespace-nowrap">
            <Loader2 className="w-3 h-3 animate-spin" /> lendo o ClickUp · {lidas} de {pessoas.length}
          </span>
        )}
      </div>

      {aberta && (
        <div className="overflow-x-auto">
          <div className="min-w-full w-max pb-2">
            <div className="grid items-center gap-x-2 px-4 h-7 border-b border-ln-ink/5" style={gridStyle}>
              {colunas.map((c) => (
                <div key={c.id} className={`text-[11px] font-medium text-ln-t4 truncate ${ALINHA[c.dir || 'left']}`} title={c.id === 'hoje' && diaSelecionado ? fmtDiaCurto(diaSelecionado) : undefined}>
                  {c.id === 'hoje' ? rotuloDia(diaSelecionado) : c.label}
                </div>
              ))}
            </div>

            {carregandoVazio && [0, 1, 2].map((i) => <LinhaSkeleton key={i} colunas={colunas} gridStyle={gridStyle} denso={denso} />)}

            {!carregandoVazio && total === 0 && (
              <div className="h-10 flex items-center px-4 text-xs text-ln-t4">Ninguém neste grupo</div>
            )}

            {grupos.map((g) => (
              <div key={g.id}>
                {g.label && <GrupoHeader grupo={g} aberto={!recolhidos[g.id]} onToggle={() => alternarGrupo(g.id)} />}
                {!recolhidos[g.id] && g.pessoas.map((p) => (
                  <Linha
                    key={p.profileId || p.nome}
                    pessoa={p}
                    colunas={colunas}
                    gridStyle={gridStyle}
                    hoje={hoje}
                    diaSelecionado={diaSelecionado}
                    selecionada={!!selecionadaId && p.profileId === selecionadaId}
                    denso={denso}
                    loading={loading}
                    menuAberto={menu?.id === p.profileId}
                    onAbrir={onAbrirPessoa}
                    onNova={onNovaAtividadePara}
                    onRecarregar={onRecarregar}
                    onMenu={abrirMenu}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {menu && pessoaMenu && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Ações de ${pessoaMenu.nome}`}
          className="ln ln-card fixed z-50 p-1"
          style={{ top: menu.top, left: menu.left, width: MENU_LARGURA, boxShadow: 'var(--ln-shadow-panel)' }}
        >
          <ItemMenu icone={PanelRight} onClick={acaoMenu(() => onAbrirPessoa?.(pessoaMenu))}>Abrir painel</ItemMenu>
          <ItemMenu icone={Plus} onClick={acaoMenu(() => onNovaAtividadePara?.(pessoaMenu))}>Nova atividade para esta pessoa</ItemMenu>
          <ItemMenu icone={RefreshCw} onClick={acaoMenu(() => onRecarregar?.(pessoaMenu))}>Recarregar do ClickUp</ItemMenu>
        </div>,
        document.body,
      )}
    </div>
  )
}
