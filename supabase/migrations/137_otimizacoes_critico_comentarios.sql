-- 137: Central de Otimizações com o gestor de tráfego do Escritório no comando
-- (pedido do Matheus em 24/11/2026).
--
-- 1. Status 'critica' em projeto_sugestoes: o agente julgou a otimização crítica
--    (desligar conjunto ou campanha, aumentar verba) e ela espera aprovação na aba
--    Crítico da /otimizacoes. Não aparece em Pendentes (pendente() só devolve sugestão
--    sem decisão ou adiada vencida). Aprovar = status 'aceita' + execucao_status
--    'pendente' (o agente executa na rodada seguinte); reprovar = 'recusada' com motivo.
-- 2. projeto_sugestoes_comentarios: conversa por sugestão entre o time e o agente,
--    casada por (project_id, chave), então vale também para sugestão ainda sem decisão.
--    A rotina de hora em hora do agente lê os comentários de pessoa com
--    tratado_em vazio, responde e marca tratado_em.
-- 3. agentes_rotinas.gatilho: rotina com gatilho só chama o agente quando o gatilho
--    tem novidade (o Escritório confere antes; sem novidade a rodada é pulada sem gastar
--    tokens).

alter table public.projeto_sugestoes drop constraint if exists projeto_sugestoes_status_check;
alter table public.projeto_sugestoes add constraint projeto_sugestoes_status_check
  check (status in ('aceita', 'descartada', 'recusada', 'critica'));

alter table public.projeto_sugestoes
  add column if not exists critica_motivo text,   -- por que o agente julgou crítica
  add column if not exists aprovada_por   text,   -- quem aprovou/reprovou na aba Crítico
  add column if not exists aprovada_em    timestamptz;

create index if not exists idx_projeto_sugestoes_critica
  on public.projeto_sugestoes(decidida_em desc)
  where status = 'critica';

create table if not exists public.projeto_sugestoes_comentarios (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects_v2(id) on delete cascade,
  chave       text not null,
  autor_tipo  text not null default 'pessoa' check (autor_tipo in ('pessoa', 'agente')),
  autor_id    uuid references public.profiles(id) on delete set null,
  autor_nome  text,
  texto       text not null check (length(trim(texto)) > 0),
  tratado_em  timestamptz,       -- comentário de pessoa já lido e respondido pelo agente
  created_at  timestamptz not null default now()
);

create index if not exists idx_sug_coment_chave
  on public.projeto_sugestoes_comentarios(project_id, chave, created_at);
create index if not exists idx_sug_coment_nao_tratados
  on public.projeto_sugestoes_comentarios(created_at)
  where autor_tipo = 'pessoa' and tratado_em is null;

alter table public.projeto_sugestoes_comentarios enable row level security;

-- Operação do time, como projeto_sugestoes: todo mundo logado lê e escreve.
drop policy if exists "projeto_sugestoes_comentarios_team" on public.projeto_sugestoes_comentarios;
create policy "projeto_sugestoes_comentarios_team"
  on public.projeto_sugestoes_comentarios for all
  to authenticated using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table public.projeto_sugestoes_comentarios;
exception when duplicate_object then null; end $$;

alter table public.agentes_rotinas add column if not exists gatilho text;

-- A /otimizacoes relê as decisões quando o agente grava (realtime).
do $$ begin
  alter publication supabase_realtime add table public.projeto_sugestoes;
exception when duplicate_object then null; end $$;

-- Fila reconciliada só nas regras de anúncio. As outras que o agente executa
-- (remanejar, desligar conjunto aprovado, escalar aprovado, Google) não são mexidas;
-- o resto continua 'manual'. Mesma divisão de src/lib/otimizacoesAgente.js.
create or replace function public.reconciliar_fila_otimizacoes(p_aplicar boolean default false)
returns table (sugestao_id uuid, conta text, anuncio text, ad_id text, novo_status text, log jsonb)
language plpgsql security invoker set search_path = public as $$
begin
  drop table if exists _rec;
  create temp table _rec on commit drop as
  with fila as (
    select s.id, s.conta, s.anuncio, s.ad_id, s.chave, s.decidida_em
    from projeto_sugestoes s
    where s.execucao_status = 'pendente'
  ),
  ult as (
    select distinct on (f.id) f.id, d.day,
      d.data->>'Status do Aúncio' as st_ad,
      d.data->>'Status do Conjunto de Anúncio' as st_conj,
      d.data->>'Status da Campanha' as st_camp
    from fila f
    join dash_insights d on d.channel = 'meta' and f.ad_id is not null
      and d.data->>'ad_id' = f.ad_id and d.day >= current_date - 30
    order by f.id, d.day desc
  ),
  depois as (
    select f.id, sum(dash_num(d.data->>'Conversões')) as conv, sum(dash_num(d.data->>'Valor investido')) as gasto
    from fila f
    join dash_insights d on d.channel = 'meta' and d.data->>'ad_id' = f.ad_id
      and d.day > (f.decidida_em at time zone 'America/Sao_Paulo')::date
    group by f.id
  )
  select f.id, f.conta, f.anuncio, f.ad_id,
    case
      when f.chave ~ '(^|\|)(meta:(conj_remanejar|conj_desligar|escalar)|google:(camp_cpl_alto|perda_orcamento)):' then null
      when f.ad_id is null or f.chave !~ '(^|\|)meta:(ad_sem_conv|ad_cpl_alto|topo_gancho):' then 'manual'
      when u.st_ad ~* 'paus|archiv|delet' then 'executada'
      when coalesce(p.conv, 0) > 0 and f.chave !~ 'topo_gancho' then 'bloqueada'
    end as novo,
    jsonb_build_object('origem', 'reconciliacao', 'em', now(),
      'status_anuncio', u.st_ad, 'status_conjunto', u.st_conj, 'status_campanha', u.st_camp,
      'ultimo_dia', u.day, 'conv_desde_decisao', p.conv, 'gasto_desde_decisao', p.gasto) as lg
  from fila f
  left join ult u on u.id = f.id
  left join depois p on p.id = f.id;

  if p_aplicar then
    update projeto_sugestoes s
       set execucao_status = r.novo,
           execucao_log = coalesce(s.execucao_log, '{}'::jsonb) || jsonb_build_object('reconciliacao', r.lg),
           executada_em = case when r.novo = 'executada' then now() else s.executada_em end
      from _rec r
     where s.id = r.id and r.novo is not null and s.execucao_status = 'pendente';
  end if;

  return query select r.id, r.conta, r.anuncio, r.ad_id, r.novo, r.lg from _rec r where r.novo is not null;
end $$;
