// Rascunho de tarefa nova no painel lateral: a pessoa escolhe a lista, preenche título e
// propriedades e só então confirma em "Criar tarefa" (Ctrl+Enter). Nada vai para o banco antes.
// Usado pelo "+ Tarefa" e pelo atalho C da AreaTarefas (em Minhas/Todas a lista é escolhida aqui).
// Subtarefas, relações e checklists também ficam no rascunho e são criados junto (AreaTarefas).
import { useMemo, useRef, useState, useEffect } from 'react'
import { Loader2, ChevronDown, Folder, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import MarkdownEditor from '../Editor/MarkdownEditor'
import { StatusCampo, ResponsavelCampo, PrioridadeCampo, DataCampo, EstimativaCampo, TipoTarefaCampo, Popover, ItemMenu, BuscaMenu, FOCO } from './Campos'
import { Propriedade, DepartamentoCampo, Checklists } from './TarefaPanel'
import { Secao, ListaSubtarefas, ListaRelacoes } from './SecoesTarefa'
import { TIPOS_RELACAO, ROTULO_DIRETO } from './TarefaExtras'
import { statusDaLista, statusInicial, novoId } from '../../lib/tarefas'

const semAcento = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Lista da tarefa com busca pelo nome do cliente (pasta) ou da lista. */
function ListaCampo({ grupos, valor, onChange }) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef(null)
  const grupoAtual = grupos.find((g) => g.listas.some((x) => x.id === valor))
  const atual = grupoAtual ? { pasta: grupoAtual.pasta, lista: grupoAtual.listas.find((x) => x.id === valor) } : null
  // a pasta que bate mostra todas as listas dela; senão só as listas cujo nome bate
  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim())
    if (!q) return grupos
    return grupos
      .map((g) => (semAcento(g.pasta?.nome).includes(q) ? g : { ...g, listas: g.listas.filter((l) => semAcento(l.nome).includes(q)) }))
      .filter((g) => g.listas.length)
  }, [grupos, busca])
  const fechar = () => { setOpen(false); setBusca('') }
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className={`inline-flex items-center gap-1 min-w-0 max-w-full h-7 px-1.5 -mx-1.5 rounded-md text-xs hover:bg-ln-ink/[0.04] ${atual ? 'text-ln-t2' : 'text-ln-t4'} ${FOCO}`} aria-label="Lista da tarefa" aria-haspopup="listbox" aria-expanded={open}>
        {atual ? (<>
          {atual.pasta && <span className="truncate text-ln-t3">{atual.pasta.nome}</span>}
          {atual.pasta && <span className="text-ln-t4">/</span>}
          <span className="truncate">{atual.lista.nome}</span>
        </>) : 'escolher lista'}
        <ChevronDown className="w-3 h-3 shrink-0 text-ln-t4" />
      </button>
      <Popover anchorRef={ref} open={open} onClose={fechar} width={300} alturaMax={380}>
        <BuscaMenu valor={busca} onChange={setBusca} placeholder="Buscar cliente ou lista..." />
        <div className="p-1 overflow-y-auto" role="listbox">
          {filtrados.map((g) => (
            <div key={g.pasta?.id || 'soltas'}>
              <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[11px] text-ln-t4"><Folder className="w-3 h-3" /><span className="truncate">{g.pasta?.nome || 'Sem pasta'}</span></div>
              {g.listas.map((l) => (
                <ItemMenu key={l.id} ativo={l.id === valor} onClick={() => { onChange(l.id); fechar() }}>
                  <span className="truncate pl-4">{l.nome}</span>
                </ItemMenu>
              ))}
            </div>
          ))}
          {!filtrados.length && <div className="px-2.5 py-3 text-xs text-ln-t4">Nenhum cliente ou lista encontrado.</div>}
        </div>
      </Popover>
    </>
  )
}

/**
 * grupos = [{ pasta, listas }] com as listas que podem receber a tarefa; inicial = valores
 * pré-preenchidos (lista_id, responsaveis). onCriar(payload) devolve { data } ou { error }.
 */
export default function NovaTarefaPanel({ grupos, listasMap, inicial, membros, membrosMap, onCriar, onCancelar }) {
  const [f, setF] = useState(() => ({
    titulo: '', descricao: '', prioridade: null, data_inicio: null, data_vencimento: null, estimativa_min: null,
    tipo_tarefa: null, departamento: [], responsaveis: [], status: null, subtarefas: [], relacoes: [], checklists: [], ...inicial,
  }))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const tituloRef = useRef(null)
  useEffect(() => { tituloRef.current?.focus() }, [])
  const mudar = (patch) => { setF((p) => ({ ...p, ...patch })); setErro('') }

  const lista = f.lista_id ? listasMap.get(f.lista_id) : null
  const statuses = useMemo(() => (lista ? statusDaLista(lista) : []), [lista])
  // status escolhido que não existe na lista nova volta ao inicial dela
  const status = statuses.find((s) => s.key === f.status) || statusInicial(statuses)

  async function criar() {
    if (salvando) return
    if (!f.lista_id) { setErro('Escolha a lista da tarefa'); return }
    if (!f.titulo.trim()) { setErro('Dê um nome à tarefa'); tituloRef.current?.focus(); return }
    setSalvando(true)
    const r = await onCriar({ ...f, titulo: f.titulo.trim(), descricao: f.descricao?.trim() || null, status: status?.key })
    setSalvando(false)
    if (r?.error) setErro(r.error)
  }

  return (
    <div
      className="flex flex-col h-full"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); criar() }
      }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 p-4">
        <header>
          <textarea
            ref={tituloRef}
            value={f.titulo}
            onChange={(e) => mudar({ titulo: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) e.preventDefault() }}
            rows={1}
            placeholder="Nome da tarefa"
            aria-label="Título da tarefa"
            className="w-full bg-transparent text-xl font-semibold tracking-[-0.01em] leading-tight outline-none resize-none rounded-md -mx-1 px-1 text-ln-t1 placeholder:text-ln-t4 hover:bg-ln-ink/[0.03] focus:bg-ln-ink/[0.04]"
          />
        </header>

        <section>
          <p className="ln-label">Propriedades</p>
          <dl className="flex flex-col">
            <Propriedade label="Lista">
              <ListaCampo grupos={grupos} valor={f.lista_id} onChange={(id) => mudar({ lista_id: id })} />
            </Propriedade>
            <Propriedade label="Status">
              {lista ? <StatusCampo item={{ status: status?.key }} statuses={statuses} onChange={(s) => mudar({ status: s.key })} /> : <span className="text-ln-t4">escolha a lista</span>}
            </Propriedade>
            <Propriedade label="Responsáveis">
              <ResponsavelCampo item={{ responsaveis: f.responsaveis, responsaveis_extra: [] }} membros={membros} membrosMap={membrosMap} size={16} max={4} comNome onChange={(ids) => mudar({ responsaveis: ids })} />
            </Propriedade>
            <Propriedade label="Prioridade"><PrioridadeCampo valor={f.prioridade} onChange={(v) => mudar({ prioridade: v })} /></Propriedade>
            <Propriedade label="Início"><DataCampo valor={f.data_inicio} placeholder="definir" onChange={(v) => mudar({ data_inicio: v })} /></Propriedade>
            <Propriedade label="Vencimento"><DataCampo valor={f.data_vencimento} placeholder="definir" onChange={(v) => mudar({ data_vencimento: v })} /></Propriedade>
            <Propriedade label="Estimativa"><EstimativaCampo valor={f.estimativa_min} onChange={(v) => mudar({ estimativa_min: v })} /></Propriedade>
            <Propriedade label="Tipo"><TipoTarefaCampo valor={f.tipo_tarefa} onChange={(v) => mudar({ tipo_tarefa: v })} /></Propriedade>
            <Propriedade label="Departamento"><DepartamentoCampo valor={f.departamento} onChange={(v) => mudar({ departamento: v })} /></Propriedade>
          </dl>
        </section>

        <section>
          <p className="ln-label">Descrição</p>
          <MarkdownEditor value={f.descricao} onChange={(v) => mudar({ descricao: v })} minHeight={120} placeholder="Escreva a descrição (aceita markdown)..." className="md-editor--13 text-ln-t2" />
        </section>

        <Secao titulo="Subtarefas">
          <ListaSubtarefas
            itens={f.subtarefas}
            onAbrir={() => {}}
            onAdicionar={async (titulo) => mudar({ subtarefas: [...f.subtarefas, { id: novoId(), titulo }] })}
            fim={(s) => <button type="button" onClick={() => mudar({ subtarefas: f.subtarefas.filter((x) => x.id !== s.id) })} className="ln-iconbtn !w-5 !h-5" aria-label={`Tirar a subtarefa ${s.titulo}`}><X className="w-3 h-3" /></button>}
          />
        </Secao>

        <Secao titulo="Relações">
          <ListaRelacoes
            linhas={f.relacoes.map((r) => ({
              key: r.key, rotulo: ROTULO_DIRETO[r.tipo], titulo: r.alvo.titulo, concluida: r.alvo.status_tipo === 'closed',
              onRemover: () => mudar({ relacoes: f.relacoes.filter((x) => x.key !== r.key) }),
            }))}
            tipos={TIPOS_RELACAO}
            buscar={async (q) => (await supabase.from('tarefas_itens').select('id,titulo,status_tipo').ilike('titulo', `%${q}%`).eq('arquivada', false).limit(8)).data || []}
            onAdicionar={async (tipo, alvo) => {
              if (f.relacoes.some((r) => r.tipo === tipo && r.alvo.id === alvo.id)) { setErro('Essa relação já está na lista'); return false }
              mudar({ relacoes: [...f.relacoes, { key: novoId(), tipo, alvo }] })
              return true
            }}
          />
        </Secao>

        <Secao titulo="Checklists">
          <Checklists checklists={f.checklists} onChange={(v) => mudar({ checklists: v })} />
        </Secao>
      </div>

      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-ln-ink/[0.06]">
        {erro && <span className="text-xs text-ln-red truncate" role="alert">{erro}</span>}
        <span className="ml-auto text-[11px] text-ln-t4 hidden sm:inline-flex items-center gap-1"><kbd className="ln-kbd">Ctrl</kbd>+<kbd className="ln-kbd">Enter</kbd></span>
        <button type="button" onClick={onCancelar} className="ln-pill">Cancelar</button>
        <button type="button" onClick={criar} disabled={salvando} className="ln-primary inline-flex items-center gap-1.5 disabled:opacity-60">
          {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Criar tarefa
        </button>
      </div>
    </div>
  )
}
