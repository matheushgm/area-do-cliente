// Construtor de um template do VertaTask, com a mesma cara da lista de tarefas de um
// cliente: a ListaView (colunas do template, edição inline nas células, subtarefas
// abertas) e, ao clicar numa linha, o painel lateral de 480px com nome, propriedades,
// descrição e checklists. Salva só no botão Salvar; sair com alterações pede confirmação.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Trash2, Copy, ChevronUp, ChevronDown, Play, Save, AlertTriangle, CheckSquare, Square, X, Info, Users, User,
} from 'lucide-react'
import {
  itensDoTemplate, resumoDoTemplate, achatar, novoItem, atualizarItem, removerItem, moverItem, duplicarItem, validarItens,
  MODOS_RESPONSAVEL, VARIAVEL_CLIENTE,
} from '../../lib/templates'
import { fmtEstimativa, corDaPessoa, iniciais, STATUSES_PADRAO } from '../../lib/tarefas'
import { PrioridadeCampo, TipoTarefaCampo, DificuldadeCampo, EstimativaCampo, Popover, Avatar, ItemMenu, FOCO } from './Campos'
import ListaView from './ListaView'
import { Propriedade, DepartamentoCampo, Descricao, Checklists } from './TarefaPanel'
import { EtiquetasCampo } from './TarefaExtras'

const numeracao = (itens) => {
  const m = new Map()
  itens.forEach((it, i) => { m.set(it.id, `${i + 1}`); it.subtarefas.forEach((s, j) => m.set(s.id, `${i + 1}.${j + 1}`)) })
  return m
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

function DependeCampo({ item, itens, num, onChange, compacto = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const sel = new Set(item.depende_de)
  const opcoes = achatar(itens).map((p) => p.item).filter((x) => x.id !== item.id && !item.subtarefas.some((s) => s.id === x.id))
  const nomes = opcoes.filter((o) => sel.has(o.id))
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className={`flex flex-wrap gap-1 text-left rounded-md min-w-0 ${FOCO}`}>
        {compacto ? (
          nomes.length
            ? <span className="text-[13px] text-ln-t2 tabular truncate" title={nomes.map((o) => `${num.get(o.id)} ${o.titulo}`).join('\n')}>após {nomes.map((o) => num.get(o.id)).join(', ')}</span>
            : <span className="text-[13px] text-ln-t4 pl-1">–</span>
        ) : nomes.length ? nomes.map((o) => (
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

function ItemForm({ item, itens, num, membros, etiquetas, onCriarEtiqueta, onPatch }) {
  const set = (patch) => onPatch(patch)
  return (
    <div className="flex flex-col gap-5">
      <div>
        <input
          value={item.titulo} onChange={(e) => set({ titulo: e.target.value })} placeholder="Nome da tarefa"
          aria-label="Nome da tarefa" autoFocus={!item.titulo}
          className="w-full bg-transparent text-xl font-semibold tracking-[-0.01em] text-ln-t1 outline-none rounded-md -mx-1 px-1 hover:bg-ln-ink/[0.03] focus:bg-ln-ink/[0.04]"
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
          <span>Prazos contam dias úteis a partir da data de início escolhida ao aplicar (D+0 é o próprio dia). Pelo departamento, o responsável sai do squad do cliente, configurado em Usuários → Equipes; o departamento Cliente vai para o usuário Cliente do ClickUp.</span>
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

// ─── Células do template na ListaView ────────────────────────────────────────

/** "D+3" na célula; clique abre o campo numérico (dias úteis depois da data de início). */
function DiaCelula({ valor, onChange, rotulo }) {
  const [editando, setEditando] = useState(false)
  const [txt, setTxt] = useState('')
  const salvar = () => {
    setEditando(false)
    const n = txt.trim() === '' ? null : Math.max(0, Math.round(Number(txt)))
    if (!Number.isNaN(n) && n !== valor) onChange(n)
  }
  if (editando) {
    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <span className="text-[13px] text-ln-t4 tabular">D+</span>
        <input
          autoFocus type="number" min={0} inputMode="numeric" value={txt} aria-label={rotulo}
          onChange={(e) => setTxt(e.target.value)} onBlur={salvar}
          onKeyDown={(e) => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') { e.stopPropagation(); setEditando(false) } }}
          className="ln-input !h-6 !w-14 !px-1.5 !text-xs tabular"
        />
      </span>
    )
  }
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); setTxt(valor ?? ''); setEditando(true) }} className={`text-[13px] tabular whitespace-nowrap rounded hover:text-ln-t1 ${valor == null ? 'text-ln-t4 pl-1' : 'text-ln-t2'} ${FOCO}`} title={`${rotulo}: dias úteis depois da data de início`}>
      {valor == null ? '–' : `D+${valor}`}
    </button>
  )
}

/** Regra do responsável na célula: "Pelo squad", a pessoa fixa ou "–". */
function RegraCelula({ valor, membros, membrosMap, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const modo = valor?.modo || 'departamento'
  const pessoa = modo === 'pessoa' ? membrosMap.get(valor?.pessoa_id) : null
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className={`inline-flex items-center gap-1.5 min-w-0 rounded-md ${FOCO}`} title="Quem recebe a tarefa ao aplicar">
        {modo === 'departamento' && <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-md text-xs text-ln-t2 bg-ln-level2 whitespace-nowrap"><Users className="w-3 h-3 text-ln-t4" /> Pelo squad</span>}
        {modo === 'pessoa' && (pessoa
          ? <><Avatar pessoa={{ nome: pessoa.name, iniciais: pessoa.avatar || iniciais(pessoa.name), cor: corDaPessoa(pessoa.id) }} size={22} /><span className="text-[13px] text-ln-t2 truncate">{pessoa.name.split(' ')[0]}</span></>
          : <span className="text-[13px] text-ln-orange">escolher pessoa</span>)}
        {modo === 'nenhum' && <span className="text-[13px] text-ln-t4 pl-1">–</span>}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={260}>
        <div className="p-1 overflow-y-auto">
          <ItemMenu ativo={modo === 'departamento'} onClick={() => { setOpen(false); onChange({ modo: 'departamento', pessoa_id: null }) }}><Users className="w-3.5 h-3.5 text-ln-t4" /> Pelo departamento (squad)</ItemMenu>
          <ItemMenu ativo={modo === 'nenhum'} onClick={() => { setOpen(false); onChange({ modo: 'nenhum', pessoa_id: null }) }}><User className="w-3.5 h-3.5 text-ln-t4" /> Sem responsável</ItemMenu>
          <div className="px-2.5 pt-2 pb-1 text-[10px] uppercase tracking-wide text-ln-t4">Pessoa fixa</div>
          {membros.filter((m) => !m.disabled).map((m) => (
            <ItemMenu key={m.id} ativo={modo === 'pessoa' && valor?.pessoa_id === m.id} onClick={() => { setOpen(false); onChange({ modo: 'pessoa', pessoa_id: m.id }) }}>
              <Avatar pessoa={{ nome: m.name, iniciais: m.avatar || iniciais(m.name), cor: corDaPessoa(m.id) }} size={18} />
              <span className="truncate">{m.name}</span>
            </ItemMenu>
          ))}
        </div>
      </Popover>
    </>
  )
}

const COLUNAS_TEMPLATE = [
  { k: 'depto', label: 'Departamento', w: 180 },
  { k: 'resp', label: 'Responsável', w: 150 },
  { k: 'ini', label: 'Início', w: 90 },
  { k: 'venc', label: 'Vencimento', w: 100 },
  { k: 'prio', label: 'Prioridade', w: 120 },
  { k: 'tipo', label: 'Tipo de tarefa', w: 150 },
  { k: 'estim', label: 'Estimativa', w: 110 },
  { k: 'deps', label: 'Depende de', w: 120 },
]

/** Item do template no formato de tarefa que a ListaView lê. */
const comoLinha = (it, i, paiId = null) => ({
  ...it, parent_id: paiId, posicao: i, lista_id: 'template', status: 'a fazer', status_tipo: 'open',
  responsaveis: [], responsaveis_extra: [], created_at: null,
})

// ─── Painel lateral (mesmo chrome do painel da tarefa) ───────────────────────

export function PainelLateral({ titulo, acoes, onFechar, children, label }) {
  return (
    <>
      <div className="absolute inset-0 z-30 bg-black/30 xl:hidden" onClick={onFechar} aria-hidden="true" />
      <aside className="absolute inset-y-0 right-0 z-40 shadow-2xl xl:shadow-none xl:relative xl:z-auto shrink-0 border-l border-ln-ink/[0.08] flex flex-col bg-ln-panel" style={{ width: 'min(480px, 100%)' }} aria-label={label}>
        <div className="h-11 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-ln-ink/5">
          <div className="text-xs font-medium text-ln-t3 truncate">{titulo}</div>
          <div className="flex items-center gap-1 shrink-0">
            {acoes}
            <button type="button" onClick={onFechar} className="ln-iconbtn" aria-label="Fechar painel" title="Fechar (Esc)"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </>
  )
}

// ─── Editor ──────────────────────────────────────────────────────────────────

export default function TemplateEditor({ template, membros, membrosMap, etiquetas, onCriarEtiqueta, onSalvar, onVoltar, onAplicar, onDuplicar, onExcluir }) {
  const [nome, setNome] = useState(template.nome || '')
  const [descricao, setDescricao] = useState(template.descricao || '')
  const [itens, setItens] = useState(() => itensDoTemplate(template))
  const [selId, setSelId] = useState(null)
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
  }, [template.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sujo) return undefined
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [sujo])

  useEffect(() => {
    if (!selId) return undefined
    const h = (e) => {
      const el = document.activeElement
      if (e.key === 'Escape' && !(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))) setSelId(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [selId])

  const num = useMemo(() => numeracao(itens), [itens])
  const resumo = useMemo(() => resumoDoTemplate(itens), [itens])
  const erros = useMemo(() => validarItens(itens), [itens])
  const plano = useMemo(() => achatar(itens), [itens])
  const sel = plano.find((p) => p.item.id === selId)

  const patch = (id, p) => setItens((prev) => atualizarItem(prev, id, (it) => ({ ...it, ...p })))
  const addTarefa = (titulo) => { const it = novoItem({ titulo }); setItens((p) => [...p, it]); return it }
  const addSub = (paiId, titulo = '') => {
    const s = novoItem({ titulo })
    setItens((prev) => prev.map((it) => (it.id === paiId ? { ...it, subtarefas: [...it.subtarefas, s] } : it)))
    return s
  }
  const excluir = (id) => {
    const alvo = plano.find((p) => p.item.id === id)
    const n = alvo?.nivel === 0 ? alvo.item.subtarefas.length : 0
    if (n && !window.confirm(`Excluir a tarefa e as ${n} subtarefa(s) dela?`)) return
    setItens((prev) => removerItem(prev, id))
    if (selId === id || alvo?.item.subtarefas.some((s) => s.id === selId)) setSelId(null)
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

  // ── ListaView: um grupo só, subtarefas abertas, colunas do template ──
  const grupos = [{ key: 'template', label: 'Tarefas do template', cor: '#2A25F0', itens: itens.map((it, i) => comoLinha(it, i)) }]
  const filhosDe = new Map(itens.map((it) => [it.id, it.subtarefas.map((s, j) => comoLinha(s, j, it.id))]))
  const ctx = {
    statuses: STATUSES_PADRAO, membros, membrosMap, itensMap: {}, listaPadraoId: 'template', agrupar: 'nenhum',
    contagemComentarios: {}, selecionadaId: selId, semStatus: true, expandirTudo: true,
    onAbrir: (id) => setSelId(id),
    onAtualizar: (id, p) => patch(id, p),
    onMudarStatus: () => {},
    onCriar: ({ parent_id, titulo }) => {
      const novo = parent_id ? addSub(parent_id, titulo === 'Nova subtarefa' ? '' : titulo) : addTarefa(titulo)
      if (!novo.titulo) setSelId(novo.id)
      return Promise.resolve({ data: novo })
    },
    renderCelula: (k, it) => {
      switch (k) {
        case 'depto': return <DepartamentoCampo compacto valor={it.departamento} onChange={(v) => patch(it.id, { departamento: v })} />
        case 'resp': return <RegraCelula valor={it.responsavel} membros={membros} membrosMap={membrosMap} onChange={(v) => patch(it.id, { responsavel: v })} />
        case 'ini': return <DiaCelula valor={it.inicio_dia} rotulo="Início" onChange={(v) => patch(it.id, { inicio_dia: v })} />
        case 'venc': return <DiaCelula valor={it.vencimento_dia} rotulo="Vencimento" onChange={(v) => patch(it.id, { vencimento_dia: v })} />
        case 'deps': return <DependeCampo compacto item={it} itens={itens} num={num} onChange={(v) => patch(it.id, { depende_de: v })} />
        default: return undefined
      }
    },
    acaoLinha: (it) => (
      <button type="button" onClick={() => excluir(it.id)} className="ln-iconbtn !w-6 !h-6 opacity-0 group-hover/linha:opacity-100 focus-visible:opacity-100 hover:!text-ln-red" aria-label={`Excluir ${it.titulo || 'tarefa'}`} title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
    ),
  }

  const irmaos = sel ? (sel.nivel === 0 ? itens : sel.pai.subtarefas) : []
  const idx = sel ? irmaos.findIndex((x) => x.id === sel.item.id) : -1

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
          {erros.length > 0 && (
            <button type="button" onClick={() => setSelId(erros[0].id)} className="inline-flex items-center gap-1 text-[11px] text-ln-orange" title={[...new Set(erros.map((e) => e.msg))].join('\n')}>
              <AlertTriangle className="w-3 h-3" /> {erros.length} pendência{erros.length === 1 ? '' : 's'}
            </button>
          )}
          {sujo && <span className="text-[11px] font-semibold text-ln-orange">Alterações não salvas</span>}
          <button type="button" onClick={() => onDuplicar({ ...template, nome, descricao, itens })} className="ln-iconbtn" aria-label="Duplicar template" title="Duplicar"><Copy className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => onExcluir(template)} className="ln-iconbtn hover:!text-ln-red" aria-label="Apagar template" title="Apagar"><Trash2 className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={aplicar} disabled={!resumo.total} className="ln-pill disabled:opacity-50"><Play className="w-3 h-3" /> Aplicar</button>
          <button type="button" onClick={salvar} disabled={!sujo || salvando} className="ln-primary disabled:opacity-50"><Save className="w-3.5 h-3.5" /> {salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do template" aria-label="Nome do template" className="mt-2 w-full bg-transparent outline-none text-2xl font-bold text-ln-t1 vt-display" />
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Para que serve este template (opcional)" aria-label="Descrição do template" className="mt-0.5 w-full bg-transparent outline-none text-[13px] text-ln-t3 placeholder:text-ln-t4" />
      </div>

      <div className="relative flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 overflow-auto bg-ln-panel">
          <ListaView grupos={grupos} filhosDe={filhosDe} ctx={ctx} mostrarConcluidas colunas={COLUNAS_TEMPLATE} />
        </div>

        {sel && (
          <PainelLateral
            label="Tarefa do template"
            titulo={`${sel.nivel === 0 ? 'Tarefa' : `Subtarefa de ${num.get(sel.pai.id)}`} ${num.get(sel.item.id)}`}
            onFechar={() => setSelId(null)}
            acoes={(
              <>
                <button type="button" onClick={() => setItens((p) => moverItem(p, sel.item.id, -1))} disabled={idx <= 0} className="ln-iconbtn disabled:opacity-30" aria-label="Subir" title="Subir"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => setItens((p) => moverItem(p, sel.item.id, 1))} disabled={idx === irmaos.length - 1} className="ln-iconbtn disabled:opacity-30" aria-label="Descer" title="Descer"><ChevronDown className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => setItens((p) => duplicarItem(p, sel.item.id))} className="ln-iconbtn" aria-label="Duplicar" title="Duplicar"><Copy className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => excluir(sel.item.id)} className="ln-iconbtn hover:!text-ln-red" aria-label="Excluir" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
              </>
            )}
          >
            <ItemForm
              key={sel.item.id}
              item={sel.item} itens={itens} num={num} membros={membros} etiquetas={etiquetas} onCriarEtiqueta={onCriarEtiqueta}
              onPatch={(p) => patch(sel.item.id, p)}
            />
          </PainelLateral>
        )}
      </div>
    </div>
  )
}
