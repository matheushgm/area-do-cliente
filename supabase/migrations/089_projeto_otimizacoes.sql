-- Migration 089: Hub do projeto (página do cliente em 3 colunas)
--
-- 1. projeto_otimizacoes: diário do que o time fez na conta (otimizações) e
--    anotações livres do projeto. Aparece na timeline central da página do
--    cliente, junto com as tarefas planejadas, tarefas do ClickUp e atas.
-- 2. projeto_sugestoes: estado das sugestões do playbook (calculadas na hora
--    a partir do dash_insights). Só guarda o que o usuário decidiu: aceitou
--    (virou tarefa no ClickUp) ou descartou (some da lista por um período).

create table if not exists public.projeto_otimizacoes (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects_v2(id) on delete cascade,
  tipo            text not null default 'otimizacao'
                  check (tipo in ('otimizacao', 'anotacao')),
  data            date not null default (now() at time zone 'America/Sao_Paulo')::date,
  canal           text check (canal in ('meta', 'google', 'ambos', 'outro')),
  campanha        text,                       -- campanha / conjunto / anúncio afetado
  acao            text not null,              -- o que foi feito (ou o título da anotação)
  motivo          text,                       -- por quê / contexto
  metricas_antes  jsonb,                      -- { cpl, ctr, gasto, conv, ... } livre
  resultado       text,                       -- preenchido depois: o que aconteceu
  origem          text not null default 'manual'
                  check (origem in ('manual', 'sugestao')),
  sugestao_chave  text,                       -- chave da sugestão do playbook que originou
  clickup_task_id text,
  clickup_task_url text,
  created_by      uuid references public.profiles(id) on delete set null,
  autor_nome      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_projeto_otimizacoes_project
  on public.projeto_otimizacoes(project_id, data desc, created_at desc);

create table if not exists public.projeto_sugestoes (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects_v2(id) on delete cascade,
  chave            text not null,             -- id estável da regra + entidade
  status           text not null check (status in ('aceita', 'descartada')),
  titulo           text,
  payload          jsonb,                     -- a sugestão como estava na hora
  clickup_task_id  text,
  clickup_task_url text,
  atividade_id     uuid references public.atividades_planejadas(id) on delete set null,
  valida_ate       date,                      -- descartada: volta a aparecer depois daqui
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (project_id, chave)
);

create index if not exists idx_projeto_sugestoes_project
  on public.projeto_sugestoes(project_id);

create or replace function public.projeto_otimizacoes_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_projeto_otimizacoes_touch on public.projeto_otimizacoes;
create trigger trg_projeto_otimizacoes_touch
  before update on public.projeto_otimizacoes
  for each row execute function public.projeto_otimizacoes_touch();

alter table public.projeto_otimizacoes enable row level security;
alter table public.projeto_sugestoes   enable row level security;

-- É operação do time, não dado pessoal: todo mundo logado lê e escreve.
create policy "projeto_otimizacoes_team"
  on public.projeto_otimizacoes for all
  to authenticated using (true) with check (true);

create policy "projeto_sugestoes_team"
  on public.projeto_sugestoes for all
  to authenticated using (true) with check (true);
