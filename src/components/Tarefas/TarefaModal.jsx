// Detalhe da tarefa (modal grande, como a tela de tarefa do ClickUp):
// título, campos, descrição em markdown, subtarefas, checklists, anexos e
// comentários. Tudo editável no lugar.
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import {
  X, ChevronRight, Trash2, Plus, Check, Square, CheckSquare, Paperclip, ExternalLink, Send, CornerDownRight, Loader2, Maximize2, Minimize2,
} from 'lucide-react'
import { uploadFile, deleteFile, getSignedUrl } from '../../lib/supabase'
import {
  ordenarItens, fmtDataHora, fmtDataNumerica, descricaoVazia, novoId, progressoChecklists, corDaPessoa, iniciais, DEPARTAMENTOS,
} from '../../lib/tarefas'
import {
  StatusCampo, ResponsavelCampo, DataCampo, PrioridadeCampo, TipoTarefaCampo, DificuldadeCampo, EstimativaCampo, AdicionarInline, Avatar, Avatares, Popover,
} from './Campos'

const BUCKET = 'task-attachments'

function fmtBytes(n) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${Math.round(n / 1024)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

function Campo({ label, children }) {
  return (
    <div className="flex items-center gap-3 min-h-[32px]">
      <span className="w-[130px] shrink-0 text-[12px] text-rl-muted">{label}</span>
      <div className="flex-1 min-w-0 flex items-center">{children}</div>
    </div>
  )
}

function DepartamentoCampo({ valor = [], onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const sel = new Set(valor)
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className="flex flex-wrap gap-1 text-left">
        {valor.length ? valor.map((d) => <span key={d} className="inline-flex items-center h-[22px] px-2 rounded-md text-[12px] bg-rl-surface border border-rl-border text-rl-subtle">{d}</span>) : <span className="text-[13px] text-rl-muted/70">–</span>}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={230}>
        <div className="py-1">
          {DEPARTAMENTOS.map((d) => (
            <button key={d} type="button" onClick={() => onChange(sel.has(d) ? valor.filter((x) => x !== d) : [...valor, d])} className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-rl-subtle hover:bg-rl-surface">
              {sel.has(d) ? <CheckSquare className="w-3.5 h-3.5 text-rl-purple" /> : <Square className="w-3.5 h-3.5 text-rl-muted" />}
              {d}
            </button>
          ))}
        </div>
      </Popover>
    </>
  )
}

function Descricao({ valor, onSalvar }) {
  const [editando, setEditando] = useState(false)
  const [txt, setTxt] = useState('')
  const abrir = () => { setTxt(valor || ''); setEditando(true) }
  function salvar() {
    setEditando(false)
    if ((txt || '') !== (valor || '')) onSalvar(txt.trim() || null)
  }
  if (editando) {
    return (
      <div>
        <textarea
          autoFocus
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setEditando(false); setTxt(valor || '') } if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.keyCode === 13)) salvar() }}
          rows={Math.min(24, Math.max(6, txt.split('\n').length + 2))}
          placeholder="Escreva a descrição (aceita markdown)..."
          className="w-full px-3 py-2 rounded-lg border border-rl-purple bg-rl-surface text-[13px] text-rl-text leading-relaxed outline-none resize-y"
        />
        <div className="flex items-center gap-2 mt-2">
          <button type="button" onClick={salvar} className="h-7 px-3 rounded-md bg-rl-purple text-white text-xs font-semibold">Salvar</button>
          <button type="button" onClick={() => { setEditando(false); setTxt(valor || '') }} className="h-7 px-2 rounded-md text-xs text-rl-muted hover:text-rl-text">Cancelar</button>
          <span className="text-[11px] text-rl-muted ml-auto">⌘/Ctrl + Enter salva</span>
        </div>
      </div>
    )
  }
  return (
    <div onClick={abrir} className="min-h-[60px] px-3 py-2 rounded-lg border border-transparent hover:border-rl-border hover:bg-rl-surface/50 cursor-text transition">
      {descricaoVazia(valor)
        ? <p className="text-[13px] text-rl-muted/70">Adicionar descrição...</p>
        : <div className="prose-tarefa text-[13px] text-rl-text leading-relaxed"><ReactMarkdown>{valor}</ReactMarkdown></div>}
    </div>
  )
}

function Checklists({ checklists = [], onChange }) {
  const [novaLista, setNovaLista] = useState(false)
  const [novoItemEm, setNovoItemEm] = useState(null)
  function set(next) { onChange(next) }
  function toggleItem(cid, iid) {
    set(checklists.map((c) => c.id !== cid ? c : { ...c, itens: (c.itens || []).map((i) => i.id === iid ? { ...i, feito: !i.feito } : i) }))
  }
  function addItem(cid, nome) {
    set(checklists.map((c) => c.id !== cid ? c : { ...c, itens: [...(c.itens || []), { id: novoId(), nome, feito: false }] }))
  }
  function delItem(cid, iid) {
    set(checklists.map((c) => c.id !== cid ? c : { ...c, itens: (c.itens || []).filter((i) => i.id !== iid) }))
  }
  function delLista(cid) { set(checklists.filter((c) => c.id !== cid)) }
  return (
    <div className="space-y-4">
      {checklists.map((c) => {
        const p = progressoChecklists([c])
        return (
          <div key={c.id} className="group/cl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-semibold text-rl-text">{c.nome || 'Checklist'}</span>
              <span className="text-[11px] text-rl-muted">{p.feitos}/{p.total}</span>
              <button type="button" onClick={() => delLista(c.id)} className="ml-auto p-1 rounded text-rl-muted hover:text-red-500 opacity-0 group-hover/cl:opacity-100" title="Excluir checklist"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <ul className="space-y-0.5">
              {(c.itens || []).map((i) => (
                <li key={i.id} className="group/ci flex items-center gap-2 h-7 px-1 rounded hover:bg-rl-surface/60">
                  <button type="button" onClick={() => toggleItem(c.id, i.id)} className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${i.feito ? 'bg-rl-green border-rl-green text-white' : 'border-rl-muted/60'}`}>{i.feito && <Check className="w-3 h-3" />}</button>
                  <span className={`text-[13px] flex-1 min-w-0 truncate ${i.feito ? 'line-through text-rl-muted' : 'text-rl-text'}`}>{i.nome}</span>
                  <button type="button" onClick={() => delItem(c.id, i.id)} className="p-0.5 text-rl-muted hover:text-red-500 opacity-0 group-hover/ci:opacity-100"><X className="w-3 h-3" /></button>
                </li>
              ))}
            </ul>
            {novoItemEm === c.id ? (
              <div className="pl-1 pt-1"><AdicionarInline autoFocus compacto placeholder="Novo item" onCriar={async (t) => addItem(c.id, t)} /></div>
            ) : (
              <button type="button" onClick={() => setNovoItemEm(c.id)} className="flex items-center gap-1 h-6 px-1 text-[12px] text-rl-muted hover:text-rl-text"><Plus className="w-3 h-3" /> Novo item</button>
            )}
          </div>
        )
      })}
      {novaLista ? (
        <AdicionarInline autoFocus compacto placeholder="Nome do checklist" onCriar={async (t) => { set([...checklists, { id: novoId(), nome: t, itens: [] }]); setNovaLista(false) }} />
      ) : (
        <button type="button" onClick={() => setNovaLista(true)} className="flex items-center gap-1.5 text-[12px] text-rl-muted hover:text-rl-text"><Plus className="w-3.5 h-3.5" /> Adicionar checklist</button>
      )}
    </div>
  )
}

function Anexos({ item, onChange, onErro }) {
  const [enviando, setEnviando] = useState(false)
  async function upload(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setEnviando(true)
    const novos = []
    for (const f of files) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${item.id}/${Date.now()}-${safe}`
      const url = await uploadFile(BUCKET, path, f)
      if (url) novos.push({ path, name: f.name, type: f.type, size: f.size })
      else onErro?.(`Falha ao enviar ${f.name}`)
    }
    if (novos.length) onChange([...(item.anexos || []), ...novos])
    setEnviando(false)
  }
  async function abrir(a) {
    if (a.url) { window.open(a.url, '_blank', 'noopener,noreferrer'); return }
    const url = await getSignedUrl(BUCKET, a.path)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }
  async function remover(idx) {
    const a = item.anexos[idx]
    onChange(item.anexos.filter((_, i) => i !== idx))
    if (a?.path) await deleteFile(BUCKET, a.path)
  }
  return (
    <div>
      {(item.anexos || []).length > 0 && (
        <ul className="space-y-1 mb-2">
          {item.anexos.map((a, i) => (
            <li key={a.path || a.url || i} className="group/an flex items-center gap-2 h-8 px-2.5 rounded-lg bg-rl-surface/60 border border-rl-border text-[13px]">
              <Paperclip className="w-3.5 h-3.5 text-rl-muted shrink-0" />
              <button type="button" onClick={() => abrir(a)} className="flex-1 min-w-0 text-left truncate text-rl-text hover:text-rl-purple">{a.name || a.title || 'arquivo'}</button>
              <span className="text-[11px] text-rl-muted">{fmtBytes(a.size)}</span>
              <button type="button" onClick={() => remover(i)} className="p-0.5 text-rl-muted hover:text-red-500 opacity-0 group-hover/an:opacity-100"><X className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <label className="inline-flex items-center gap-1.5 text-[12px] text-rl-muted hover:text-rl-text cursor-pointer">
        {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        {enviando ? 'Enviando...' : 'Anexar arquivo'}
        <input type="file" multiple className="hidden" onChange={upload} disabled={enviando} />
      </label>
    </div>
  )
}

function Comentarios({ item, comentarios, user, membrosMap, onComentar, onExcluir }) {
  const [txt, setTxt] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fim = useRef(null)
  useEffect(() => { fim.current?.scrollIntoView({ block: 'nearest' }) }, [comentarios?.length])
  async function enviar() {
    if (!txt.trim()) return
    setEnviando(true)
    await onComentar(txt)
    setTxt('')
    setEnviando(false)
  }
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div className="text-[12px] text-rl-muted">
          Criada por <span className="text-rl-subtle font-medium">{item.criador_nome || membrosMap.get(item.criado_por)?.name || 'alguém'}</span> em {fmtDataHora(item.created_at)}
          {item.clickup_url && <a href={item.clickup_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-2 text-rl-purple hover:underline">ClickUp <ExternalLink className="w-3 h-3" /></a>}
        </div>
        {!comentarios && <p className="text-[12px] text-rl-muted flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando comentários...</p>}
        {comentarios?.map((c) => {
          const m = c.autor_id ? membrosMap.get(c.autor_id) : null
          const nome = m?.name || c.autor_nome || 'Alguém'
          const p = { nome, iniciais: m?.avatar || iniciais(nome), cor: corDaPessoa(c.autor_id || nome) }
          const meu = c.autor_id && c.autor_id === user?.id
          return (
            <div key={c.id} className="group/com flex gap-2.5">
              <Avatar pessoa={p} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-semibold text-rl-text">{nome}</span>
                  <span className="text-[11px] text-rl-muted">{fmtDataHora(c.created_at)}</span>
                  {meu && <button type="button" onClick={() => onExcluir(c.id)} className="ml-auto p-0.5 text-rl-muted hover:text-red-500 opacity-0 group-hover/com:opacity-100" title="Excluir"><Trash2 className="w-3 h-3" /></button>}
                </div>
                <div className="prose-tarefa text-[13px] text-rl-text leading-relaxed mt-0.5"><ReactMarkdown>{c.texto}</ReactMarkdown></div>
              </div>
            </div>
          )
        })}
        {comentarios && !comentarios.length && <p className="text-[12px] text-rl-muted">Sem comentários. Use este espaço para anotar o andamento.</p>}
        <div ref={fim} />
      </div>
      <div className="border-t border-rl-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-rl-border bg-rl-surface px-3 py-2 focus-within:border-rl-purple">
          <textarea
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.keyCode === 13)) enviar() }}
            rows={Math.min(8, Math.max(1, txt.split('\n').length))}
            placeholder="Escreva um comentário... (⌘/Ctrl + Enter envia)"
            className="flex-1 bg-transparent outline-none text-[13px] text-rl-text placeholder:text-rl-muted resize-none"
          />
          <button type="button" onClick={enviar} disabled={enviando || !txt.trim()} className="h-7 w-7 rounded-lg bg-rl-purple text-white flex items-center justify-center disabled:opacity-40" title="Enviar">
            {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TarefaModal({
  item, pai, subtarefas, statuses, lista, pasta, membros, membrosMap, comentarios, user,
  onFechar, onAtualizar, onMudarStatus, onCriarSub, onAbrir, onExcluir, onComentar, onExcluirComentario, onCarregarComentarios, onErro,
}) {
  // O modal recebe key={item.id} da página: trocar de tarefa remonta o estado local.
  const [titulo, setTitulo] = useState(item?.titulo || '')
  const [cheio, setCheio] = useState(false)
  useEffect(() => { if (item?.id) onCarregarComentarios(item.id) }, [item?.id, onCarregarComentarios])
  useEffect(() => {
    // Esc fecha o modal, mas não enquanto se digita num campo (o próprio campo trata o Esc).
    const h = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      onFechar()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onFechar])

  if (!item) return null
  const subs = ordenarItens(subtarefas || [])
  const feitas = subs.filter((s) => s.status_tipo === 'closed').length

  function salvarTitulo() {
    const t = titulo.trim()
    if (!t) { setTitulo(item.titulo); return }
    if (t !== item.titulo) onAtualizar(item.id, { titulo: t })
  }

  const largura = cheio ? 'max-w-[1400px]' : 'max-w-[1100px]'
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 md:p-6 bg-black/60" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div className={`w-full ${largura} h-full max-h-[92vh] bg-rl-bg border border-rl-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up`}>
        {/* Cabeçalho */}
        <div className="flex items-center gap-2 h-12 px-4 border-b border-rl-border bg-rl-card/60 shrink-0">
          <nav className="flex items-center gap-1 text-[12px] text-rl-muted min-w-0">
            {pasta && <span className="truncate max-w-[160px]">{pasta.nome}</span>}
            {pasta && <ChevronRight className="w-3 h-3 shrink-0" />}
            {lista && <span className="truncate max-w-[160px]">{lista.nome}</span>}
            {pai && <ChevronRight className="w-3 h-3 shrink-0" />}
            {pai && <button type="button" onClick={() => onAbrir(pai.id)} className="truncate max-w-[220px] text-rl-purple hover:underline">{pai.titulo}</button>}
          </nav>
          <div className="flex-1" />
          <StatusCampo item={item} statuses={statuses} onChange={(s) => onMudarStatus(item, s)} />
          {item.status_tipo !== 'closed' && (
            <button type="button" onClick={() => { const s = statuses.find((x) => x.tipo === 'closed'); if (s) onMudarStatus(item, s) }} className="hidden sm:inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-rl-border text-[12px] text-rl-subtle hover:text-rl-green hover:border-rl-green/50" title="Marcar como concluída">
              <Check className="w-3.5 h-3.5" /> Concluir
            </button>
          )}
          <button type="button" onClick={() => setCheio((v) => !v)} className="hidden lg:inline-flex p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface" title={cheio ? 'Reduzir' : 'Ampliar'}>
            {cheio ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button type="button" onClick={() => { if (window.confirm('Excluir esta tarefa (e as subtarefas)?')) onExcluir(item.id) }} className="p-1.5 rounded-lg text-rl-muted hover:text-red-500 hover:bg-red-500/10" title="Excluir">
            <Trash2 className="w-4 h-4" />
          </button>
          <button type="button" onClick={onFechar} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface" title="Fechar (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
            <textarea
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onBlur={salvarTitulo}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.keyCode === 13)) { e.preventDefault(); e.target.blur() } }}
              rows={1}
              className={`w-full bg-transparent text-[22px] font-semibold leading-tight outline-none resize-none rounded-md px-1 -mx-1 hover:bg-rl-surface/60 focus:bg-rl-surface ${item.status_tipo === 'closed' ? 'text-rl-muted line-through' : 'text-rl-text'}`}
              style={{ height: 'auto' }}
              onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px` }}
            />

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              <Campo label="Status"><StatusCampo item={item} statuses={statuses} onChange={(s) => onMudarStatus(item, s)} /></Campo>
              <Campo label="Responsáveis"><ResponsavelCampo item={item} membros={membros} membrosMap={membrosMap} size={26} max={5} onChange={(ids, extra) => onAtualizar(item.id, extra ? { responsaveis: ids, responsaveis_extra: extra } : { responsaveis: ids })} /></Campo>
              <Campo label="Data de início"><DataCampo valor={item.data_inicio} placeholder="Definir" onChange={(v) => onAtualizar(item.id, { data_inicio: v })} /></Campo>
              <Campo label="Data de vencimento"><DataCampo valor={item.data_vencimento} item={item} placeholder="Definir" onChange={(v) => onAtualizar(item.id, { data_vencimento: v })} /></Campo>
              <Campo label="Prioridade"><PrioridadeCampo valor={item.prioridade} onChange={(v) => onAtualizar(item.id, { prioridade: v })} /></Campo>
              <Campo label="Estimativa de tempo"><EstimativaCampo valor={item.estimativa_min} onChange={(v) => onAtualizar(item.id, { estimativa_min: v })} /></Campo>
              <Campo label="Tipo de tarefa"><TipoTarefaCampo valor={item.tipo_tarefa} placeholder="Definir" onChange={(v) => onAtualizar(item.id, { tipo_tarefa: v })} /></Campo>
              <Campo label="Dificuldade"><DificuldadeCampo valor={item.dificuldade} placeholder="Definir" onChange={(v) => onAtualizar(item.id, { dificuldade: v })} /></Campo>
              <Campo label="Departamento"><DepartamentoCampo valor={item.departamento || []} onChange={(v) => onAtualizar(item.id, { departamento: v })} /></Campo>
              <Campo label="Data de conclusão"><span className="text-[13px] text-rl-subtle">{item.data_conclusao ? fmtDataNumerica(item.data_conclusao) : <span className="text-rl-muted/70">–</span>}</span></Campo>
              {(item.tags || []).length > 0 && (
                <Campo label="Tags"><div className="flex flex-wrap gap-1">{item.tags.map((t) => <span key={t} className="inline-flex items-center h-5 px-1.5 rounded-md text-[11px] bg-rl-surface text-rl-subtle border border-rl-border">{t}</span>)}</div></Campo>
              )}
              {item.campos && Object.keys(item.campos).length > 0 && Object.entries(item.campos).map(([k, v]) => (
                <Campo key={k} label={k}><span className="text-[13px] text-rl-subtle truncate">{Array.isArray(v) ? v.join(', ') : String(v)}</span></Campo>
              ))}
            </div>

            <h3 className="mt-6 mb-1 text-[12px] font-semibold uppercase tracking-wide text-rl-muted">Descrição</h3>
            <Descricao valor={item.descricao} onSalvar={(v) => onAtualizar(item.id, { descricao: v })} />

            <div className="mt-6 flex items-center gap-2 mb-2">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-rl-muted">Subtarefas</h3>
              {subs.length > 0 && <span className="text-[11px] text-rl-muted">{feitas}/{subs.length}</span>}
            </div>
            <div className="rounded-xl border border-rl-border divide-y divide-rl-border/60">
              {subs.map((s) => (
                <div key={s.id} role="button" tabIndex={0} onClick={() => onAbrir(s.id)} onKeyDown={(e) => { if ((e.key === 'Enter' || e.keyCode === 13)) onAbrir(s.id) }} className="flex items-center gap-2 h-9 px-2.5 hover:bg-rl-surface/70 cursor-pointer text-[13px]">
                  <CornerDownRight className="w-3.5 h-3.5 text-rl-muted shrink-0" />
                  <StatusCampo item={s} statuses={statuses} size="icon" onChange={(st) => onMudarStatus(s, st)} />
                  <span className={`flex-1 min-w-0 truncate ${s.status_tipo === 'closed' ? 'line-through text-rl-muted' : 'text-rl-text'}`}>{s.titulo}</span>
                  <Avatares item={s} membrosMap={membrosMap} size={20} max={2} vazio={false} />
                  <DataCampo valor={s.data_vencimento} item={s} formato="curta" onChange={(v) => onAtualizar(s.id, { data_vencimento: v })} />
                </div>
              ))}
              <div className="flex items-center h-9 px-2.5">
                <AdicionarInline compacto placeholder="Adicionar subtarefa" onCriar={(t) => onCriarSub(item, t)} />
              </div>
            </div>

            <h3 className="mt-6 mb-2 text-[12px] font-semibold uppercase tracking-wide text-rl-muted">Checklists</h3>
            <Checklists checklists={item.checklists || []} onChange={(v) => onAtualizar(item.id, { checklists: v })} />

            <h3 className="mt-6 mb-2 text-[12px] font-semibold uppercase tracking-wide text-rl-muted">Anexos</h3>
            <Anexos item={item} onChange={(v) => onAtualizar(item.id, { anexos: v })} onErro={onErro} />
            <div className="h-8" />
          </div>

          <div className="lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-rl-border bg-rl-card/40 flex flex-col min-h-[260px] lg:min-h-0">
            <div className="h-10 px-4 flex items-center border-b border-rl-border text-[12px] font-semibold uppercase tracking-wide text-rl-muted shrink-0">Atividade</div>
            <Comentarios item={item} comentarios={comentarios} user={user} membrosMap={membrosMap} onComentar={(t) => onComentar(item.id, t)} onExcluir={(id) => onExcluirComentario(item.id, id)} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
