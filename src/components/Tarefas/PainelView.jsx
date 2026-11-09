// Sidebars da visualização (engrenagem da barra e "+ Visualização"):
//   PainelConfigView  nome, tipo, colunas (Lista), subtarefas, agrupamento e filtros, quem vê; tudo grava na
//                     hora (sem botão de confirmar). Padrão: qualquer um edita, não exclui.
//   PainelNovaView    cria uma visualização a partir do que está na tela.
import { useRef, useState } from 'react'
import { Settings, X, Copy, Trash2, Lock, Globe, EyeOff, ChevronDown, ListFilter } from 'lucide-react'
import { Popover, FOCO } from './Campos'
import { TIPOS_VIEW, rotuloTipo, rotuloSubtarefas, nomeResponsavelFiltro, patchColunas, colunasVisiveis, COLUNAS_LISTA } from '../../lib/viewsTarefas'
import { contarRegras } from '../../lib/filtrosTarefas'
import { rotuloAgrupamento } from '../../lib/tarefas'
import { useI18n, t as tr } from '../../i18n'
import { iconeTipo, ListaAgrupar, ListaResponsaveis, OpcoesSubtarefas } from './BarraViews'
import EditorColunas from './ColunasLista'

const rotuloAgrupar = rotuloAgrupamento
const nomesDe = (ids, membros) => (ids.length ? ids.map((id) => nomeResponsavelFiltro(id, membros)).join(', ') : tr('tarefas.painelView.todos'))

export function CabecalhoPainel({ titulo, icone = Settings, onFechar, extra }) {
  const { t } = useI18n()
  const Icone = icone
  return (
    <div className="h-12 shrink-0 flex items-center justify-between gap-2 px-4 border-b border-ln-ink/[0.06]">
      <span className="flex items-center gap-2 text-[13px] font-semibold text-ln-t1 min-w-0"><Icone className="w-4 h-4 text-ln-t3 shrink-0" /><span className="truncate">{titulo}</span></span>
      <span className="flex items-center gap-2 shrink-0">{extra}<button type="button" onClick={onFechar} className="ln-iconbtn !w-7 !h-7" aria-label={t('comum.fechar')} title={t('tarefas.painelView.fecharEsc')}><X className="w-4 h-4" /></button></span>
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
      {TIPOS_VIEW.map(({ key }) => (
        <button key={key} type="button" disabled={fixo && valor !== key} onClick={() => onChange(key)} className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[12px] transition-colors disabled:opacity-40 ${valor === key ? 'border-ln-accent/50 bg-ln-accent/10 text-ln-accent' : 'border-ln-ink/[0.08] text-ln-t2 enabled:hover:bg-ln-ink/[0.04]'}`}>
          {iconeTipo(key, 'w-4 h-4')}{rotuloTipo(key)}
        </button>
      ))}
    </div>
  )
}

function EscolhaAcesso({ publica, onChange, desabilitado }) {
  const { t: tt } = useI18n()
  const opcoes = [[true, Globe, tt('tarefas.painelView.compartilhada'), tt('tarefas.painelView.compartilhadaDesc')], [false, EyeOff, tt('tarefas.painelView.soParaMim'), tt('tarefas.painelView.soParaMimDesc')]]
  return (
    <div className="flex flex-col gap-1">
      {opcoes.map(([v, Icone, t, d]) => (
        <button key={String(v)} type="button" disabled={desabilitado} onClick={() => onChange(v)} className={`flex items-start gap-2.5 p-2 rounded-lg border text-left disabled:cursor-default ${publica === v ? 'border-ln-accent/50 bg-ln-accent/[0.06]' : 'border-ln-ink/[0.08] enabled:hover:bg-ln-ink/[0.03] disabled:opacity-50'}`}>
          <Icone className={`w-4 h-4 mt-0.5 ${publica === v ? 'text-ln-accent' : 'text-ln-t3'}`} />
          <span className="flex flex-col"><span className="text-[13px] text-ln-t1">{t}</span><span className="text-[11px] text-ln-t4">{d}</span></span>
        </button>
      ))}
    </div>
  )
}

/**
 * v = view ativa (viewsDoEscopo), config = rascunho na tela. onEditar(patch) grava config;
 * onMeta(patch) grava nome/acesso. Sem podeEditar, as mudanças valem só na tela. Compartilhada:
 * qualquer pessoa edita nome e configuração, mas quem vê e excluir são só do dono (souDono).
 */
export function PainelConfigView({ v, config, podeEditar, souDono, membros, respBloqueado, onEditar, onMeta, onAbrirFiltros, onDuplicar, onExcluir, onFechar }) {
  const { t } = useI18n()
  // a padrão sem nome personalizado mostra o rótulo traduzido; só um nome digitado vai para o banco
  const nomeAtual = v.rotulo ?? v.nome
  const [nome, setNome] = useState(nomeAtual)
  const [confirmar, setConfirmar] = useState(false)
  const salvarNome = () => { const n = nome.trim(); if (n && n !== nomeAtual) onMeta({ nome: n }); else setNome(nomeAtual) }
  const nFiltros = contarRegras(config.filtros)
  return (
    <>
      <CabecalhoPainel titulo={t('tarefas.painelView.configuracoes')} onFechar={onFechar} />
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5">
        {v.padrao && <p className="flex items-start gap-2 text-xs text-ln-t3 bg-ln-ink/[0.04] rounded-lg px-3 py-2"><Lock className="w-3.5 h-3.5 mt-px shrink-0" />{v.pessoal ? t('tarefas.painelView.padraoPessoal') : t('tarefas.painelView.padraoTime')}</p>}
        {!v.padrao && podeEditar && !souDono && <p className="text-xs text-ln-t3 bg-ln-ink/[0.04] rounded-lg px-3 py-2">{t('tarefas.painelView.compartilhadaOutra')}</p>}
        {!podeEditar && <p className="text-xs text-ln-t3 bg-ln-ink/[0.04] rounded-lg px-3 py-2">{t('tarefas.painelView.criadaOutra')}</p>}

        <Bloco titulo={t('tarefas.painelView.nome')}>
          <input value={nome} disabled={!podeEditar} onChange={(e) => setNome(e.target.value)} onBlur={salvarNome} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} className="ln-input !h-9 w-full disabled:opacity-70" aria-label={t('tarefas.painelView.nomeAria')} />
        </Bloco>
        <Bloco titulo={t('tarefas.painelView.visualizacao')}>
          <EscolhaTipo valor={config.tipo} onChange={(tipo) => onEditar({ tipo })} fixo={v.padrao} />
          {v.padrao && <p className="text-[11px] text-ln-t4">{t('tarefas.painelView.tipoFixo')}</p>}
        </Bloco>
        {config.tipo === 'lista' && (
          <Bloco titulo={t('tarefas.painelView.colunas')}>
            <div className="rounded-lg border border-ln-ink/[0.08] p-1.5"><EditorColunas valor={config.colunas} onChange={(colunas) => onEditar(patchColunas(colunas, config))} /></div>
          </Bloco>
        )}
        <Bloco titulo={t('tarefas.painelView.subtarefas')}>
          <div className="rounded-lg border border-ln-ink/[0.08] p-1"><OpcoesSubtarefas valor={config.subtarefas} tipo={config.tipo} onChange={(subtarefas) => onEditar({ subtarefas })} /></div>
        </Bloco>
        <Bloco titulo={t('tarefas.painelView.agrupamentoFiltros')}>
          <div className="flex flex-col gap-1.5">
            <CampoEditavel rotulo={t('tarefas.painelView.agruparPor')} valor={rotuloAgrupar(config.agrupar)} largura={210}>
              {(fechar) => <ListaAgrupar valor={config.agrupar} onChange={(agrupar) => { fechar(); onEditar({ agrupar }) }} />}
            </CampoEditavel>
            {respBloqueado ? (
              <span className="flex items-center justify-between gap-3 h-9 px-3 rounded-lg border border-ln-ink/[0.08] text-[13px] opacity-60 cursor-not-allowed" title={t('tarefas.barra.respSempreVoce')}>
                <span className="text-ln-t3">{t('tarefas.painelView.responsaveis')}</span><span className="text-ln-t2">{t('tarefas.painelView.voce')}</span>
              </span>
            ) : (
              <CampoEditavel rotulo={t('tarefas.painelView.responsaveis')} valor={nomesDe(config.responsaveis, membros)} largura={260}>
                {() => <ListaResponsaveis valor={config.responsaveis} membros={membros} onChange={(responsaveis) => onEditar({ responsaveis })} />}
              </CampoEditavel>
            )}
            <button type="button" onClick={() => onEditar({ concluidas: !config.concluidas })} className={`flex items-center justify-between h-9 px-3 rounded-lg border border-ln-ink/[0.08] text-[13px] hover:bg-ln-ink/[0.03] ${FOCO}`}>
              <span className="text-ln-t3">{t('tarefas.painelView.mostrarConcluidas')}</span><Interruptor ligado={config.concluidas} />
            </button>
            <button type="button" onClick={onAbrirFiltros} className={`flex items-center justify-between h-9 px-3 rounded-lg border border-ln-ink/[0.08] text-[13px] hover:bg-ln-ink/[0.03] ${FOCO}`}>
              <span className="flex items-center gap-2 text-ln-t3"><ListFilter className="w-3.5 h-3.5" />{t('tarefas.painelView.filtrosAvancados')}</span>
              <span className="text-ln-t1">{nFiltros ? t('tarefas.painelView.condicoes', { count: nFiltros }) : t('comum.nenhum')} <span className="text-ln-accent ml-1">{t('comum.editar')}</span></span>
            </button>
          </div>
          {podeEditar && <p className="text-[11px] text-ln-t4">{t('tarefas.painelView.jaFicaSalvo')}</p>}
        </Bloco>
        {!v.padrao && (
          <Bloco titulo={t('tarefas.painelView.quemVe')}>
            <EscolhaAcesso publica={v.acesso === 'publica'} onChange={(p) => onMeta({ acesso: p ? 'publica' : 'privada' })} desabilitado={!souDono} />
          </Bloco>
        )}
      </div>
      <div className="shrink-0 p-3 border-t border-ln-ink/[0.06] flex items-center gap-1.5">
        <button type="button" onClick={onDuplicar} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] text-ln-t2 hover:bg-ln-ink/5 ${FOCO}`}><Copy className="w-3.5 h-3.5" /> {t('tarefas.painelView.duplicar')}</button>
        {!v.padrao && souDono && (confirmar
          ? <span className="ml-auto flex items-center gap-1.5 text-xs text-ln-t3">{t('tarefas.painelView.excluirParaTodos')}<button type="button" onClick={() => setConfirmar(false)} className="ln-pill">{t('comum.nao')}</button><button type="button" onClick={onExcluir} className="h-7 px-2.5 rounded-md text-xs font-medium bg-ln-red text-white">{t('comum.excluir')}</button></span>
          : <button type="button" onClick={() => setConfirmar(true)} className={`ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] text-ln-red hover:bg-ln-red/10 ${FOCO}`}><Trash2 className="w-3.5 h-3.5" /> {t('comum.excluir')}</button>)}
      </div>
    </>
  )
}

/** Cria uma visualização a partir do rascunho na tela; a de origem continua como estava. */
export function PainelNovaView({ config, origem, membros, onCriar, onFechar }) {
  const { t } = useI18n()
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
      <CabecalhoPainel titulo={t('tarefas.painelView.novaVisualizacao')} onFechar={onFechar} />
      <form className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5" onSubmit={enviar}>
        <p className="text-xs text-ln-t3 bg-ln-ink/[0.04] rounded-lg px-3 py-2">{t('tarefas.painelView.parteDeA')}<strong className="text-ln-t2">{origem}</strong>{t('tarefas.painelView.parteDeB', { origem })}</p>
        <Bloco titulo={t('tarefas.painelView.nome')}><input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t('tarefas.painelView.exemploNome')} className="ln-input !h-9 w-full" aria-label={t('tarefas.painelView.nomeAria')} /></Bloco>
        <Bloco titulo={t('tarefas.painelView.leva')}>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
            <dt className="text-ln-t3">{t('tarefas.painelView.visualizacao')}</dt><dd className="text-ln-t1">{rotuloTipo(config.tipo)}</dd>
            <dt className="text-ln-t3">{t('tarefas.painelView.agruparPor')}</dt><dd className="text-ln-t1">{rotuloAgrupar(config.agrupar)}</dd>
            <dt className="text-ln-t3">{t('tarefas.painelView.subtarefas')}</dt><dd className="text-ln-t1">{rotuloSubtarefas(config.subtarefas)}</dd>
            <dt className="text-ln-t3">{t('tarefas.painelView.responsaveis')}</dt><dd className="text-ln-t1 truncate">{nomesDe(config.responsaveis, membros)}</dd>
            <dt className="text-ln-t3">{t('tarefas.painelView.concluidas')}</dt><dd className="text-ln-t1">{config.concluidas ? t('tarefas.painelView.mostrar') : t('tarefas.painelView.esconder')}</dd>
            {config.tipo === 'lista' && <><dt className="text-ln-t3">{t('tarefas.painelView.colunas')}</dt><dd className="text-ln-t1">{t('tarefas.painelView.visiveis', { n: colunasVisiveis(config.colunas).length, total: COLUNAS_LISTA.length })}</dd></>}
            <dt className="text-ln-t3">{t('tarefas.painelView.filtros')}</dt><dd className="text-ln-t1">{nFiltros ? t('tarefas.painelView.condicoes', { count: nFiltros }) : t('comum.nenhum')}</dd>
          </dl>
        </Bloco>
        <Bloco titulo={t('tarefas.painelView.quemVe')}><EscolhaAcesso publica={publica} onChange={setPublica} /></Bloco>
        <div className="mt-auto flex justify-end gap-1.5">
          <button type="button" onClick={onFechar} className="ln-pill">{t('comum.cancelar')}</button>
          <button type="submit" disabled={!ok} className="ln-primary !h-8 disabled:opacity-50">{t('tarefas.painelView.criarVisualizacao')}</button>
        </div>
      </form>
    </>
  )
}
