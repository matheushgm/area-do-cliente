-- Migração do Dashboard de Tráfego para dentro da Área do Cliente.
-- Consolida as duas tabelas que viviam no Supabase próprio do dashboard
-- (projeto opeprchaozuohrdguuzp) para o Supabase da Área do Cliente, de modo
-- que o dashboard passe a usar um único client autenticado pelo login do app.
--
-- Os dados existentes (47 squads + 21 mapeamentos) são copiados via script
-- separado (INSERT ... ON CONFLICT) após esta migração criar o schema.

-- ─── client_squads ────────────────────────────────────────────────────────────
-- Rótulo de squad (Caça ROI / Zero Churn) atribuído a cada cliente do dashboard,
-- chaveado pelo nome como aparece nas planilhas (não há FK — o nome do
-- dashboard pode divergir do company_name em projects_v2; o vínculo formal
-- fica em client_mapping).
CREATE TABLE client_squads (
  client_name TEXT PRIMARY KEY,
  squad       TEXT CHECK (squad = ANY (ARRAY['Caça ROI'::text, 'Zero Churn'::text])),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS: leitura e escrita para qualquer autenticado — atribuir squad é uma ação
-- rotineira do time, não restrita a admins (preserva o comportamento original
-- do dashboard, onde qualquer usuário logado podia escrever).
ALTER TABLE client_squads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_squads_read"  ON client_squads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "client_squads_write" ON client_squads FOR ALL    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ─── client_mapping ───────────────────────────────────────────────────────────
-- Vínculo entre o nome do cliente no dashboard (planilhas) e a empresa
-- correspondente na Área do Cliente + pasta do ClickUp. Usado para resolver
-- a meta de CPL (cpl_targets_public), o ROI (roi_details_public) e as
-- atividades (ClickUp) de cada cliente.
CREATE TABLE client_mapping (
  dashboard_name    TEXT PRIMARY KEY,
  ac_company_name   TEXT,
  ac_project_id     UUID,
  clickup_folder_id TEXT,
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE client_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_mapping_read"  ON client_mapping FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "client_mapping_write" ON client_mapping FOR ALL    USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
