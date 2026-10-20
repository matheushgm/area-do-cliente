// Aba Modules: cartões com o progresso de cada entrega. Clicar abre as
// tarefas do module (a mesma lista/quadro do resto do módulo).
import { useEffect, useState, useMemo } from 'react'
import { Plus, Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { corDaPessoa, iniciais } from '../../lib/tarefas'
import { progressoDoModulo, statusModulo, STATUS_MODULO, fmtDiaMes } from '../../lib/vertatask'
import { Avatar } from './Campos'

export default function ModulosView({ modulos, projetos, membrosMap, vt, onAbrirModulo, onToast, refreshKey }) {
  const [linhas, setLinhas] = useState([])
  const [novo, setNovo] = useState(null)
  const [fStatus, setFStatus] = useState('')

  useEffect(() => {
    let vivo = true
    supabase.from('tarefas_itens').select('modulo_id,status_tipo,responsaveis,parent_id')
      .not('modulo_id', 'is', null).eq('arquivada', false)
      .then(({ data }) => { if (vivo) setLinhas(data || []) })
    return () => { vivo = false }
  }, [refreshKey, modulos.length])

  const porModulo = useMemo(() => {
    const m = new Map()
    for (const l of linhas) { if (!m.has(l.modulo_id)) m.set(l.modulo_id, []); m.get(l.modulo_id).push(l) }
    return m
  }, [linhas])

  async function criar(e) {
    e.preventDefault()
    if (!novo.nome.trim()) return
    const r = await vt.criarModulo(novo)
    if (r.error) { onToast(r.error, 'error'); return }
    setNovo(null)
    onToast('Module criado')
  }

  return (
    <div className="p-4">
      <p className="text-[13px] text-ln-t3 max-w-2xl mb-3">Um module agrupa as tarefas de uma mesma entrega, mesmo quando elas passam por várias pessoas, listas e cycles.</p>
      <div className="flex gap-1.5 flex-wrap mb-4">
        <button type="button" onClick={() => setFStatus('')} className={`ln-tab ${!fStatus ? 'ln-tab-active' : ''}`}>Todos</button>
        {STATUS_MODULO.map((s) => <button key={s.key} type="button" onClick={() => setFStatus(s.key)} className={`ln-tab ${fStatus === s.key ? 'ln-tab-active' : ''}`}>{s.label}</button>)}
      </div>
      <div className="grid gap-3 max-w-5xl" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {modulos.filter((m) => !fStatus || m.status === fStatus).map((m) => {
          const rows = porModulo.get(m.id) || []
          const p = progressoDoModulo(rows)
          const pessoas = [...new Set([m.lider_id, ...(m.membros || []), ...rows.filter((r) => !r.parent_id).flatMap((r) => r.responsaveis || [])].filter(Boolean))].slice(0, 5)
          const proj = projetos?.find((x) => x.id === m.project_id)
          return (
            <button key={m.id} type="button" onClick={() => onAbrirModulo(m.id)} className="ln-card p-4 text-left transition-colors duration-150 hover:!border-ln-accent/40">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-ln-t1 truncate flex-1">{m.nome}</p>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ln-t3 shrink-0"><i className="w-2 h-2 rounded-full" style={{ backgroundColor: statusModulo(m.status).cor }} />{statusModulo(m.status).label}</span>
              </div>
              <p className="text-xs text-ln-t3 mt-0.5 line-clamp-2 min-h-[32px]">{m.descricao || (proj ? proj.company_name || proj.companyName : '')}</p>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-xl font-semibold tabular text-ln-t1">{p.pct}%</span>
                <span className="text-xs text-ln-t4 tabular">{p.feitas} de {p.total} tarefas</span>
              </div>
              <div className="h-1.5 rounded-full bg-ln-ink/[0.06] overflow-hidden mt-1.5"><i className="block h-full rounded-full bg-ln-accent" style={{ width: `${p.pct}%` }} /></div>
              {(m.inicio || m.alvo) && <p className="text-[11px] text-ln-t4 mt-2 tabular">{m.inicio ? fmtDiaMes(m.inicio) : '...'} a {m.alvo ? fmtDiaMes(m.alvo) : '...'}</p>}
              <div className="flex gap-1 mt-3 min-h-[20px]">
                {pessoas.map((id) => { const mem = membrosMap.get(id); return mem ? <Avatar key={id} pessoa={{ nome: mem.name, iniciais: mem.avatar || iniciais(mem.name), cor: corDaPessoa(id) }} size={20} /> : null })}
              </div>
            </button>
          )
        })}
        {novo ? (
          <form onSubmit={criar} className="ln-card p-4 flex flex-col gap-2">
            <input className="ln-input !h-8" placeholder="Nome do module" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} autoFocus />
            <input className="ln-input !h-8" placeholder="Descrição (opcional)" value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
            <select className="ln-input !h-8" value={novo.project_id} onChange={(e) => setNovo({ ...novo, project_id: e.target.value })}>
              <option value="">Sem cliente</option>
              {(projetos || []).map((pr) => <option key={pr.id} value={pr.id}>{pr.company_name || pr.companyName}</option>)}
            </select>
            <div className="flex gap-2 mt-1">
              <button type="submit" className="ln-primary"><Check className="w-3.5 h-3.5" /> Criar</button>
              <button type="button" onClick={() => setNovo(null)} className="ln-pill"><X className="w-3.5 h-3.5" /> Cancelar</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setNovo({ nome: '', descricao: '', project_id: '' })} className="rounded-lg border border-dashed border-ln-ink/15 p-4 min-h-[150px] flex items-center justify-center gap-1.5 text-[13px] text-ln-t3 hover:text-ln-t1 hover:border-ln-ink/30">
            <Plus className="w-4 h-4" /> Novo module
          </button>
        )}
      </div>
    </div>
  )
}
