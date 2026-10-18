-- 097: metas por métrica para a Central de Otimizações (playbookSugestoes.js).
--
-- O motor comparava tudo com o CPL alvo. Campanha de compra precisa ser julgada
-- pelo CAC (custo por venda) e campanha de MQL pelo custo por MQL. As duas metas
-- saem da mesma conta da calculadora de ROI que gera o CPL alvo (062), na mesma
-- base de MÍDIA (media_orcamento / vendas, / MQLs), porque o gasto do dash é só
-- mídia. O `cac` gravado em roi_calculators.result usa mídia + fee e por isso
-- NÃO é usado aqui.
--
-- cpl_target continua idêntico ao da 062 (conferido nos 78 projetos em
-- 2026-10-18); só a conta foi reescrita em laterais para reaproveitar vendas,
-- MQLs e leads.
--
-- metrica_formulario: como o motor julga formulário nativo do Meta. 'mql' para
-- formulário condicional/qualificado (Nectar FORMS, Multichat360, WJK), cujo
-- `Tipo de resultado` no dash é igual ao de um formulário comum.

alter table public.projects_v2
  add column if not exists metrica_formulario text not null default 'lead'
  check (metrica_formulario in ('lead', 'mql'));

comment on column public.projects_v2.metrica_formulario is
  'Central de Otimizações: formulário nativo do Meta é julgado como lead (CPL) ou mql (custo por MQL, formulário qualificado).';

create or replace view public.cpl_targets_public as
select distinct on (p.id)
  p.id as project_id,
  p.company_name,
  case when ok.v then r.media_orcamento / nullif(f.leads, 0) end  as cpl_target,
  case when ok.v then r.media_orcamento / nullif(f.vendas, 0) end as cac_target,
  case when ok.v then r.media_orcamento / nullif(f.mqls, 0) end   as mql_target,
  p.metrica_formulario
from public.projects_v2 p
left join public.roi_calculators r on r.project_id = p.id
left join lateral (
  select (r.margem_bruta > 0 and r.ticket_medio > 0 and r.qtd_compras > 0
          and r.taxa_sql_venda > 0 and r.taxa_mql_sql > 0 and r.taxa_lead_mql > 0) as v
) ok on true
left join lateral (
  select v.vendas, m.mqls, ceil(m.mqls / nullif(r.taxa_lead_mql / 100.0, 0)) as leads
  from (select ceil((r.media_orcamento + r.custo_marketing) * (1 + r.roi_desejado / 100.0)
                    / nullif(r.ticket_medio * r.qtd_compras::numeric * (r.margem_bruta / 100.0), 0)) as vendas) v,
  lateral (select ceil(ceil(v.vendas / nullif(r.taxa_sql_venda / 100.0, 0))
                   / nullif(r.taxa_mql_sql / 100.0, 0)) as mqls) m
) f on true
order by p.id, r.created_at desc nulls last;

-- Projetos com formulário qualificado (conferência de otimizações de 17/10/2026)
update public.projects_v2 set metrica_formulario = 'mql'
where trim(company_name) in ('Nectar Crm', 'Multichat360', 'WJK Travel');
