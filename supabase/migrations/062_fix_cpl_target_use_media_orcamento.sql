-- 062 — Corrige o CPL alvo do dashboard
--
-- A view cpl_targets_public calculava o CPL alvo dividindo pelo fee de gestão
-- (custo_marketing) em vez do Orçamento em Mídia (media_orcamento). A calculadora
-- de ROI exibe "CPL (mídia)" = media_orcamento / leads_necessários, e o CPL real
-- no dashboard vem do gasto em anúncio — então o alvo precisa estar na mesma base.
-- Com custo_marketing o alvo ficava errado e zerava quando o fee era 0
-- (ex.: Matheus Business → CPL alvo R$ 0,00).
--
-- Único ajuste: numerador custo_marketing → media_orcamento. O cálculo de
-- leads_necessários é idêntico.
CREATE OR REPLACE VIEW cpl_targets_public AS
 SELECT DISTINCT ON (p.id) p.id AS project_id,
    p.company_name,
        CASE
            WHEN ((r.margem_bruta > (0)::numeric) AND (r.ticket_medio > (0)::numeric) AND (r.qtd_compras > 0) AND (r.taxa_sql_venda > (0)::numeric) AND (r.taxa_mql_sql > (0)::numeric) AND (r.taxa_lead_mql > (0)::numeric)) THEN (r.media_orcamento / NULLIF(ceil((ceil((ceil((ceil((((r.media_orcamento + r.custo_marketing) * ((1)::numeric + (r.roi_desejado / 100.0))) / NULLIF(((r.ticket_medio * (r.qtd_compras)::numeric) * (r.margem_bruta / 100.0)), (0)::numeric))) / NULLIF((r.taxa_sql_venda / 100.0), (0)::numeric))) / NULLIF((r.taxa_mql_sql / 100.0), (0)::numeric))) / NULLIF((r.taxa_lead_mql / 100.0), (0)::numeric))), (0)::numeric))
            ELSE NULL::numeric
        END AS cpl_target
   FROM (projects_v2 p
     LEFT JOIN roi_calculators r ON ((r.project_id = p.id)))
  ORDER BY p.id, r.created_at DESC NULLS LAST;
