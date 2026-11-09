// Barra de visualizações do VertaTask, no modelo do ClickUp:
//   AbasViews        linha 1: as 4 padrão | as salvas do escopo | "+ Visualização"
//   FerramentasView  linha 2: agrupador e subtarefas à esquerda; à direita "Salvar
//                    visualização ▾" (quando há rascunho), busca, filtros, responsáveis,
//                    concluídas, configurações e "+ Tarefa ▾" (templates)
// Só apresentação: config, rascunho e gravação vêm de Tarefas.jsx (src/lib/viewsTarefas.js).
import { createElement, useRef, useState } from 'react'
import {
  List, KanbanSquare, CalendarDays, GanttChart, Plus, EyeOff, Check, X, Search, Layers, User, Users, CircleCheck,
  Settings, ChevronDown, ChevronUp, Undo2, CopyPlus, ListTree, ListFilter,
} from 'lucide-react'
import { Popover, Avatar, FOCO } from './Campos'
import ModelosMenu from './ModelosMenu'
import { AGRUPAMENTOS, pessoaDoPerfil, rotuloAgrupamento } from '../../lib/tarefas'
import { SUBTAREFAS, rotuloSubtarefas, descSubtarefas, SEM_RESPONSAVEL, nomeResponsavelFiltro } from '../../lib/viewsTarefas'
import { useI18n } from '../../i18n'

const ICONES_TIPO = { lista: List, quadro: KanbanSquare, calendario: CalendarDays, gantt: GanttChart }
export const iconeTipo = (tipo, className = 'w-3.5 h-3.5') => createElement(ICONES_TIPO[tipo] || List, { className })
const rotuloAgrupar = rotuloAgrupamento

// ─── Linha 1: abas ────────────────────────────────────────────────────────────

function Aba({ tipo, ativa, onClick, extra, children }) {
  return (
    <button type="button" onClick={onClick} className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-2.5 -mb-px border-b-2 text-[13px] font-medium whitespace-nowrap transition-colors ${ativa ? 'border-ln-t1 text-ln-t1' : 'border-transparent text-ln-t3 hover:text-ln-t1'} ${FOCO}`}>
      <span className={ativa ? 'text-ln-accent' : ''}>{iconeTipo(tipo)}</span>
      <span className="max-w-[180px] truncate">{children}</span>
      {extra}
    </button>
  )
}

/** padrao/salvas = viewsDoEscopo(); tipoAtivo = tipo do rascunho da aba ativa. onNova null = sem "+ Visualização". */
export function AbasViews({ padrao, salvas, ativaChave, tipoAtivo, alterada, onAbrir, onNova }) {
  const { t } = useI18n()
  const aba = (v) => (
    <Aba key={v.chave} tipo={v.chave === ativaChave ? tipoAtivo : v.config.tipo} ativa={v.chave === ativaChave} onClick={() => onAbrir(v)}
      extra={<>
        {v.chave === ativaChave && alterada && <i className="w-1.5 h-1.5 rounded-full bg-ln-orange shrink-0" title={t('tarefas.barra.alteracoesNaoSalvas')} />}
        {v.acesso === 'privada' && !v.padrao && <EyeOff className="w-3 h-3 text-ln-t4 shrink-0" aria-label={t('tarefas.barra.soVoceVe')} />}
      </>}
    >{v.rotulo ?? v.nome}</Aba>
  )
  return (
    <div className="h-10 shrink-0 flex items-end gap-0.5 px-3 border-b border-ln-ink/[0.08] overflow-x-auto scroll-hide" role="tablist" aria-label={t('tarefas.barra.visualizacoes')}>
      {padrao.map(aba)}
      {salvas.length > 0 && <span className="w-px h-4 bg-ln-line mx-1.5 mb-3 shrink-0" />}
      {salvas.map(aba)}
      {onNova && (
        <button type="button" onClick={onNova} className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-2.5 text-[13px] font-medium text-ln-t3 hover:text-ln-t1 ${FOCO}`}>
          <Plus className="w-3.5 h-3.5" /> {t('tarefas.barra.visualizacao')}
        </button>
      )}
    </div>
  )
}

// ─── Peças reaproveitadas pela barra e pela sidebar ───────────────────────────

export function ListaAgrupar({ valor, onChange }) {
  const { t } = useI18n()
  return (
    <div className="p-1">
      <p className="px-2.5 pt-1.5 pb-1 text-[11px] text-ln-t4">{t('tarefas.barra.agruparPor')}</p>
      {AGRUPAMENTOS.map((a) => (
        <button key={a.value} type="button" onClick={() => onChange(a.value)} className={`w-full flex items-center h-8 px-2.5 rounded-md text-[13px] hover:bg-ln-ink/5 ${a.value === valor ? 'text-ln-t1' : 'text-ln-t2'}`}>
          {rotuloAgrupamento(a.value)}{a.value === valor && <Check className="w-3.5 h-3.5 ml-auto text-ln-accent" />}
        </button>
      ))}
    </div>
  )
}

/** tipo = visualização; Expandidas só faz diferença na Lista (nas outras, igual a Recolhidas). */
export function OpcoesSubtarefas({ valor, onChange, tipo = 'lista' }) {
  const { t } = useI18n()
  return SUBTAREFAS.map((s) => {
    const soLista = s.key === 'expandidas' && tipo !== 'lista'
    return (
    <button key={s.key} type="button" disabled={soLista} onClick={() => onChange(s.key)} title={soLista ? t('tarefas.barra.soNaListaTitulo') : undefined} className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-md text-left enabled:hover:bg-ln-ink/5 disabled:opacity-45 disabled:cursor-not-allowed ${FOCO}`}>
      <span className="flex-1 min-w-0">
        <span className={`block text-[13px] ${valor === s.key ? 'text-ln-t1 font-medium' : 'text-ln-t2'}`}>{rotuloSubtarefas(s.key)} {s.extra && <span className="text-ln-t4 font-normal">{t('tarefas.subtarefas.padrao')}</span>}{soLista && <span className="text-ln-t4 font-normal">{t('tarefas.barra.soNaLista')}</span>}</span>
        <span className="block text-[11px] text-ln-t4 leading-snug mt-0.5">{descSubtarefas(s.key)}</span>
      </span>
      {valor === s.key && <Check className="w-3.5 h-3.5 mt-0.5 text-ln-accent shrink-0" />}
    </button>
    )
  })
}

/** Seleção múltipla de pessoas: marcar não fecha o menu; nenhuma marcada = todos. */
export function ListaResponsaveis({ valor, membros, onChange }) {
  const { t } = useI18n()
  const alternar = (id) => onChange(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id])
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <span className="text-[11px] font-medium text-ln-t4">{valor.length ? t('tarefas.barra.selecionados', { count: valor.length }) : t('tarefas.barra.todosResponsaveis')}</span>
        {valor.length > 0 && <button type="button" onClick={() => onChange([])} className="text-[11px] text-ln-accent hover:underline">{t('comum.limpar')}</button>}
      </div>
      <div className="p-1 overflow-y-auto">
        {(() => {
          const marcado = valor.includes(SEM_RESPONSAVEL)
          return (
            <button type="button" role="menuitemcheckbox" aria-checked={marcado} onClick={() => alternar(SEM_RESPONSAVEL)} className={`w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13px] hover:bg-ln-ink/5 ${marcado ? 'text-ln-t1' : 'text-ln-t2'}`}>
              <span className={`w-4 h-4 rounded grid place-items-center shrink-0 border ${marcado ? 'bg-ln-accent border-ln-accent text-white' : 'border-ln-ink/25'}`}>{marcado && <Check className="w-3 h-3" />}</span>
              <span className="w-[18px] h-[18px] rounded-full border border-dashed border-ln-ink/30 grid place-items-center shrink-0"><User className="w-2.5 h-2.5 text-ln-t4" /></span>
              <span className="truncate">{t('tarefasCampos.grupo.semResponsavel')}</span>
            </button>
          )
        })()}
        <div className="border-t border-ln-ink/5 my-1" />
        {membros.filter((m) => !m.disabled).map((m) => {
          const marcado = valor.includes(m.id)
          return (
            <button key={m.id} type="button" role="menuitemcheckbox" aria-checked={marcado} onClick={() => alternar(m.id)} className={`w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13px] hover:bg-ln-ink/5 ${marcado ? 'text-ln-t1' : 'text-ln-t2'}`}>
              <span className={`w-4 h-4 rounded grid place-items-center shrink-0 border ${marcado ? 'bg-ln-accent border-ln-accent text-white' : 'border-ln-ink/25'}`}>{marcado && <Check className="w-3 h-3" />}</span>
              <Avatar pessoa={pessoaDoPerfil(m)} size={18} />
              <span className="truncate">{m.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Linha 2: ferramentas ─────────────────────────────────────────────────────

export function IconeBtn({ ativo, onClick, titulo, children, refBtn }) {
  return (
    <button ref={refBtn} type="button" onClick={onClick} title={titulo} aria-label={titulo} aria-pressed={!!ativo}
      className={`inline-flex items-center justify-center gap-1 h-8 min-w-8 px-1.5 rounded-md transition-colors ${ativo ? 'bg-ln-accent/10 text-ln-accent' : 'text-ln-t3 hover:text-ln-t1 hover:bg-ln-ink/5'} ${FOCO}`}>
      {children}
    </button>
  )
}

function Chip({ refBtn, onClick, titulo, children }) {
  return (
    <button ref={refBtn} type="button" onClick={onClick} title={titulo} className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12.5px] font-medium bg-ln-accent/10 text-ln-accent ring-1 ring-inset ring-ln-accent/25 hover:bg-ln-accent/15 whitespace-nowrap ${FOCO}`}>
      {children}<ChevronDown className="w-3 h-3 opacity-70" />
    </button>
  )
}

function MenuAgrupar({ valor, onChange }) {
  const { t } = useI18n()
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Chip refBtn={ref} onClick={() => setAberto((x) => !x)} titulo={t('tarefas.barra.agrupar')}><Layers className="w-3.5 h-3.5" /> {rotuloAgrupar(valor)}</Chip>
      <Popover anchorRef={ref} open={aberto} onClose={() => setAberto(false)} width={210}>
        <ListaAgrupar valor={valor} onChange={(v) => { setAberto(false); onChange(v) }} />
      </Popover>
    </>
  )
}

function MenuSubtarefas({ valor, onChange, tipo }) {
  const { t } = useI18n()
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Chip refBtn={ref} onClick={() => setAberto((x) => !x)} titulo={t('tarefas.barra.mostrarSubtarefas')}><ListTree className="w-3.5 h-3.5" /> {rotuloSubtarefas(valor === 'expandidas' && tipo !== 'lista' ? 'recolhidas' : valor)}</Chip>
      <Popover anchorRef={ref} open={aberto} onClose={() => setAberto(false)} width={300}>
        <div className="p-1">
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] text-ln-t4">{t('tarefas.barra.mostrarSubtarefas')}</p>
          <OpcoesSubtarefas valor={valor} tipo={tipo} onChange={(v) => { setAberto(false); onChange(v) }} />
        </div>
      </Popover>
    </>
  )
}

function BuscaIcone({ valor, onChange }) {
  const { t } = useI18n()
  const [aberta, setAberta] = useState(false)
  if (aberta || valor) {
    return (
      <div className="ln-input !h-8 !w-[180px] flex items-center gap-1.5">
        <Search className="w-3.5 h-3.5 text-ln-t4 shrink-0" />
        <input autoFocus value={valor} onChange={(e) => onChange(e.target.value)} onBlur={() => !valor && setAberta(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onChange(''); setAberta(false) } }}
          placeholder={t('tarefas.barra.buscarPeloNome')} aria-label={t('tarefas.barra.buscarTarefaPeloNome')} className="flex-1 min-w-0 bg-transparent outline-none text-xs text-ln-t1 placeholder:text-ln-t4" />
        {valor && <button type="button" onClick={() => { onChange(''); setAberta(false) }} className="text-ln-t4 hover:text-ln-t2" aria-label={t('tarefas.barra.limparBusca')}><X className="w-3 h-3" /></button>}
      </div>
    )
  }
  return <IconeBtn onClick={() => setAberta(true)} titulo={t('tarefas.barra.buscarTarefaPeloNome')}><Search className="w-4 h-4" /></IconeBtn>
}

function MenuResponsaveis({ valor, membros, onChange, bloqueado }) {
  const { t } = useI18n()
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  if (bloqueado) {
    return <span className="inline-flex items-center justify-center h-8 min-w-8 px-1.5 rounded-md text-ln-t4 opacity-50 cursor-not-allowed" title={t('tarefas.barra.respSempreVoce')} aria-label={t('tarefas.barra.respIndisponivel')}><Users className="w-4 h-4" /></span>
  }
  const ativo = valor.length > 0
  const nomes = valor.map((id) => nomeResponsavelFiltro(id, membros))
  return (
    <>
      <IconeBtn refBtn={ref} ativo={ativo} onClick={() => setAberto((x) => !x)} titulo={ativo ? t('tarefas.barra.responsaveisLista', { nomes: nomes.join(', ') }) : t('tarefas.barra.filtrarResponsavel')}>
        <Users className="w-4 h-4" />{ativo && <span className="text-xs font-medium max-w-[110px] truncate">{(nomes[0] || '').split(' ')[0]}{valor.length > 1 ? ` +${valor.length - 1}` : ''}</span>}
      </IconeBtn>
      <Popover anchorRef={ref} open={aberto} onClose={() => setAberto(false)} width={260} align="right">
        <ListaResponsaveis valor={valor} membros={membros} onChange={onChange} />
      </Popover>
    </>
  )
}

function ItemSalvar({ icone, onClick, fechar, atalho, children, desabilitado }) {
  return (
    <button type="button" disabled={desabilitado} onClick={() => { fechar(); onClick() }} className="w-full flex items-center gap-2.5 h-9 px-2.5 rounded-md text-[13px] text-ln-t1 hover:bg-ln-ink/5 disabled:opacity-40 disabled:hover:bg-transparent">
      {createElement(icone, { className: 'w-4 h-4 text-ln-t3' })}<span className="flex-1 text-left">{children}</span>
      {atalho && <span className="text-[11px] text-ln-t4">{atalho}</span>}
    </button>
  )
}

/** Botão dividido do ClickUp: "Salvar visualização" + menu (salvar, salvar como nova, reverter). */
function BotaoSalvar({ podeEditar, onSalvar, onNova, onReverter }) {
  const { t } = useI18n()
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  const fechar = () => setAberto(false)
  return (
    <span className="inline-flex items-center mr-1 rounded-md ring-1 ring-inset ring-ln-orange/40 bg-ln-orange/10 text-ln-orange">
      <button type="button" onClick={podeEditar ? onSalvar : onNova} className={`h-7 pl-2.5 pr-2 text-xs font-medium rounded-l-md hover:bg-ln-orange/15 whitespace-nowrap ${FOCO}`} title={podeEditar ? t('tarefas.barra.salvarVisualizacaoAtalho') : t('tarefas.barra.soQuemCriou')}>
        {podeEditar ? t('tarefas.barra.salvarVisualizacao') : t('tarefas.barra.salvarComoNova')}
      </button>
      <span className="w-px h-4 bg-ln-orange/30" />
      <button ref={ref} type="button" onClick={() => setAberto((x) => !x)} className={`h-7 px-1.5 rounded-r-md hover:bg-ln-orange/15 ${FOCO}`} aria-label={t('tarefas.barra.maisOpcoesSalvar')}>
        {aberto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      <Popover anchorRef={ref} open={aberto} onClose={fechar} width={290} align="right">
        <div className="p-1.5">
          <ItemSalvar fechar={fechar} icone={CircleCheck} onClick={onSalvar} atalho="Ctrl ⏎" desabilitado={!podeEditar}>{t('tarefas.barra.salvarVisualizacao')}</ItemSalvar>
          <ItemSalvar fechar={fechar} icone={CopyPlus} onClick={onNova}>{t('tarefas.barra.salvarComoNovaVisualizacao')}</ItemSalvar>
          <div className="border-t border-ln-ink/[0.06] my-1" />
          <ItemSalvar fechar={fechar} icone={Undo2} onClick={onReverter}>{t('tarefas.barra.reverterAlteracoes')}</ItemSalvar>
        </div>
      </Popover>
    </span>
  )
}

/**
 * config = rascunho da view ativa; onEditar(patch) mexe no rascunho. persistente = o escopo
 * guarda views (pasta, minhas, todas); fora disso não há salvar nem configurações.
 */
export function FerramentasView({
  config, onEditar, alterada, podeEditar, persistente, onSalvar, onSalvarNova, onReverter,
  busca, onBusca, membros, respBloqueado, nFiltros, filtrosAlterados, painel, onPainel,
  modelos, onUsarModelo, onGerenciarModelos, onNovaTarefa,
}) {
  const { t } = useI18n()
  return (
    <div className="h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-ln-ink/5">
      <div className="flex items-center gap-1.5 min-w-0">
        <MenuAgrupar valor={config.agrupar} onChange={(agrupar) => onEditar({ agrupar })} />
        <MenuSubtarefas valor={config.subtarefas} tipo={config.tipo} onChange={(subtarefas) => onEditar({ subtarefas })} />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {persistente && alterada && <BotaoSalvar podeEditar={podeEditar} onSalvar={onSalvar} onNova={onSalvarNova} onReverter={onReverter} />}
        <BuscaIcone valor={busca} onChange={onBusca} />
        <IconeBtn ativo={nFiltros > 0 || painel === 'filtros'} onClick={() => onPainel(painel === 'filtros' ? null : 'filtros')} titulo={nFiltros ? t('tarefas.barra.filtrosCondicoes', { count: nFiltros }) : t('tarefas.barra.filtros')}>
          <span className="relative inline-flex"><ListFilter className="w-4 h-4" />{filtrosAlterados && <i className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-ln-orange" />}</span>
          {nFiltros > 0 && <span className="text-xs font-semibold tabular">{nFiltros}</span>}
        </IconeBtn>
        <MenuResponsaveis valor={config.responsaveis} membros={membros} bloqueado={respBloqueado} onChange={(responsaveis) => onEditar({ responsaveis })} />
        <IconeBtn ativo={config.concluidas} onClick={() => onEditar({ concluidas: !config.concluidas })} titulo={config.concluidas ? t('tarefas.barra.esconderConcluidas') : t('tarefas.barra.mostrarConcluidas')}><CircleCheck className="w-4 h-4" /></IconeBtn>
        {persistente && (<>
          <span className="w-px h-5 bg-ln-line mx-1" />
          <IconeBtn ativo={painel === 'config'} onClick={() => onPainel(painel === 'config' ? null : 'config')} titulo={t('tarefas.barra.configuracoesVisualizacao')}><Settings className="w-4 h-4" /></IconeBtn>
        </>)}
        <span className="inline-flex items-stretch ml-1">
          <button type="button" onClick={onNovaTarefa} className={`ln-primary !h-8 !rounded-r-none ${FOCO}`} title={t('tarefas.barra.novaTarefaAtalho')}><Plus className="w-3.5 h-3.5" /> {t('tarefas.barra.tarefa')}</button>
          <ModelosMenu
            modelos={modelos} titulo={t('tarefas.barra.criarDeTemplate')} onUsar={onUsarModelo} onGerenciar={onGerenciarModelos}
            classeBotao="ln-primary !h-8 !px-1.5 !rounded-l-none border-l border-white/25" render={<ChevronDown className="w-3.5 h-3.5" />}
          />
        </span>
      </div>
    </div>
  )
}
