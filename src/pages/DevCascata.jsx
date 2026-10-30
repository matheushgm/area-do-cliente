// Harness DEV (só import.meta.env.DEV): o template "Landing Page" aplicado a um cliente fictício,
// em memória, para testar o replanejamento em cascata sem login e sem tocar no banco nem no
// ClickUp. Mexer numa data (na linha ou no painel) passa pelo mesmo useCascata do VertaTask.
// "Hoje simulado" troca o relógio da página (Date) para ver atrasadas e os rótulos "há N dias";
// sair da página devolve o relógio de verdade. "Mudança do ClickUp" grava a data sem a cascata, como
// chega pelo webhook, para ver o aviso de dependência no bloco Entrega.
import { useState, useMemo, useCallback, useEffect } from 'react'
import ListaView from '../components/Tarefas/ListaView'
import TarefaPanel from '../components/Tarefas/TarefaPanel'
import GanttView from '../components/Tarefas/GanttView'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { useConfirmar } from '../components/Tarefas/Confirmacao'
import { useCascata } from '../hooks/useCascata'
import EntregaPainel from '../components/Tarefas/EntregaPainel'
import { STATUSES_PADRAO, agruparItens, deInputDate, paraData, inicioDoDia } from '../lib/tarefas'
import { somarDiasUteis, proximoDiaUtil } from '../lib/templates'
import { hojeISO } from '../lib/vertatask'

// Mesmo desenho do template "Landing Page" do banco (30/10/2026): cadeia de 14 subtarefas
// [título, departamento, início D+N, vencimento D+N]
const SUBS = [
  ['Criar o Briefing', 'Account Manager', null, 0],
  ['Coletar a referência', 'Account Manager', null, 0],
  ['Criar a Copy na área do cliente', 'Account Manager', 0, 1],
  ['Aprovar Copy com o cliente', 'Cliente', 1, 2],
  ['Criar landing page no claude', 'Designer', 2, 3],
  ['Aprovar Layout em PDF da landing page com o cliente', 'Cliente', null, 3],
  ['Subir html para pasta no drive', 'Designer', null, 4],
  ['Subir html para o lovable', 'Designer', null, 4],
  ['Apontar o domínio', 'Tecnologia', null, 4],
  ['Fazer integração com a BD', 'Tecnologia', null, 4],
  ['Conferir se o lead está caindo na planilha e crm', 'Tecnologia', null, 4],
  ['Conferir Traqueamento', 'Gestor de tráfego', null, 4],
  ['Enviar para o cliente', 'Account Manager', null, 4],
  ['Subir a página para a campanha', 'Gestor de tráfego', 4, 5],
]
const MEMBROS = [{ id: 'eu', name: 'Pessoa de teste', avatar: 'PT' }]
const LISTA = { id: 'lista-dev', nome: 'Geral', pasta_id: 'pasta-dev', statuses: STATUSES_PADRAO }

const CHAVE_HOJE = 'dev.cascata.hoje'
const CHAVE_INICIO = 'dev.cascata.inicio'
const ler = (k) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const gravarLocal = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k) } catch { /* sem storage */ } }

// O relógio de verdade fica guardado; "hoje simulado" = Date deslocado em dias inteiros (a hora segue andando).
const DataReal = globalThis.__dataRealDev || (globalThis.__dataRealDev = Date)
function simularHoje(iso) {
  if (!iso) { globalThis.Date = DataReal; return }
  const meiaNoite = new DataReal(); meiaNoite.setHours(0, 0, 0, 0)
  const desloc = new DataReal(`${iso}T00:00:00`).getTime() - meiaNoite.getTime()
  if (Number.isNaN(desloc)) return
  class DataSimulada extends DataReal {
    constructor(...a) { if (a.length) super(...a); else super(DataReal.now() + desloc) }
    static now() { return DataReal.now() + desloc }
  }
  globalThis.Date = DataSimulada
}

function montar(inicioISO) {
  const ini = proximoDiaUtil(inicioISO || hojeISO())
  const dia = (n) => (n == null ? null : deInputDate(somarDiasUteis(ini, n)))
  const base = { lista_id: LISTA.id, status: 'to do', status_tipo: 'open', responsaveis: [], arquivada: false, created_at: new Date().toISOString() }
  const itens = { P: { ...base, id: 'P', parent_id: null, titulo: 'Landing Page · Cliente de teste', data_inicio: dia(0), data_vencimento: dia(5), posicao: 0 } }
  SUBS.forEach(([titulo, dep, i, v], k) => { itens[`S${k}`] = { ...base, id: `S${k}`, parent_id: 'P', titulo, departamento: [dep], data_inicio: dia(i), data_vencimento: dia(v), posicao: k } })
  const relacoes = SUBS.slice(1).map((_, k) => ({ tarefa_id: `S${k}`, relacionada_id: `S${k + 1}`, tipo: 'bloqueia' }))
  return { itens, relacoes }
}

export default function DevCascata() {
  const [hoje, setHoje] = useState(() => { const v = ler(CHAVE_HOJE); simularHoje(v); return v })
  const [inicio, setInicio] = useState(() => ler(CHAVE_INICIO))
  const [viaClickup, setViaClickup] = useState(false)
  const [{ itens, relacoes }, setDados] = useState(() => montar(inicio))
  // instala de novo depois do desmonte do StrictMode e devolve o relógio de verdade ao sair
  useEffect(() => { simularHoje(hoje); return () => simularHoje(null) }, [hoje])
  const mudarHoje = (v) => { simularHoje(v); gravarLocal(CHAVE_HOJE, v); setHoje(v) }
  const mudarInicio = (v) => { gravarLocal(CHAVE_INICIO, v); setInicio(v); setDados(montar(v)); setAbertaId(null) }
  const recomecar = () => { setDados(montar(inicio)); setAbertaId(null) }
  const [abertaId, setAbertaId] = useState(null)
  const [confirmar, dialogo] = useConfirmar()
  const { toast, showToast } = useToast()

  const gravar = useCallback(async (id, patch) => {
    console.log('gravar', id, patch)
    setDados((d) => ({ ...d, itens: { ...d.itens, [id]: { ...d.itens[id], ...patch } } }))
    return {}
  }, [])
  const carregarGrafo = useCallback(async () => ({ itens: new Map(Object.entries(itens)), relacoes }), [itens, relacoes])
  const comCascata = useCascata({ carregarGrafo, gravar, confirmar, avisar: showToast })
  const atualizar = viaClickup ? gravar : comCascata

  const lista = Object.values(itens)
  const filhosDe = useMemo(() => {
    const m = new Map()
    for (const i of lista) if (i.parent_id) { if (!m.has(i.parent_id)) m.set(i.parent_id, []); m.get(i.parent_id).push(i) }
    for (const v of m.values()) v.sort((a, b) => a.posicao - b.posicao)
    return m
  }, [lista])
  const topo = lista.filter((i) => !i.parent_id)
  const grupos = agruparItens(topo, 'status', { statuses: STATUSES_PADRAO })
  const membrosMap = new Map(MEMBROS.map((m) => [m.id, m]))
  const mudarStatus = (it, s) => gravar(it.id, { status: s.key, status_tipo: s.tipo || 'custom', data_conclusao: s.tipo === 'closed' ? new Date().toISOString() : null })
  const ctx = {
    statuses: STATUSES_PADRAO, membros: MEMBROS, membrosMap, itensMap: itens, listaPadraoId: LISTA.id, agrupar: 'status',
    contagemComentarios: {}, selecionadaId: abertaId, onAbrir: setAbertaId, onAtualizar: atualizar, onMudarStatus: mudarStatus,
    onCriar: async () => ({}), listas: [LISTA], pastas: [], projetos: [], ciclos: [], expandirTudo: true,
    nomePai: (it) => (it.parent_id ? itens[it.parent_id]?.titulo : null),
  }
  const meiaNoite = inicioDoDia(new Date())
  const atrasadas = lista.filter((i) => i.status_tipo !== 'closed' && paraData(i.data_vencimento) && paraData(i.data_vencimento) < meiaNoite).length
  const aberta = abertaId ? itens[abertaId] : null
  const ancestrais = aberta?.parent_id ? [itens[aberta.parent_id]] : []

  return (
    <div className="ln vt h-screen bg-ln-bg flex flex-col">
      {dialogo}
      <Toast toast={toast} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-h-11 py-1.5 px-4 border-b border-ln-line text-xs text-ln-t3 shrink-0">
        <span><strong className="text-ln-t1">DevCascata</strong> · template Landing Page em memória (cadeia de {SUBS.length}), nada vai para o banco</span>
        <label className="flex items-center gap-1.5">
          Template começa em
          <input type="date" value={inicio} onChange={(e) => mudarInicio(e.target.value)} className="ln-input h-7 text-xs" />
        </label>
        <label className="flex items-center gap-1.5">
          Hoje simulado
          <input type="date" value={hoje} onChange={(e) => mudarHoje(e.target.value)} className={`ln-input h-7 text-xs ${hoje ? '!border-ln-orange' : ''}`} />
          {hoje && <button type="button" onClick={() => mudarHoje('')} className="ln-pill">hoje real</button>}
        </label>
        <span className={atrasadas ? 'text-ln-red font-medium' : ''}>{atrasadas} {atrasadas === 1 ? 'atrasada' : 'atrasadas'}</span>
        <label className={`flex items-center gap-1.5 ${viaClickup ? 'text-ln-orange font-medium' : ''}`} title="Mudanças de data gravam sem a cascata, como chegam do ClickUp">
          <input type="checkbox" checked={viaClickup} onChange={(e) => setViaClickup(e.target.checked)} /> mudança vinda do ClickUp
        </label>
        <button type="button" onClick={() => recomecar()} className="ln-pill">Recomeçar</button>
      </div>
      <div key={hoje || 'real'} className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 overflow-auto">
          <ListaView grupos={grupos} filhosDe={filhosDe} ctx={ctx} mostrarConcluidas compacto={!!aberta} />
          <div className="p-4"><GanttView itens={lista} ctx={ctx} /></div>
        </div>
        {aberta && (
          <aside className="shrink-0 w-[480px] border-l border-ln-line bg-ln-panel overflow-y-auto" aria-label="Detalhe da tarefa">
            <TarefaPanel
              key={aberta.id} item={aberta} subtarefas={filhosDe.get(aberta.id) || []} ancestrais={ancestrais}
              irmas={aberta.parent_id ? filhosDe.get(aberta.parent_id) : null} statuses={STATUSES_PADRAO} membros={MEMBROS} membrosMap={membrosMap}
              comentarios={[]} user={{ id: 'eu' }} onAtualizar={atualizar} onMudarStatus={mudarStatus}
              onCriarSub={() => {}} onAbrir={setAbertaId} onComentar={() => {}} onExcluirComentario={() => {}}
              onCarregarComentarios={() => {}} onErro={(m) => console.log('erro', m)} onFechar={() => setAbertaId(null)}
              entrega={<EntregaPainel item={aberta} carregarGrafo={carregarGrafo} gravar={gravar} confirmar={confirmar} avisar={showToast} />}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
