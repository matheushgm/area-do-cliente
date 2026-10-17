// Edição de um module: nome, descrição, status, líder, membros, datas, cliente e links.
import { useState } from 'react'
import { Plus, X, Check, ExternalLink } from 'lucide-react'
import { STATUS_MODULO } from '../../lib/vertatask'

export default function ModuloEditor({ modulo, membros, projetos, onSalvar, onCancelar }) {
  const [f, setF] = useState({
    nome: modulo.nome || '', descricao: modulo.descricao || '', status: modulo.status || 'planejado',
    lider_id: modulo.lider_id || '', membros: modulo.membros || [], inicio: modulo.inicio || '', alvo: modulo.alvo || '',
    project_id: modulo.project_id || '', links: modulo.links || [],
  })
  const [novoLink, setNovoLink] = useState({ titulo: '', url: '' })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const ativos = membros.filter((m) => !m.disabled)
  const alternar = (id) => set('membros', f.membros.includes(id) ? f.membros.filter((x) => x !== id) : [...f.membros, id])
  function addLink() {
    let url = novoLink.url.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    set('links', [...f.links, { titulo: novoLink.titulo.trim() || url, url }])
    setNovoLink({ titulo: '', url: '' })
  }
  function salvar(e) {
    e.preventDefault()
    if (!f.nome.trim()) return
    onSalvar({
      nome: f.nome.trim(), descricao: f.descricao.trim() || null, status: f.status, lider_id: f.lider_id || null,
      membros: f.membros, inicio: f.inicio || null, alvo: f.alvo || null, project_id: f.project_id || null, links: f.links,
    })
  }
  const lbl = 'flex flex-col gap-1 text-xs text-ln-t3 font-semibold'
  return (
    <form onSubmit={salvar} className="ln-card m-4 p-4 flex flex-col gap-3 max-w-3xl">
      <div className="grid gap-3 md:grid-cols-2">
        <label className={`${lbl} md:col-span-2`}>Nome<input className="ln-input !h-9" value={f.nome} onChange={(e) => set('nome', e.target.value)} autoFocus /></label>
        <label className={`${lbl} md:col-span-2`}>Descrição<textarea className="ln-input !h-auto py-2 resize-y" rows={2} value={f.descricao} onChange={(e) => set('descricao', e.target.value)} /></label>
        <label className={lbl}>Status<select className="ln-input !h-9" value={f.status} onChange={(e) => set('status', e.target.value)}>{STATUS_MODULO.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
        <label className={lbl}>Líder<select className="ln-input !h-9" value={f.lider_id} onChange={(e) => set('lider_id', e.target.value)}><option value="">Sem líder</option>{ativos.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label className={lbl}>Início<input type="date" className="ln-input !h-9" value={f.inicio} onChange={(e) => set('inicio', e.target.value)} /></label>
        <label className={lbl}>Data alvo<input type="date" className="ln-input !h-9" value={f.alvo} min={f.inicio || undefined} onChange={(e) => set('alvo', e.target.value)} /></label>
        <label className={`${lbl} md:col-span-2`}>Cliente<select className="ln-input !h-9" value={f.project_id} onChange={(e) => set('project_id', e.target.value)}><option value="">Sem cliente</option>{projetos.map((p) => <option key={p.id} value={p.id}>{p.company_name || p.companyName}</option>)}</select></label>
      </div>
      <div>
        <p className="ln-label">Membros</p>
        <div className="flex flex-wrap gap-1.5">
          {ativos.map((m) => (
            <button key={m.id} type="button" onClick={() => alternar(m.id)} className={`ln-tab ${f.membros.includes(m.id) ? 'ln-tab-active' : ''}`}>{m.name}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="ln-label">Links</p>
        {f.links.map((l, i) => (
          <div key={i} className="flex items-center gap-2 h-8 text-[13px]">
            <ExternalLink className="w-3.5 h-3.5 text-ln-t4" />
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-ln-accent hover:underline">{l.titulo}</a>
            <button type="button" onClick={() => set('links', f.links.filter((_, j) => j !== i))} className="ln-iconbtn !w-6 !h-6" aria-label="Remover link"><X className="w-3 h-3" /></button>
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          <input className="ln-input !h-8" placeholder="Título (opcional)" value={novoLink.titulo} onChange={(e) => setNovoLink({ ...novoLink, titulo: e.target.value })} />
          <input className="ln-input !h-8" placeholder="https://..." value={novoLink.url} onChange={(e) => setNovoLink({ ...novoLink, url: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} />
          <button type="button" onClick={addLink} className="ln-pill"><Plus className="w-3.5 h-3.5" /> Link</button>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="ln-primary"><Check className="w-3.5 h-3.5" /> Salvar</button>
        <button type="button" onClick={onCancelar} className="ln-pill">Cancelar</button>
      </div>
    </form>
  )
}
