// Harness DEV (só import.meta.env.DEV): painel Sincronização do VertaTask com dados em
// memória, no formato dos dois incidentes reais (template de 14 tarefas + edição em massa de
// 164 alterações que levou 34 min; 2 vencimentos recusados pelo ClickUp). Sem login nem banco:
// o useSincronizacao lê window.__DEV_SYNC. "Tentar de novo" / "Ignorar" mexem na memória.
import { useState, useLayoutEffect } from 'react'
import SincronizacaoView from '../components/Tarefas/SincronizacaoView'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'

const P1 = 'p-ana', P2 = 'p-bruno', P3 = 'p-carla'
const membros = [{ id: P1, name: 'Ana Account' }, { id: P2, name: 'Bruno Designer' }, { id: P3, name: 'Carla Tráfego' }]
const pastas = [{ id: 'f1', nome: 'Reserva Beach Villas' }, { id: 'f2', nome: 'Nomus' }]
const listas = [{ id: 'l1', pasta_id: 'f1', nome: 'Geral' }, { id: 'l2', pasta_id: 'f2', nome: 'Geral' }]
const TITULOS = ['Briefing da LP', 'Layout desktop + mobile', 'Aprovar layout com o cliente', 'Montar LP e integrar formulário', 'Apontar o domínio', 'Conferir traqueamento',
  'Subir criativos novos no fundo', 'Escalar +20% o conjunto 00_INTERESSES', 'Pausar anúncio 03 sem conversão', 'Revisar copy da campanha de topo', 'Trocar público lookalike', 'Relatório semanal',
  'Ajustar orçamento Google', 'Criar campanha de remarketing', 'Gravar vídeo de depoimento', 'Revisar oferta']

function montar() {
  const agora = Date.now()
  const iso = (msAtras) => new Date(agora - msAtras).toISOString()
  const tarefas = TITULOS.map((titulo, i) => ({ id: `t${i}`, titulo, lista_id: i < 8 ? 'l1' : 'l2', clickup_task_id: `cu${i}`, clickup_url: `https://app.clickup.com/t/cu${i}`, arquivada: false }))
  let id = 1000
  const fila = []
  const add = (o) => fila.push({ id: id++, status: 'ok', tentativas: 0, campos: [], erro: null, avisos: null, resolvido_por: null, ...o })
  // ontem: template aplicado (14 criar) e edição em massa logo depois (164 atualizar, 34 min)
  const ontem = 26 * 3600_000
  for (let i = 0; i < 14; i++) add({ operacao: 'criar', ator_id: P1, tarefa_id: `t${i % 6}`, created_at: iso(ontem - i * 300), processed_at: iso(ontem - 90_000 - i * 3000) })
  for (let i = 0; i < 164; i++) {
    const campos = [['status'], ['data_vencimento'], ['responsaveis'], ['prioridade']][i % 4]
    add({ operacao: 'atualizar', ator_id: P1, tarefa_id: `t${i % 16}`, campos, created_at: iso(ontem - 600_000 - i * 150), processed_at: iso(ontem - 600_000 - 2040_000 + i * 50), avisos: i === 7 ? ['tarefa cu7: mover de lista não é replicado no ClickUp (mova lá também)'] : null })
  }
  // hoje: 2 vencimentos recusados pelo ClickUp
  add({ operacao: 'atualizar', ator_id: P3, tarefa_id: 't6', campos: ['data_vencimento'], status: 'erro', tentativas: 1, erro: 'Start date cannot be after due date on task cu6. Enable the Duration ClickApp to allow automatic date adjustment.', created_at: iso(5 * 3600_000), processed_at: iso(5 * 3600_000 - 3000) })
  add({ operacao: 'atualizar', ator_id: P3, tarefa_id: 't7', campos: ['data_vencimento'], status: 'erro', tentativas: 1, erro: 'Start date cannot be after due date on task cu7. Enable the Duration ClickApp to allow automatic date adjustment.', created_at: iso(5 * 3600_000 - 20_000), processed_at: iso(5 * 3600_000 - 23_000) })
  add({ operacao: 'criar', ator_id: P2, tarefa_id: 't14', created_at: iso(3 * 3600_000), processed_at: iso(3 * 3600_000 - 4000), avisos: ['tarefa Gravar vídeo de depoimento: o ClickUp não deixou atribuir o responsável por este token'] })
  // agora: lote em andamento (40 alterações, 12 já enviadas)
  for (let i = 0; i < 40; i++) add({ operacao: 'atualizar', ator_id: P2, tarefa_id: `t${8 + (i % 8)}`, campos: ['status'], status: i < 12 ? 'ok' : i < 15 ? 'processando' : 'pendente', created_at: iso(4 * 60_000 - i * 200), processed_at: i < 12 ? iso(2 * 60_000) : null })

  let lid = 1
  const log = []
  const addL = (o) => log.push({ id: lid++, campos: null, motivo: null, detalhe: null, evento: null, clickup_task_id: null, ...o })
  addL({ origem: 'clickup', acao: 'atualizada', tarefa_id: 't3', campos: ['status', 'data_vencimento'], detalhe: { status: { de: 'a fazer', para: 'em andamento' }, data_vencimento: { de: iso(-86400_000), para: iso(-3 * 86400_000) } }, created_at: iso(40 * 60_000) })
  addL({ origem: 'clickup', acao: 'atualizada', tarefa_id: 't5', campos: ['responsaveis'], detalhe: { responsaveis: { de: [P1], para: [P1, P3] } }, created_at: iso(70 * 60_000) })
  addL({ origem: 'clickup', acao: 'criada', tarefa_id: 't15', detalhe: { titulo: 'Revisar oferta', status: 'a fazer' }, created_at: iso(2 * 3600_000) })
  addL({ origem: 'webhook', evento: 'taskUpdated', acao: 'ignorado', tarefa_id: 't9', clickup_task_id: 'cu9', motivo: 'push em andamento para esta tarefa', created_at: iso(3 * 60_000) })
  addL({ origem: 'webhook', evento: 'taskUpdated', acao: 'sem_mudanca', tarefa_id: 't8', clickup_task_id: 'cu8', created_at: iso(2 * 60_000) })
  addL({ origem: 'webhook', evento: 'taskUpdated', acao: 'pulada_conflito', tarefa_id: 't2', clickup_task_id: 'cu2', created_at: iso(6 * 3600_000) })
  addL({ origem: 'clickup', acao: 'removida', tarefa_id: 't4', campos: ['arquivada'], detalhe: { arquivada: { de: false, para: true } }, created_at: iso(ontem + 3600_000) })
  addL({ origem: 'rodada', evento: 'rodada', acao: 'resumo', created_at: iso(30 * 60_000), detalhe: { via: 'user', duracao_s: 9.7, tarefas_recebidas: 12, criadas: 1, atualizadas: 9, puladas_conflito: 1, avisos: [], push: { criadas: 0, atualizadas: 3, excluidas: 0, erros: 0, avisos: [] } } })
  addL({ origem: 'rodada', evento: 'rodada', acao: 'resumo', created_at: iso(20 * 3600_000), detalhe: { via: 'cron', duracao_s: 41.2, tarefas_recebidas: 220, criadas: 4, atualizadas: 180, avisos: ['tempo esgotado nos comentários; o resto vem na próxima rodada'] } })
  addL({ origem: 'rodada', evento: 'rodada', acao: 'erro', motivo: 'upsert tarefas (nível 1): insert or update on table "tarefas_itens" violates foreign key constraint', created_at: iso(3 * 86400_000), detalhe: { via: 'cron' } })
  log.sort((a, b) => b.id - a.id)

  const atividade = [
    { id: 'a1', tarefa_id: 't6', ator_nome: 'Carla Tráfego', campo: 'data_vencimento', valor_novo: '2026-10-27 15:00:00+00', created_at: iso(5 * 3600_000 + 1000) },
    { id: 'a2', tarefa_id: 't6', ator_nome: 'Ana Account', campo: 'status', valor_novo: 'em andamento', created_at: iso(ontem - 600_000) },
  ]
  const estado = {
    clickup: { id: 'clickup', ultimo_inicio: iso(30 * 60_000 + 10_000), ultimo_fim: iso(30 * 60_000), ultimo_ok: true, resumo: { criadas: 1, atualizadas: 9 } },
    clickup_webhook: { id: 'clickup_webhook', ultimo_fim: iso(2 * 60_000), ultimo_ok: true, resumo: { evento: 'taskUpdated', acao: 'sem_mudanca' } },
  }
  return { fila, log, atividade, estado, tarefas }
}

// dados e "API" em memória, montados uma vez no carregamento do módulo (o hook relê após cada ação)
const base = montar()
const DEV_SYNC = {
  dados: ({ tarefaId, ecos }) => {
    const tarefas = new Map()
    for (const t of base.tarefas) { tarefas.set(t.id, t); tarefas.set(`cu:${t.clickup_task_id}`, t) }
    const log = base.log.filter((l) => ecos || l.acao !== 'sem_mudanca')
    return tarefaId
      ? { fila: base.fila.filter((i) => i.tarefa_id === tarefaId).sort((a, b) => b.id - a.id), log: log.filter((l) => l.tarefa_id === tarefaId), atividade: base.atividade.filter((a) => a.tarefa_id === tarefaId), estado: base.estado, tarefas, logIndisponivel: false }
      : { fila: [...base.fila].sort((a, b) => b.id - a.id), log, atividade: [], estado: base.estado, tarefas, logIndisponivel: false }
  },
  rpc: (nome, args) => {
    for (const it of base.fila) {
      if (!args.p_ids?.includes(it.id) || it.status !== 'erro') continue
      if (nome === 'tarefas_outbox_reenviar') Object.assign(it, { status: 'pendente', tentativas: 0, erro: null, resolvido_por: P1, resolvido_em: new Date().toISOString() })
      if (nome === 'tarefas_outbox_ignorar') Object.assign(it, { status: 'cancelado', resolvido_por: P1, resolvido_em: new Date().toISOString() })
    }
    return { data: 1 }
  },
}

export default function DevSincronizacao() {
  const { toast, showToast } = useToast()
  const [filtro, setFiltro] = useState(null)
  // layout effect: roda antes do primeiro carregamento do hook (efeito comum do filho), e sai
  // ao desmontar para o /tarefas de verdade não ler dados fictícios na mesma aba
  useLayoutEffect(() => { window.__DEV_SYNC = DEV_SYNC; return () => { delete window.__DEV_SYNC } }, [])
  return (
    <div className="ln vt min-h-screen bg-ln-panel">
      <SincronizacaoView
        membrosMap={new Map(membros.map((m) => [m.id, m]))}
        listasMap={new Map(listas.map((l) => [l.id, l]))}
        pastasMap={new Map(pastas.map((p) => [p.id, p]))}
        tarefaFiltro={filtro} onFiltrarTarefa={setFiltro}
        onAbrirTarefa={(id) => showToast(`Abriria a tarefa ${id}`)} onToast={showToast}
      />
      <Toast toast={toast} />
    </div>
  )
}
