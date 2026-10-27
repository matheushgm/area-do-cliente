// Sidebars da visualização (engrenagem da barra e "+ Visualização"):
//   PainelConfigView  nome, tipo, colunas (Lista), subtarefas, agrupamento e filtros, quem vê; tudo grava na
//                     hora (sem botão de confirmar). Padrão: qualquer um edita, não exclui.
//   PainelNovaView    cria uma visualização a partir do que está na tela.
import { useRef, useState } from 'react'
import { Settings, X, Copy, Trash2, Lock, Globe, EyeOff, ChevronDown, ListFilter } from 'lucide-react'
import { Popover, FOCO } from './Campos'
import { TIPOS_VIEW, rotuloTipo, rotuloSubtarefas, nomeResponsavelFiltro, patchColunas, colunasVisiveis, COLUNAS_LISTA } from '../../lib/viewsTarefas'
import { contarRegras } from '../../lib/filtrosTarefas'
import { AGRUPAMENTOS } from '../../lib/tarefas'
import { iconeTipo, ListaAgrupar, ListaResponsaveis, OpcoesSubtarefas } from './BarraViews'
import EditorColunas from './ColunasLista'

const rotuloAgrupar = (v) => AGRUPAMENTOS.find((a) => a.value === v)?.label || v
const nomesDe = (ids, membros) => (ids.length ? ids.map((id) => nomeResponsavelFiltro(id, membros)).join(', ') : 'Todos')

export function CabecalhoPainel({ titulo, icone = Settings, onFechar, extra }) {
  const Icone = icone
  return (
    <div className="h-12 shrink-0 flex items-center justify-between gap-2 px-4 border-b border-ln-ink/[0.06]">
      <span className="flex items-center gap-2 text-[13px] font-semibold text-ln-t1 min-w-0"><Icone className="w-4 h-4 text-ln-t3 shrink-0" /><span className="truncate">{titulo}</span></span>
      <span className="flex items-center gap-2 shrink-0">{extra}<button type="button" onClick={onFechar} className="ln-iconbtn !w-7 !h-7" aria-label="Fechar" title="Fechar (Esc)"><X className="w-4 h-4" /></button></span>
    </div>
  )
}

function Bloco({ titulo, children }) {
  return <section className="flex flex-col gap-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-ln-t4">{titulo}</p>{children}</section>
}

function Interruptor({ ligado }) {
  return <span className={`w-8 h-[18px] rounded-full p-0.5 transition-colors shrink-0 ${ligado ? 'bg-ln-accent' : 'bg-ln-ink/15'}`}><span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${ligado ? 'translate-x-3.5' : ''}`} /></span>
}

/** Linha "rótulo · valor" que abre um popover para editar. */
function CampoEditavel({ rotulo, valor, largura = 230, children }) {
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button ref={ref} type="button" onClick={() => setAberto((x) => !x)} className={`flex items-center justify-between gap-3 h-9 px-3 rounded-lg border border-ln-ink/[0.08] text-[13px] hover:bg-ln-ink/[0.03] ${FOCO}`}>
        <span className="text-ln-t3 shrink-0">{rotulo}</span>
        <span className="flex items-center gap-1 text-ln-t1 min-w-0"><span className="truncate">{valor}</span><ChevronDown className="w-3 h-3 text-ln-t4 shrink-0" /></span>
      </button>
      <Popover anchorRef={ref} open={aberto} onClose={() => setAberto(false)} width={largura} align="right">
        {children(() => setAberto(false))}
      </Popover>
    </>
  )
}

function EscolhaTipo({ valor, onChange, fixo }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {TIPOS_VIEW.map(({ key, label }) => (
        <button key={key} type="button" disabled={fixo && valor !== key} onClick={() => onChange(key)} className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[12px] transition-colors disabled:opacity-40 ${valor === key ? 'border-ln-accent/50 bg-ln-accent/10 text-ln-accent' : 'border-ln-ink/[0.08] text-ln-t2 enabled:hover:bg-ln-ink/[0.04]'}`}>
          {iconeTipo(key, 'w-4 h-4')}{label}
        </button>
      ))}
    </div>
  )
}

function EscolhaAcesso({ publica, onChange, desabilitado }) {
  const opcoes = [[true, Globe, 'Compartilhada com o time', 'Todo mundo vê esta aba'], [false, EyeOff, 'Só para mim', 'Só você vê esta aba']]
  return (
    <div className="flex flex-col gap-1">
      {opcoes.map(([v, Icone, t, d]) => (
        <button key={t} type="button" disabled={desabilitado} onClick={() => onChange(v)} className={`flex items-start gap-2.5 p-2 rounded-lg border text-left disabled:cursor-default ${publica === v ? 'border-ln-accent/50 bg-ln-accent/[0.06]' : 'border-ln-ink/[0.08] enabled:hover:bg-ln-ink/[0.03] disabled:opacity-50'}`}>
          <Icone className={`w-4 h-4 mt-0.5 ${publica === v ? 'text-ln-accent' : 'text-ln-t3'}`} />
          <span className="flex flex-col"><span className="text-[13px] text-ln-t1">{t}</span><span className="text-[11px] text-ln-t4">{d}</span></span>
        </button>
      ))}
    </div>
  )
}

/**
 * v = view ativa (viewsDoEscopo), config = rascunho na tela. onEditar(patch) grava config;
 * onMeta(patch) grava nome/acesso. Sem podeEditar, as mudanças valem só na tela.
 */
export function PainelConfigView({ v, config, podeEditar, membros, respBloqueado, onEditar, onMeta, onAbrirFiltros, onDuplicar, onExcluir, onFechar }) {
  const [nome, setNome] = useState(v.nome)
  const [confirmar, setConfirmar] = useState(false)
  const salvarNome = () => { const n = nome.trim(); if (n && n !== v.nome) onMeta({ nome: n }); else setNome(v.nome) }
  const nFiltros = contarRegras(config.filtros)
  return (
    <>
      <CabecalhoPainel titulo="Configurações da visualização" onFechar={onFechar} />
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5">
        {v.padrao && <p className="flex items-start gap-2 text-xs text-ln-t3 bg-ln-ink/[0.04] rounded-lg px-3 py-2"><Lock className="w-3.5 h-3.5 mt-px shrink-0" />{v.pessoal ? 'Visualização padrão: estes ajustes são só seus (cada pessoa tem a sua em Minhas tarefas) e ela não pode ser excluída.' : 'Visualização padrão: qualquer pessoa do time ajusta, mas ela não pode ser excluída.'}</p>}
        {!podeEditar && <p className="text-xs text-ln-t3 bg-ln-ink/[0.04] rounded-lg px-3 py-2">Criada por outra pessoa. O que você mudar aqui vale só na sua tela; para guardar, use “Salvar como nova visualização” na barra.</p>}

        <Bloco titulo="Nome">
          <input value={nome} disabled={!podeEditar} onChange={(e) => setNome(e.target.value)} onBlur={salvarNome} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} className="ln-input !h-9 w-full disabled:opacity-70" aria-label="Nome da visualização" />
        </Bloco>
        <Bloco titulo="Visualização">
          <EscolhaTipo valor={config.tipo} onChange={(tipo) => onEditar({ tipo })} fixo={v.padrao} />
          {v.padrao && <p className="text-[11px] text-ln-t4">Nas padrão o tipo é fixo; para outro tipo, crie uma visualização.</p>}
        </Bloco>
        {config.tipo === 'lista' && (
          <Bloco titulo="Colunas">
            <div className="rounded-lg border border-ln-ink/[0.08] p-1.5"><EditorColunas valor={config.colunas} onChange={(colunas) => onEditar(patchColunas(colunas, config))} /></div>
          </Bloco>
        )}
        <Bloco titulo="Subtarefas">
          <div className="rounded-lg border border-ln-ink/[0.08] p-1"><OpcoesSubtarefas valor={config.subtarefas} tipo={config.tipo} onChange={(subtarefas) => onEditar({ subtarefas })} /></div>
        </Bloco>
        <Bloco titulo="Agrupamento e filtros">
          <div className="flex flex-col gap-1.5">
            <CampoEditavel rotulo="Agrupar por" valor={rotuloAgrupar(config.agrupar)} largura={210}>
              {(fechar) => <ListaAgrupar valor={config.agrupar} onChange={(agrupar) => { fechar(); onEditar({ agrupar }) }} />}
            </CampoEditavel>
            {respBloqueado ? (
              <span className="flex items-center justify-between gap-3 h-9 px-3 rounded-lg border border-ln-ink/[0.08] text-[13px] opacity-60 cursor-not-allowed" title="Em Minhas tarefas o responsável é sempre você">
                <span className="text-ln-t3">Responsáveis</span><span className="text-ln-t2">Você</span>
              </span>
            ) : (
              <CampoEditavel rotulo="Responsáveis" valor={nomesDe(config.responsaveis, membros)} largura={260}>
                {() => <ListaResponsaveis valor={config.responsaveis} membros={membros} onChange={(responsaveis) => onEditar({ responsaveis })} />}
              </CampoEditavel>
            )}
            <button type="button" onClick={() => onEditar({ concluidas: !config.concluidas })} className={`flex items-center justify-between h-9 px-3 rounded-lg border border-ln-ink/[0.08] text-[13px] hover:bg-ln-ink/[0.03] ${FOCO}`}>
              <span className="text-ln-t3">Mostrar concluídas</span><Interruptor ligado={config.concluidas} />
            </button>
            <button type="button" onClick={onAbrirFiltros} className={`flex items-center justify-between h-9 px-3 rounded-lg border border-ln-ink/[0.08] text-[13px] hover:bg-ln-ink/[0.03] ${FOCO}`}>
              <span className="flex items-center gap-2 text-ln-t3"><ListFilter className="w-3.5 h-3.5" />Filtros avançados</span>
              <span className="text-ln-t1">{nFiltros ? `${nFiltros} condição${nFiltros === 1 ? '' : 'ões'}` : 'Nenhum'} <span className="text-ln-accent ml-1">Editar</span></span>
            </button>
          </div>
          {podeEditar && <p className="text-[11px] text-ln-t4">O que você muda aqui já fica salvo na visualização.</p>}
        </Bloco>
        {!v.padrao && (
          <Bloco titulo="Quem vê">
            <EscolhaAcesso publica={v.acesso === 'publica'} onChange={(p) => onMeta({ acesso: p ? 'publica' : 'privada' })} desabilitado={!podeEditar} />
          </Bloco>
        )}
      </div>
      <div className="shrink-0 p-3 border-t border-ln-ink/[0.06] flex items-center gap-1.5">
        <button type="button" onClick={onDuplicar} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] text-ln-t2 hover:bg-ln-ink/5 ${FOCO}`}><Copy className="w-3.5 h-3.5" /> Duplicar</button>
        {!v.padrao && podeEditar && (confirmar
          ? <span className="ml-auto flex items-center gap-1.5 text-xs text-ln-t3">Excluir para todos?<button type="button" onClick={() => setConfirmar(false)} className="ln-pill">Não</button><button type="button" onClick={onExcluir} className="h-7 px-2.5 rounded-md text-xs font-medium bg-ln-red text-white">Excluir</button></span>
          : <button type="button" onClick={() => setConfirmar(true)} className={`ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] text-ln-red hover:bg-ln-red/10 ${FOCO}`}><Trash2 className="w-3.5 h-3.5" /> Excluir</button>)}
      </div>
    </>
  )
}

/** Cria uma visualização a partir do rascunho na tela; a de origem continua como estava. */
export function PainelNovaView({ config, origem, membros, onCriar, onFechar }) {
  const [nome, setNome] = useState('')
  const [publica, setPublica] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const ok = nome.trim().length > 0 && !salvando
  const nFiltros = contarRegras(config.filtros)
  async function enviar(e) {
    e.preventDefault()
    if (!ok) return
    setSalvando(true)
    await onCriar({ nome: nome.trim(), publica })
    setSalvando(false)
  }
  return (
    <>
      <CabecalhoPainel titulo="Nova visualização" onFechar={onFechar} />
      <form className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5" onSubmit={enviar}>
        <p className="text-xs text-ln-t3 bg-ln-ink/[0.04] rounded-lg px-3 py-2">Parte do que está na tela em <strong className="text-ln-t2">{origem}</strong>. “{origem}” continua como estava.</p>
        <Bloco titulo="Nome"><input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Atrasadas do design" className="ln-input !h-9 w-full" aria-label="Nome da visualização" /></Bloco>
        <Bloco titulo="Leva">
          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
            <dt className="text-ln-t3">Visualização</dt><dd className="text-ln-t1">{rotuloTipo(config.tipo)}</dd>
            <dt className="text-ln-t3">Agrupar por</dt><dd className="text-ln-t1">{rotuloAgrupar(config.agrupar)}</dd>
            <dt className="text-ln-t3">Subtarefas</dt><dd className="text-ln-t1">{rotuloSubtarefas(config.subtarefas)}</dd>
            <dt className="text-ln-t3">Responsáveis</dt><dd className="text-ln-t1 truncate">{nomesDe(config.responsaveis, membros)}</dd>
            <dt className="text-ln-t3">Concluídas</dt><dd className="text-ln-t1">{config.concluidas ? 'Mostrar' : 'Esconder'}</dd>
            {config.tipo === 'lista' && <><dt className="text-ln-t3">Colunas</dt><dd className="text-ln-t1">{colunasVisiveis(config.colunas).length} de {COLUNAS_LISTA.length} visíveis</dd></>}
            <dt className="text-ln-t3">Filtros</dt><dd className="text-ln-t1">{nFiltros ? `${nFiltros} condição${nFiltros === 1 ? '' : 'ões'}` : 'Nenhum'}</dd>
          </dl>
        </Bloco>
        <Bloco titulo="Quem vê"><EscolhaAcesso publica={publica} onChange={setPublica} /></Bloco>
        <div className="mt-auto flex justify-end gap-1.5">
          <button type="button" onClick={onFechar} className="ln-pill">Cancelar</button>
          <button type="submit" disabled={!ok} className="ln-primary !h-8 disabled:opacity-50">Criar visualização</button>
        </div>
      </form>
    </>
  )
}
