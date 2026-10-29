# Plano de melhorias — sincronização ClickUp ↔ VertaTask

Data da análise: 2026-10-29. Objetivo: manter um espelho fiel do ClickUp sem exceder o
limite da API (100 requisições por minuto no token pessoal; todos os caminhos abaixo e
também `api/atividades.js`, `api/clickup.js` e `api/clickup-proxy.js` dividem esse limite).

## Status da execução (2026-10-29, branch `vertatask-painel-sincronizacao`)

| Item | Status |
|---|---|
| 1. Push agrupado por tarefa | Feito (`agruparFila`, sem GET final desnecessário, reivindicação de 120 itens). Testado com Supabase e ClickUp falsos: 8 itens → 4 chamadas. Falta o teste real com edição em massa numa lista de teste. |
| 2. Prazo no pull e `ultimo_inicio` no fim | Feito (`semTempo` na rodada, `resumo.incompleto`, pull de até 40 s; endpoint e script). |
| 3. Saúde do webhook e reconciliação semanal | Feito (`api/_tarefas_webhook_saude.js`, só no cron; reconciliação aos domingos; prazo de 18 s no webhook; aviso no botão e no painel). |
| 4. Rodada ao abrir mais rara e leve | Feito (só com webhook calado +30 min ou rodada +3 h; sem comentários, anexos e arquivados fora do cron). |
| 5. Webhook em duas fases | Não feito, como previsto: só se 1 a 4 não bastarem. |
| 6. Chat desligado + tarja offline | Feito (front, endpoint 503, rodada sem chat, migration 122 desliga os triggers de `chat_outbox`). |
| 7. Conflito silencioso | Só registrado, como previsto. |

As migrations 121 (painel Sincronização) e 122 (chat) ainda precisam ser aplicadas no Supabase.

## Diagnóstico em uma frase

O desenho está certo (webhook como caminho principal, rodada periódica como rede de
segurança, outbox com reivindicação atômica, trava de uma rodada por vez). O limite só é
ameaçado em rajadas, e as duas maiores fontes de rajada são evitáveis: o push cria vários
itens de fila por tarefa numa edição em massa, e a rodada incremental roda inteira ao abrir
a página mesmo quando o webhook já entregou tudo.

## Quanto cada caminho gasta hoje

| Caminho | Chamadas ao ClickUp | Quando dispara |
|---|---|---|
| Webhook (`api/clickup-webhook.js`) | 1 GET por evento (+1 pai ausente, +1 lista nova, +1 comentários) | segundos após cada mudança no ClickUp |
| Rodada incremental (`api/tarefas-sync.js`) | 13 fixas de estrutura + páginas + até 40 comentários + até 40 anexos | cron 09:00 UTC, botão, e ao abrir `/tarefas` se a última tem +30 min |
| Push "atualizar" (`api/_tarefas_push_core.js`) | 2 por item (PUT + GET final); 3 se mexe em responsáveis | 1,5 s após cada escrita, por aba aberta |
| Push "criar" | 1 POST (+1 por lista por rodada para os campos) | idem |
| Chat pull (`api/chat-sync.js`) | 1 a 2 + 1 por canal com atividade | ao abrir o chat e a cada 2 min por aba, sem trava |

Evidência do pico (tabela `tarefas_outbox`, 2026-10-28 das 19h às 20h UTC): 427 itens
para 99 tarefas (média 4,3 por tarefa, máximo 14 na mesma), campos `responsaveis` 172,
`status` 98, `data_vencimento` 55, `prioridade` 45; cerca de 900 chamadas e 69 minutos
para esvaziar.

---

## 1. Juntar os itens da outbox por tarefa e não reler à toa  (prioridade máxima)

**Problema.** O push processa item a item. Três edições na mesma tarefa viram três
itens e cada item custa 2 ou 3 chamadas. Além disso o GET final depois do PUT é
incondicional, embora o PUT já devolva a tarefa com `date_updated`.

**Solução.**
- Em `empurrar()` (`api/_tarefas_push_core.js`), depois de reivindicar a fila, agrupar
  os itens `atualizar` pendentes da mesma `tarefa_id`: união dos `campos`, um PUT só, e
  marcar todos os itens do grupo como `ok` (ou todos como `pendente`/`erro` na falha).
  Item `criar` continua sozinho; `excluir` cancela os `atualizar` da mesma tarefa.
- Pular o GET final quando o PUT devolveu a tarefa e não houve tags, campos
  personalizados nem checklist (nesses casos a releitura continua).
- Para `responsaveis`, o GET prévio fica (precisa do `add`/`rem`), mas passa a ser um
  por tarefa, não um por item.

**Efeito esperado.** O pico de 28/10 cairia de ~900 para ~200 chamadas.

**Arquivos.** `api/_tarefas_push_core.js`. Nenhuma migration.

## 2. Relógio no pull e `ultimo_inicio` só no fim  (prioridade máxima)

**Problema.** `api/tarefas-sync.js` soma 15 s de push, 50 s de pull e no mínimo 5 s de
chat contra `maxDuration` 60. O `estourou()` só é checado entre etapas e o `fazClickup`
de `api/_tarefas_sync_core.js` não tem prazo (até 8 tentativas de 429 com esperas de 5,
10, 15… s). Se a Vercel mata a função, o `catch` não roda e `ultimo_inicio` já foi
gravado no começo da rodada: a próxima parte de "novo início − 15 min" e a faixa entre o
início anterior e esse ponto nunca mais é varrida pelo polling.

**Solução.**
- Dar ao `fazClickup` do pull o mesmo `prazo` que o push já tem (`semTempo`): não começa
  chamada nem espera 429 além do orçamento; o que faltou fica para a próxima rodada.
- Gravar `ultimo_inicio` **só** junto com `ultimo_fim` e `ultimo_ok = true`. Durante a
  rodada, guardar o início em memória (ou numa coluna separada, ex.: `rodada_inicio`,
  que não é usada como ponto de partida).
- Reduzir o orçamento do pull quando a rodada também roda o push (ex.: 40 s), para a soma
  caber nos 60 s com folga para as gravações no Supabase.

**Arquivos.** `api/_tarefas_sync_core.js`, `api/tarefas-sync.js`,
`scripts/sincronizar_clickup.mjs` (mesmo ajuste do `ultimo_inicio`).

## 3. Vigiar a saúde do webhook e reconciliar por semana  (alta)

**Problema.** O ClickUp suspende webhook que falha repetidamente; o handler tem
`maxDuration` 30 com até 8 esperas de 429 dentro, então em rajada algumas invocações
morrem com timeout e contam como falha. Nada confere o status. E o cron não passa
`reconciliar=1`: tarefa apagada no ClickUp só sai do espelho pelo evento `taskDeleted`.

**Solução.**
- Na rodada do cron, 1 chamada `GET /team/{team}/webhook`: se o nosso webhook
  (`CLICKUP_WEBHOOK_ID`) não estiver `active`, reativar com `PUT /webhook/{id}`
  (`status: 'active'`) e registrar um aviso em `tarefas_sync.resumo`. Mostrar esse aviso
  no botão "ClickUp há X min" de `/tarefas`.
- `reconciliar=1` uma vez por semana (ex.: o cron de domingo, decidido pela data dentro
  do handler). Custo: ~25 páginas de abertas + 1 GET por tarefa sumida.
- Prazo no `fazClickup` do webhook também (item 2), com teto bem abaixo dos 30 s.

**Arquivos.** `api/tarefas-sync.js`, `api/clickup-webhook.js`, `src/pages/Tarefas.jsx`
(exibição do aviso).

## 4. Rodada ao abrir a página: mais rara e mais leve  (alta)

**Problema.** Com o webhook funcionando, a rodada de 30 em 30 min quase não traz nada
(última real: 20 recebidas, 1 atualizada) e mesmo assim paga 13 chamadas de estrutura
(6 só para listar arquivados) e até 80 em comentários e anexos, que o webhook já traz.

**Solução.**
- `SYNC_AUTO_MS` em `src/pages/Tarefas.jsx`: de 30 min para 2 a 4 h, **ou** disparar só
  se o último evento do webhook (`tarefas_sync.clickup_webhook.ultimo_fim`) for mais
  antigo que 30 min (sinal de webhook em silêncio).
- Na rodada disparada pelo usuário/página, passar `comentarios=0` e `maxAnexos=0`;
  comentários e anexos ficam só no cron.
- Listagem de pastas/listas arquivadas (`archived=true`) só no cron ou em `--completo`.

**Arquivos.** `src/pages/Tarefas.jsx`, `api/tarefas-sync.js`, `api/_tarefas_sync_core.js`.

## 5. Webhook em duas fases  (média; mudança estrutural)

**Problema.** Uma edição no ClickUp gera até 3 eventos (12 tipos assinados), cada um com
seu GET; edição em massa lá vira centenas de invocações paralelas disputando o limite.

**Solução.**
- Tabela `tarefas_webhook_eventos` (event, task_id, recebido_em, processado_em). O
  handler valida a assinatura, grava e responde 200 na hora.
- Um processador (chamado pelo próprio handler com debounce, ou pelo cron a cada minuto)
  lê os eventos pendentes agrupados por `task_id` com janela de 3 a 5 s e faz **1 GET por
  tarefa**, aplicando a lógica atual de `processarEventoTarefa`.
- Opcional: usar `history_items` do payload para status, prioridade, data e responsável
  sem GET, mantendo o GET só para o resto.

**Arquivos.** `api/clickup-webhook.js`, `api/_tarefas_webhook_core.js`, migration nova.

## 6. Desligar a sincronização do chat e marcar a aba como offline  (decisão tomada)

**Decisão.** A sincronização Chat ↔ ClickUp Chat é desativada. O chat interno continua
funcionando entre as pessoas do time, mas nada mais vai nem vem do ClickUp. É o único
consumo que nunca parava (1 pull a cada 2 min por aba aberta, sem trava).

**O que fazer.**
- `src/hooks/useChat.js`: remover o `setInterval` de 2 min, o pull ao abrir e o push com
  debounce (`/api/chat-sync`). Nada no front chama mais o endpoint.
- `api/tarefas-sync.js`: tirar a chamada a `sincronizarChat` da rodada diária.
- `api/chat-sync.js`: responder `503 { ok: false, error: 'Sincronização do chat desativada.' }`
  em qualquer chamada (o arquivo e `api/_chat_sync_core.js` ficam, para religar se um dia
  quiser; o script de importação manual continua existindo).
- `chat_outbox`: desativar o trigger que enfileira (`drop trigger` em migration nova) ou
  deixar o trigger e marcar os itens como `cancelado`; sem isso a fila cresce para sempre.
  Preferência: migration que desabilita o trigger, reversível.
- **Tarja "offline" na aba Chat:**
  - no item "Chat" da coluna esquerda (`src/components/Tarefas/TarefasSidebar.jsx`,
    `NavItem` com `nav.aba === 'chat'`): uma pílula pequena ao lado do nome, texto
    "offline", cor neutra (`ln-pill`, cinza), com `title` explicando "Sem sincronização
    com o ClickUp. As mensagens ficam só aqui.";
  - dentro do módulo (`src/components/Chat/ChatModulo.jsx`): uma faixa fina no topo da
    conversa, fundo `ln-yellow` suave, texto "Chat offline: este chat não sincroniza mais
    com o ClickUp. O que você escrever aqui fica só no VertaTask." A faixa não bloqueia
    o uso.
- `CLAUDE.md`: atualizar a seção "Chat ↔ ClickUp Chat" dizendo que está desativada desde
  2026-10-29 e como religar.

**Arquivos.** `src/hooks/useChat.js`, `api/tarefas-sync.js`, `api/chat-sync.js`,
`src/components/Tarefas/TarefasSidebar.jsx`, `src/components/Chat/ChatModulo.jsx`,
migration nova (trigger de `chat_outbox`), `CLAUDE.md`.

## 7. Conflito silencioso (registrar, não corrigir agora)

Se o pull vê o ClickUp mais novo e sobrescreve uma linha cuja edição ainda está na
outbox, o push lê a linha na hora e manda o valor já sobrescrito: a edição local some sem
aviso. Raro. Quando for tratar: o item da outbox guardar o valor pretendido, ou a rodada
de pull pular tarefas com item `pendente`/`processando`, como o webhook já faz.

---

## Ordem de execução sugerida

1. Item 6 (desligar o chat): menor risco, tira consumo constante, pode sair hoje.
2. Itens 1 e 2 juntos (push coalescido + relógio e `ultimo_inicio` no pull): corrigem
   desperdício e perda de janela; testar com uma edição em massa de ~50 tarefas numa
   lista de teste e conferir `tarefas_outbox` e o ClickUp.
3. Item 3 (saúde do webhook + reconciliação semanal).
4. Item 4 (rodada automática mais rara e leve).
5. Item 5 (webhook em duas fases), só se os itens anteriores não bastarem ou se houver
   rajadas vindas do próprio ClickUp (automações, movimentações em massa).

## Como medir se deu certo

- `select date_trunc('hour', created_at), count(*), count(distinct tarefa_id) from tarefas_outbox group by 1`:
  a razão itens/tarefas deve cair para perto de 1 após o item 1.
- `tarefas_sync.resumo.duracao_s` das rodadas: nunca perto de 50 s após o item 2.
- `tarefas_sync` linha `clickup_webhook`: `ultimo_fim` recente em dia útil; aviso de
  webhook inativo nunca aparecendo após o item 3.
- Ausência de respostas 429 nos logs da Vercel (`get_runtime_logs`) durante uma edição em massa.

## Ressalva sobre o plano do ClickUp

O limite de 100 req/min vale para Free, Unlimited e Business. Business Plus tem 1.000 e
Enterprise 10.000. Os itens 1, 2 e 3 valem em qualquer plano (corrigem perda de dados e
desperdício); 4 e 5 perdem urgência em plano maior. O item 6 é decisão de produto.
