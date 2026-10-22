// Construtor de um template do VertaTask: à esquerda a estrutura (tarefas e
// subtarefas, em ordem), à direita os atributos da tarefa escolhida. Salva só no
// botão Salvar; sair com alterações pede confirmação.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Plus, Trash2, Copy, ChevronUp, ChevronDown, CornerDownRight, Play, Save, AlertTriangle, Link2, CheckSquare, Square, X, Clock3, Info,
} from 'lucide-react'
import {
  itensDoTemplate, resumoDoTemplate, achatar, novoItem, atualizarItem, removerItem, moverItem, duplicarItem, validarItens,
  MODOS_RESPONSAVEL, VARIAVEL_CLIENTE,
} from '../../lib/templates'
import { fmtEstimativa, corDaPessoa, iniciais } from '../../lib/tarefas'
import { PrioridadeCampo, TipoTarefaCampo, DificuldadeCampo, EstimativaCampo, Popover, Avatar, AdicionarInline, FOCO } from './Campos'
import { Propriedade, DepartamentoCampo, Descricao, Checklists } from './TarefaPanel'
import { EtiquetasCampo } from './TarefaExtras'

const numeracao = (itens) => {
  const m = new Map()
  itens.forEach((it, i) => { m.set(it.id, `${i + 1}`); it.subtarefas.forEach((s, j) => m.set(s.id, `${i + 1}.${j + 1}`)) })
  return m
}

function textoPrazo(item) {
  const a = item.inicio_dia, b = item.vencimento_dia
  if (a == null && b == null) return ''
  if (a != null && b != null && a !== b) return `D+${a} → D+${b}`
  return `D+${b ?? a}`
}

// ─── Campos próprios do template ─────────────────────────────────────────────

function DiaCampo({ valor, onChange, rotulo }) {
  const [txt, setTxt] = useState(valor ?? '')
  useEffect(() => { setTxt(valor ?? '') }, [valor])
  const salvar = () => {
    const n = txt === '' ? null : Math.max(0, Math.round(Number(txt)))
    if (Number.isNaN(n)) { setTxt(valor ?? ''); return }
    if (n !== valor) onChange(n)
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-ln-t4 tabular">D+</span>
      <input
        type="number" min={0} step={1} inputMode="numeric" value={txt} placeholder="—"
        onChange={(e) => setTxt(e.target.value)} onBlur={salvar} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        aria-label={rotulo} className="ln-input !h-6 !w-16 !px-1.5 !text-xs tabular"
      />
      <span className="text-ln-t4">dia{valor === 1 ? '' : 's'} út{valor === 1 ? 'il' : 'eis'}</span>
      {valor != null && <button type="button" onClick={() => onChange(null)} className="text-ln-t4 hover:text-ln-red" aria-label={`Limpar ${rotulo}`} title="Sem data"><X className="w-3 h-3" /></button>}
    </span>
  )
}

function ResponsavelTemplateCampo({ valor, membros, onChange }) {
  const modo = valor?.modo || 'departamento'
  return (
    <span className="flex flex-wrap items-center gap-1.5 min-w-0">
      <select className="ln-input !h-7 !w-auto !text-xs" value={modo} onChange={(e) => onChange({ modo: e.target.value, pessoa_id: e.target.value === 'pessoa' ? valor?.pessoa_id || null : null })} aria-label="Regra do responsável">
        {MODOS_RESPONSAVEL.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
      </select>
      {modo === 'pessoa' && (
        <select className="ln-input !h-7 !w-auto !text-xs" value={valor?.pessoa_id || ''} onChange={(e) => onChange({ modo: 'pessoa', pessoa_id: e.target.value || null })} aria-label="Pessoa">
          <option value="">Escolha a pessoa</option>
          {membros.filter((m) => !m.disabled).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}
    </span>
  )
}

function DependeCampo({ item, itens, num, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const sel = new Set(item.depende_de)
  const opcoes = achatar(itens).map((p) => p.item).filter((x) => x.id !== item.id && !item.subtarefas.some((s) => s.id === x.id))
  const nomes = opcoes.filter((o) => sel.has(o.id))
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className={`flex flex-wrap gap-1 text-left rounded-md min-w-0 ${FOCO}`}>
        {nomes.length ? nomes.map((o) => (
          <span key={o.id} className="inline-flex items-center gap-1 h-6 px-2 rounded-full ring-1 ring-inset ring-ln-line text-xs text-ln-t3 max-w-[220px]"><span className="tabular text-ln-t4">{num.get(o.id)}</span><span className="truncate">{o.titulo || 'Sem título'}</span></span>
        )) : <span className="text-ln-t4">nenhuma</span>}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={300}>
        <p className="px-3 pt-2.5 pb-1 text-[11px] text-ln-t4">Esta tarefa só começa depois de:</p>
        <div className="p-1 overflow-y-auto">
          {opcoes.length === 0 && <p className="px-2.5 py-2 text-xs text-ln-t4">Não há outras tarefas no template.</p>}
          {opcoes.map((o) => (
            <button key={o.id} type="button" onClick={() => onChange(sel.has(o.id) ? item.depende_de.filter((d) => d !== o.id) : [...item.depende_de, o.id])} className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] text-ln-t2 hover:bg-ln-ink/5 text-left">
              {sel.has(o.id) ? <CheckSquare className="w-3.5 h-3.5 text-ln-accent shrink-0" /> : <Square className="w-3.5 h-3.5 text-ln-t4 shrink-0" />}
              <span className="tabular text-ln-t4 w-7 shrink-0">{num.get(o.id)}</span>
              <span className="truncate">{o.titulo || 'Sem título'}</span>
            </button>
          ))}
        </div>
      </Popover>
    </>
  )
}

// ─── Formulário da tarefa escolhida ──────────────────────────────────────────

function ItemForm({ item, itens, num, membros, etiquetas, onCriarEtiqueta, onPatch, ehSub }) {
  const set = (patch) => onPatch(patch)
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[11px] text-ln-t4 tabular">{ehSub ? 'Subtarefa' : 'Tarefa'} {num.get(item.id)}</p>
        <input
          value={item.titulo} onChange={(e) => set({ titulo: e.target.value })} placeholder="Nome da tarefa"
          aria-label="Nome da tarefa" autoFocus={!item.titulo}
          className="mt-1 w-full bg-transparent text-xl font-semibold tracking-[-0.01em] text-ln-t1 outline-none rounded-md -mx-1 px-1 hover:bg-ln-ink/[0.03] focus:bg-ln-ink/[0.04]"
        />
        <p className="mt-1 text-[11px] text-ln-t4">Use <code className="ln-kbd">{VARIAVEL_CLIENTE}</code> no nome ou na descrição para entrar o nome do cliente ao aplicar.</p>
      </div>

      <section>
        <p className="ln-label">Propriedades</p>
        <dl className="mt-1.5 flex flex-col gap-0.5">
          <Propriedade label="Responsável"><ResponsavelTemplateCampo valor={item.responsavel} membros={membros} onChange={(v) => set({ responsavel: v })} /></Propriedade>
          <Propriedade label="Departamento"><DepartamentoCampo valor={item.departamento} onChange={(v) => set({ departamento: v })} /></Propriedade>
          <Propriedade label="Início"><DiaCampo valor={item.inicio_dia} rotulo="Início" onChange={(v) => set({ inicio_dia: v })} /></Propriedade>
          <Propriedade label="Vencimento"><DiaCampo valor={item.vencimento_dia} rotulo="Vencimento" onChange={(v) => set({ vencimento_dia: v })} /></Propriedade>
          <Propriedade label="Depende de"><DependeCampo item={item} itens={itens} num={num} onChange={(v) => set({ depende_de: v })} /></Propriedade>
          <Propriedade label="Prioridade"><PrioridadeCampo valor={item.prioridade} onChange={(v) => set({ prioridade: v })} /></Propriedade>
          <Propriedade label="Tipo"><TipoTarefaCampo valor={item.tipo_tarefa} onChange={(v) => set({ tipo_tarefa: v })} /></Propriedade>
          <Propriedade label="Dificuldade"><DificuldadeCampo valor={item.dificuldade} onChange={(v) => set({ dificuldade: v })} /></Propriedade>
          <Propriedade label="Estimativa"><EstimativaCampo valor={item.estimativa_min} onChange={(v) => set({ estimativa_min: v })} /></Propriedade>
          <Propriedade label="Etiquetas"><EtiquetasCampo valor={item.etiquetas} etiquetas={etiquetas} onChange={(v) => set({ etiquetas: v })} onCriar={onCriarEtiqueta} /></Propriedade>
        </dl>
        <p className="mt-2 text-[11px] text-ln-t4 flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-px shrink-0" />
          <span>Prazos contam dias úteis a partir da data de início escolhida ao aplicar (D+0 é o próprio dia). Pelo departamento, o responsável sai do squad do cliente, configurado em Usuários → Equipes.</span>
        </p>
      </section>

      <section>
        <p className="ln-label mb-1.5">Descrição</p>
        <Descricao key={item.id} valor={item.descricao} onSalvar={(v) => set({ descricao: v || '' })} />
      </section>

      <section>
        <p className="ln-label mb-1.5">Checklists</p>
        <Checklists checklists={item.checklists} onChange={(v) => set({ checklists: v })} />
      </section>
    </div>
  )
}

// ─── Editor ──────────────────────────────────────────────────────────────────

export default function TemplateEditor({ template, membros, membrosMap, etiquetas, onCriarEtiqueta, onSalvar, onVoltar, onAplicar, onDuplicar, onExcluir }) {
  const [nome, setNome] = useState(template.nome || '')
  const [descricao, setDescricao] = useState(template.descricao || '')
  const [itens, setItens] = useState(() => itensDoTemplate(template))
  const [selId, setSelId] = useState(() => itensDoTemplate(template)[0]?.id || null)
  const [salvando, setSalvando] = useState(false)
  const [base, setBase] = useState(() => JSON.stringify({ n: template.nome || '', d: template.descricao || '', i: itensDoTemplate(template) }))

  const atual = JSON.stringify({ n: nome, d: descricao, i: itens })
  const sujo = atual !== base

  // outra pessoa salvou este template e aqui não há edição pendente: recarrega
  useEffect(() => {
    if (sujo) return
    const i = itensDoTemplate(template)
    setNome(template.nome || ''); setDescricao(template.descricao || ''); setItens(i)
    setBase(JSON.stringify({ n: template.nome || '', d: template.descricao || '', i }))
    if (!achatar(i).some((p) => p.item.id === selId)) setSelId(i[0]?.id || null)
  }, [template.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sujo) return undefined
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [sujo])

  const num = useMemo(() => numeracao(itens), [itens])
  const resumo = useMemo(() => resumoDoTemplate(itens), [itens])
  const erros = useMemo(() => validarItens(itens), [itens])
  const comErro = useMemo(() => new Set(erros.map((e) => e.id)), [erros])
  const plano = useMemo(() => achatar(itens), [itens])
  const sel = plano.find((p) => p.item.id === selId)

  const patch = (id, p) => setItens((prev) => atualizarItem(prev, id, (it) => ({ ...it, ...p })))
  const addTarefa = (titulo) => { const it = novoItem({ titulo }); setItens((p) => [...p, it]); setSelId(it.id) }
  const addSub = (paiId, titulo = '') => {
    const s = novoItem({ titulo })
    setItens((prev) => prev.map((it) => (it.id === paiId ? { ...it, subtarefas: [...it.subtarefas, s] } : it)))
    setSelId(s.id)
  }
  const excluir = (id) => {
    const alvo = plano.find((p) => p.item.id === id)
    const n = alvo?.nivel === 0 ? alvo.item.subtarefas.length : 0
    if (n && !window.confirm(`Excluir a tarefa e as ${n} subtarefa(s) dela?`)) return
    setItens((prev) => removerItem(prev, id))
    if (selId === id || alvo?.item.subtarefas.some((s) => s.id === selId)) setSelId(alvo?.pai?.id || null)
  }

  async function salvar() {
    if (!nome.trim()) { window.alert('Dê um nome ao template.'); return false }
    setSalvando(true)
    const r = await onSalvar({ nome: nome.trim(), descricao: descricao.trim() || null, itens })
    setSalvando(false)
    if (r?.error) return false
    setBase(atual)
    return true
  }
  const voltar = () => { if (!sujo || window.confirm('Sair sem salvar as alterações?')) onVoltar() }
  async function aplicar() {
    if (erros.length) { window.alert(`Corrija antes de aplicar:\n\n${[...new Set(erros.map((e) => e.msg))].join('\n')}`); return }
    if (sujo && !(await salvar())) return
    onAplicar({ ...template, nome: nome.trim(), descricao, itens })
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* cabeçalho do template */}
      <div className="shrink-0 px-4 sm:px-6 pt-3 pb-3 border-b border-ln-ink/[0.08] bg-ln-panel">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={voltar} className={`inline-flex items-center gap-1 text-xs text-ln-t3 hover:text-ln-t1 rounded ${FOCO}`}><ArrowLeft className="w-3 h-3" /> Templates</button>
          <span className="flex-1" />
          <span className="text-[11px] text-ln-t4 tabular hidden sm:inline">
            {resumo.total} tarefa{resumo.total === 1 ? '' : 's'}{resumo.estimativaMin ? ` · ${fmtEstimativa(resumo.estimativaMin)}` : ''}
          </span>
          {sujo && <span className="text-[11px] font-semibold text-ln-orange">Alterações não salvas</span>}
          <button type="button" onClick={() => onDuplicar({ ...template, nome, descricao, itens })} className="ln-iconbtn" aria-label="Duplicar template" title="Duplicar"><Copy className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => onExcluir(template)} className="ln-iconbtn hover:!text-ln-red" aria-label="Apagar template" title="Apagar"><Trash2 className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={aplicar} disabled={!resumo.total} className="ln-pill disabled:opacity-50"><Play className="w-3 h-3" /> Aplicar</button>
          <button type="button" onClick={salvar} disabled={!sujo || salvando} className="ln-primary disabled:opacity-50"><Save className="w-3.5 h-3.5" /> {salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do template" aria-label="Nome do template" className="mt-2 w-full bg-transparent outline-none text-2xl font-bold text-ln-t1 vt-display" />
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Para que serve este template (opcional)" aria-label="Descrição do template" className="mt-0.5 w-full bg-transparent outline-none text-[13px] text-ln-t3 placeholder:text-ln-t4" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* estrutura */}
        <aside className="lg:w-[400px] shrink-0 lg:border-r border-b lg:border-b-0 border-ln-ink/[0.08] bg-ln-panel flex flex-col min-h-0 max-h-[45vh] lg:max-h-none">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <p className="ln-label">Estrutura</p>
            {erros.length > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-ln-orange" title={[...new Set(erros.map((e) => e.msg))].join('\n')}><AlertTriangle className="w-3 h-3" /> {erros.length} pendência{erros.length === 1 ? '' : 's'}</span>}
          </div>
          <ol className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
            {itens.length === 0 && <li className="px-2 py-3 text-xs text-ln-t4">Comece adicionando a primeira tarefa.</li>}
            {plano.map(({ item, nivel, pai }) => {
              const irmaos = nivel === 0 ? itens : pai.subtarefas
              const idx = irmaos.findIndex((x) => x.id === item.id)
              const ativo = item.id === selId
              const resp = item.responsavel?.modo === 'pessoa' ? membrosMap.get(item.responsavel.pessoa_id) : null
              return (
                <li key={item.id} className={`group/row flex items-center gap-1.5 min-h-[34px] rounded-lg pr-1 ${ativo ? 'bg-ln-accent/10' : 'hover:bg-ln-ink/[0.04]'}`} style={{ paddingLeft: nivel ? 26 : 8 }}>
                  {nivel === 1 && <CornerDownRight className="w-3 h-3 text-ln-t4 shrink-0" />}
                  <button type="button" onClick={() => setSelId(item.id)} className={`flex-1 min-w-0 flex items-center gap-2 text-left py-1 rounded ${FOCO}`}>
                    <span className="tabular text-[11px] text-ln-t4 w-7 shrink-0">{num.get(item.id)}</span>
                    <span className={`truncate text-[13px] ${ativo ? 'text-ln-accent font-semibold' : item.titulo ? 'text-ln-t2' : 'text-ln-t4 italic'}`}>{item.titulo || 'Sem título'}</span>
                    {comErro.has(item.id) && <AlertTriangle className="w-3 h-3 text-ln-orange shrink-0" />}
                    {item.depende_de.length > 0 && <Link2 className="w-3 h-3 text-ln-t4 shrink-0" aria-label="Depende de outra tarefa" />}
                  </button>
                  <span className="flex items-center gap-1.5 shrink-0 group-hover/row:hidden">
                    {textoPrazo(item) && <span className="text-[11px] text-ln-t4 tabular">{textoPrazo(item)}</span>}
                    {item.estimativa_min > 0 && <span className="text-[11px] text-ln-t4 tabular inline-flex items-center gap-0.5"><Clock3 className="w-3 h-3" />{fmtEstimativa(item.estimativa_min)}</span>}
                    {resp && <Avatar pessoa={{ nome: resp.name, iniciais: resp.avatar || iniciais(resp.name), cor: corDaPessoa(resp.id) }} size={16} />}
                  </span>
                  <span className="hidden group-hover/row:flex group-focus-within/row:flex items-center shrink-0">
                    <button type="button" onClick={() => setItens((p) => moverItem(p, item.id, -1))} disabled={idx === 0} className="ln-iconbtn !w-6 !h-6 disabled:opacity-30" aria-label="Subir" title="Subir"><ChevronUp className="w-3 h-3" /></button>
                    <button type="button" onClick={() => setItens((p) => moverItem(p, item.id, 1))} disabled={idx === irmaos.length - 1} className="ln-iconbtn !w-6 !h-6 disabled:opacity-30" aria-label="Descer" title="Descer"><ChevronDown className="w-3 h-3" /></button>
                    {nivel === 0 && <button type="button" onClick={() => addSub(item.id)} className="ln-iconbtn !w-6 !h-6" aria-label="Adicionar subtarefa" title="Adicionar subtarefa"><Plus className="w-3 h-3" /></button>}
                    <button type="button" onClick={() => setItens((p) => duplicarItem(p, item.id))} className="ln-iconbtn !w-6 !h-6" aria-label="Duplicar" title="Duplicar"><Copy className="w-3 h-3" /></button>
                    <button type="button" onClick={() => excluir(item.id)} className="ln-iconbtn !w-6 !h-6 hover:!text-ln-red" aria-label="Excluir" title="Excluir"><Trash2 className="w-3 h-3" /></button>
                  </span>
                </li>
              )
            })}
          </ol>
          <div className="px-3 py-2 border-t border-ln-ink/5 flex flex-col gap-1">
            <AdicionarInline placeholder="Adicionar tarefa" onCriar={async (t) => addTarefa(t)} />
            {sel && (
              <AdicionarInline placeholder={`Adicionar subtarefa em ${num.get(sel.nivel === 0 ? sel.item.id : sel.pai.id)}`} onCriar={async (t) => addSub(sel.nivel === 0 ? sel.item.id : sel.pai.id, t)} />
            )}
          </div>
        </aside>

        {/* atributos */}
        <section className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-ln-bg">
          <div className="max-w-3xl px-4 sm:px-8 py-6">
            {sel ? (
              <ItemForm
                key={sel.item.id}
                item={sel.item} itens={itens} num={num} membros={membros} etiquetas={etiquetas} onCriarEtiqueta={onCriarEtiqueta}
                ehSub={sel.nivel === 1} onPatch={(p) => patch(sel.item.id, p)}
              />
            ) : (
              <div className="text-center text-[13px] text-ln-t4 py-16">
                {itens.length ? 'Escolha uma tarefa à esquerda para editar os atributos dela.' : 'Adicione a primeira tarefa na coluna da esquerda.'}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
