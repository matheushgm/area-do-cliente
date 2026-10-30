// Regras puras do painel Sincronização do VertaTask (/tarefas?aba=sincronizacao): agrupa a
// fila VertaTask → ClickUp (tarefas_outbox) em "lotes" (uma ação em massa ou um template
// viram um lote só), traduz erros e avisos para quem não conhece a sincronização e
// descreve o rastro da volta (tarefas_sync_log, migration 121). Sem React nem Supabase.

export const CAMPOS = {
  titulo: 'Título', descricao: 'Descrição', status: 'Status', prioridade: 'Prioridade',
  responsaveis: 'Responsáveis', data_inicio: 'Início', data_vencimento: 'Vencimento',
  estimativa_min: 'Estimativa', tipo_tarefa: 'Tipo de tarefa', dificuldade: 'Dificuldade',
  departamento: 'Departamento', tags: 'Tags', checklists: 'Checklists', parent_id: 'Tarefa pai',
  lista_id: 'Lista', arquivada: 'Arquivada', cliente: 'Cliente',
}
export const rotuloCampo = (k) => CAMPOS[k] || k

export const OPERACOES = { criar: 'Criar', atualizar: 'Atualizar', excluir: 'Excluir', comentar: 'Comentar', relacionar: 'Relacionar', desrelacionar: 'Desfazer relação' }

// Relações (migration 126): como cada tipo vai para o ClickUp, do lado de payload.tarefa_id
export const RELACOES = {
  bloqueia: { rotulo: 'Bloqueia', clickup: 'dependência' },
  relacionada: { rotulo: 'Relacionada a', clickup: 'link' },
  duplica: { rotulo: 'Duplicada de', clickup: null }, // fica só no VertaTask
}
/** { rotulo, outraId, clickup } de um item 'relacionar'/'desrelacionar' (null nos outros). */
export function descreverRelacao(it) {
  const p = it?.payload
  if (!p?.tipo || (it.operacao !== 'relacionar' && it.operacao !== 'desrelacionar')) return null
  const r = RELACOES[p.tipo] || { rotulo: p.tipo, clickup: '' }
  return { rotulo: r.rotulo, outraId: p.relacionada_id, clickup: r.clickup }
}

// Escritas próximas da mesma pessoa = um lote (template aplicado, edição em massa). O
// trigger enfileira um item por tarefa e por escrita, então 14 tarefas de um template
// chegam em 2 ou 3 segundos; 30 s de folga cobrem a edição em massa feita em seguida.
export const JANELA_LOTE_MS = 30_000
export const MAX_TENTATIVAS = 5 // igual a api/_tarefas_push_core.js
// item na fila há mais que isso sem sair = fila atrasada (o front empurra 1,5 s depois)
export const FILA_ATRASADA_MS = 10 * 60_000

const t = (iso) => (iso ? new Date(iso).getTime() : null)

/** Situação de um item da fila, em palavras: { chave, rotulo, tom }. */
export function situacaoItem(it) {
  if (it.status === 'ok') return { chave: 'ok', rotulo: 'Enviado', tom: 'green' }
  if (it.status === 'processando') return { chave: 'enviando', rotulo: 'Enviando', tom: 'accent' }
  if (it.status === 'erro') return { chave: 'erro', rotulo: 'Falhou', tom: 'red' }
  if (it.status === 'cancelado') return it.resolvido_por
    ? { chave: 'ignorado', rotulo: 'Ignorado', tom: 'muted' }
    : { chave: 'cancelado', rotulo: 'Cancelado', tom: 'muted' }
  if ((it.tentativas || 0) > 0) return { chave: 'retentar', rotulo: `Vai tentar de novo (${it.tentativas + 1}ª de ${MAX_TENTATIVAS})`, tom: 'yellow' }
  return { chave: 'fila', rotulo: 'Na fila', tom: 'yellow' }
}

/** Agrupa os itens da fila em lotes (mais recente primeiro). */
export function agruparLotes(itens, janelaMs = JANELA_LOTE_MS) {
  const ordem = [...(itens || [])].sort((a, b) => t(a.created_at) - t(b.created_at) || a.id - b.id)
  const lotes = []
  let atual = null
  for (const it of ordem) {
    const mesmoAutor = atual && (atual.ator_id || null) === (it.ator_id || null)
    if (atual && mesmoAutor && t(it.created_at) - atual._ultimo <= janelaMs) {
      atual.itens.push(it); atual._ultimo = t(it.created_at)
    } else {
      atual = { id: it.id, ator_id: it.ator_id || null, itens: [it], _ultimo: t(it.created_at) }
      lotes.push(atual)
    }
  }
  return lotes.map(resumirLote).reverse()
}

export function resumirLote(l) {
  const cont = { ok: 0, enviando: 0, erro: 0, fila: 0, retentar: 0, ignorado: 0, cancelado: 0 }
  const ops = {}
  const campos = new Set()
  const tarefas = new Set()
  let avisos = 0
  let fimEnvio = null
  for (const it of l.itens) {
    cont[situacaoItem(it).chave]++
    ops[it.operacao] = (ops[it.operacao] || 0) + 1
    for (const c of it.campos || []) campos.add(c)
    if (it.tarefa_id) tarefas.add(it.tarefa_id)
    if (it.avisos?.length) avisos++
    if (it.processed_at && (it.status === 'ok' || it.status === 'erro')) fimEnvio = Math.max(fimEnvio || 0, t(it.processed_at))
  }
  const inicio = t(l.itens[0].created_at)
  const emAberto = cont.enviando + cont.fila + cont.retentar
  const finais = cont.ok + cont.erro
  return {
    id: l.id, ator_id: l.ator_id, itens: l.itens, inicio: l.itens[0].created_at, fim: l.itens[l.itens.length - 1].created_at,
    total: l.itens.length, tarefas: tarefas.size, ops, campos: [...campos], cont, avisos, emAberto,
    progresso: l.itens.length ? finais / Math.max(1, l.itens.length - cont.ignorado - cont.cancelado) : 1,
    // quanto o lote levou para chegar inteiro ao ClickUp (null enquanto falta item)
    duracaoMs: !emAberto && fimEnvio ? fimEnvio - inicio : null,
    esperaMs: emAberto ? Date.now() - inicio : null,
  }
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias". */
export function tempoRelativo(iso, agora = Date.now()) {
  if (!iso) return 'nunca'
  const min = Math.round((agora - t(iso)) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `há ${h} h`
  return `há ${Math.round(h / 24)} dias`
}

/** 42 s, 3 min, 1 h 12 min. */
export function fmtDuracao(ms) {
  if (ms == null) return ''
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
}

// Erros que o ClickUp / o push devolvem, em português e com o que fazer.
const ERROS = [
  [/tarefa excluída na mesma rodada/i, 'Não foi enviada: a tarefa foi excluída logo depois, então só a exclusão foi para o ClickUp.'],
  [/relação "\w+" fica só no VertaTask/i, 'Essa relação não existe no ClickUp ("duplicada de"), então fica só no VertaTask.'],
  [/não existe no ClickUp; a relação fica só no VertaTask/i, 'Uma das tarefas não existe no ClickUp (ex.: lista que não sincroniza), então a relação ficou só aqui.'],
  [/DEPENDS_\d+|dependenc/i, 'O ClickUp recusou a dependência entre as duas tarefas. Confira se elas ainda existem lá.'],
  [/start date cannot be after due date/i, 'O ClickUp recusou: a data de início ficou depois do vencimento. Corrija as datas da tarefa e tente de novo.'],
  [/due date cannot be before start date/i, 'O ClickUp recusou: o vencimento ficou antes da data de início. Corrija as datas da tarefa e tente de novo.'],
  [/OAUTH_0\d\d|not authorized|team not authorized|unauthorized/i, 'O token do ClickUp não tem permissão para esta tarefa ou lista. Peça a um admin para conferir o acesso.'],
  [/limite de requisições/i, 'O ClickUp limitou as requisições (muitas alterações de uma vez). O envio tenta de novo sozinho.'],
  [/sem tempo/i, 'A rodada de envio acabou o tempo antes deste item; ele foi para a próxima.'],
  [/tarefa não existe mais/i, 'A tarefa foi excluída no VertaTask antes de ir para o ClickUp.'],
  [/comentário não existe mais/i, 'O comentário foi apagado antes de ir para o ClickUp.'],
  [/lista não encontrada/i, 'A lista da tarefa não existe mais.'],
  [/criação pendente/i, 'O comentário espera a tarefa ser criada no ClickUp; vai sozinho em seguida.'],
  [/: 404\b|not found/i, 'A tarefa não existe mais no ClickUp (foi apagada lá).'],
  [/status .* não existe/i, 'O status escolhido não existe nessa lista do ClickUp.'],
]
export function traduzirErro(msg) {
  if (!msg) return ''
  for (const [re, txt] of ERROS) if (re.test(msg)) return txt
  return msg
}

// Avisos do push que merecem explicação
const AVISOS = [
  [/mover de lista não é replicado/i, 'Mover de lista não vai para o ClickUp: mova a tarefa lá também.'],
  [/status "(.+)" não existe na lista do ClickUp/i, (m) => `O status "${m[1]}" não existe nessa lista do ClickUp; o status lá não mudou.`],
  [/cópia absorvida/i, 'O webhook do ClickUp criou uma cópia da tarefa antes do vínculo; a cópia foi juntada à original (nada se perdeu).'],
  [/não deixou atribuir o responsável/i, 'O ClickUp não aceitou o responsável por este token; a tarefa foi criada sem responsável lá.'],
  [/opção "(.+)" não existe no campo (.+) desta lista/i, (m) => `A opção "${m[1]}" não existe no campo ${m[2]} dessa lista do ClickUp; o campo ficou sem valor lá.`],
  [/criado no ClickUp depois da última sincronização; mantido/i, 'Um checklist (ou item) criado no ClickUp ainda não tinha chegado aqui; foi mantido lá.'],
  [/ainda é relacionado no sentido inverso/i, 'As duas tarefas ainda estão relacionadas no sentido inverso; no ClickUp é o mesmo link, então ele continua lá.'],
  [/foi apagada antes do envio; nada mandado/i, 'A relação foi desfeita antes de chegar ao ClickUp; nada foi mandado.'],
]
export function traduzirAviso(msg) {
  for (const [re, txt] of AVISOS) { const m = String(msg).match(re); if (m) return typeof txt === 'function' ? txt(m) : txt }
  return msg
}

// ── Volta (tarefas_sync_log) ─────────────────────────────────────────────────
const MOTIVOS = [
  [/push em andamento/i, 'o VertaTask estava enviando esta tarefa ao ClickUp; o envio grava a versão final'],
  [/fora dos spaces/i, 'a tarefa é de um space do ClickUp que não sincroniza'],
  [/não está no espelho/i, 'a tarefa não existe no VertaTask'],
  [/evento sem tarefa/i, 'evento sem tarefa'],
  [/editada no VertaTask depois/i, 'a tarefa foi editada no VertaTask depois e o ClickUp não era mais novo; vale a edição daqui'],
]
export const traduzirMotivo = (m) => { for (const [re, txt] of MOTIVOS) if (re.test(m || '')) return txt; return m || '' }

/** { rotulo, tom, ruido } de uma linha do log da volta. ruido = escondida por padrão. */
export function descreverLog(l) {
  if (l.origem === 'rodada') return l.acao === 'erro'
    ? { rotulo: 'Rodada de sincronização falhou', tom: 'red' }
    : l.acao === 'pulada_conflito' ? { rotulo: 'Mudança do ClickUp não aplicada (conflito)', tom: 'yellow' }
      : l.acao === 'sem_pai' ? { rotulo: 'Gravada sem a tarefa pai', tom: 'yellow' }
        : { rotulo: 'Rodada de sincronização', tom: 'muted' }
  if (l.acao === 'relacao_criada') return { rotulo: `Relação criada no ClickUp (${RELACOES[l.detalhe?.tipo]?.rotulo || l.detalhe?.tipo || '?'})`, tom: 'accent' }
  if (l.acao === 'relacao_removida') return { rotulo: `Relação desfeita no ClickUp (${RELACOES[l.detalhe?.tipo]?.rotulo || l.detalhe?.tipo || '?'})`, tom: 'accent' }
  if (l.origem === 'clickup') return l.acao === 'criada'
    ? { rotulo: 'Chegou do ClickUp (tarefa nova)', tom: 'accent' }
    : l.acao === 'removida' ? { rotulo: 'Apagada no ClickUp (arquivada aqui)', tom: 'yellow' }
      : { rotulo: 'Chegou do ClickUp', tom: 'accent' }
  // webhook
  if (l.acao === 'sem_mudanca') return { rotulo: 'Evento sem mudança (eco de uma edição daqui)', tom: 'muted', ruido: true }
  if (l.acao === 'pulada_conflito') return { rotulo: 'Mudança do ClickUp não aplicada (conflito)', tom: 'yellow' }
  if (l.acao === 'erro') return { rotulo: 'Erro ao receber evento do ClickUp', tom: 'red' }
  return { rotulo: 'Evento do ClickUp ignorado', tom: 'muted' }
}

export const ehProblemaLog = (l) => l.acao === 'erro' || l.acao === 'pulada_conflito' || l.acao === 'sem_pai'

/** Saúde geral, para a frase do topo do painel. */
export function saudeGeral({ fila = [], erros = 0, webhook = null, rodada = null, agora = Date.now() }) {
  const emAberto = fila.filter((i) => i.status === 'pendente' || i.status === 'processando')
  const maisAntigo = emAberto.reduce((m, i) => Math.min(m, t(i.created_at)), Infinity)
  if (erros > 0) return { tom: 'red', titulo: `${erros} ${erros === 1 ? 'alteração não chegou' : 'alterações não chegaram'} ao ClickUp`, texto: 'Veja em Problemas o motivo de cada uma e tente de novo ou ignore.' }
  if (emAberto.length && agora - maisAntigo > FILA_ATRASADA_MS) return { tom: 'yellow', titulo: `Fila atrasada: ${emAberto.length} ${emAberto.length === 1 ? 'alteração esperando' : 'alterações esperando'} há ${fmtDuracao(agora - maisAntigo)}`, texto: 'O ClickUp limita as requisições; muitas alterações de uma vez levam alguns minutos. Enquanto isso, o ClickUp mostra a versão antiga.' }
  if (emAberto.length) return { tom: 'accent', titulo: `Enviando ${emAberto.length} ${emAberto.length === 1 ? 'alteração' : 'alterações'} ao ClickUp`, texto: 'Assim que terminar, o ClickUp fica igual ao VertaTask.' }
  const wh = rodada?.resumo?.webhook
  if (wh && wh.status !== 'active' && !wh.ok) return { tom: 'yellow', titulo: 'O webhook do ClickUp não está ativo', texto: `${wh.aviso || ''} Enquanto isso, as mudanças feitas no ClickUp só chegam pelas rodadas.`.trim() }
  if (rodada && rodada.ultimo_ok === false) return { tom: 'yellow', titulo: 'A última rodada de sincronização falhou', texto: rodada.resumo?.erro || 'Rode de novo pelo botão "Sincronizar agora".' }
  const ultimaNoticia = Math.max(t(webhook?.ultimo_fim) || 0, t(rodada?.ultimo_fim) || 0)
  if (ultimaNoticia && agora - ultimaNoticia > 26 * 3600_000) return { tom: 'yellow', titulo: 'Sem notícias do ClickUp há mais de um dia', texto: 'O webhook pode estar suspenso. Rode "Sincronizar agora" e, se continuar, peça a um admin para conferir o webhook.' }
  return { tom: 'green', titulo: 'Tudo sincronizado', texto: 'Nada na fila para o ClickUp e nenhum erro pendente.' }
}
