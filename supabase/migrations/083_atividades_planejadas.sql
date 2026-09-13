-- Migration 083: Planejador de Atividades (rota /atividades)
--
-- O account preenche uma atividade nova, o sistema lê a carga do responsável
-- no ClickUp e sugere a data real de entrega. Ao aprovar, a tarefa é criada
-- no ClickUp (pasta do cliente) e fica registrada aqui, com o "retrato" da
-- carga usado no cálculo — pra auditar depois por que a data foi aquela.

create table if not exists public.atividades_planejadas (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid references public.projects_v2(id) on delete set null,
  titulo                  text not null,
  descricao               text,
  tipo_tarefa             text,
  departamento            text,
  responsavel_profile_id  uuid references public.profiles(id) on delete set null,
  responsavel_clickup_id  bigint,
  horas_estimadas         numeric(6,2) not null,
  prioridade              text,                       -- urgent | high | normal | low
  data_inicio_sugerida    date,
  data_sugerida           date,                       -- o que o sistema sugeriu
  data_escolhida          date,                       -- o que o account aprovou
  sobrecarga              boolean not null default false,
  horas_excedentes        numeric(6,2),
  justificativa           text,                       -- por que forçou data mais cedo
  snapshot_carga          jsonb,                      -- resumo da agenda no momento
  clickup_task_id         text,
  clickup_task_url        text,
  clickup_list_id         text,
  status                  text not null default 'criada'
                          check (status in ('criada', 'erro')),
  aviso                   text,                       -- ex.: "não foi possível atribuir"
  created_by              uuid references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now()
);

create index if not exists idx_atividades_planejadas_project on public.atividades_planejadas(project_id);
create index if not exists idx_atividades_planejadas_created on public.atividades_planejadas(created_at desc);

alter table public.atividades_planejadas enable row level security;

-- Todo o time enxerga o histórico (é operação, não dado pessoal).
create policy "atividades_planejadas_select_team"
  on public.atividades_planejadas for select
  to authenticated using (true);

-- Escrita normal acontece pela Edge Function com a service key (que ignora
-- RLS). Ainda assim, quem criou pode inserir/editar a própria linha e admin
-- pode tudo, pra permitir ajustes manuais pelo app.
create policy "atividades_planejadas_insert_own"
  on public.atividades_planejadas for insert
  to authenticated with check (created_by = auth.uid());

create policy "atividades_planejadas_update_own_or_admin"
  on public.atividades_planejadas for update
  to authenticated
  using (created_by = auth.uid() or (auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check (created_by = auth.uid() or (auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "atividades_planejadas_delete_admin"
  on public.atividades_planejadas for delete
  to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Configuração do cálculo (capacidade por pessoa, horas por tipo, etc.).
-- Uma linha só ('global'); o JSON segue DEFAULT_CONFIG de api/_atividades_engine.js.
create table if not exists public.atividades_config (
  id          text primary key default 'global',
  config      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

alter table public.atividades_config enable row level security;

create policy "atividades_config_select_team"
  on public.atividades_config for select
  to authenticated using (true);

create policy "atividades_config_write_admin"
  on public.atividades_config for all
  to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

insert into public.atividades_config (id, config) values ('global', '{}'::jsonb)
on conflict (id) do nothing;
