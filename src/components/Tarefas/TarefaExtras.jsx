// Extras do painel da tarefa no VertaTask: etiquetas, relações entre tarefas,
// histórico de atividade e seguir/deixar de seguir.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Plus, X, Check, Bell, BellOff, Loader2, MoreHorizontal, LayoutTemplate, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fmtDataHora, fmtDataNumerica, rotuloStatus, prioridade as prioDe } from '../../lib/tarefas'
import { Popover, ItemMenu, FOCO } from './Campos'
import { ListaRelacoes } from './SecoesTarefa'

const PALETA = ['#2A25F0', '#518CFF', '#1F8A5B', '#C99A2E', '#E2564B', '#8B5CF6', '#EC4899', '#5A6072']

export function EtiquetaChip({ etiqueta, onRemover }) {
  if (!etiqueta) return null
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full ring-1 ring-inset ring-ln-line text-xs text-ln-t3 max-w-full">
      <i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: etiqueta.cor }} />
      <span className="truncate">{etiqueta.nome}</span>
      {onRemover && <button type="button" onClick={onRemover} className="text-ln-t4 hover:text-ln-t1" aria-label={`Remover ${etiqueta.nome}`}><X className="w-3 h-3" /></button>}
    </span>
  )
}

export function EtiquetasCampo({ valor = [], etiquetas, onChange, onCriar }) {
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(PALETA[0])
  const ref = useRef(null)
  const sel = new Set(valor)
  const map = new Map(etiquetas.map((e) => [e.id, e]))
  const alternar = (id) => onChange(sel.has(id) ? valor.filter((x) => x !== id) : [...valor, id])
  async function criar(e) {
    e.preventDefault()
    if (!nome.trim()) return
    const r = await onCriar({ nome, cor })
    if (r?.data) { setNome(''); onChange([...valor, r.data.id]) }
  }
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className={`flex flex-wrap gap-1 text-left rounded-md ${FOCO}`}>
        {valor.length ? valor.map((id) => <EtiquetaChip key={id} etiqueta={map.get(id)} />) : <span className="text-ln-t4 text-xs">nenhuma</span>}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={250}>
        <div className="p-1 max-h-[260px] overflow-y-auto">
          {etiquetas.map((e) => (
            <button key={e.id} type="button" onClick={() => alternar(e.id)} className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] text-ln-t2 hover:bg-ln-ink/5">
              <i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.cor }} />
              <span className="truncate">{e.nome}</span>
              {sel.has(e.id) && <Check className="w-3.5 h-3.5 ml-auto text-ln-accent" />}
            </button>
          ))}
          {!etiquetas.length && <p className="px-2.5 py-2 text-xs text-ln-t4">Nenhuma etiqueta ainda. Crie a primeira abaixo.</p>}
        </div>
        <form onSubmit={criar} className="border-t border-ln-ink/5 p-2 flex flex-col gap-2">
          <input className="ln-input !h-8" placeholder="Nova etiqueta" value={nome} onChange={(e) => setNome(e.target.value)} />
          <div className="flex items-center gap-1.5">
            {PALETA.map((c) => (
              <button key={c} type="button" onClick={() => setCor(c)} aria-label={`Cor ${c}`} className={`w-5 h-5 rounded-full ${cor === c ? 'ring-2 ring-offset-1 ring-ln-t2' : ''}`} style={{ backgroundColor: c }} />
            ))}
            <button type="submit" disabled={!nome.trim()} className="ln-primary !h-7 ml-auto disabled:opacity-50"><Plus className="w-3 h-3" /> Criar</button>
          </div>
        </form>
      </Popover>
    </>
  )
}

// ── Relações ────────────────────────────────────────────────────────────────

const ROTULO_DIRETO = { bloqueia: 'Bloqueia', duplica: 'Duplicada de', relacionada: 'Relacionada a' }
const ROTULO_INVERSO = { bloqueia: 'Bloqueada por', duplica: 'Tem a duplicata', relacionada: 'Relacionada a' }

export function RelacoesSecao({ tarefaId, user, onAbrir, onErro }) {
  const [linhas, setLinhas] = useState([])
  const [titulos, setTitulos] = useState({})

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('tarefas_relacoes').select('*').or(`tarefa_id.eq.${tarefaId},relacionada_id.eq.${tarefaId}`)
    const rows = data || []
    setLinhas(rows)
    const ids = [...new Set(rows.flatMap((r) => [r.tarefa_id, r.relacionada_id]).filter((id) => id !== tarefaId))]
    if (ids.length) {
      const { data: ts } = await supabase.from('tarefas_itens').select('id,titulo,status_tipo').in('id', ids)
      setTitulos(Object.fromEntries((ts || []).map((t) => [t.id, t])))
    } else setTitulos({})
  }, [tarefaId])
  useEffect(() => { carregar() }, [carregar])

  const buscar = async (q) => {
    const { data } = await supabase.from('tarefas_itens').select('id,titulo,status_tipo').ilike('titulo', `%${q}%`).neq('id', tarefaId).eq('arquivada', false).limit(8)
    return data || []
  }
  async function adicionar(tipo, alvo) {
    // "Bloqueia" e "duplica" gravam tarefa → alvo; "relacionada" também.
    const { error } = await supabase.from('tarefas_relacoes').insert({ tarefa_id: tarefaId, relacionada_id: alvo.id, tipo, criado_por: user?.id || null })
    if (error) { onErro?.(error.code === '23505' ? 'Essa relação já existe.' : error.message); return false }
    carregar()
    return true
  }
  async function remover(id) {
    const { error } = await supabase.from('tarefas_relacoes').delete().eq('id', id)
    if (error) onErro?.(error.message); else setLinhas((l) => l.filter((x) => x.id !== id))
  }

  return (
    <ListaRelacoes
      linhas={linhas.map((r) => {
        const direto = r.tarefa_id === tarefaId
        const outro = titulos[direto ? r.relacionada_id : r.tarefa_id]
        return {
          key: r.id, rotulo: (direto ? ROTULO_DIRETO : ROTULO_INVERSO)[r.tipo], titulo: outro?.titulo, concluida: outro?.status_tipo === 'closed',
          onAbrir: outro ? () => onAbrir(outro.id) : undefined, onRemover: () => remover(r.id),
        }
      })}
      tipos={[{ value: 'relacionada', label: 'Relacionada a' }, { value: 'bloqueia', label: 'Bloqueia' }, { value: 'duplica', label: 'Duplicada de' }]}
      buscar={buscar} onAdicionar={adicionar}
    />
  )
}

// ── Histórico ───────────────────────────────────────────────────────────────

export function HistoricoSecao({ tarefaId, versao, membrosMap, ciclosMap, etiquetasMap }) {
  const [linhas, setLinhas] = useState(null)
  useEffect(() => {
    let vivo = true
    supabase.from('tarefas_atividade').select('*').eq('tarefa_id', tarefaId).order('created_at', { ascending: false }).limit(40)
      .then(({ data }) => { if (vivo) setLinhas(data || []) })
    return () => { vivo = false }
  }, [tarefaId, versao])

  const nomes = useCallback((csv, mapa, campo) => {
    if (!csv) return 'ninguém'
    return csv.split(',').map((id) => (campo === 'm' ? mapa.get(id)?.name : mapa.get(id)?.nome) || '?').join(', ')
  }, [])

  const texto = useMemo(() => (a) => {
    const de = a.valor_antigo, para = a.valor_novo
    switch (a.campo) {
      case 'criada': return 'criou a tarefa'
      case 'titulo': return `renomeou a tarefa para "${para}"`
      case 'status': return `mudou o status de ${rotuloStatus(de)} para ${rotuloStatus(para)}`
      case 'prioridade': return `mudou a prioridade para ${prioDe(para)?.label || 'sem prioridade'}`
      case 'data_inicio': return para ? `definiu o início para ${fmtDataNumerica(para)}` : 'removeu a data de início'
      case 'data_vencimento': return para ? `definiu o vencimento para ${fmtDataNumerica(para)}` : 'removeu o vencimento'
      case 'estimativa_min': return para ? `estimou em ${Math.round(Number(para) / 6) / 10}h` : 'removeu a estimativa'
      case 'ciclo': return para ? `colocou no cycle ${ciclosMap.get(para)?.nome || ''}` : 'tirou do cycle'
      case 'responsaveis': return `mudou os responsáveis para ${nomes(para, membrosMap, 'm')}`
      case 'etiquetas': return para ? `mudou as etiquetas para ${nomes(para, etiquetasMap)}` : 'removeu as etiquetas'
      default: return `alterou ${a.campo}`
    }
  }, [ciclosMap, membrosMap, etiquetasMap, nomes])

  if (linhas === null) return <div className="py-2 text-ln-t4"><Loader2 className="w-3.5 h-3.5 animate-spin" /></div>
  if (!linhas.length) return <p className="text-xs text-ln-t4">Sem alterações registradas. O histórico começa a partir de agora e não inclui o que veio do ClickUp.</p>
  return (
    <ol className="flex flex-col gap-1.5">
      {linhas.map((a) => (
        <li key={a.id} className="flex items-baseline gap-2 text-[13px] text-ln-t3">
          <i className="w-1.5 h-1.5 rounded-full bg-ln-t4 shrink-0 translate-y-[-2px]" />
          <span className="min-w-0"><b className="font-semibold text-ln-t2">{a.ator_nome || 'Alguém'}</b> {texto(a)}</span>
          <span className="ml-auto text-[11px] text-ln-t4 whitespace-nowrap tabular">{fmtDataHora(a.created_at)}</span>
        </li>
      ))}
    </ol>
  )
}

// ── Seguir ──────────────────────────────────────────────────────────────────

/** Quem segue a tarefa: estado e alternar (tarefas_seguidores). */
function useSeguir(tarefaId, user) {
  const [seguindo, setSeguindo] = useState(false)
  const [total, setTotal] = useState(0)
  useEffect(() => {
    let vivo = true
    supabase.from('tarefas_seguidores').select('user_id').eq('tarefa_id', tarefaId).then(({ data }) => {
      if (!vivo) return
      setTotal((data || []).length)
      setSeguindo((data || []).some((r) => r.user_id === user?.id))
    })
    return () => { vivo = false }
  }, [tarefaId, user?.id])
  async function alternar() {
    if (!user?.id) return
    if (seguindo) {
      await supabase.from('tarefas_seguidores').delete().eq('tarefa_id', tarefaId).eq('user_id', user.id)
      setSeguindo(false); setTotal((n) => Math.max(0, n - 1))
    } else {
      await supabase.from('tarefas_seguidores').insert({ tarefa_id: tarefaId, user_id: user.id })
      setSeguindo(true); setTotal((n) => n + 1)
    }
  }
  return { seguindo, total, alternar }
}

/** Menu ⋯ do painel da tarefa: seguir, salvar como template e excluir. */
export function MenuTarefa({ tarefaId, user, onSalvarTemplate, onExcluir }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { seguindo, total, alternar } = useSeguir(tarefaId, user)
  const fechar = (fn) => () => { setOpen(false); fn?.() }
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className={`ln-iconbtn ${open ? 'bg-ln-ink/[0.08] text-ln-t1' : ''} ${FOCO}`} aria-label="Mais ações" title="Mais ações" aria-haspopup="menu" aria-expanded={open}>
        <MoreHorizontal className="w-4 h-4" />
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={230} align="right">
        <div className="p-1" role="menu">
          <ItemMenu onClick={fechar(alternar)}>
            {seguindo ? <BellOff className="w-3.5 h-3.5 text-ln-t4" /> : <Bell className="w-3.5 h-3.5 text-ln-t4" />}
            <span className="flex-1">{seguindo ? 'Deixar de seguir' : 'Seguir'}</span>
            {total > 0 && <span className="text-[11px] text-ln-t4 tabular" title={`${total} pessoa(s) seguindo`}>{total}</span>}
          </ItemMenu>
          {onSalvarTemplate && (
            <ItemMenu onClick={fechar(onSalvarTemplate)}><LayoutTemplate className="w-3.5 h-3.5 text-ln-t4" /> Salvar como template</ItemMenu>
          )}
          {onExcluir && (<>
            <div className="border-t border-ln-ink/5 my-1" />
            <ItemMenu onClick={fechar(onExcluir)} className="!text-ln-red"><Trash2 className="w-3.5 h-3.5" /> Excluir</ItemMenu>
          </>)}
        </div>
      </Popover>
    </>
  )
}

