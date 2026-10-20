// Extras do painel da tarefa no VertaTask: etiquetas, relações entre tarefas,
// histórico de atividade e seguir/deixar de seguir.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Plus, X, Check, Search, Bell, BellOff, Link2, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fmtDataHora, fmtDataNumerica, rotuloStatus, prioridade as prioDe } from '../../lib/tarefas'
import { Popover, FOCO } from './Campos'

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
  const [adicionando, setAdicionando] = useState(false)
  const [tipo, setTipo] = useState('relacionada')
  const [q, setQ] = useState('')
  const [achados, setAchados] = useState([])

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

  useEffect(() => {
    if (!adicionando || q.trim().length < 2) { setAchados([]); return undefined }
    const h = setTimeout(async () => {
      const { data } = await supabase.from('tarefas_itens').select('id,titulo,status_tipo').ilike('titulo', `%${q.trim()}%`).neq('id', tarefaId).eq('arquivada', false).limit(8)
      setAchados(data || [])
    }, 250)
    return () => clearTimeout(h)
  }, [q, adicionando, tarefaId])

  async function adicionar(alvo) {
    // "Bloqueia" e "duplica" gravam tarefa → alvo; "relacionada" também.
    const { error } = await supabase.from('tarefas_relacoes').insert({ tarefa_id: tarefaId, relacionada_id: alvo.id, tipo, criado_por: user?.id || null })
    if (error) { onErro?.(error.code === '23505' ? 'Essa relação já existe.' : error.message); return }
    setQ(''); setAchados([]); setAdicionando(false)
    carregar()
  }
  async function remover(id) {
    const { error } = await supabase.from('tarefas_relacoes').delete().eq('id', id)
    if (error) onErro?.(error.message); else setLinhas((l) => l.filter((x) => x.id !== id))
  }

  return (
    <div className="flex flex-col">
      {linhas.map((r) => {
        const direto = r.tarefa_id === tarefaId
        const outro = titulos[direto ? r.relacionada_id : r.tarefa_id]
        return (
          <div key={r.id} className="group/rel flex items-center gap-2 h-8 -mx-2 px-2 rounded-lg hover:bg-ln-ink/[0.03]">
            <span className="text-[11px] text-ln-t4 w-[110px] shrink-0">{(direto ? ROTULO_DIRETO : ROTULO_INVERSO)[r.tipo]}</span>
            <button type="button" onClick={() => outro && onAbrir(outro.id)} className={`flex-1 min-w-0 truncate text-left text-[13px] hover:text-ln-accent ${outro?.status_tipo === 'closed' ? 'line-through text-ln-t4' : 'text-ln-t2'} ${FOCO}`}>{outro?.titulo || 'Tarefa removida'}</button>
            <button type="button" onClick={() => remover(r.id)} className="ln-iconbtn !w-5 !h-5 opacity-0 group-hover/rel:opacity-100 focus-visible:opacity-100" aria-label="Remover relação"><X className="w-3 h-3" /></button>
          </div>
        )
      })}
      {adicionando ? (
        <div className="mt-1 flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <select className="ln-input !h-8 !w-[150px]" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de relação">
              <option value="relacionada">Relacionada a</option>
              <option value="bloqueia">Bloqueia</option>
              <option value="duplica">Duplicada de</option>
            </select>
            <div className="ln-input !h-8 flex items-center gap-1.5 flex-1">
              <Search className="w-3.5 h-3.5 text-ln-t4" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tarefa pelo título" className="flex-1 min-w-0 bg-transparent outline-none text-xs" />
            </div>
            <button type="button" onClick={() => { setAdicionando(false); setQ('') }} className="ln-iconbtn" aria-label="Cancelar"><X className="w-3.5 h-3.5" /></button>
          </div>
          {achados.map((a) => (
            <button key={a.id} type="button" onClick={() => adicionar(a)} className="text-left text-[13px] px-2 h-8 rounded-md hover:bg-ln-ink/5 text-ln-t2 truncate">{a.titulo}</button>
          ))}
        </div>
      ) : (
        <button type="button" onClick={() => setAdicionando(true)} className={`self-start inline-flex items-center gap-1.5 h-7 px-2 -mx-2 rounded-md text-xs text-ln-t4 hover:text-ln-t2 hover:bg-ln-ink/[0.03] ${FOCO}`}><Link2 className="w-3.5 h-3.5" /> Adicionar relação</button>
      )}
    </div>
  )
}

// ── Histórico ───────────────────────────────────────────────────────────────

export function HistoricoSecao({ tarefaId, versao, membrosMap, ciclosMap, modulosMap, etiquetasMap }) {
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
      case 'modulo': return para ? `colocou no module ${modulosMap.get(para)?.nome || ''}` : 'tirou do module'
      case 'responsaveis': return `mudou os responsáveis para ${nomes(para, membrosMap, 'm')}`
      case 'etiquetas': return para ? `mudou as etiquetas para ${nomes(para, etiquetasMap)}` : 'removeu as etiquetas'
      default: return `alterou ${a.campo}`
    }
  }, [ciclosMap, modulosMap, membrosMap, etiquetasMap, nomes])

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

export function SeguirBotao({ tarefaId, user }) {
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
  return (
    <button type="button" onClick={alternar} className={`ln-pill ${seguindo ? '!text-ln-accent' : ''} ${FOCO}`} title={seguindo ? 'Você recebe aviso de comentários e mudanças. Clique para parar.' : 'Receber aviso de comentários nesta tarefa'}>
      {seguindo ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
      {seguindo ? 'Seguindo' : 'Seguir'}{total > 0 && <span className="text-ln-t4 tabular">{total}</span>}
    </button>
  )
}

