// Corpo do painel lateral de uma pessoa (módulo Atividades, visual do Linear).
// O container e o cabeçalho do painel ficam fora; aqui vai o conteúdo rolável
// (cabeçalho da pessoa, KPIs, gráfico, alertas, clientes, abas de tarefas) e
// o rodapé fixo com as ações.
import { useId, useState, useEffect, useRef } from 'react'
import { AlertTriangle, Plus, RefreshCw, Loader2, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import CargaDiaria from './CargaDiaria'
import { PrioridadeIcon, PRIORIDADE_LABEL } from './IssueList'
import {
  NIVEIS, diaDe, tomOcupacao,
  fmtHoras, fmtCurta, fmtDiaCurto, fmtPct, fmtHora, iniciais, primeiroNome,
} from '../../lib/atividadesCarga'

const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ln-t2'

const TOM = {
  neutro:   'text-ln-t1',
  ambar:    'text-ln-yellow',
  vermelho: 'text-ln-red',
  laranja:  'text-ln-orange',
}

export const ABAS = [
  { id: 'fila',      label: 'Fila',      vazio: 'Nada com data nos próximos 10 dias úteis' },
  { id: 'atrasadas', label: 'Atrasadas', vazio: 'Nenhuma atrasada contada no cálculo' },
  { id: 'semdata',   label: 'Sem data',  vazio: 'Todas as tarefas abertas têm data' },
  { id: 'zumbis',    label: 'Zumbis',    vazio: 'Nenhuma atrasada antiga fora do cálculo' },
]
const ABA_PADRAO = 'fila'

function normalizarAba(aba) {
  return ABAS.some((a) => a.id === aba) ? aba : ABA_PADRAO
}

// Ordem de exibição: urgente > alta > normal > baixa > sem prioridade; dentro
// da mesma prioridade, pelo dia em que entram na agenda (ou vencimento).
const ORDEM_PRIORIDADE = { urgent: 0, high: 1, normal: 2, low: 3 }
function pesoPrioridade(t) {
  const p = ORDEM_PRIORIDADE[String(t.prioridade || '').toLowerCase()]
  return p === undefined ? 4 : p
}
function ordenarPorPrioridade(itens) {
  return [...itens].sort((a, b) => {
    const d = pesoPrioridade(a) - pesoPrioridade(b)
    if (d !== 0) return d
    const da = a.dia || a.vencimento || '9999', db = b.dia || b.vencimento || '9999'
    return da < db ? -1 : da > db ? 1 : 0
  })
}

// Grupos de prioridade da lista (estilo dos grupos por status do Linear)
const GRUPOS_PRIORIDADE = [
  { id: 'urgent', label: 'Urgente',        cls: 'bg-ln-red/15 text-ln-red ring-ln-red/30' },
  { id: 'high',   label: 'Alta',           cls: 'bg-ln-orange/15 text-ln-orange ring-ln-orange/30' },
  { id: 'normal', label: 'Normal',         cls: 'bg-ln-blue/15 text-ln-blue ring-ln-blue/30' },
  { id: 'low',    label: 'Baixa',          cls: 'bg-ln-ink/5 text-ln-t3 ring-ln-ink/10' },
  { id: 'none',   label: 'Sem prioridade', cls: 'bg-ln-ink/5 text-ln-t4 ring-ln-ink/10' },
]
function grupoDe(t) {
  const p = String(t.prioridade || '').toLowerCase()
  return ORDEM_PRIORIDADE[p] === undefined ? 'none' : p
}
function agruparPorPrioridade(itens) {
  return GRUPOS_PRIORIDADE
    .map((g) => ({ ...g, itens: itens.filter((t) => grupoDe(t) === g.id), horas: itens.filter((t) => grupoDe(t) === g.id).reduce((s, t) => s + (Number(t.horas) || 0), 0) }))
    .filter((g) => g.itens.length > 0)
}

function itensDaAba(pessoa, aba) {
  const fila = pessoa.filaProxima || []
  if (aba === 'atrasadas') return ordenarPorPrioridade(fila.filter((t) => t.atrasada))
  if (aba === 'semdata') return ordenarPorPrioridade(pessoa.semData || [])
  if (aba === 'zumbis') return ordenarPorPrioridade(pessoa.zumbis || [])
  return ordenarPorPrioridade(fila)
}

function alertasDe(pessoa) {
  const t = pessoa.totais || {}
  const out = []
  if ((pessoa.pctSemEstimativa || 0) >= 30) {
    out.push({
      id: 'estimativa',
      texto: `${pessoa.pctSemEstimativa}% da fila sem estimativa`,
      title: `${t.semEstimativa?.tarefas || 0} tarefa(s) sem estimativa no ClickUp: as horas vieram do tipo, da dificuldade ou do padrão`,
    })
  }
  if (pessoa.picoDeData) {
    out.push({
      id: 'pico',
      texto: `pico de data em ${fmtDiaCurto(pessoa.picoDeData)}`,
      title: 'Um único dia concentra mais de 40% das horas dos próximos 10 dias úteis',
    })
  }
  if ((Number(t.alemDoHorizonte) || 0) > 0) {
    out.push({
      id: 'alem',
      texto: `${fmtHoras(t.alemDoHorizonte)} além do horizonte`,
      title: 'Horas que não cabem nos próximos 10 dias úteis e rolam para depois',
    })
  }
  if ((Number(t.sobraFinal) || 0) > 0) {
    out.push({
      id: 'sobra',
      texto: `${fmtHoras(t.sobraFinal)} não cabem em 60 dias`,
      title: 'Nem em 60 dias úteis a agenda absorve essas horas',
    })
  }
  return out
}

// ─── Peças ───────────────────────────────────────────────────────────────────

function Avatar({ pessoa }) {
  const avatar = pessoa.avatar || ''
  if (/^https?:\/\//.test(avatar)) {
    return <img src={avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
  }
  return (
    <span className="w-6 h-6 rounded-full bg-ln-brand/20 text-ln-brand text-[10px] font-semibold flex items-center justify-center shrink-0" aria-hidden="true">
      {avatar || iniciais(pessoa.nome)}
    </span>
  )
}

function Cabecalho({ pessoa, atualizadoEm }) {
  const saude = pessoa.saude || {}
  const nivel = NIVEIS[saude.nivel] || NIVEIS.sem_leitura
  const deps = (pessoa.departamentos || []).filter(Boolean)
  const linha = [
    deps.length ? deps.join(', ') : 'Sem departamento',
    `${fmtHoras(pessoa.capacidadeDia)}/dia`,
    atualizadoEm ? `atualizado às ${fmtHora(atualizadoEm)}` : null,
  ].filter(Boolean).join(' · ')
  return (
    <header className="flex items-start gap-3">
      <Avatar pessoa={pessoa} />
      <div className="min-w-0 flex-1">
        <h2 className="text-[20px] font-semibold leading-6 tracking-[-0.01em] text-ln-t2 truncate" title={pessoa.nome}>
          {pessoa.nome || 'Sem nome'}
        </h2>
        <p className="mt-0.5 text-xs text-ln-t3 truncate" title={linha}>{linha}</p>
        <div className="mt-2">
          <span
            className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-xs font-medium ${nivel.bg} ${nivel.text}`}
            title={saude.texto || nivel.label}
          >
            <i className={`w-2 h-2 rounded-full ${nivel.dot}`} aria-hidden="true" />
            {nivel.label}
            {saude.suspeito && <span className="text-[10px] opacity-80" aria-label="leitura suspeita">?</span>}
          </span>
        </div>
        {saude.texto && <p className="mt-1 text-xs text-ln-t3">{saude.texto}</p>}
      </div>
    </header>
  )
}

function Kpi({ label, valor, sub, tom = 'text-ln-t1', title }) {
  return (
    <div className="ln-card px-3 py-2 min-w-0" title={title}>
      <p className="text-[11px] text-ln-t4 truncate">{label}</p>
      <p className={`mt-0.5 text-base font-semibold leading-5 tabular truncate ${tom}`}>{valor}</p>
      {sub && <p className="text-[11px] text-ln-t3 truncate">{sub}</p>}
    </div>
  )
}

function Kpis({ pessoa }) {
  const t = pessoa.totais || {}
  const ocupacao = Number(t.ocupacaoProximosDias) || 0
  const atrasadas = Number(t.atrasadas) || 0
  const zumbis = Number(t.zumbis) || 0
  const semData = Number(t.semData) || 0
  const fila = pessoa.filaProxima || []
  return (
    <div className="grid grid-cols-2 gap-2">
      <Kpi
        label="Ocupação 10d"
        valor={fmtPct(ocupacao)}
        sub={`${fmtHoras(t.horasProximosDias)} de ${fmtHoras(t.capacidadeProximosDias)}`}
        tom={tomOcupacao(ocupacao).text}
        title="Horas na agenda dividido pela capacidade dos próximos 10 dias úteis"
      />
      <Kpi
        label="Fila"
        valor={`${Number(t.consideradas) || 0} · ${fmtHoras(t.horasConsideradas)}`}
        sub={`${fila.length} caem nos próximos 10 dias`}
        title="Tarefas abertas com data que entram no cálculo"
      />
      <Kpi
        label="Atrasadas"
        valor={`${atrasadas} · ${fmtHoras(t.horasAtrasadas)}`}
        sub="caem em hoje no cálculo"
        tom={atrasadas > 0 ? TOM.ambar : TOM.neutro}
        title="Venceram e ainda estão abertas: consomem a capacidade de hoje"
      />
      <Kpi
        label="Fora do cálculo"
        valor={String(zumbis + semData)}
        sub={`${zumbis} muito atrasadas · ${semData} sem data`}
        tom={zumbis > 0 ? TOM.laranja : TOM.neutro}
        title="Atrasadas há mais tempo que o limite e tarefas sem data não entram na agenda"
      />
    </div>
  )
}

function LinhaDia({ pessoa, diaSelecionado }) {
  if (!pessoa.resumo?.length) return null
  const d = diaDe(pessoa, diaSelecionado)
  let rotulo = 'Hoje'
  if (diaSelecionado) rotulo = `Dia selecionado, ${fmtDiaCurto(diaSelecionado)}`
  else if (!pessoa.diaHoje && d) rotulo = `Fim de semana, próximo dia útil ${fmtDiaCurto(d.data)}`
  if (!d) return <p className="mt-2 text-xs text-ln-t4">{rotulo}: fora do resumo de 10 dias desta pessoa</p>
  const estoura = (Number(d.excedente) || 0) > 0
  const livre = Number(d.livre) || 0
  return (
    <p className="mt-2 text-xs text-ln-t3">
      <span className="text-ln-t4">{rotulo}:</span>{' '}
      <span className={`tabular ${estoura ? TOM.vermelho : 'text-ln-t2'}`}>{fmtHoras(d.carga)} de {fmtHoras(d.capacidade)}</span>
      {' · '}
      <span className="tabular">{d.tarefas} tarefa{d.tarefas === 1 ? '' : 's'}</span>
      {estoura && <span className={TOM.vermelho}> · estoura {fmtHoras(d.excedente)}</span>}
      {!estoura && livre > 0 && <span> · {fmtHoras(livre)} livres</span>}
    </p>
  )
}

function Alertas({ alertas }) {
  if (!alertas.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Alertas">
      {alertas.map((a) => (
        <li key={a.id} className="inline-flex items-center h-6 px-2 rounded-full border border-dashed border-ln-line text-xs text-ln-t3 whitespace-nowrap" title={a.title}>
          {a.texto}
        </li>
      ))}
    </ul>
  )
}

function Distribuicao({ porPasta }) {
  const max = Math.max(0, ...porPasta.map((p) => Number(p.horas) || 0))
  return (
    <section>
      <h3 className="ln-label">Distribuição por cliente</h3>
      {porPasta.length === 0 ? (
        <p className="text-xs text-ln-t4">Sem tarefas com data para distribuir</p>
      ) : (
        <ul className="space-y-0.5">
          {porPasta.map((p) => {
            const horas = Number(p.horas) || 0
            const largura = max > 0 ? Math.max(2, (horas / max) * 100) : 0
            return (
              <li key={p.pasta ?? 'sem-pasta'} className="flex items-center gap-2 h-6">
                <span className="flex-1 min-w-0 truncate text-xs text-ln-t2" title={p.pasta || 'Sem pasta'}>{p.pasta || 'Sem pasta'}</span>
                <span className="w-24 h-1.5 rounded-full bg-ln-ink/[0.06] overflow-hidden shrink-0" aria-hidden="true">
                  <span className="block h-full rounded-full bg-ln-brand/60" style={{ width: `${largura}%` }} />
                </span>
                <span className="w-16 text-right text-xs text-ln-t3 tabular shrink-0">{Number(p.tarefas) || 0} · {fmtHoras(horas)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Abas({ aba, onAba, contagens, prefixo }) {
  return (
    <div role="tablist" aria-label="Tarefas da pessoa" className="flex items-center gap-1 flex-wrap">
      {ABAS.map((a) => {
        const ativa = a.id === aba
        return (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`${prefixo}-aba-${a.id}`}
            aria-selected={ativa}
            aria-controls={`${prefixo}-painel-${a.id}`}
            onClick={() => onAba(a.id)}
            className={`ln-tab ${ativa ? 'ln-tab-active' : ''} ${FOCO}`}
          >
            {a.label}
            <span className={`tabular ${ativa ? 'text-ln-t3' : 'text-ln-t4'}`}>{contagens[a.id]}</span>
          </button>
        )
      })}
    </div>
  )
}

// Horas da tarefa com edição inline: clique vira um campo; Enter ou sair do
// campo grava a estimativa no ClickUp (via onEstimar) e a agenda recalcula.
function HorasEditaveis({ tarefa, estimada, onEstimar }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [local, setLocal] = useState(null) // valor recém-salvo, até a agenda recarregar
  const inputRef = useRef(null)

  useEffect(() => { setLocal(null) }, [tarefa.horas, tarefa.origem])
  useEffect(() => { if (editando) inputRef.current?.select() }, [editando])

  const horasMostradas = local ?? tarefa.horas
  const veioDoClickUp = local != null || !estimada
  const podeEditar = typeof onEstimar === 'function' && !!tarefa.id

  function abrir(e) {
    e.preventDefault(); e.stopPropagation()
    if (!podeEditar || salvando) return
    setValor(String(horasMostradas ?? '').replace('.', ','))
    setErro(null)
    setEditando(true)
  }
  async function salvar() {
    const n = Number(String(valor).replace(',', '.'))
    setEditando(false)
    if (!(n > 0) || n === Number(horasMostradas) && veioDoClickUp) return
    setSalvando(true)
    setErro(null)
    try {
      await onEstimar(tarefa, n)
      setLocal(n)
    } catch (e) {
      setErro(e?.message || 'Não salvou')
    } finally {
      setSalvando(false)
    }
  }
  function tecla(e) {
    if (e.key === 'Enter') { e.preventDefault(); salvar() }
    if (e.key === 'Escape') { e.preventDefault(); setEditando(false) }
  }

  if (editando) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={salvar}
        onKeyDown={tecla}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Horas de ${tarefa.nome || 'tarefa'}`}
        className="w-14 shrink-0 h-6 px-1.5 rounded-md bg-ln-ink/[0.05] border border-ln-accent/60 text-right text-xs text-ln-t1 tabular outline-none"
      />
    )
  }
  return (
    <button
      type="button"
      onClick={abrir}
      disabled={!podeEditar || salvando}
      className={`group/h w-14 shrink-0 h-6 px-1 rounded-md inline-flex items-center justify-end gap-1 text-xs tabular transition-colors duration-150 ${podeEditar ? 'hover:bg-ln-ink/5 cursor-text' : 'cursor-default'} ${erro ? 'text-ln-red' : 'text-ln-t2'} ${FOCO}`}
      title={erro ? `Erro ao salvar: ${erro}. Clique para tentar de novo` : podeEditar ? (veioDoClickUp ? 'Estimativa preenchida no ClickUp. Clique para alterar' : `Horas estimadas pelo tipo ou dificuldade (${tarefa.origem}). Clique para preencher a estimativa no ClickUp`) : (veioDoClickUp ? 'Estimativa preenchida no ClickUp' : `Horas estimadas (${tarefa.origem})`)}
    >
      {salvando
        ? <Loader2 className="w-3 h-3 animate-spin text-ln-t3" />
        : <Pencil className="w-2.5 h-2.5 text-ln-t4 opacity-0 group-hover/h:opacity-100 transition-opacity" aria-hidden="true" />}
      <span>{fmtHoras(horasMostradas)}{!veioDoClickUp && <span className="text-ln-t4">*</span>}</span>
    </button>
  )
}

function TarefaRow({ tarefa, aba, diaSelecionado, onEstimar }) {
  const zumbi = aba === 'zumbis'
  const atrasada = zumbi || !!tarefa.atrasada
  let dia = ''
  let tituloDia = ''
  if (aba === 'semdata') {
    dia = 'sem data'
    tituloDia = 'Sem data de vencimento no ClickUp: fica fora do cálculo'
  } else if (zumbi) {
    dia = fmtCurta(tarefa.vencimento)
    tituloDia = `Venceu em ${fmtCurta(tarefa.vencimento)}, há ${Number(tarefa.diasAtraso) || 0} dia(s): fora do cálculo`
  } else if (tarefa.atrasada) {
    dia = fmtCurta(tarefa.vencimento || tarefa.dia)
    tituloDia = `Venceu em ${fmtCurta(tarefa.vencimento || tarefa.dia)}, entra em hoje no cálculo`
  } else {
    dia = fmtCurta(tarefa.dia)
    tituloDia = `Entra na agenda em ${fmtDiaCurto(tarefa.dia)}`
  }
  const estimada = !!tarefa.origem && tarefa.origem !== 'estimativa'
  const selecionada = !!diaSelecionado && tarefa.dia === diaSelecionado
  const corDia = atrasada ? TOM.vermelho : aba === 'semdata' ? 'text-ln-t4' : 'text-ln-t3'
  return (
    <li className={`ln-row-hover flex items-center gap-2 h-8 px-2 -mx-2 ${selecionada ? 'bg-ln-ink/[0.03]' : ''}`}>
      {tarefa.prioridade && PRIORIDADE_LABEL[String(tarefa.prioridade).toLowerCase()]
        ? <PrioridadeIcon prioridade={String(tarefa.prioridade).toLowerCase()} className="w-4 h-4" />
        : <span className="w-4 h-4 shrink-0 inline-flex items-center justify-center text-ln-t4/60" title="Sem prioridade no ClickUp" aria-label="Sem prioridade">·</span>}
      <span className={`w-14 shrink-0 text-xs tabular ${corDia}`} title={tituloDia}>{dia}</span>
      <a
        href={tarefa.url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex-1 min-w-0 truncate text-[13px] text-ln-t2 hover:text-ln-t1 rounded transition-colors duration-150 ${FOCO}`}
        title={`${tarefa.pasta || 'Sem pasta'} › ${tarefa.lista || 'Sem lista'}`}
      >
        {tarefa.nome || 'Sem título'}
      </a>
      <span
        className="w-24 shrink-0 truncate text-[11px] text-ln-t3"
        title={tarefa.pasta ? `Cliente: ${tarefa.pasta}${tarefa.lista ? ` › ${tarefa.lista}` : ''}` : 'Tarefa fora de uma pasta de cliente'}
      >
        {tarefa.pasta || <span className="text-ln-t4">sem cliente</span>}
      </span>
      <HorasEditaveis tarefa={tarefa} estimada={estimada} onEstimar={onEstimar} />
      {tarefa.status && (
        <span className="shrink-0 max-w-[96px] truncate h-5 px-1.5 rounded-full ring-1 ring-ln-line text-[11px] leading-5 text-ln-t3" title={tarefa.status}>
          {tarefa.status}
        </span>
      )}
    </li>
  )
}

function GrupoPrioridade({ grupo, recolhido, onToggle, children }) {
  return (
    <section className="mb-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!recolhido}
        className={`w-full h-9 -mx-2 px-2 rounded-lg flex items-center gap-2 text-left transition-colors duration-150 hover:bg-ln-ink/[0.03] ${FOCO}`}
        style={{ width: 'calc(100% + 16px)' }}
      >
        {recolhido ? <ChevronRight className="w-3.5 h-3.5 text-ln-t4 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-ln-t4 shrink-0" />}
        <span className={`inline-flex items-center h-5 px-2 rounded-full ring-1 ring-inset text-[11px] font-semibold uppercase tracking-wide ${grupo.cls}`}>{grupo.label}</span>
        <span className="text-[13px] text-ln-t3 tabular">{grupo.itens.length}</span>
        <span className="text-[11px] text-ln-t4 tabular ml-auto">{fmtHoras(grupo.horas)}</span>
      </button>
      {!recolhido && <ul>{children}</ul>}
    </section>
  )
}

function ListaTarefas({ pessoa, aba, onAba, diaSelecionado, prefixo, onEstimar }) {
  const [recolhidos, setRecolhidos] = useState({})
  const contagens = {
    fila: (pessoa.filaProxima || []).length,
    atrasadas: (pessoa.filaProxima || []).filter((t) => t.atrasada).length,
    semdata: (pessoa.semData || []).length,
    zumbis: (pessoa.zumbis || []).length,
  }
  const itens = itensDaAba(pessoa, aba)
  const def = ABAS.find((a) => a.id === aba) || ABAS[0]
  const temEstimadas = itens.some((t) => !!t.origem && t.origem !== 'estimativa')
  return (
    <section>
      <Abas aba={aba} onAba={onAba} contagens={contagens} prefixo={prefixo} />
      <div role="tabpanel" id={`${prefixo}-painel-${aba}`} aria-labelledby={`${prefixo}-aba-${aba}`} className="mt-2">
        {itens.length === 0 ? (
          <p className="h-8 flex items-center text-xs text-ln-t4">{def.vazio}</p>
        ) : (
          agruparPorPrioridade(itens).map((g) => (
            <GrupoPrioridade key={g.id} grupo={g} recolhido={!!recolhidos[g.id]} onToggle={() => setRecolhidos((r) => ({ ...r, [g.id]: !r[g.id] }))}>
              {g.itens.map((t, i) => <TarefaRow key={t.id || i} tarefa={t} aba={aba} diaSelecionado={diaSelecionado} onEstimar={onEstimar} />)}
            </GrupoPrioridade>
          ))
        )}
      </div>
      {temEstimadas && (
        <p className="mt-1.5 text-[11px] text-ln-t4">
          * horas estimadas pelo tipo ou pela dificuldade: a tarefa não tem estimativa no ClickUp.{onEstimar ? ' Clique nas horas para preencher.' : ''}
        </p>
      )}
    </section>
  )
}

function Esqueleto({ pessoa }) {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full ln-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-40 rounded ln-shimmer" />
          <div className="h-3 w-56 max-w-full rounded ln-shimmer" />
          <div className="h-6 w-24 rounded-full ln-shimmer" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-[9px] ln-shimmer" />)}
      </div>
      <div className="h-[140px] rounded-lg ln-shimmer" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-8 rounded-lg ln-shimmer" />)}
      </div>
      <p className="text-xs text-ln-t4">Lendo o ClickUp de {primeiroNome(pessoa.nome) || 'esta pessoa'}…</p>
    </div>
  )
}

function Erro({ pessoa, onRecarregar }) {
  return (
    <div className="ln-card p-4 flex items-start gap-3" role="alert">
      <AlertTriangle className="w-4 h-4 text-ln-red shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ln-t2">Não consegui ler o ClickUp</p>
        <p className="mt-0.5 text-xs text-ln-t3 break-words">{pessoa.erro}</p>
        <button
          type="button"
          onClick={() => onRecarregar?.(pessoa)}
          className={`ln-pill mt-3 ${FOCO}`}
          title="Tentar ler o ClickUp de novo"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Tentar de novo
        </button>
      </div>
    </div>
  )
}

function SemClickup({ pessoa }) {
  return (
    <div className="ln-card p-4 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 text-ln-t4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ln-t2">Sem ClickUp mapeado</p>
        <p className="mt-0.5 text-xs text-ln-t3">
          {pessoa.saude?.texto || 'Sem ClickUp mapeado no perfil desta pessoa'}. Preencha o usuário do ClickUp em Usuários para ler a agenda.
        </p>
      </div>
    </div>
  )
}

// ─── Painel ──────────────────────────────────────────────────────────────────

/**
 * @param {object}   p
 * @param {object}   p.pessoa            pessoa enriquecida (enriquecerPessoa)
 * @param {string}   [p.hoje]            yyyy-mm-dd (cai em pessoa.hoje)
 * @param {string}   [p.diaSelecionado]  dia destacado na linha de calor do time
 * @param {string}   [p.abaInicial]      'fila' | 'atrasadas' | 'semdata' | 'zumbis'
 * @param {Function} [p.onNovaAtividade] (pessoa) => void
 * @param {Function} [p.onRecarregar]    (pessoa) => void
 * @param {Function} [p.onEstimar]       (pessoa, tarefa, horas) => Promise  grava a estimativa no ClickUp
 */
export default function PersonPanel({ pessoa, hoje, diaSelecionado = null, abaInicial = ABA_PADRAO, onNovaAtividade, onRecarregar, onEstimar }) {
  const prefixo = useId()
  // A aba segue a prop quando o painel troca de pessoa ou a tabela pede outra
  // aba; entre trocas, quem manda é o clique do usuário.
  const chaveAba = `${pessoa?.profileId ?? ''}|${normalizarAba(abaInicial)}`
  const [aba, setAba] = useState(() => normalizarAba(abaInicial))
  const [chaveAnterior, setChaveAnterior] = useState(chaveAba)
  if (chaveAba !== chaveAnterior) {
    setChaveAnterior(chaveAba)
    setAba(normalizarAba(abaInicial))
  }

  if (!pessoa) return null

  const semClickup = !pessoa.clickupId
  const carregando = !pessoa.api && !pessoa.erro && !semClickup
  const atualizadoEm = pessoa.atualizadoEm || pessoa.geradoEm || pessoa.api?.geradoEm || null
  const hojeRef = hoje || pessoa.hoje || null
  const nome = primeiroNome(pessoa.nome) || 'esta pessoa'

  return (
    <div className="flex flex-col min-h-full text-ln-t2">
      <div className="flex-1 px-4 py-4 space-y-5">
        {carregando ? (
          <Esqueleto pessoa={pessoa} />
        ) : (
          <>
            <Cabecalho pessoa={pessoa} atualizadoEm={atualizadoEm} />

            {pessoa.erro && <Erro pessoa={pessoa} onRecarregar={onRecarregar} />}
            {!pessoa.erro && semClickup && <SemClickup pessoa={pessoa} />}

            {pessoa.api && (
              <>
                <Kpis pessoa={pessoa} />

                <section>
                  {pessoa.resumo?.length ? (
                    <CargaDiaria
                      resumo={pessoa.resumo}
                      capacidade={pessoa.capacidadeDia}
                      hoje={hojeRef}
                      diaSelecionado={diaSelecionado}
                      altura={120}
                    />
                  ) : (
                    <p className="text-xs text-ln-t4">Sem dias úteis no resumo desta pessoa</p>
                  )}
                  <LinhaDia pessoa={pessoa} diaSelecionado={diaSelecionado} />
                </section>

                <Alertas alertas={alertasDe(pessoa)} />

                <Distribuicao porPasta={pessoa.porPasta || []} />

                <ListaTarefas pessoa={pessoa} aba={aba} onAba={setAba} diaSelecionado={diaSelecionado} prefixo={prefixo} onEstimar={onEstimar ? (tarefa, horas) => onEstimar(pessoa, tarefa, horas) : null} />
              </>
            )}
          </>
        )}
      </div>

      <footer className="sticky bottom-0 z-10 flex items-center gap-2 flex-wrap px-4 py-3 border-t border-ln-ink/[0.08] bg-ln-panel">
        <button
          type="button"
          onClick={() => onNovaAtividade?.(pessoa)}
          disabled={semClickup}
          className={`ln-primary ${FOCO}`}
          title={semClickup ? 'Sem ClickUp mapeado: não dá para atribuir uma tarefa' : `Nova atividade para ${pessoa.nome}`}
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Nova atividade para {nome}
        </button>
        <button
          type="button"
          onClick={() => onRecarregar?.(pessoa)}
          disabled={semClickup || carregando}
          className={`ln-pill ${FOCO}`}
          title={semClickup ? 'Sem ClickUp mapeado: nada para recarregar' : 'Ler de novo as tarefas desta pessoa no ClickUp'}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} aria-hidden="true" /> Recarregar do ClickUp
        </button>
      </footer>
    </div>
  )
}
