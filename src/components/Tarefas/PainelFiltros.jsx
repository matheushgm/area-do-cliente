// Sidebar de filtros avançados (funil da barra), no modelo do ClickUp: campo → condição
// (conforme o tipo do campo) → valor, condições ligadas por E/OU dentro de grupos e grupos
// ligados por E/OU. Os filtros são rascunho da visualização: valem na tela na hora e ficam
// gravados com "Salvar visualização". O motor e os campos moram em src/lib/filtrosTarefas.js.
import { useEffect, useRef, useState } from 'react'
import { ListFilter, Plus, Trash2, Check, ChevronDown, Search, Flag } from 'lucide-react'
import { Popover, Avatar, FOCO } from './Campos'
import { DataInput } from './Calendario'
import { CabecalhoPainel } from './PainelView'
import { corDaPessoa, iniciais } from '../../lib/tarefas'
import {
  CAMPOS_FILTRO, PERIODOS, SEM_VALOR, FILTROS_VAZIOS, campoFiltro, operadoresDe, regraCompleta, contarRegras,
  novaRegra, novoGrupo, opcoesDoCampo,
} from '../../lib/filtrosTarefas'

const INCOMPLETO = '!border-dashed !border-ln-orange/60'

function Marcador({ o }) {
  if (o.pessoa) return <Avatar pessoa={{ nome: o.pessoa.name, iniciais: o.pessoa.avatar || iniciais(o.pessoa.name), cor: corDaPessoa(o.pessoa.id) }} size={16} />
  if (o.bandeira) return <Flag className="w-3.5 h-3.5 shrink-0" style={{ color: o.cor }} fill={o.cor} />
  if (o.cor) return <i className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: o.cor }} />
  return null
}

function SeletorOpcoes({ opcoes, valor, onChange }) {
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const sel = opcoes.filter((o) => valor.includes(o.value))
  const visiveis = opcoes.filter((o) => o.label.toLowerCase().includes(busca.toLowerCase()))
  const alternar = (v) => onChange(valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v])
  return (
    <>
      <button ref={ref} type="button" onClick={() => setAberto((x) => !x)} className={`ln-input !h-8 flex-1 min-w-[120px] flex items-center gap-1.5 text-left text-[12.5px] ${!sel.length ? INCOMPLETO : ''} ${aberto ? '!border-ln-accent' : ''}`}>
        {sel.length ? (
          <span className="flex items-center gap-1.5 min-w-0 flex-1">
            {sel.slice(0, 2).map((o) => <span key={o.value} className="inline-flex items-center gap-1 min-w-0"><Marcador o={o} /><span className="truncate text-ln-t1">{o.label}</span></span>)}
            {sel.length > 2 && <span className="text-ln-t4 shrink-0">+{sel.length - 2}</span>}
          </span>
        ) : <span className="flex-1 text-ln-t4">Escolha…</span>}
        <ChevronDown className="w-3 h-3 text-ln-t4 shrink-0" />
      </button>
      <Popover anchorRef={ref} open={aberto} onClose={() => { setAberto(false); setBusca('') }} width={260} align="right">
        {opcoes.length > 6 && (
          <div className="flex items-center gap-2 h-9 px-3 border-b border-ln-ink/5 shrink-0"><Search className="w-3.5 h-3.5 text-ln-t4" /><input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="flex-1 bg-transparent outline-none text-[13px] text-ln-t1 placeholder:text-ln-t4" /></div>
        )}
        <div className="p-1 overflow-y-auto">
          {visiveis.map((o) => {
            const marcado = valor.includes(o.value)
            return (
              <button key={o.value} type="button" role="menuitemcheckbox" aria-checked={marcado} onClick={() => alternar(o.value)} className={`w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13px] hover:bg-ln-ink/5 ${marcado ? 'text-ln-t1' : 'text-ln-t2'}`}>
                <span className={`w-4 h-4 rounded grid place-items-center shrink-0 border ${marcado ? 'bg-ln-accent border-ln-accent text-white' : 'border-ln-ink/25'}`}>{marcado && <Check className="w-3 h-3" />}</span>
                <Marcador o={o} /><span className="truncate">{o.label}</span>
              </button>
            )
          })}
          {!visiveis.length && <p className="px-2.5 py-2 text-xs text-ln-t4">{opcoes.length ? 'Nada encontrado.' : 'Sem opções neste escopo.'}</p>}
        </div>
      </Popover>
    </>
  )
}

function ValorRegra({ r, campo, ctx, onChange }) {
  if (!campo || !r.operador) return <span className="ln-input !h-8 flex-1 min-w-[120px] flex items-center text-[12.5px] text-ln-t4 opacity-60">—</span>
  if (SEM_VALOR.has(r.operador)) return <span className="flex-1 min-w-[120px]" />
  const incompleto = regraCompleta(r) ? '' : INCOMPLETO
  if (campo.tipo === 'opcao' || campo.tipo === 'multi') return <SeletorOpcoes opcoes={opcoesDoCampo(campo.key, ctx)} valor={r.valor || []} onChange={onChange} />
  if (campo.tipo === 'data' && r.operador === 'e') {
    return (
      <select value={r.valor || ''} onChange={(e) => onChange(e.target.value)} className={`ln-input !h-8 flex-1 min-w-[120px] !text-[12.5px] ${incompleto}`} aria-label="Período">
        <option value="" disabled>Escolha o período…</option>
        {PERIODOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    )
  }
  if (campo.tipo === 'data') return <DataInput value={r.valor || ''} onChange={onChange} placeholder="Escolha a data" className={`!h-8 flex-1 min-w-[120px] !text-[12.5px] ${incompleto}`} aria-label="Data" />
  return (
    <input value={r.valor ?? ''} onChange={(e) => onChange(e.target.value)} type={campo.tipo === 'numero' ? 'number' : 'text'} min="0" step="0.5"
      placeholder={campo.tipo === 'numero' ? 'Horas' : 'Texto'} aria-label="Valor" className={`ln-input !h-8 flex-1 min-w-[120px] !text-[12.5px] ${incompleto}`} />
  )
}

// classes literais: o Tailwind não enxerga nome de classe montado em tempo de execução
const LARG_CONECTOR = { grupo: ['w-[56px]', '!w-[56px]'], regra: ['w-[52px]', '!w-[52px]'] }
/** indice 0 = "Onde"; 1 = seletor E/OU (vale para todo o nível); 2+ = repete o E/OU em texto, como no ClickUp. */
function Conector({ indice, valor, onChange, nivel = 'grupo' }) {
  const [larg, largSel] = LARG_CONECTOR[nivel]
  if (indice !== 1) {
    return <span className={`${larg} block shrink-0 text-right pr-2 text-[12px] ${indice === 0 ? 'text-ln-t3' : 'text-ln-t4 font-medium'}`}>{indice === 0 ? 'Onde' : valor === 'ou' ? 'OU' : 'E'}</span>
  }
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value)} className={`ln-input !h-8 ${largSel} shrink-0 !px-2 !text-[12px] font-medium`} aria-label="Ligar com E ou OU">
      <option value="e">E</option><option value="ou">OU</option>
    </select>
  )
}

function RegraFiltro({ r, ctx, indice, opGrupo, onOpGrupo, onChange, onRemover, focar, onFocado }) {
  const campo = campoFiltro(r.campo)
  const ops = operadoresDe(campo)
  const incompleta = !regraCompleta(r)
  const campoRef = useRef(null)
  // condição recém-criada: rola até ela (pode nascer abaixo da área visível) e foca o campo
  useEffect(() => {
    if (!focar) return
    campoRef.current?.scrollIntoView({ block: 'nearest' })
    campoRef.current?.focus({ preventScroll: true })
    onFocado()
  }, [focar]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Conector indice={indice} valor={opGrupo} onChange={onOpGrupo} nivel="regra" />
        <select ref={campoRef} value={r.campo} onChange={(e) => { const c = campoFiltro(e.target.value); onChange({ campo: c.key, operador: operadoresDe(c)[0][0], valor: null }) }}
          className={`ln-input !h-8 !w-[136px] shrink-0 !text-[12.5px] ${!r.campo ? `${INCOMPLETO} text-ln-t4` : ''}`} aria-label="Campo">
          <option value="" disabled>Escolha o campo…</option>
          {CAMPOS_FILTRO.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={r.operador} disabled={!campo} onChange={(e) => onChange({ operador: e.target.value, valor: campo.tipo === 'opcao' || campo.tipo === 'multi' ? r.valor : null })}
          className="ln-input !h-8 !w-[112px] shrink-0 !text-[12.5px] disabled:opacity-50" aria-label="Condição">
          {!campo && <option value="">—</option>}
          {ops.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <ValorRegra r={r} campo={campo} ctx={ctx} onChange={(valor) => onChange({ valor })} />
        <button type="button" onClick={onRemover} className="ln-iconbtn !w-7 !h-7 shrink-0 hover:!text-ln-red" aria-label="Remover condição" title="Remover condição"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      {incompleta && <p className="pl-[58px] text-[11px] text-ln-orange">{!r.campo ? 'Escolha um campo.' : 'Escolha um valor.'} Enquanto isso, esta condição não filtra nada.</p>}
    </div>
  )
}

/**
 * filtros/onChange = rascunho da view. ctx = opções dos campos { statuses, membros, etiquetas,
 * ciclos, listas }. barra = textos dos filtros da barra que somam com estes.
 */
export default function PainelFiltros({ filtros, onChange, ctx, barra, total, mostrando, alterados, podeEditar, persistente, onSalvar, onReverter, onFechar }) {
  const [focar, setFocar] = useState(null) // id da condição recém-criada
  const n = contarRegras(filtros)
  const mudar = (fn) => { const f = structuredClone(filtros); fn(f); onChange(f) }
  const addGrupo = () => { const r = novaRegra(); setFocar(r.id); mudar((f) => { f.grupos.push(novoGrupo(r)) }) }
  const addRegra = (gi) => { const r = novaRegra(); setFocar(r.id); mudar((f) => { f.grupos[gi].regras.push(r) }) }
  return (
    <>
      <CabecalhoPainel
        titulo={<>Filtros{n > 0 && <span className="ml-2 h-5 min-w-5 px-1.5 rounded-full bg-ln-accent/15 text-ln-accent text-[11px] tabular inline-grid place-items-center">{n}</span>}</>}
        icone={ListFilter} onFechar={onFechar}
        extra={<span className="text-[11px] text-ln-t4 tabular">{mostrando} de {total}</span>}
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        {barra.length > 0 && (
          <div className="rounded-lg bg-ln-ink/[0.035] px-3 py-2 flex flex-col gap-1.5">
            <span className="text-[11px] text-ln-t3">Somam com os filtros da barra:</span>
            <span className="flex flex-wrap gap-1">{barra.map((b) => <span key={b} className="h-6 px-2 rounded-md bg-ln-panel border border-ln-ink/[0.08] text-[11.5px] text-ln-t2 inline-flex items-center">{b}</span>)}</span>
          </div>
        )}

        {filtros.grupos.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-10 px-6">
            <span className="w-10 h-10 rounded-full bg-ln-ink/[0.05] grid place-items-center"><ListFilter className="w-5 h-5 text-ln-t3" /></span>
            <p className="text-[13px] text-ln-t1 font-medium">Nenhum filtro nesta visualização</p>
            <p className="text-xs text-ln-t4 leading-relaxed">Combine campos com E/OU e agrupe condições, como “prioridade alta E status a fazer” OU “vence ontem”.{persistente ? ' Os filtros ficam salvos com a visualização.' : ''}</p>
            <button type="button" onClick={addGrupo} className="ln-primary !h-8 mt-1"><Plus className="w-3.5 h-3.5" /> Adicionar filtro</button>
          </div>
        ) : filtros.grupos.map((g, gi) => (
          <div key={g.id} className="flex items-start gap-1.5">
            <div className="pt-2.5"><Conector indice={gi} valor={filtros.op} onChange={(op) => mudar((f) => { f.op = op })} /></div>
            <div className="flex-1 min-w-0 rounded-lg border border-ln-ink/[0.08] bg-ln-ink/[0.025] p-2.5 flex flex-col gap-2">
              {g.regras.map((r, ri) => (
                <RegraFiltro
                  key={r.id} r={r} ctx={ctx} indice={ri} opGrupo={g.op} focar={focar === r.id} onFocado={() => setFocar(null)}
                  onOpGrupo={(op) => mudar((f) => { f.grupos[gi].op = op })}
                  onChange={(patch) => mudar((f) => { Object.assign(f.grupos[gi].regras[ri], patch) })}
                  onRemover={() => mudar((f) => { f.grupos[gi].regras.splice(ri, 1); if (!f.grupos[gi].regras.length) f.grupos.splice(gi, 1) })}
                />
              ))}
              <button type="button" onClick={() => addRegra(gi)} className={`self-start inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-ln-t3 hover:text-ln-t1 hover:bg-ln-ink/5 ${FOCO}`}>
                <Plus className="w-3 h-3" /> Adicionar filtro agrupado
              </button>
            </div>
          </div>
        ))}
        {filtros.grupos.length > 0 && (
          <div className="flex items-start gap-1.5">
            <span className={`${LARG_CONECTOR.grupo[0]} shrink-0`} aria-hidden="true" />
            <button type="button" onClick={addGrupo} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-dashed border-ln-ink/[0.15] text-[13px] text-ln-t2 hover:text-ln-t1 hover:bg-ln-ink/5 ${FOCO}`}><Plus className="w-3.5 h-3.5" /> Adicionar grupo</button>
          </div>
        )}

        {filtros.grupos.length > 0 && mostrando === 0 && (
          <p className="text-xs text-ln-t3 bg-ln-orange/10 rounded-lg px-3 py-2">Nenhuma tarefa passa nesses filtros. Troque um “E” por “OU” ou remova uma condição.</p>
        )}
      </div>

      {filtros.grupos.length > 0 && (
        <div className="shrink-0 border-t border-ln-ink/[0.06]">
          {persistente && alterados && (
            <div className="flex items-center gap-1.5 px-4 py-2 bg-ln-orange/[0.06] text-[11.5px] text-ln-t2 border-b border-ln-ink/[0.06]">
              <i className="w-1.5 h-1.5 rounded-full bg-ln-orange shrink-0" /><span className="flex-1">Filtros diferentes dos salvos na visualização</span>
              <button type="button" onClick={onReverter} className="h-6 px-2 rounded-md hover:bg-ln-ink/5 text-ln-t3">Reverter</button>
              {podeEditar && <button type="button" onClick={onSalvar} className="h-6 px-2 rounded-md bg-ln-orange/15 text-ln-orange font-medium hover:bg-ln-orange/20">Salvar</button>}
            </div>
          )}
          <div className="p-3 flex items-center justify-end">
            <button type="button" onClick={() => onChange(FILTROS_VAZIOS)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-ln-red/40 text-[13px] text-ln-red hover:bg-ln-red/10 ${FOCO}`}>Apagar tudo</button>
          </div>
        </div>
      )}
    </>
  )
}
