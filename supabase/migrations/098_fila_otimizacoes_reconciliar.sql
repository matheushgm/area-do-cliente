-- 098: fila da Central de Otimizações reconciliada com o que já aconteceu no Meta.
--
-- Em 17/10/2026 havia 35 decisões com execucao_status = 'pendente', quase todas
-- já feitas à mão (anúncio pausado) e duas que não deviam mais ser executadas
-- (anúncio voltou a converter). Dois status novos:
--   bloqueada = o anúncio voltou a converter depois da decisão; o robô não
--               executa e alguém reavalia.
--   manual    = ação que o robô não sabe fazer (criativo, investigação, Google);
--               fica com a tarefa no ClickUp. O front (linhaDecisao) já grava
--               assim nas decisões novas.
--
-- reconciliar_fila_otimizacoes(false) só mostra o que mudaria; (true) aplica.
-- O robô deve chamar com true antes de cada rodada e executar só o que
-- continuar 'pendente'. O status anterior fica em execucao_log.reconciliacao.

alter table public.projeto_sugestoes drop constraint if exists projeto_sugestoes_execucao_status_check;
alter table public.projeto_sugestoes add constraint projeto_sugestoes_execucao_status_check
  check (execucao_status in ('pendente', 'executada', 'erro', 'cancelada', 'bloqueada', 'manual'));

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
  ult as (  -- status do anúncio no último dia com linha (30 dias)
    select distinct on (f.id) f.id, d.day,
      d.data->>'Status do Aúncio' as st_ad,
      d.data->>'Status do Conjunto de Anúncio' as st_conj,
      d.data->>'Status da Campanha' as st_camp
    from fila f
    join dash_insights d on d.channel = 'meta' and f.ad_id is not null
      and d.data->>'ad_id' = f.ad_id and d.day >= current_date - 30
    order by f.id, d.day desc
  ),
  depois as (  -- resultado do anúncio depois do dia da decisão
    select f.id, sum(dash_num(d.data->>'Conversões')) as conv, sum(dash_num(d.data->>'Valor investido')) as gasto
    from fila f
    join dash_insights d on d.channel = 'meta' and d.data->>'ad_id' = f.ad_id
      and d.day > (f.decidida_em at time zone 'America/Sao_Paulo')::date
    group by f.id
  )
  select f.id, f.conta, f.anuncio, f.ad_id,
    case
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

revoke all on function public.reconciliar_fila_otimizacoes(boolean) from public, anon;
grant execute on function public.reconciliar_fila_otimizacoes(boolean) to authenticated, service_role;
