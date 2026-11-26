// Harness DEV (só import.meta.env.DEV): timer das tarefas e aba Horas com um banco em memória,
// sem login. Troca, só nesta página, o pedaço do cliente do Supabase que useTimer e HorasView
// usam (tarefas_tempo, tarefas_itens, as RPCs tarefas_timer_iniciar/parar e o canal realtime).
// Recarregar a página volta aos dados de exemplo.
import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TimerTarefa, TimerAtivo } from '../components/Tarefas/TimerTarefa'
import HorasView from '../components/Tarefas/HorasView'
import TarefasSidebar from '../components/Tarefas/TarefasSidebar'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { STATUSES_PADRAO } from '../lib/tarefas'

const EU = 'p1'
const membros = [
  { id: 'p1', name: 'Matheus Martins', avatar: 'MM' },
  { id: 'p2', name: 'Mario Marques', avatar: 'MA' },
  { id: 'p3', name: 'Bárbara Luiza', avatar: 'BL' },
  { id: 'p4', name: 'André Tenório', avatar: 'AT' },
]
const pastas = ['Nomus', 'Grupo AJ', 'Cical Honda', 'TudoMed'].map((nome, i) => ({ id: `pa${i}`, nome }))
const listas = [
  ...pastas.map((p) => ({ id: `li-${p.id}`, nome: 'Geral', pasta_id: p.id, statuses: STATUSES_PADRAO })),
  { id: 'li-pessoal', nome: 'Lista pessoal', pasta_id: null, dono_id: EU, statuses: STATUSES_PADRAO },
]
const tarefas = [
  { id: 't1', titulo: 'Criativos estáticos da semana', lista_id: 'li-pa0', tipo_tarefa: 'Criação de Arte Estática', estimativa_min: 240 },
  { id: 't2', titulo: 'Relatório mensal de novembro', lista_id: 'li-pa1', tipo_tarefa: 'Relatório', estimativa_min: 90 },
  { id: 't3', titulo: 'Subir campanha de Black Friday', lista_id: 'li-pa2', tipo_tarefa: 'Criar Campanha', estimativa_min: 120 },
  { id: 't4', titulo: 'LP de SST', lista_id: 'li-pa3', tipo_tarefa: 'Criação de Landing Page', estimativa_min: 480 },
  { id: 't5', titulo: 'Reunião de alinhamento', lista_id: 'li-pa1', tipo_tarefa: 'Reunião', estimativa_min: 60 },
  { id: 't6', titulo: 'Estudar o novo playbook', lista_id: 'li-pessoal', tipo_tarefa: null, estimativa_min: null },
].map((x) => ({ parent_id: null, status_tipo: 'open', ...x }))

function semente() {
  const out = []
  const dia = (n, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, m, 0, 0); return d }
  const add = (tarefa_id, user_id, ini, min, origem = 'timer') => out.push({ id: crypto.randomUUID(), tarefa_id, user_id, inicio: ini.toISOString(), fim: new Date(ini.getTime() + min * 60000).toISOString(), segundos: min * 60, origem, nota: null })
  for (let n = 0; n < 12; n++) {
    add('t1', 'p3', dia(n, 9), 70 + (n * 13) % 50)
    if (n % 2 === 0) add('t2', 'p2', dia(n, 14), 45)
    if (n % 3 === 0) add('t3', 'p4', dia(n, 10, 30), 95)
    add('t5', ['p1', 'p2', 'p3', 'p4'][n % 4], dia(n, 16), 30)
    if (n % 4 === 1) add('t4', 'p1', dia(n, 11), 150, 'manual')
    if (n % 5 === 0) add('t-privada-outro', 'p2', dia(n, 8), 40) // lista pessoal do Mario: a RLS não devolve a tarefa
  }
  add('t6', EU, dia(1, 19), 35)
  // Mario está com um timer rodando há 25 min
  const ini = new Date(Date.now() - 25 * 60000)
  out.push({ id: crypto.randomUUID(), tarefa_id: 't3', user_id: 'p2', inicio: ini.toISOString(), fim: null, segundos: null, origem: 'timer', nota: null })
  return out
}

function instalarBancoFalso() {
  if (window.__devHorasBanco) return window.__devHorasBanco
  const db = { tarefas_tempo: semente(), tarefas_itens: tarefas }
  const ouvintes = new Set()
  const avisar = (eventType, row) => ouvintes.forEach((f) => f({ eventType, new: row, old: row }))
  const comSegundos = (r) => ({ ...r, segundos: r.fim ? Math.max(0, Math.floor((new Date(r.fim) - new Date(r.inicio)) / 1000)) : null })

  function from(nome) {
    const filtros = []
    let op = 'select', valores = null, modo = 'lista', ordem = null, faixa = null, lim = null
    const q = {
      select() { return q },
      eq(c, v) { filtros.push((r) => r[c] === v); return q },
      is(c, v) { filtros.push((r) => (r[c] ?? null) === v); return q },
      in(c, vs) { filtros.push((r) => vs.includes(r[c])); return q },
      lt(c, v) { filtros.push((r) => r[c] < v); return q },
      or(expr) { // só "fim.is.null,fim.gt.<iso>"
        const [, iso] = expr.split(',fim.gt.')
        filtros.push((r) => r.fim == null || r.fim > iso); return q
      },
      order(c, o) { if (!ordem) ordem = { c, asc: o?.ascending !== false }; return q },
      limit(n) { lim = n; return q },
      range(a, b) { faixa = [a, b]; return q },
      maybeSingle() { modo = 'talvez'; return q },
      single() { modo = 'um'; return q },
      insert(v) { op = 'insert'; valores = v; return q },
      delete() { op = 'delete'; return q },
      then(ok, falha) { return Promise.resolve(executar()).then(ok, falha) },
    }
    function executar() {
      const tab = db[nome] || []
      if (op === 'insert') {
        const linhas = (Array.isArray(valores) ? valores : [valores]).map((v) => comSegundos({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...v }))
        tab.push(...linhas)
        linhas.forEach((l) => avisar('INSERT', l))
        return { data: modo === 'lista' ? linhas : linhas[0], error: null }
      }
      const achadas = tab.filter((r) => filtros.every((f) => f(r)))
      if (op === 'delete') {
        db[nome] = tab.filter((r) => !achadas.includes(r))
        achadas.forEach((l) => avisar('DELETE', l))
        return { data: null, error: null }
      }
      let linhas = [...achadas]
      if (ordem) linhas.sort((a, b) => (a[ordem.c] < b[ordem.c] ? -1 : a[ordem.c] > b[ordem.c] ? 1 : 0) * (ordem.asc ? 1 : -1))
      if (faixa) linhas = linhas.slice(faixa[0], faixa[1] + 1)
      if (lim) linhas = linhas.slice(0, lim)
      if (modo === 'talvez') return { data: linhas[0] || null, error: null }
      if (modo === 'um') return linhas[0] ? { data: linhas[0], error: null } : { data: null, error: { message: 'nenhuma linha' } }
      return { data: linhas, error: null }
    }
    return q
  }

  async function rpc(nome, args) {
    const agora = new Date().toISOString()
    const parar = () => db.tarefas_tempo.filter((r) => r.user_id === EU && !r.fim).map((r) => { Object.assign(r, comSegundos({ ...r, fim: agora })); avisar('UPDATE', r); return r })
    if (nome === 'tarefas_timer_parar') return { data: parar(), error: null }
    if (nome === 'tarefas_timer_iniciar') {
      parar()
      const r = comSegundos({ id: crypto.randomUUID(), tarefa_id: args.p_tarefa, user_id: EU, inicio: agora, fim: null, origem: 'timer', nota: null })
      db.tarefas_tempo.push(r)
      avisar('INSERT', r)
      return { data: r, error: null }
    }
    return { data: null, error: { message: `rpc ${nome} fora do harness` } }
  }

  supabase.from = from
  supabase.rpc = rpc
  supabase.channel = () => {
    const ch = { on(_t, _f, f) { ouvintes.add(f); ch._f = f; return ch }, subscribe(cb) { setTimeout(() => cb?.('SUBSCRIBED'), 0); return ch } }
    return ch
  }
  supabase.removeChannel = (ch) => { if (ch?._f) ouvintes.delete(ch._f) }
  window.__devHorasBanco = db
  return db
}

export default function DevHoras() {
  useMemo(() => instalarBancoFalso(), [])
  const { toast, showToast } = useToast()
  const user = useMemo(() => ({ id: EU, name: 'Matheus Martins' }), [])
  const membrosMap = useMemo(() => new Map(membros.map((m) => [m.id, m])), [])
  const pastasMap = useMemo(() => new Map(pastas.map((p) => [p.id, p])), [])
  const listasMap = useMemo(() => new Map(listas.map((l) => [l.id, l])), [])
  const [aberta, setAberta] = useState('t1')
  const tarefa = tarefas.find((x) => x.id === aberta)
  const [sel, setSel] = useState({ tipo: 'minhas' })

  return (
    <div className="ln vt flex h-screen bg-ln-bg">
      <div className="relative h-full flex bg-ln-panel overflow-hidden flex-1">
        <TarefasSidebar
          pastas={pastas} listas={listas} projetos={[]} sel={sel} onSel={setSel}
          onCriarPasta={() => {}} onAtualizarPasta={() => {}} onAtualizarLista={() => {}}
          nav={{ aba: 'horas', onAba: () => {}, intake: 0, onPessoal: () => setSel({ tipo: 'lista', id: 'li-pessoal' }), pessoalAtiva: sel.id === 'li-pessoal' }}
        />
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="min-h-[56px] flex items-center justify-between gap-3 px-6 border-b border-ln-ink/[0.08]">
            <h1 className="text-xl font-bold text-ln-t1">DevHoras</h1>
            <TimerAtivo user={user} onAbrir={setAberta} onAviso={showToast} />
          </header>
          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0 overflow-y-auto" data-dev-horas>
              <HorasView membros={membros} membrosMap={membrosMap} pastasMap={pastasMap} listasMap={listasMap} onAbrirTarefa={setAberta} />
            </div>
            <aside className="w-[420px] shrink-0 border-l border-ln-ink/[0.08] overflow-y-auto p-4 flex flex-col gap-3" data-dev-painel>
              <div className="flex flex-wrap gap-1">
                {tarefas.map((x) => <button key={x.id} type="button" onClick={() => setAberta(x.id)} className={`ln-tab ${aberta === x.id ? 'ln-tab-active' : ''}`}>{x.id}</button>)}
              </div>
              <p className="text-[15px] font-semibold text-ln-t1">{tarefa?.titulo}</p>
              {tarefa && (
                <div className="flex items-start min-h-[26px] gap-2">
                  <span className="w-24 shrink-0 text-xs text-ln-t3 leading-7">Tempo</span>
                  <div className="min-w-0 flex-1 flex items-center gap-1.5 text-xs text-ln-t2"><TimerTarefa key={tarefa.id} item={tarefa} user={user} membrosMap={membrosMap} onAviso={showToast} /></div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}
