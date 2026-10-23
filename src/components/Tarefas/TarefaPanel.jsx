// Corpo do painel lateral de uma tarefa (mesmo lugar e linguagem do painel
// de atividade do módulo Atividades): título, propriedades, descrição em
// markdown, subtarefas, checklists, anexos e a atividade (comentários).
// O container e o header ficam na página.
import { useState, useEffect, useRef } from 'react'
import MarkdownView from '../Editor/MarkdownView'
import MarkdownEditor from '../Editor/MarkdownEditor'
import { X, Trash2, Plus, Check, Square, CheckSquare, Paperclip, Send, Loader2 } from 'lucide-react'
import { uploadFile, deleteFile } from '../../lib/supabase'
import AnexoPreview from '../UI/AnexoPreview'
import { tipoDoAnexo, nomeDoAnexo } from '../../lib/anexos'
import {
  ordenarItens, fmtDataHora, fmtDataNumerica, descricaoVazia, novoId, progressoChecklists, corDaPessoa, iniciais, DEPARTAMENTOS,
} from '../../lib/tarefas'
import {
  StatusCampo, ResponsavelCampo, DataCampo, PrioridadeCampo, TipoTarefaCampo, DificuldadeCampo, EstimativaCampo, AdicionarInline,
  Avatar, Avatares, Popover, FOCO,
} from './Campos'
import RelacaoCampo from './RelacaoCampo'
import { Secao, ListaSubtarefas } from './SecoesTarefa'
import { EtiquetasCampo, RelacoesSecao, HistoricoSecao } from './TarefaExtras'
import { faseDoCiclo, fmtDiaMes, ROTULO_FASE } from '../../lib/vertatask'

const BUCKET = 'task-attachments'

function fmtBytes(n) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${Math.round(n / 1024)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

export function Propriedade({ label, children }) {
  return (
    <div className="flex items-center min-h-[26px] gap-2">
      <dt className="w-24 shrink-0 text-xs text-ln-t3">{label}</dt>
      <dd className="min-w-0 flex-1 flex items-center gap-1.5 text-xs text-ln-t2">{children}</dd>
    </div>
  )
}

function Vazio({ children = 'não informado' }) {
  return <span className="text-ln-t4">{children}</span>
}

/** `compacto`: uma linha só (o primeiro departamento e "+N"), para célula de lista. */
export function DepartamentoCampo({ valor = [], onChange, compacto = false, render = null }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const sel = new Set(valor)
  const chip = (d) => <span key={d} className="inline-flex items-center h-6 px-2 rounded-full ring-1 ring-inset ring-ln-line text-xs text-ln-t3 whitespace-nowrap min-w-0 truncate">{d}</span>
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} title={valor.join(', ') || undefined}
        className={`${compacto ? 'flex flex-nowrap items-center gap-1 min-w-0 max-w-full overflow-hidden' : 'flex flex-wrap gap-1'} text-left rounded-md ${FOCO}`}>
        {render || (!valor.length ? <Vazio>{compacto ? '–' : undefined}</Vazio>
          : compacto ? (<>{chip(valor[0])}{valor.length > 1 && <span className="text-xs text-ln-t4 tabular shrink-0">+{valor.length - 1}</span>}</>)
            : valor.map(chip))}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={230}>
        <div className="p-1">
          {DEPARTAMENTOS.map((d) => (
            <button key={d} type="button" onClick={() => onChange(sel.has(d) ? valor.filter((x) => x !== d) : [...valor, d])} className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] text-ln-t2 hover:bg-ln-ink/5">
              {sel.has(d) ? <CheckSquare className="w-3.5 h-3.5 text-ln-accent" /> : <Square className="w-3.5 h-3.5 text-ln-t4" />}
              {d}
            </button>
          ))}
        </div>
      </Popover>
    </>
  )
}

export function Descricao({ valor, onSalvar }) {
  const [editando, setEditando] = useState(false)
  const [txt, setTxt] = useState('')
  const abrir = () => { setTxt(valor || ''); setEditando(true) }
  function salvar() {
    setEditando(false)
    if ((txt || '') !== (valor || '')) onSalvar(txt.trim() || null)
  }
  if (editando) {
    return (
      <div onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditando(false) } if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); salvar() } }}>
        <MarkdownEditor
          value={txt}
          onChange={setTxt}
          minHeight={140}
          autoFocus
          placeholder="Escreva a descrição (aceita markdown)..."
          className="md-editor--13 text-ln-t2"
        />
        <div className="flex items-center gap-2 mt-2">
          <button type="button" onClick={salvar} className="ln-primary">Salvar</button>
          <button type="button" onClick={() => setEditando(false)} className="ln-pill">Cancelar</button>
          <span className="text-[11px] text-ln-t4 ml-auto flex items-center gap-1"><kbd className="ln-kbd">⌘</kbd><span>/</span><kbd className="ln-kbd">Ctrl</kbd>+<kbd className="ln-kbd">Enter</kbd> salva</span>
        </div>
      </div>
    )
  }
  return (
    <div role="button" tabIndex={0} onClick={abrir} onKeyDown={(e) => { if (e.key === 'Enter') abrir() }} className={`min-h-[44px] -mx-2 px-2 py-1.5 rounded-lg cursor-text transition-colors duration-150 hover:bg-ln-ink/[0.03] ${FOCO}`}>
      {descricaoVazia(valor)
        ? <p className="text-sm text-ln-t4">Sem descrição. Clique para escrever.</p>
        : <MarkdownView content={valor} className="md-prose--13 text-ln-t2" />}
    </div>
  )
}

export function Checklists({ checklists = [], onChange }) {
  const [novaLista, setNovaLista] = useState(false)
  const [novoItemEm, setNovoItemEm] = useState(null)
  const set = (next) => onChange(next)
  const toggleItem = (cid, iid) => set(checklists.map((c) => c.id !== cid ? c : { ...c, itens: (c.itens || []).map((i) => i.id === iid ? { ...i, feito: !i.feito } : i) }))
  const addItem = (cid, nome) => set(checklists.map((c) => c.id !== cid ? c : { ...c, itens: [...(c.itens || []), { id: novoId(), nome, feito: false }] }))
  const delItem = (cid, iid) => set(checklists.map((c) => c.id !== cid ? c : { ...c, itens: (c.itens || []).filter((i) => i.id !== iid) }))
  const delLista = (cid) => set(checklists.filter((c) => c.id !== cid))
  return (
    <div className="flex flex-col gap-3">
      {checklists.map((c) => {
        const p = progressoChecklists([c])
        return (
          <div key={c.id} className="group/cl">
            <div className="flex items-center gap-2 h-6">
              <span className="text-xs font-medium text-ln-t2">{c.nome || 'Checklist'}</span>
              <span className="text-[11px] text-ln-t4 tabular">{p.feitos}/{p.total}</span>
              <button type="button" onClick={() => delLista(c.id)} className="ln-iconbtn !w-6 !h-6 ml-auto opacity-0 group-hover/cl:opacity-100 focus-visible:opacity-100 hover:!text-ln-red" title="Excluir checklist" aria-label="Excluir checklist"><Trash2 className="w-3 h-3" /></button>
            </div>
            <ul>
              {(c.itens || []).map((i) => (
                <li key={i.id} className="group/ci flex items-center gap-2 h-7 -mx-1 px-1 rounded-md hover:bg-ln-ink/[0.03]">
                  <button type="button" onClick={() => toggleItem(c.id, i.id)} className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${i.feito ? 'bg-ln-green border-ln-green text-white' : 'border-ln-t4/60'} ${FOCO}`} aria-label={i.feito ? 'Desmarcar' : 'Marcar'}>{i.feito && <Check className="w-2.5 h-2.5" />}</button>
                  <span className={`text-[13px] flex-1 min-w-0 truncate ${i.feito ? 'line-through text-ln-t4' : 'text-ln-t2'}`}>{i.nome}</span>
                  <button type="button" onClick={() => delItem(c.id, i.id)} className="ln-iconbtn !w-5 !h-5 opacity-0 group-hover/ci:opacity-100 focus-visible:opacity-100" aria-label="Remover item"><X className="w-3 h-3" /></button>
                </li>
              ))}
            </ul>
            {novoItemEm === c.id ? (
              <div className="pt-1"><AdicionarInline autoFocus placeholder="Novo item" onCriar={async (t) => addItem(c.id, t)} /></div>
            ) : (
              <button type="button" onClick={() => setNovoItemEm(c.id)} className={`flex items-center gap-1 h-6 px-1 -mx-1 rounded-md text-xs text-ln-t4 hover:text-ln-t2 ${FOCO}`}><Plus className="w-3 h-3" /> Novo item</button>
            )}
          </div>
        )
      })}
      {novaLista ? (
        <AdicionarInline autoFocus placeholder="Nome do checklist" onCriar={async (t) => { set([...checklists, { id: novoId(), nome: t, itens: [] }]); setNovaLista(false) }} />
      ) : (
        <button type="button" onClick={() => setNovaLista(true)} className={`self-start inline-flex items-center gap-1.5 h-7 px-2 -mx-2 rounded-md text-xs text-ln-t4 hover:text-ln-t2 hover:bg-ln-ink/[0.03] ${FOCO}`}><Plus className="w-3.5 h-3.5" /> Adicionar checklist</button>
      )}
    </div>
  )
}

function Anexos({ item, onChange, onErro }) {
  const [enviando, setEnviando] = useState(false)
  const [aberto, setAberto] = useState(null) // índice do anexo em pré-visualização
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
  async function remover(idx) {
    const a = item.anexos[idx]
    onChange(item.anexos.filter((_, i) => i !== idx))
    if (a?.path) await deleteFile(BUCKET, a.path)
  }
  const anexos = item.anexos || []
  return (
    <div className="flex flex-col gap-1">
      {anexos.map((a, i) => {
        const doClickUp = a.source === 'clickup'
        const imagem = tipoDoAnexo(a) === 'imagem' && (a.thumbnail || a.url)
        return (
          <div key={a.path || a.url || a.id || i} className="group/an ln-card flex items-center gap-2 h-9 px-2.5 text-xs">
            {imagem ? <img src={a.thumbnail || a.url} alt="" className="w-6 h-6 rounded object-cover shrink-0" loading="lazy" /> : <Paperclip className="w-3.5 h-3.5 text-ln-t4 shrink-0" />}
            <button type="button" onClick={() => setAberto(i)} className={`flex-1 min-w-0 text-left truncate text-ln-t2 hover:text-ln-accent ${FOCO}`} title="Pré-visualizar">{nomeDoAnexo(a)}</button>
            {doClickUp && <span className="text-[10px] text-ln-t4 shrink-0" title="Anexo vindo do ClickUp">ClickUp</span>}
            <span className="text-[11px] text-ln-t4 tabular">{fmtBytes(a.size)}</span>
            {!doClickUp && <button type="button" onClick={() => remover(i)} className="ln-iconbtn !w-5 !h-5 opacity-0 group-hover/an:opacity-100 focus-visible:opacity-100 hover:!text-ln-red" aria-label="Remover anexo"><X className="w-3 h-3" /></button>}
          </div>
        )
      })}
      {aberto != null && <AnexoPreview anexos={anexos} indice={aberto} bucket={BUCKET} onFechar={() => setAberto(null)} />}
      <label className={`self-start inline-flex items-center gap-1.5 h-7 px-2 -mx-2 rounded-md text-xs text-ln-t4 hover:text-ln-t2 hover:bg-ln-ink/[0.03] cursor-pointer ${FOCO}`}>
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
  async function enviar() {
    if (!txt.trim()) return
    setEnviando(true)
    await onComentar(txt)
    setTxt('')
    setEnviando(false)
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ln-t4">
        Criada por <span className="text-ln-t3">{item.criador_nome || membrosMap.get(item.criado_por)?.name || 'alguém'}</span> em {fmtDataHora(item.created_at)}
      </p>
      {!comentarios && <p className="text-xs text-ln-t4 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando comentários...</p>}
      {comentarios?.map((c) => {
        const m = c.autor_id ? membrosMap.get(c.autor_id) : null
        const nome = m?.name || c.autor_nome || 'Alguém'
        const p = { nome, iniciais: m?.avatar || iniciais(nome), cor: corDaPessoa(c.autor_id || nome) }
        const meu = c.autor_id && c.autor_id === user?.id
        return (
          <div key={c.id} className="group/com flex gap-2.5">
            <Avatar pessoa={p} size={22} className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-ln-t2">{nome}</span>
                <span className="text-[11px] text-ln-t4 tabular">{fmtDataHora(c.created_at)}</span>
                {meu && <button type="button" onClick={() => onExcluir(c.id)} className="ln-iconbtn !w-5 !h-5 ml-auto opacity-0 group-hover/com:opacity-100 focus-visible:opacity-100 hover:!text-ln-red" title="Excluir" aria-label="Excluir comentário"><Trash2 className="w-3 h-3" /></button>}
              </div>
              <MarkdownView content={c.texto} className="md-prose--13 text-ln-t2 mt-0.5" />
            </div>
          </div>
        )
      })}
      {comentarios && !comentarios.length && <p className="text-xs text-ln-t4">Sem comentários. Use este espaço para anotar o andamento.</p>}
      <div
        className="ln-card flex items-end gap-2 px-3 py-2 focus-within:border-ln-accent/60"
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); enviar() } }}
      >
        <MarkdownEditor
          value={txt}
          onChange={setTxt}
          minHeight={24}
          placeholder="Escreva um comentário..."
          className="md-editor--nu md-editor--13 flex-1 min-w-0 text-ln-t1"
        />
        <button type="button" onClick={enviar} disabled={enviando || !txt.trim()} className="ln-primary !px-2" title="Enviar (⌘/Ctrl + Enter)" aria-label="Enviar comentário">
          {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}


export default function TarefaPanel({
  item, subtarefas, statuses, membros, membrosMap, comentarios, user, ciclos = [], etiquetas = [], ciclosMap = new Map(), etiquetasMap = new Map(), onCriarEtiqueta,
  onAtualizar, onMudarStatus, onCriarSub, onAbrir, onComentar, onExcluirComentario, onCarregarComentarios, onErro,
}) {
  const [titulo, setTitulo] = useState(item?.titulo || '')
  const tituloRef = useRef(null)
  useEffect(() => { if (item?.id) onCarregarComentarios(item.id) }, [item?.id, onCarregarComentarios])
  useEffect(() => {
    const el = tituloRef.current
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
  }, [titulo])

  if (!item) return <p className="p-4 text-[13px] text-ln-t4">Selecione uma tarefa na lista.</p>
  const subs = ordenarItens(subtarefas || [])
  const feitas = subs.filter((s) => s.status_tipo === 'closed').length

  function salvarTitulo() {
    const t = titulo.trim()
    if (!t) { setTitulo(item.titulo); return }
    if (t !== item.titulo) onAtualizar(item.id, { titulo: t })
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <header>
        <textarea
          ref={tituloRef}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={salvarTitulo}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur() } if (e.key === 'Escape') { e.stopPropagation(); setTitulo(item.titulo); e.target.blur() } }}
          rows={1}
          aria-label="Título da tarefa"
          className={`w-full bg-transparent text-xl font-semibold tracking-[-0.01em] leading-tight outline-none resize-none rounded-md -mx-1 px-1 hover:bg-ln-ink/[0.03] focus:bg-ln-ink/[0.04] ${item.status_tipo === 'closed' ? 'text-ln-t4 line-through' : 'text-ln-t2'}`}
        />
      </header>

      <section>
        <p className="ln-label">Propriedades</p>
        <dl className="flex flex-col">
          <Propriedade label="Status"><StatusCampo item={item} statuses={statuses} onChange={(s) => onMudarStatus(item, s)} /></Propriedade>
          <Propriedade label="Responsáveis">
            <ResponsavelCampo item={item} membros={membros} membrosMap={membrosMap} size={16} max={4} comNome onChange={(ids, extra) => onAtualizar(item.id, extra ? { responsaveis: ids, responsaveis_extra: extra } : { responsaveis: ids })} />
          </Propriedade>
          <Propriedade label="Prioridade"><PrioridadeCampo valor={item.prioridade} onChange={(v) => onAtualizar(item.id, { prioridade: v })} /></Propriedade>
          <Propriedade label="Início"><DataCampo valor={item.data_inicio} placeholder="definir" onChange={(v) => onAtualizar(item.id, { data_inicio: v })} /></Propriedade>
          <Propriedade label="Vencimento"><DataCampo valor={item.data_vencimento} item={item} placeholder="definir" onChange={(v) => onAtualizar(item.id, { data_vencimento: v })} /></Propriedade>
          <Propriedade label="Cycle">
            <RelacaoCampo
              valor={item.ciclo_id} cor="#2A25F0" vazio="nenhum"
              opcoes={ciclos.map((c) => ({ id: c.id, rotulo: c.nome, sub: `${fmtDiaMes(c.inicio)} a ${fmtDiaMes(c.fim)} · ${ROTULO_FASE[faseDoCiclo(c)]}` }))}
              onChange={(v) => onAtualizar(item.id, { ciclo_id: v })}
            />
          </Propriedade>
          <Propriedade label="Etiquetas">
            <EtiquetasCampo valor={item.etiquetas || []} etiquetas={etiquetas} onChange={(v) => onAtualizar(item.id, { etiquetas: v })} onCriar={onCriarEtiqueta} />
          </Propriedade>
          <Propriedade label="Estimativa"><EstimativaCampo valor={item.estimativa_min} onChange={(v) => onAtualizar(item.id, { estimativa_min: v })} /></Propriedade>
          <Propriedade label="Tipo"><TipoTarefaCampo valor={item.tipo_tarefa} onChange={(v) => onAtualizar(item.id, { tipo_tarefa: v })} /></Propriedade>
          <Propriedade label="Dificuldade"><DificuldadeCampo valor={item.dificuldade} onChange={(v) => onAtualizar(item.id, { dificuldade: v })} /></Propriedade>
          <Propriedade label="Departamento"><DepartamentoCampo valor={item.departamento || []} onChange={(v) => onAtualizar(item.id, { departamento: v })} /></Propriedade>
          <Propriedade label="Concluída">{item.data_conclusao ? <span className="tabular">{fmtDataNumerica(item.data_conclusao)}</span> : <Vazio>em aberto</Vazio>}</Propriedade>
          {(item.tags || []).length > 0 && (
            <Propriedade label="Tags"><span className="flex flex-wrap gap-1">{item.tags.map((t) => <span key={t} className="inline-flex items-center h-6 px-2 rounded-full ring-1 ring-inset ring-ln-line text-xs text-ln-t3">{t}</span>)}</span></Propriedade>
          )}
          {item.campos && Object.entries(item.campos).map(([k, v]) => (
            <Propriedade key={k} label={k}><span className="truncate">{Array.isArray(v) ? v.join(', ') : String(v)}</span></Propriedade>
          ))}
        </dl>
      </section>

      <Secao titulo="Descrição">
        <Descricao valor={item.descricao} onSalvar={(v) => onAtualizar(item.id, { descricao: v })} />
      </Secao>

      <Secao titulo="Subtarefas" extra={subs.length > 0 && <span className="text-[11px] text-ln-t4 tabular">{feitas}/{subs.length}</span>}>
        <ListaSubtarefas
          itens={subs.map((s) => ({ ...s, concluida: s.status_tipo === 'closed' }))} onAbrir={onAbrir} onAdicionar={(t) => onCriarSub(item, t)}
          inicio={(s) => <span onClick={(e) => e.stopPropagation()}><StatusCampo item={s} statuses={statuses} modo="icon" onChange={(st) => onMudarStatus(s, st)} /></span>}
          fim={(s) => (<>
            <DataCampo valor={s.data_vencimento} item={s} formato="curta" placeholder="" onChange={(v) => onAtualizar(s.id, { data_vencimento: v })} />
            <Avatares item={s} membrosMap={membrosMap} size={16} max={2} vazio={false} />
          </>)}
        />
      </Secao>

      <Secao titulo="Relações">
        <RelacoesSecao tarefaId={item.id} user={user} onAbrir={onAbrir} onErro={onErro} />
      </Secao>

      <Secao titulo="Checklists">
        <Checklists checklists={item.checklists || []} onChange={(v) => onAtualizar(item.id, { checklists: v })} />
      </Secao>

      <Secao titulo="Anexos">
        <Anexos item={item} onChange={(v) => onAtualizar(item.id, { anexos: v })} onErro={onErro} />
      </Secao>

      <Secao titulo="Histórico">
        <HistoricoSecao tarefaId={item.id} versao={item.updated_at} membrosMap={membrosMap} ciclosMap={ciclosMap} etiquetasMap={etiquetasMap} />
      </Secao>

      <Secao titulo="Atividade">
        <Comentarios item={item} comentarios={comentarios} user={user} membrosMap={membrosMap} onComentar={(t) => onComentar(item.id, t)} onExcluir={(id) => onExcluirComentario(item.id, id)} />
      </Secao>
    </div>
  )
}
