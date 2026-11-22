// Início do portal: o que precisa da atenção do cliente agora (aprovações), como está o mês
// (investimento e conversões) e o andamento das solicitações, cada bloco levando ao módulo.
import { useMemo } from 'react'
import { ArrowRight, Clock, CheckCircle2, LineChart, Megaphone, ListTodo, Plus, FileText, Image as ImageIcon, Film } from 'lucide-react'
import { contarCentral, mesesDaCentral, nomeDoMes } from '../../lib/portalCentral'

const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const int = (n) => Math.round(Number(n) || 0).toLocaleString('pt-BR')

function Bloco({ icone: Ic, titulo, acao, onAcao, children, destaque = false }) {
  return (
    <div className={`glass-card p-4 sm:p-5 flex flex-col ${destaque ? 'ring-1 ring-amber-500/40' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-lg bg-rl-purple/10 text-rl-purple inline-flex items-center justify-center"><Ic className="w-4 h-4" /></span>
        <p className="text-sm font-bold text-rl-text">{titulo}</p>
      </div>
      <div className="flex-1">{children}</div>
      {acao && (
        <button type="button" onClick={onAcao} className="mt-4 self-start text-sm font-semibold text-rl-purple hover:underline inline-flex items-center gap-1">
          {acao} <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default function PortalInicio({ company, dashboard, central, podeAprovar, pedidos, onIr }) {
  const mesAtual = useMemo(() => (central ? mesesDaCentral([])[0] : null), [central])
  const cont = useMemo(() => (central ? contarCentral(central.itens, mesAtual) : null), [central, mesAtual])
  const totalDash = useMemo(() => {
    const contas = dashboard?.contas || []
    return {
      inv: contas.reduce((s, c) => s + (c.mes?.investimento || 0), 0),
      conv: contas.reduce((s, c) => s + (c.mes?.conversoes || 0), 0),
      n: contas.length,
    }
  }, [dashboard])
  const andamento = pedidos ? pedidos.pedidos.filter((p) => p.etapa === 'recebido' || p.etapa === 'producao') : []
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="text-xl font-bold text-rl-text">{saudacao}{company ? `, ${company}` : ''}</h2>
        <p className="text-sm text-rl-muted">Tudo o que a Verta está fazendo por você, num lugar só.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {central && (
          <Bloco icone={Megaphone} titulo="Esperando a sua aprovação" acao={cont?.todos.pendente ? (podeAprovar ? 'Aprovar agora' : 'Ver o que está esperando') : 'Abrir a Central de anúncios'} onAcao={() => onIr('debriefing')} destaque={cont?.todos.pendente > 0}>
            {central.carregando && !central.itens.length ? <p className="text-sm text-rl-muted">Carregando…</p> : (
              <>
                <p className="text-3xl font-bold text-rl-text tabular-nums">{cont.todos.pendente}</p>
                <p className="text-sm text-rl-muted">{cont.todos.pendente === 1 ? 'item esperando você' : cont.todos.pendente ? 'itens esperando você' : 'Nada pendente. Tudo em dia.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[['roteiro', 'Roteiros', FileText], ['imagem', 'Imagens', ImageIcon], ['video', 'Vídeos', Film]].map(([k, rot, Ic]) => (
                    <span key={k} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rl-surface text-rl-text">
                      <Ic className="w-3.5 h-3.5 text-rl-muted" />{rot}
                      <span className={`tabular-nums ${cont[k].pendente ? 'text-amber-600 dark:text-amber-400' : 'text-rl-muted'}`}>{cont[k].pendente}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-rl-muted inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />{cont.todos.aprovado} {cont.todos.aprovado === 1 ? 'aprovado' : 'aprovados'} em {nomeDoMes(mesAtual).replace(/ de \d{4}$/, '').toLowerCase()}</p>
              </>
            )}
          </Bloco>
        )}

        {dashboard && (
          <Bloco icone={LineChart} titulo="Suas campanhas este mês" acao="Ver o dashboard" onAcao={() => onIr('dashboard')}>
            {totalDash.n ? (
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[11px] font-semibold text-rl-muted">Investimento</p><p className="text-2xl font-bold text-rl-text tabular-nums">{brl(totalDash.inv)}</p></div>
                <div><p className="text-[11px] font-semibold text-rl-muted">Conversões</p><p className="text-2xl font-bold text-rl-text tabular-nums">{int(totalDash.conv)}</p></div>
                <div className="col-span-2"><p className="text-[11px] font-semibold text-rl-muted">Custo por conversão</p><p className="text-lg font-bold text-rl-text tabular-nums">{totalDash.conv ? brl(totalDash.inv / totalDash.conv) : '—'}</p></div>
              </div>
            ) : <p className="text-sm text-rl-muted">As contas de anúncio ainda não foram ligadas.</p>}
          </Bloco>
        )}

        {pedidos && (
          <Bloco icone={ListTodo} titulo="Suas solicitações" acao={andamento.length ? 'Acompanhar' : 'Ver solicitações'} onAcao={() => onIr('solicitacoes')}>
            {pedidos.carregando && !pedidos.pedidos.length ? <p className="text-sm text-rl-muted">Carregando…</p> : (
              <>
                <p className="text-3xl font-bold text-rl-text tabular-nums">{andamento.length}</p>
                <p className="text-sm text-rl-muted">{andamento.length === 1 ? 'solicitação em andamento' : 'solicitações em andamento'}</p>
                {andamento.slice(0, 3).map((p) => (
                  <p key={p.id} className="mt-2 text-xs text-rl-text flex items-center gap-1.5 min-w-0">
                    <Clock className={`w-3.5 h-3.5 shrink-0 ${p.etapa === 'producao' ? 'text-rl-purple' : 'text-rl-muted'}`} />
                    <span className="truncate">{p.titulo}</span>
                    <span className="shrink-0 text-rl-muted">· {p.etapa === 'producao' ? 'em produção' : 'recebido'}</span>
                  </p>
                ))}
                {pedidos.podePedir && (
                  <button type="button" onClick={() => onIr('solicitacoes')} className="mt-3 btn-secondary text-xs inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Nova solicitação</button>
                )}
              </>
            )}
          </Bloco>
        )}
      </div>
    </div>
  )
}
