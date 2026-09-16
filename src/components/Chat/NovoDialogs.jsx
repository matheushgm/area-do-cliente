import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Hash, Lock, Search, X } from 'lucide-react'
import ChatAvatar from './ChatAvatar'

function Dialogo({ titulo, onFechar, children, largura = 420 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFechar])
  return createPortal(
    <div className="ln fixed inset-0 z-[95] flex items-start justify-center pt-[12vh] px-4 bg-black/30" onMouseDown={onFechar}>
      <div className="w-full bg-ln-panel border border-ln-ink/[0.08] rounded-xl overflow-hidden" style={{ maxWidth: largura, boxShadow: 'var(--ln-shadow-panel)' }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="h-11 px-4 flex items-center border-b border-ln-border">
          <h2 className="text-[14px] font-semibold text-ln-t1 flex-1">{titulo}</h2>
          <button onClick={onFechar} className="ln-iconbtn" aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function NovoCanalDialog({ membros, meuId, projetos = [], onFechar, onCriar }) {
  const [nome, setNome] = useState('')
  const [privado, setPrivado] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [sel, setSel] = useState(new Set(membros.map((m) => m.id)))
  const [salvando, setSalvando] = useState(false)
  const limpo = nome.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').replace(/-+/g, '-').replace(/^-|-$/g, '')

  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function submit(e) {
    e.preventDefault()
    if (!limpo) return
    setSalvando(true)
    await onCriar({ nome: limpo, membros: [...sel], privado, projectId: projectId || null })
    setSalvando(false)
  }

  return (
    <Dialogo titulo="Novo canal" onFechar={onFechar}>
      <form onSubmit={submit} className="p-4 space-y-4">
        <div>
          <label className="ln-label">Nome</label>
          <div className="relative">
            {privado ? <Lock className="w-3.5 h-3.5 text-ln-t4 absolute left-2.5 top-1/2 -translate-y-1/2" /> : <Hash className="w-3.5 h-3.5 text-ln-t4 absolute left-2.5 top-1/2 -translate-y-1/2" />}
            <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: nome-do-cliente" className="ln-input !pl-8" />
          </div>
          {limpo && limpo !== nome && <p className="text-[11px] text-ln-t4 mt-1">Será criado como <b>#{limpo}</b></p>}
        </div>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-1.5 text-[12px] text-ln-t2 cursor-pointer">
            <input type="radio" checked={!privado} onChange={() => setPrivado(false)} className="accent-[rgb(var(--ln-brand))]" /> Público (todo o time vê)
          </label>
          <label className="inline-flex items-center gap-1.5 text-[12px] text-ln-t2 cursor-pointer">
            <input type="radio" checked={privado} onChange={() => setPrivado(true)} className="accent-[rgb(var(--ln-brand))]" /> Privado (só membros)
          </label>
        </div>
        {projetos.length > 0 && (
          <div>
            <label className="ln-label">Cliente (opcional)</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="ln-input">
              <option value="">Nenhum</option>
              {projetos.map((p) => <option key={p.id} value={p.id}>{p.company_name || p.companyName}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="ln-label">Membros</label>
          <div className="max-h-48 overflow-y-auto border border-ln-ink/[0.08] rounded-md divide-y divide-ln-ink/5">
            {membros.map((m) => (
              <label key={m.id} className="flex items-center gap-2 px-2.5 h-8 hover:bg-ln-ink/[0.03] cursor-pointer">
                <input type="checkbox" checked={sel.has(m.id) || m.id === meuId} disabled={m.id === meuId} onChange={() => toggle(m.id)} className="accent-[rgb(var(--ln-brand))]" />
                <ChatAvatar pessoa={m} size={18} />
                <span className="text-[13px] text-ln-t1">{m.name}</span>
                {m.id === meuId && <span className="ml-auto text-[10px] text-ln-t4">você</span>}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="ln-pill">Cancelar</button>
          <button type="submit" disabled={!limpo || salvando} className="ln-primary">{salvando ? 'Criando…' : 'Criar canal'}</button>
        </div>
      </form>
    </Dialogo>
  )
}

export function NovaDMDialog({ membros, meuId, onFechar, onEscolher }) {
  const [busca, setBusca] = useState('')
  const lista = membros.filter((m) => m.id !== meuId && m.name.toLowerCase().includes(busca.toLowerCase()))
  return (
    <Dialogo titulo="Nova mensagem direta" onFechar={onFechar} largura={380}>
      <div className="p-3">
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 text-ln-t4 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Para: nome da pessoa" className="ln-input !pl-8" />
        </div>
        <ul className="max-h-72 overflow-y-auto">
          {lista.length === 0 && <li className="px-2 py-4 text-center text-[12px] text-ln-t4">Ninguém encontrado</li>}
          {lista.map((m) => (
            <li key={m.id}>
              <button onClick={() => onEscolher(m)} className="w-full flex items-center gap-2 px-2 h-9 rounded-md hover:bg-ln-ink/[0.04] text-left">
                <ChatAvatar pessoa={m} size={24} />
                <span className="text-[13px] text-ln-t1">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialogo>
  )
}
