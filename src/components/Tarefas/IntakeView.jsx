// Aba Intake: fila de pedidos que ainda não são tarefa. Pedidos de clientes,
// reprovações de anúncio e sugestões do playbook chegam aqui; o time escolhe
// cliente e responsável e aceita (vira tarefa em "A fazer") ou recusa.
import { useMemo, useState, useEffect } from 'react'
import { Plus, Undo2, ExternalLink, Clock, Copy, Link2, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PRIORIDADES, fmtDataHora } from '../../lib/tarefas'
import { ORIGENS_INTAKE } from '../../lib/vertatask'

const ROTULO_PRIO = Object.fromEntries(PRIORIDADES.map((p) => [p.key, p.label]))
// pílula de prioridade do protótipo: urgente vermelho, alta âmbar, normal azul, baixa cinza
const PILULA_PRIO = {
  urgent: 'bg-ln-red/10 text-ln-red',
  high: 'bg-ln-yellow/15 text-[#8a6a14] dark:text-ln-yellow',
  normal: 'bg-ln-accent/10 text-ln-accent',
  low: 'bg-ln-ink/[0.06] text-ln-t3',
}

function nomeProjeto(p) { return p?.company_name || p?.companyName || p?.name || 'Sem nome' }

function BuscaDuplicada({ onEscolher, onCancelar }) {
  const [q, setQ] = useState('')
  const [achados, setAchados] = useState([])
  useEffect(() => {
    if (q.trim().length < 2) return undefined
    const h = setTimeout(async () => {
      const { data } = await supabase.from('tarefas_itens').select('id,titulo').ilike('titulo', `%${q.trim()}%`).eq('arquivada', false).limit(6)
      setAchados(data || [])
    }, 250)
    return () => clearTimeout(h)
  }, [q])
  return (
    <div className="flex flex-col gap-1.5">
      <div className="ln-input !h-9 flex items-center gap-1.5"><Search className="w-3.5 h-3.5 text-ln-t4" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Duplicada de qual tarefa?" className="flex-1 min-w-0 bg-transparent outline-none text-xs" /></div>
      {q.trim().length >= 2 && achados.map((a) => <button key={a.id} type="button" onClick={() => onEscolher(a)} className="text-left text-xs px-2 h-8 rounded-md hover:bg-ln-ink/5 truncate text-ln-t2">{a.titulo}</button>)}
      <button type="button" onClick={onCancelar} className="ln-pill !h-8 justify-center">Voltar</button>
    </div>
  )
}

function Cartao({ it, pastas, listas, projetos, membros, onAceitar, onRecusar, onAdiar, onDuplicada }) {
  const pastaDoProjeto = useMemo(() => pastas.find((p) => p.project_id && p.project_id === it.project_id)?.id || '', [pastas, it.project_id])
  const [pastaId, setPastaId] = useState(pastaDoProjeto)
  const [resp, setResp] = useState('')
  const [recusando, setRecusando] = useState(false)
  const [duplicando, setDuplicando] = useState(false)
  const [adiando, setAdiando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const projeto = projetos.find((p) => p.id === it.project_id)

  async function aceitar() {
    setBusy(true)
    await onAceitar(it, { pastaId, responsavelId: resp || null })
    setBusy(false)
  }
  async function recusar() {
    setBusy(true)
    await onRecusar(it, motivo.trim() || null)
    setBusy(false)
  }
  const temLista = pastaId && listas.some((l) => l.pasta_id === pastaId)

  return (
    <div className="ln-card px-[18px] py-4 grid gap-4 md:grid-cols-[1fr_220px] max-w-[880px]">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.12em] text-ln-accent font-bold">{it.origem} · {fmtDataHora(it.created_at)}</p>
        <h3 className="text-[15px] font-bold text-ln-t1 mt-1">{it.titulo}</h3>
        {it.descricao && <p className="text-sm text-ln-t2 mt-1.5 mb-2.5 whitespace-pre-line">{it.descricao}</p>}
        <div className="flex items-center gap-2 mt-2 text-xs text-ln-t3">
          {it.prioridade && <span className={`px-2 py-0.5 rounded-full text-[11.5px] font-bold ${PILULA_PRIO[it.prioridade] || PILULA_PRIO.low}`}>{ROTULO_PRIO[it.prioridade]}</span>}
          {projeto && <span>{nomeProjeto(projeto)}</span>}
          {it.contato && <span>Contato: {it.contato}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <select className="ln-input !h-9" value={pastaId} onChange={(e) => setPastaId(e.target.value)} aria-label="Cliente">
          <option value="">Escolha o cliente</option>
          {pastas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select className="ln-input !h-9" value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável">
          <option value="">Sem responsável</option>
          {membros.filter((m) => !m.disabled).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {duplicando ? (
          <BuscaDuplicada onEscolher={async (a) => { setBusy(true); await onDuplicada(it, a); setBusy(false) }} onCancelar={() => setDuplicando(false)} />
        ) : adiando ? (
          <div className="flex flex-col gap-1.5">
            {[[1, 'Amanhã'], [3, 'Em 3 dias'], [7, 'Em 1 semana'], [14, 'Em 2 semanas']].map(([n, rot]) => (
              <button key={n} type="button" disabled={busy} onClick={async () => { setBusy(true); await onAdiar(it, n); setBusy(false) }} className="ln-pill !h-8 justify-center">{rot}</button>
            ))}
            <button type="button" onClick={() => setAdiando(false)} className="ln-pill !h-8 justify-center">Voltar</button>
          </div>
        ) : recusando ? (
          <>
            <input className="ln-input !h-8" placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={recusar} className="ln-primary !bg-ln-red">Recusar</button>
              <button type="button" onClick={() => setRecusando(false)} className="ln-pill">Voltar</button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <button type="button" disabled={busy || !temLista} onClick={aceitar} className="ln-primary !h-9 w-full justify-center disabled:opacity-50" title={temLista ? '' : 'Escolha um cliente com pasta'}>Aceitar como tarefa</button>
            <button type="button" disabled={busy} onClick={() => setRecusando(true)} className="ln-pill !h-9 w-full justify-center !text-ln-t1 hover:!text-ln-red">Recusar</button>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => setAdiando(true)} className="ln-pill !h-8 flex-1 justify-center" title="Tirar da fila e voltar numa data"><Clock className="w-3.5 h-3.5" /> Adiar</button>
              <button type="button" disabled={busy} onClick={() => setDuplicando(true)} className="ln-pill !h-8 flex-1 justify-center" title="Já existe uma tarefa igual"><Copy className="w-3.5 h-3.5" /> Duplicada</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NovoPedido({ pastas, projetos, onCriar, onCancelar }) {
  const [f, setF] = useState({ titulo: '', descricao: '', origem: 'Cliente', project_id: '', prioridade: '' })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const projetosComPasta = projetos.filter((p) => pastas.some((pa) => pa.project_id === p.id))
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (f.titulo.trim()) onCriar(f) }}
      className="ln-card p-4 flex flex-col gap-2 max-w-4xl"
    >
      <input className="ln-input !h-8" placeholder="O que o cliente ou o time está pedindo" value={f.titulo} onChange={(e) => set('titulo', e.target.value)} autoFocus />
      <textarea className="ln-input !h-auto py-2 resize-y" rows={3} placeholder="Contexto, links, o que seria o pronto (opcional)" value={f.descricao} onChange={(e) => set('descricao', e.target.value)} />
      <div className="flex gap-2 flex-wrap">
        <select className="ln-input !h-8 !w-[190px]" value={f.origem} onChange={(e) => set('origem', e.target.value)} aria-label="Origem">
          {ORIGENS_INTAKE.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select className="ln-input !h-8 !w-[220px]" value={f.project_id} onChange={(e) => set('project_id', e.target.value)} aria-label="Cliente">
          <option value="">Cliente (opcional)</option>
          {projetosComPasta.map((p) => <option key={p.id} value={p.id}>{nomeProjeto(p)}</option>)}
        </select>
        <select className="ln-input !h-8 !w-[150px]" value={f.prioridade} onChange={(e) => set('prioridade', e.target.value)} aria-label="Prioridade">
          <option value="">Prioridade</option>
          {PRIORIDADES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>
      <div className="flex gap-2 mt-1">
        <button type="submit" className="ln-primary"><Plus className="w-3.5 h-3.5" /> Adicionar à fila</button>
        <button type="button" onClick={onCancelar} className="ln-pill">Cancelar</button>
      </div>
    </form>
  )
}

function LinkCliente({ projetos, pastas, onToast }) {
  const [id, setId] = useState('')
  const lista = projetos.filter((p) => p.clientShareToken && pastas.some((pa) => pa.project_id === p.id))
  async function copiar() {
    const p = projetos.find((x) => x.id === id)
    if (!p?.clientShareToken) return
    const url = `${window.location.origin}/pedido/${p.clientShareToken}`
    try { await navigator.clipboard.writeText(url); onToast('Link copiado. Mande para o cliente.') } catch { window.prompt('Copie o link', url) }
  }
  return (
    <div className="ln-card px-4 py-3 max-w-[880px] flex items-center gap-2 flex-wrap">
      <Link2 className="w-4 h-4 text-ln-accent shrink-0" />
      <span className="text-[13px] text-ln-t2 mr-1">Link para o cliente mandar pedidos direto para esta fila:</span>
      <select className="ln-input !h-8 !w-[220px]" value={id} onChange={(e) => setId(e.target.value)} aria-label="Cliente"><option value="">Escolha o cliente</option>{lista.map((p) => <option key={p.id} value={p.id}>{nomeProjeto(p)}</option>)}</select>
      <button type="button" disabled={!id} onClick={copiar} className="ln-pill disabled:opacity-50"><Copy className="w-3.5 h-3.5" /> Copiar link</button>
    </div>
  )
}

export default function IntakeView({ vt, pastas, listas, projetos, membros, onAceitar, onToast, onAbrirTarefa }) {
  const [criando, setCriando] = useState(false)
  const pendentes = vt.intakePendentes
  const recentes = useMemo(() => vt.intake.filter((i) => ['aceito', 'recusado', 'duplicado'].includes(i.status)).slice(0, 15), [vt.intake])

  async function criar(f) {
    const r = await vt.criarIntake(f)
    if (r.error) { onToast(r.error, 'error'); return }
    setCriando(false)
    onToast('Pedido na fila')
  }
  async function adiar(it, dias) {
    const ate = new Date(); ate.setDate(ate.getDate() + dias); ate.setHours(8, 0, 0, 0)
    const r = await vt.decidirIntake(it.id, { status: 'adiado', adiado_ate: ate.toISOString() })
    if (r.error) onToast(r.error, 'error'); else onToast(`Volta para a fila em ${ate.toLocaleDateString('pt-BR')}`)
  }
  async function duplicada(it, alvo) {
    const r = await vt.decidirIntake(it.id, { status: 'duplicado', duplicada_de: alvo.id, tarefa_id: alvo.id })
    if (r.error) onToast(r.error, 'error'); else onToast('Marcado como duplicado')
  }
  async function recusar(it, motivo) {
    const r = await vt.decidirIntake(it.id, { status: 'recusado', motivo_recusa: motivo })
    if (r.error) onToast(r.error, 'error'); else onToast('Pedido recusado')
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 max-w-4xl">
        <p className="text-[13px] text-ln-t3 max-w-2xl">Pedidos de clientes, reprovações de anúncio e sugestões do playbook caem aqui antes de virar tarefa. Escolha o cliente e o responsável e aceite, ou recuse.</p>
        {!criando && <button type="button" onClick={() => setCriando(true)} className="ln-pill shrink-0"><Plus className="w-3.5 h-3.5" /> Novo pedido</button>}
      </div>
      <LinkCliente projetos={projetos} pastas={pastas} onToast={onToast} />
      {criando && <NovoPedido pastas={pastas} projetos={projetos} onCriar={criar} onCancelar={() => setCriando(false)} />}
      {!pendentes.length && !criando && (
        <div className="rounded-lg border border-dashed border-ln-ink/15 p-10 text-center text-[13px] text-ln-t4 max-w-4xl">Fila vazia. Tudo que chegou já virou tarefa ou foi recusado.</div>
      )}
      {pendentes.map((it) => (
        <Cartao key={it.id} it={it} pastas={pastas} listas={listas} projetos={projetos} membros={membros} onAceitar={onAceitar} onRecusar={recusar} onAdiar={adiar} onDuplicada={duplicada} />
      ))}

      {vt.intakeAdiados.length > 0 && (
        <section className="max-w-4xl mt-2">
          <p className="ln-label">Adiados</p>
          <div className="ln-card">
            {vt.intakeAdiados.map((it) => (
              <div key={it.id} className="flex items-center gap-3 h-10 px-3 border-b border-ln-ink/5 last:border-0 text-[13px]">
                <Clock className="w-3.5 h-3.5 text-ln-t4" />
                <span className="flex-1 min-w-0 truncate text-ln-t2">{it.titulo}</span>
                <span className="text-xs text-ln-t4 tabular">volta em {new Date(it.adiado_ate).toLocaleDateString('pt-BR')}</span>
                <button type="button" onClick={async () => { const r = await vt.reabrirIntake(it.id); if (r.error) onToast(r.error, 'error') }} className="ln-iconbtn" title="Voltar para a fila agora" aria-label="Voltar para a fila"><Undo2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {recentes.length > 0 && (
        <section className="max-w-4xl mt-4">
          <p className="ln-label">Decididos recentemente</p>
          <div className="ln-card">
            {recentes.map((it) => (
              <div key={it.id} className="flex items-center gap-3 h-10 px-3 border-b border-ln-ink/5 last:border-0 text-[13px]">
                <span className={`text-[11px] uppercase tracking-wider font-medium w-20 ${it.status === 'aceito' ? 'text-ln-green' : 'text-ln-t4'}`}>{{ aceito: 'Aceito', recusado: 'Recusado', duplicado: 'Duplicado' }[it.status]}</span>
                <span className="flex-1 min-w-0 truncate text-ln-t2">{it.titulo}</span>
                {it.motivo_recusa && <span className="text-xs text-ln-t4 truncate max-w-[220px]">{it.motivo_recusa}</span>}
                {it.tarefa_id && <button type="button" onClick={() => onAbrirTarefa(it.tarefa_id)} className="ln-iconbtn" title="Abrir a tarefa" aria-label="Abrir a tarefa"><ExternalLink className="w-3.5 h-3.5" /></button>}
                {['recusado', 'duplicado'].includes(it.status) && <button type="button" onClick={async () => { const r = await vt.reabrirIntake(it.id); if (r.error) onToast(r.error, 'error') }} className="ln-iconbtn" title="Voltar para a fila" aria-label="Voltar para a fila"><Undo2 className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
