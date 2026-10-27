// Rascunho de tarefa nova no painel lateral: a pessoa escolhe a lista, preenche título e
// propriedades e só então confirma em "Criar tarefa" (Ctrl+Enter). Nada vai para o banco antes.
// Usado pelo "+ Tarefa" e pelo atalho C da AreaTarefas (em Minhas/Todas a lista é escolhida aqui).
import { useMemo, useRef, useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import MarkdownEditor from '../Editor/MarkdownEditor'
import { StatusCampo, ResponsavelCampo, PrioridadeCampo, DataCampo, EstimativaCampo, TipoTarefaCampo, FOCO } from './Campos'
import { Propriedade, DepartamentoCampo } from './TarefaPanel'
import { statusDaLista, statusInicial } from '../../lib/tarefas'

/**
 * grupos = [{ pasta, listas }] com as listas que podem receber a tarefa; inicial = valores
 * pré-preenchidos (lista_id, responsaveis). onCriar(payload) devolve { data } ou { error }.
 */
export default function NovaTarefaPanel({ grupos, listasMap, inicial, membros, membrosMap, onCriar, onCancelar }) {
  const [f, setF] = useState(() => ({
    titulo: '', descricao: '', prioridade: null, data_inicio: null, data_vencimento: null, estimativa_min: null,
    tipo_tarefa: null, departamento: [], responsaveis: [], status: null, ...inicial,
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
              <select
                value={f.lista_id || ''}
                onChange={(e) => mudar({ lista_id: e.target.value || null })}
                aria-label="Lista da tarefa"
                className={`min-w-0 max-w-full h-7 px-1.5 -mx-1.5 rounded-md bg-transparent text-xs hover:bg-ln-ink/[0.04] ${f.lista_id ? 'text-ln-t2' : 'text-ln-t4'} ${FOCO}`}
              >
                <option value="">escolher lista</option>
                {grupos.map((g) => (
                  <optgroup key={g.pasta?.id || 'soltas'} label={g.pasta?.nome || 'Sem pasta'}>
                    {g.listas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </optgroup>
                ))}
              </select>
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
