// Aba Intake: fila de pedidos que ainda não são tarefa. Pedidos de clientes,
// reprovações de anúncio e sugestões do playbook chegam aqui; o time escolhe
// cliente e responsável e aceita (vira tarefa em "A fazer") ou recusa.
import { useMemo, useState } from 'react'
import { Plus, Check, X, Undo2, ExternalLink } from 'lucide-react'
import { PRIORIDADES, fmtDataHora } from '../../lib/tarefas'
import { ORIGENS_INTAKE } from '../../lib/vertatask'
import { PrioridadeIcon } from './Campos'

const ROTULO_PRIO = Object.fromEntries(PRIORIDADES.map((p) => [p.key, p.label]))

function nomeProjeto(p) { return p?.company_name || p?.companyName || p?.name || 'Sem nome' }

function Cartao({ it, pastas, listas, projetos, membros, onAceitar, onRecusar }) {
  const pastaDoProjeto = useMemo(() => pastas.find((p) => p.project_id && p.project_id === it.project_id)?.id || '', [pastas, it.project_id])
  const [pastaId, setPastaId] = useState(pastaDoProjeto)
  const [resp, setResp] = useState('')
  const [recusando, setRecusando] = useState(false)
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
    <div className="ln-card p-4 grid gap-4 md:grid-cols-[1fr_260px] max-w-4xl">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-ln-accent font-medium">{it.origem} · {fmtDataHora(it.created_at)}</p>
        <h3 className="text-sm font-semibold text-ln-t1 mt-1">{it.titulo}</h3>
        {it.descricao && <p className="text-[13px] text-ln-t2 mt-1.5 whitespace-pre-line">{it.descricao}</p>}
        <div className="flex items-center gap-3 mt-2.5 text-xs text-ln-t3">
          {projeto && <span>{nomeProjeto(projeto)}</span>}
          {it.prioridade && <span className="inline-flex items-center gap-1"><PrioridadeIcon valor={it.prioridade} />{ROTULO_PRIO[it.prioridade]}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <select className="ln-input !h-8" value={pastaId} onChange={(e) => setPastaId(e.target.value)} aria-label="Cliente">
          <option value="">Escolha o cliente</option>
          {pastas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select className="ln-input !h-8" value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável">
          <option value="">Sem responsável</option>
          {membros.filter((m) => !m.disabled).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {recusando ? (
          <>
            <input className="ln-input !h-8" placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={recusar} className="ln-primary !bg-ln-red">Recusar</button>
              <button type="button" onClick={() => setRecusando(false)} className="ln-pill">Voltar</button>
            </div>
          </>
        ) : (
          <div className="flex gap-2">
            <button type="button" disabled={busy || !temLista} onClick={aceitar} className="ln-primary disabled:opacity-50" title={temLista ? '' : 'Escolha um cliente com pasta'}><Check className="w-3.5 h-3.5" /> Aceitar</button>
            <button type="button" disabled={busy} onClick={() => setRecusando(true)} className="ln-pill hover:!text-ln-red"><X className="w-3.5 h-3.5" /> Recusar</button>
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

export default function IntakeView({ vt, pastas, listas, projetos, membros, onAceitar, onToast, onAbrirTarefa }) {
  const [criando, setCriando] = useState(false)
  const pendentes = vt.intakePendentes
  const recentes = useMemo(() => vt.intake.filter((i) => i.status !== 'pendente').slice(0, 15), [vt.intake])

  async function criar(f) {
    const r = await vt.criarIntake(f)
    if (r.error) { onToast(r.error, 'error'); return }
    setCriando(false)
    onToast('Pedido na fila')
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
      {criando && <NovoPedido pastas={pastas} projetos={projetos} onCriar={criar} onCancelar={() => setCriando(false)} />}
      {!pendentes.length && !criando && (
        <div className="rounded-lg border border-dashed border-ln-ink/15 p-10 text-center text-[13px] text-ln-t4 max-w-4xl">Fila vazia. Tudo que chegou já virou tarefa ou foi recusado.</div>
      )}
      {pendentes.map((it) => (
        <Cartao key={it.id} it={it} pastas={pastas} listas={listas} projetos={projetos} membros={membros} onAceitar={onAceitar} onRecusar={recusar} />
      ))}

      {recentes.length > 0 && (
        <section className="max-w-4xl mt-4">
          <p className="ln-label">Decididos recentemente</p>
          <div className="ln-card">
            {recentes.map((it) => (
              <div key={it.id} className="flex items-center gap-3 h-10 px-3 border-b border-ln-ink/5 last:border-0 text-[13px]">
                <span className={`text-[11px] uppercase tracking-wider font-medium w-16 ${it.status === 'aceito' ? 'text-ln-green' : 'text-ln-t4'}`}>{it.status === 'aceito' ? 'Aceito' : 'Recusado'}</span>
                <span className="flex-1 min-w-0 truncate text-ln-t2">{it.titulo}</span>
                {it.motivo_recusa && <span className="text-xs text-ln-t4 truncate max-w-[220px]">{it.motivo_recusa}</span>}
                {it.tarefa_id && <button type="button" onClick={() => onAbrirTarefa(it.tarefa_id)} className="ln-iconbtn" title="Abrir a tarefa" aria-label="Abrir a tarefa"><ExternalLink className="w-3.5 h-3.5" /></button>}
                {it.status === 'recusado' && <button type="button" onClick={async () => { const r = await vt.reabrirIntake(it.id); if (r.error) onToast(r.error, 'error') }} className="ln-iconbtn" title="Voltar para a fila" aria-label="Voltar para a fila"><Undo2 className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
