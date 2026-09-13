// Lista de atividades planejadas no visual do Linear: densa, agrupada e recolhível.
// Recebe os registros da tabela atividades_planejadas já carregados pela página.
import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import {
  chaveAtividade, fmtCurta, fmtDiaCurto, fmtHoras, fmtLonga, fmtRelativo, fmtHora,
  hojeISO, inicioDaSemana, iniciais, rotuloSemana,
} from '../../lib/atividadesCarga'

// ─── Mapas estáticos (Tailwind precisa ver as classes literalmente) ──────────

export const DOT_DEPARTAMENTO = {
  'Gestor de tráfego': 'bg-ln-blue',
  'Estrategista':      'bg-ln-accent',
  'Comercial':         'bg-ln-green',
  'Copywriter':        'bg-ln-yellow',
  'Web Designer':      'bg-ln-teal',
  'Designer':          'bg-ln-orange',
  'Account Manager':   'bg-ln-brand',
  'Tecnologia':        'bg-ln-t3',
}
export function dotDepartamento(departamento) {
  return DOT_DEPARTAMENTO[departamento] || 'bg-ln-t4'
}

export const PRIORIDADE_LABEL = { urgent: 'Urgente', high: 'Alta', normal: 'Normal', low: 'Baixa' }
const BARRAS_PRIORIDADE = { urgent: 3, high: 3, normal: 2, low: 1 }

const AVATAR_TAMANHO = {
  14: 'w-3.5 h-3.5 text-[8px]',
  16: 'w-4 h-4 text-[9px]',
  20: 'w-5 h-5 text-[10px]',
  24: 'w-6 h-6 text-[10px]',
}

const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ln-t2'

// ícone | chave | prioridade | título | pills | horas | data | avatar | aviso | criado
const COLUNAS = '16px 72px 16px minmax(120px, 1fr) minmax(0, max-content) 40px 72px 16px 16px minmax(40px, max-content)'

// ─── Peças reutilizadas pelo painel da atividade ─────────────────────────────

export function Avatar({ nome, tamanho = 16, className = '' }) {
  const cls = AVATAR_TAMANHO[tamanho] || AVATAR_TAMANHO[16]
  return (
    <span
      title={nome || 'Sem responsável'}
      className={`inline-flex items-center justify-center rounded-full font-semibold leading-none shrink-0 ${nome ? 'bg-ln-brand/20 text-ln-brand' : 'bg-ln-ink/5 text-ln-t4'} ${cls} ${className}`}
    >
      {nome ? iniciais(nome) : '?'}
    </span>
  )
}

export function PrioridadeIcon({ prioridade, className = '' }) {
  const p = PRIORIDADE_LABEL[prioridade] ? prioridade : 'normal'
  const cheias = BARRAS_PRIORIDADE[p]
  const cor = p === 'urgent' ? 'fill-ln-red' : 'fill-ln-t3'
  const label = `Prioridade: ${PRIORIDADE_LABEL[p]}`
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" role="img" aria-label={label} className={`shrink-0 ${className}`}>
      <title>{label}</title>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1.5 + i * 5}
          y={10.5 - i * 3.5}
          width="3"
          height={4.5 + i * 3.5}
          rx="1"
          className={`${cor} ${i < cheias ? '' : 'opacity-30'}`}
        />
      ))}
    </svg>
  )
}

export function StatusIcon({ registro, className = '' }) {
  const sobrecarga = !!registro?.sobrecarga
  const criada = registro?.status === 'criada'
  const erro = registro?.status === 'erro'
  const label = sobrecarga
    ? 'Entrega forçada com sobrecarga'
    : criada ? 'Criada no ClickUp' : erro ? 'Erro ao criar no ClickUp' : 'Planejada'
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" role="img" aria-label={label} className={`shrink-0 ${className}`}>
      <title>{label}</title>
      {sobrecarga ? (
        <>
          <circle cx="8" cy="8" r="6.5" fill="none" strokeWidth="1.5" className="stroke-ln-t3" />
          <circle cx="8" cy="8" r="2.5" className="fill-ln-red" />
        </>
      ) : criada ? (
        <>
          <circle cx="8" cy="8" r="6.5" fill="none" strokeWidth="1.5" className="stroke-ln-green" />
          <path d="M5 8.2l2 2 4-4.2" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-ln-green" />
        </>
      ) : (
        <circle
          cx="8" cy="8" r="6.5" fill="none" strokeWidth="1.5"
          strokeDasharray={erro ? '2 2' : undefined}
          className={erro ? 'stroke-ln-red' : 'stroke-ln-t3'}
        />
      )}
    </svg>
  )
}

// ─── Filtro e agrupamento (puros, testáveis) ─────────────────────────────────

export function filtrarRegistros(registros, filtro, hoje) {
  const lista = registros || []
  if (filtro === 'semana') {
    const semana = inicioDaSemana(hoje)
    return lista.filter((r) => inicioDaSemana(r.data_escolhida) === semana)
  }
  if (filtro === 'forcadas') return lista.filter((r) => !!r.sobrecarga)
  if (filtro === 'aviso') return lista.filter((r) => !!r.aviso || r.status === 'erro')
  return lista
}

function ordenarRegistros(arr) {
  return [...arr].sort((a, b) => {
    const da = a.data_escolhida || '9999-12-31'
    const db = b.data_escolhida || '9999-12-31'
    return da.localeCompare(db) || String(b.created_at || '').localeCompare(String(a.created_at || ''))
  })
}

/** Devolve [{ id, label, registros }] na ordem em que os grupos aparecem. */
export function agruparRegistros(registros, agrupar, { nomeMembro, hoje } = {}) {
  const lista = registros || []
  if (agrupar === 'status') {
    return [
      { id: 'erro',   label: 'Com erro no ClickUp', registros: ordenarRegistros(lista.filter((r) => r.status === 'erro')) },
      { id: 'criada', label: 'Criadas no ClickUp',  registros: ordenarRegistros(lista.filter((r) => r.status === 'criada')) },
      { id: 'outras', label: 'Outras',              registros: ordenarRegistros(lista.filter((r) => r.status !== 'erro' && r.status !== 'criada')) },
    ].filter((g) => g.registros.length > 0)
  }
  if (agrupar === 'responsavel') {
    const map = new Map()
    for (const r of lista) {
      const k = r.responsavel_profile_id || 'sem'
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(r)
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({
        id: k,
        label: k === 'sem' ? 'Sem responsável' : (nomeMembro?.get(k) || 'Responsável não identificado'),
        registros: ordenarRegistros(v),
      }))
      .sort((a, b) => (a.id === 'sem') - (b.id === 'sem') || a.label.localeCompare(b.label, 'pt-BR'))
  }
  // semana: atual e futuras em ordem, depois as passadas (mais recente primeiro), "Sem data" no fim
  const semanaAtual = inicioDaSemana(hoje)
  const map = new Map()
  for (const r of lista) {
    const k = inicioDaSemana(r.data_escolhida) || 'sem'
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(r)
  }
  const faixa = (id) => (id === 'sem' ? 2 : semanaAtual && id < semanaAtual ? 1 : 0)
  return Array.from(map.entries())
    .map(([k, v]) => ({ id: k, label: k === 'sem' ? 'Sem data' : rotuloSemana(k, hoje), registros: ordenarRegistros(v) }))
    .sort((a, b) => {
      const fa = faixa(a.id)
      const fb = faixa(b.id)
      if (fa !== fb) return fa - fb
      return fa === 1 ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id)
    })
}

// ─── Linhas ──────────────────────────────────────────────────────────────────

function LinhaSkeleton() {
  return (
    <div className="grid items-center gap-x-2.5 h-10 px-2" style={{ gridTemplateColumns: COLUNAS }} aria-hidden="true">
      <span className="ln-shimmer w-4 h-4 rounded-full" />
      <span className="ln-shimmer h-3 w-14 rounded" />
      <span className="ln-shimmer w-4 h-4 rounded" />
      <span className="ln-shimmer h-3.5 w-3/5 rounded" />
      <span className="flex gap-1.5"><span className="ln-shimmer h-6 w-20 rounded-full" /><span className="ln-shimmer h-6 w-24 rounded-full" /></span>
      <span className="ln-shimmer h-3 w-8 rounded" />
      <span className="ln-shimmer h-3 w-14 rounded" />
      <span className="ln-shimmer w-4 h-4 rounded-full" />
      <span />
      <span className="ln-shimmer h-3 w-10 rounded" />
    </div>
  )
}

function tituloCriacao(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `Criada em ${d.toLocaleDateString('pt-BR')} às ${fmtHora(iso)}`
}

function LinhaRegistro({ registro: r, cliente, responsavel, selecionada, onAbrir, agora }) {
  const tituloData = r.sobrecarga && r.data_sugerida
    ? `Sugerida ${fmtLonga(r.data_sugerida)}, forçada para ${fmtLonga(r.data_escolhida)}`
    : r.data_escolhida ? `Entrega ${fmtLonga(r.data_escolhida)}` : 'Sem data de entrega'
  return (
    <button
      type="button"
      onClick={() => onAbrir?.(r)}
      aria-current={selecionada ? 'true' : undefined}
      className={`ln-row-hover w-full grid items-center gap-x-2.5 h-10 px-2 text-left overflow-hidden ${FOCO} ${selecionada ? 'bg-ln-ink/[0.04]' : ''}`}
      style={{ gridTemplateColumns: COLUNAS }}
    >
      <StatusIcon registro={r} />

      <span className="text-xs text-ln-t3 tabular truncate">{chaveAtividade(r.id)}</span>

      <PrioridadeIcon prioridade={r.prioridade} />

      <span className="text-[13px] font-medium text-ln-t2 truncate min-w-0" title={r.titulo || ''}>
        {r.titulo || <span className="text-ln-t4 font-normal">Sem título</span>}
      </span>

      <span className="flex items-center gap-1.5 min-w-0 overflow-hidden">
        {cliente && (
          <span className="inline-flex items-center h-6 px-2 rounded-full ring-1 ring-inset ring-ln-line text-xs text-ln-t3 max-w-[150px] shrink-0" title={cliente}>
            <span className="truncate">{cliente}</span>
          </span>
        )}
        {r.tipo_tarefa && (
          <span
            className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full ring-1 ring-inset ring-ln-line text-xs text-ln-t3 max-w-[170px] shrink-0"
            title={r.departamento ? `${r.tipo_tarefa} · ${r.departamento}` : r.tipo_tarefa}
          >
            <i className={`w-2 h-2 rounded-full shrink-0 ${dotDepartamento(r.departamento)}`} />
            <span className="truncate">{r.tipo_tarefa}</span>
          </span>
        )}
      </span>

      <span className="text-xs text-ln-t3 tabular text-right">{fmtHoras(r.horas_estimadas)}</span>

      <span className="text-xs tabular leading-tight" title={tituloData}>
        {r.sobrecarga ? (
          <span className="flex flex-col">
            {r.data_sugerida && <s className="text-ln-t4">{fmtCurta(r.data_sugerida)}</s>}
            <span className="text-ln-red">{fmtDiaCurto(r.data_escolhida) || 'sem data'}</span>
          </span>
        ) : (
          <span className={r.data_escolhida ? 'text-ln-t3' : 'text-ln-t4'}>{fmtDiaCurto(r.data_escolhida) || 'sem data'}</span>
        )}
      </span>

      <Avatar nome={responsavel} tamanho={16} />

      <span className="inline-flex items-center justify-center w-4 h-4">
        {r.aviso ? (
          <span title={r.aviso} aria-label={`Aviso: ${r.aviso}`} className="inline-flex">
            <AlertTriangle className="w-3.5 h-3.5 text-ln-yellow" />
          </span>
        ) : null}
      </span>

      <span className="text-xs text-ln-t4 tabular text-right whitespace-nowrap" title={tituloCriacao(r.created_at)}>
        {fmtRelativo(r.created_at, agora)}
      </span>
    </button>
  )
}

// ─── Lista ───────────────────────────────────────────────────────────────────

/**
 * @param {object}   p
 * @param {Array}    p.registros       linhas de atividades_planejadas
 * @param {Map}      p.nomeProjeto     project_id → nome do cliente
 * @param {Map}      p.nomeMembro      profile_id → nome
 * @param {string}   p.filtro          'todas' | 'semana' | 'forcadas' | 'aviso'
 * @param {string}   p.agrupar         'semana' | 'status' | 'responsavel'
 * @param {string}   p.selecionadaId   id do registro aberto no painel
 * @param {Function} p.onAbrir         (registro) => void
 * @param {boolean}  p.loading
 * @param {string}   [p.hoje]          yyyy-mm-dd (referência da semana atual; padrão: hoje no mount)
 * @param {number}   [p.agora]         timestamp de referência para "há 2 h" (padrão: agora)
 */
export default function IssueList({
  registros = [],
  nomeProjeto,
  nomeMembro,
  filtro = 'todas',
  agrupar = 'semana',
  selecionadaId = null,
  onAbrir,
  loading = false,
  hoje = null,
  agora = undefined,
}) {
  const [hojeMount] = useState(hojeISO)
  const hojeRef = hoje || hojeMount
  const [recolhida, setRecolhida] = useState(false)
  const [fechados, setFechados] = useState(() => new Set())

  const lista = useMemo(() => filtrarRegistros(registros, filtro, hojeRef), [registros, filtro, hojeRef])
  const grupos = useMemo(
    () => agruparRegistros(lista, agrupar, { nomeMembro, hoje: hojeRef }),
    [lista, agrupar, nomeMembro, hojeRef],
  )

  const total = (registros || []).length
  const carregandoVazio = loading && total === 0

  const alternarGrupo = (chave) => {
    setFechados((prev) => {
      const s = new Set(prev)
      if (s.has(chave)) s.delete(chave)
      else s.add(chave)
      return s
    })
  }

  return (
    <section className="ln-issue-list" aria-label="Atividades planejadas">
      <div className="sticky top-0 z-20 flex items-center gap-1.5 h-9 px-2 bg-ln-panel border-b border-ln-ink/5">
        <button
          type="button"
          onClick={() => setRecolhida((v) => !v)}
          aria-expanded={!recolhida}
          aria-label={recolhida ? 'Expandir atividades planejadas' : 'Recolher atividades planejadas'}
          title={recolhida ? 'Expandir' : 'Recolher'}
          className={`ln-iconbtn ${FOCO}`}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-150 ${recolhida ? '' : 'rotate-90'}`} />
        </button>
        <span className="text-[13px] font-medium text-ln-t2">Atividades planejadas</span>
        <span className="text-[13px] text-ln-t3 tabular">· {carregandoVazio ? '…' : lista.length}</span>
        {!carregandoVazio && lista.length !== total && (
          <span className="text-[11px] text-ln-t4 tabular">de {total}</span>
        )}
      </div>

      {!recolhida && (
        <div className="py-1">
          {carregandoVazio ? (
            <div className="px-2">
              <LinhaSkeleton />
              <LinhaSkeleton />
              <LinhaSkeleton />
            </div>
          ) : total === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-10 text-center">
              <p className="text-[13px] text-ln-t4">Nenhuma atividade planejada ainda</p>
              <p className="text-xs text-ln-t4 flex items-center gap-1">
                Pressione <kbd className="ln-kbd">C</kbd> para planejar a primeira
              </p>
            </div>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
              <p className="text-[13px] text-ln-t4">Nenhuma atividade neste filtro</p>
              <p className="text-xs text-ln-t4 tabular">{total} no total</p>
            </div>
          ) : (
            grupos.map((g) => {
              const chave = `${agrupar}:${g.id}`
              const fechado = fechados.has(chave)
              return (
                <div key={chave} className="px-2">
                  <button
                    type="button"
                    onClick={() => alternarGrupo(chave)}
                    aria-expanded={!fechado}
                    title={fechado ? `Expandir ${g.label}` : `Recolher ${g.label}`}
                    className={`sticky top-9 z-10 w-full flex items-center gap-1.5 h-9 px-2 rounded-lg bg-ln-panel text-left transition-colors duration-150 hover:bg-ln-ink/[0.03] ${FOCO}`}
                  >
                    <ChevronRight className={`w-3.5 h-3.5 text-ln-t4 transition-transform duration-150 ${fechado ? '' : 'rotate-90'}`} />
                    <span className="text-[13px] font-medium text-ln-t2 truncate">{g.label}</span>
                    <span className="text-[13px] text-ln-t3 tabular">{g.registros.length}</span>
                  </button>
                  {!fechado && g.registros.map((r) => (
                    <LinhaRegistro
                      key={r.id}
                      registro={r}
                      cliente={nomeProjeto?.get(r.project_id) || null}
                      responsavel={nomeMembro?.get(r.responsavel_profile_id) || null}
                      selecionada={!!selecionadaId && r.id === selecionadaId}
                      onAbrir={onAbrir}
                      agora={agora}
                    />
                  ))}
                </div>
              )
            })
          )}
        </div>
      )}
    </section>
  )
}
