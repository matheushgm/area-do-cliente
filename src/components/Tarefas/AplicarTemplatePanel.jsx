// Painel lateral "Aplicar template": escolhe o cliente (pasta), a lista e a data de
// início, mostra a prévia com datas e responsáveis já calculados e cria tudo.
import { useMemo, useState } from 'react'
import { X, Play, Loader2, AlertTriangle, CornerDownRight, Link2 } from 'lucide-react'
import { itensDoTemplate, planejarAplicacao, proximoDiaUtil, perfilDoUsuarioCliente } from '../../lib/templates'
import { fmtDataCurta, corDaPessoa, iniciais } from '../../lib/tarefas'
import { hojeISO } from '../../lib/vertatask'
import { Avatar, FOCO } from './Campos'

const nomeProjeto = (p) => p?.company_name || p?.companyName || ''

export default function AplicarTemplatePanel({ template, pastas, listas, projetos, squads, membrosMap, listaInicialId, onAplicar, onFechar }) {
  const listaInicial = listas.find((l) => l.id === listaInicialId)
  const pastasAtivas = useMemo(() => pastas.filter((p) => !p.arquivada).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [pastas])
  const [pastaId, setPastaId] = useState(listaInicial?.pasta_id || '')
  const listasDaPasta = useMemo(() => listas.filter((l) => l.pasta_id === pastaId && !l.arquivada), [listas, pastaId])
  const padraoDa = (pid) => {
    const ls = listas.filter((l) => l.pasta_id === pid && !l.arquivada)
    return (ls.find((l) => l.nome === 'Geral') || ls[0])?.id || ''
  }
  const [listaId, setListaId] = useState(listaInicial?.id || '')
  const [dataInicio, setDataInicio] = useState(() => proximoDiaUtil(hojeISO()))
  const [aplicando, setAplicando] = useState(null) // { feitas, total }

  const pasta = pastas.find((p) => p.id === pastaId)
  const projeto = projetos.find((p) => p.id === pasta?.project_id)
  const squad = (squads || []).find((s) => s.id === projeto?.squad)
  const cliente = nomeProjeto(projeto) || pasta?.nome || ''
  const itens = useMemo(() => itensDoTemplate(template), [template])
  const usuarioClienteId = useMemo(() => perfilDoUsuarioCliente([...membrosMap.values()]), [membrosMap])
  const ativos = useMemo(() => new Set(membrosMap.keys()), [membrosMap]) // membrosMap = só perfis ativos
  const plano = useMemo(() => planejarAplicacao(itens, { dataInicio, squad, cliente, usuarioClienteId, ativos }), [itens, dataInicio, squad, cliente, usuarioClienteId, ativos])
  const avisos = plano.filter((l) => l.aviso).length
  const pronto = !!listaId && !!dataInicio && plano.length > 0 && !aplicando

  async function aplicar() {
    setAplicando({ feitas: 0, total: plano.length })
    const r = await onAplicar({ listaId, plano, onProgresso: (feitas) => setAplicando({ feitas, total: plano.length }) })
    setAplicando(null)
    if (!r?.error) onFechar()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-11 shrink-0 flex items-center justify-between gap-2 px-4 border-b border-ln-ink/5">
        <p className="text-[13px] font-semibold text-ln-t1 truncate">Aplicar “{template.nome}”</p>
        <button type="button" onClick={onFechar} className="ln-iconbtn" aria-label="Fechar" title="Fechar (Esc)"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div className="grid gap-3">
          <label className="grid gap-1 text-xs text-ln-t3">Cliente
            <select className="ln-input !h-9" value={pastaId} onChange={(e) => { setPastaId(e.target.value); setListaId(padraoDa(e.target.value)) }}>
              <option value="">Escolha o cliente</option>
              {pastasAtivas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs text-ln-t3">Lista
              <select className="ln-input !h-9" value={listaId} onChange={(e) => setListaId(e.target.value)} disabled={!pastaId}>
                {!listasDaPasta.length && <option value="">{pastaId ? 'Pasta sem lista' : '—'}</option>}
                {listasDaPasta.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-ln-t3">Data de início
              <input type="date" className="ln-input !h-9" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </label>
          </div>
          {pastaId && (
            <p className="text-[11px] text-ln-t4">
              {squad ? <>Squad do cliente: <b className="text-ln-t3">{squad.emoji} {squad.name}</b>. </> : 'Este cliente não tem squad: quem depende do departamento fica sem responsável. '}
              Fim de semana conta como o próximo dia útil.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="ln-label">Prévia · {plano.length} tarefa{plano.length === 1 ? '' : 's'}</p>
            {pastaId && avisos > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-ln-orange"><AlertTriangle className="w-3 h-3" /> {avisos} sem responsável definido</span>}
          </div>
          <ol className="ln-card divide-y divide-ln-ink/5 overflow-hidden">
            {plano.map((l) => (
              <li key={l.item.id} className="flex items-center gap-2 min-h-[38px] px-3 py-1.5" style={{ paddingLeft: l.nivel ? 30 : 12 }}>
                {l.nivel === 1 && <CornerDownRight className="w-3 h-3 text-ln-t4 shrink-0" />}
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[13px] text-ln-t2">{l.titulo}</span>
                  {pastaId && l.aviso && <span className="block text-[11px] text-ln-orange truncate">{l.aviso}</span>}
                </span>
                {l.item.depende_de.length > 0 && <Link2 className="w-3 h-3 text-ln-t4 shrink-0" aria-label="Depende de outra tarefa" />}
                <span className="inline-flex -space-x-1.5 shrink-0">
                  {l.responsaveis.map((id) => { const m = membrosMap.get(id); return m ? <Avatar key={id} pessoa={{ nome: m.name, iniciais: m.avatar || iniciais(m.name), cor: corDaPessoa(id) }} size={18} /> : null })}
                </span>
                <span className="w-[86px] shrink-0 text-right text-[11px] text-ln-t3 tabular">
                  {l.data_inicio && l.data_vencimento && l.data_inicio !== l.data_vencimento ? `${fmtDataCurta(l.data_inicio)} → ${fmtDataCurta(l.data_vencimento)}` : fmtDataCurta(l.data_vencimento || l.data_inicio) || <span className="text-ln-t4">sem data</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="shrink-0 px-4 py-3 border-t border-ln-ink/5 flex items-center gap-2">
        {aplicando && <span className="text-xs text-ln-t3 tabular inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Criando {aplicando.feitas} de {aplicando.total}…</span>}
        <span className="flex-1" />
        <button type="button" onClick={onFechar} disabled={!!aplicando} className="ln-pill">Cancelar</button>
        <button type="button" onClick={aplicar} disabled={!pronto} className={`ln-primary disabled:opacity-50 ${FOCO}`}><Play className="w-3 h-3" /> Criar {plano.length} tarefa{plano.length === 1 ? '' : 's'}</button>
      </div>
    </div>
  )
}
