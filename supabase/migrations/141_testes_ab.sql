-- Migration 141: Testes A/B das landing pages (Lovable ou qualquer outra).
--
-- O teste mora aqui, não na LP. A página carrega uma vez o kit /ab.js e ele:
--   1. busca a configuração em /api/ab?e=<slug> (variantes ativas + pesos);
--   2. sorteia a variante pelo peso e guarda no navegador (a pessoa sempre vê a mesma);
--   3. troca o texto dos elementos marcados com data-ab="headline" etc. (tipo 'texto')
--      ou manda para a URL da variante (tipo 'pagina');
--   4. registra impressão e conversão em /api/ab (POST).
--
-- O navegador nunca escreve direto nestas tabelas: os eventos entram pela
-- função /api/ab com a chave de serviço. O time logado lê e gerencia.

create table if not exists public.ab_experimentos (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,                 -- id público que vai no script da LP
  project_id    uuid references public.projects_v2(id) on delete set null,
  nome          text not null,
  descricao     text,
  url           text,                                 -- página onde o teste roda
  tipo          text not null default 'texto' check (tipo in ('texto', 'pagina')),
  status        text not null default 'rascunho' check (status in ('rascunho', 'rodando', 'pausado', 'encerrado')),
  -- O que conta como conversão: lead (form), clique (botão marcado, ex. WhatsApp) ou os dois.
  conversao     text not null default 'todas' check (conversao in ('lead', 'clique', 'todas')),
  vencedor_id   uuid,
  iniciado_em   timestamptz,
  encerrado_em  timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_ab_experimentos_project on public.ab_experimentos(project_id);
create index if not exists idx_ab_experimentos_status  on public.ab_experimentos(status);

create table if not exists public.ab_variantes (
  id             uuid primary key default gen_random_uuid(),
  experimento_id uuid not null references public.ab_experimentos(id) on delete cascade,
  nome           text not null,
  hipotese       text,
  original       boolean not null default false,      -- controle: usa o texto que já está na LP
  peso           int not null default 0 check (peso between 0 and 100),   -- % de exibição
  conteudo       jsonb not null default '{}'::jsonb,  -- { "headline": "...", "subheadline": "...", "cta": "..." }
  url            text,                                -- tipo 'pagina': para onde mandar
  ordem          int not null default 0,
  arquivada      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_ab_variantes_exp on public.ab_variantes(experimento_id);

alter table public.ab_experimentos
  drop constraint if exists ab_experimentos_vencedor_fk;
alter table public.ab_experimentos
  add constraint ab_experimentos_vencedor_fk
  foreign key (vencedor_id) references public.ab_variantes(id) on delete set null;

create table if not exists public.ab_eventos (
  id             bigint generated always as identity primary key,
  experimento_id uuid not null references public.ab_experimentos(id) on delete cascade,
  variante_id    uuid not null references public.ab_variantes(id) on delete cascade,
  visitante      text not null,                       -- id anônimo do navegador
  tipo           text not null check (tipo in ('impressao', 'conversao')),
  origem         text,                                -- conversão: 'lead' | 'clique' | 'datalayer'
  registro_id    uuid,                                -- lead em bancos_dados_registros, quando houver
  pagina         text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  dispositivo    text,                                -- 'mobile' | 'desktop'
  created_at     timestamptz not null default now()
);

create index if not exists idx_ab_eventos_exp on public.ab_eventos(experimento_id, variante_id, tipo);
create index if not exists idx_ab_eventos_dia on public.ab_eventos(experimento_id, created_at);
-- Uma conversão por visitante por teste (reenvio do form ou clique duplo não infla).
create unique index if not exists uq_ab_eventos_conversao
  on public.ab_eventos(experimento_id, visitante) where tipo = 'conversao';

-- Resumo por variante: impressões (carregamentos), visitas (visitantes únicos) e conversões.
create or replace view public.ab_resumo_variantes
with (security_invoker = true) as
select
  v.id                as variante_id,
  v.experimento_id,
  count(e.id) filter (where e.tipo = 'impressao')                      as impressoes,
  count(distinct e.visitante) filter (where e.tipo = 'impressao')      as visitas,
  count(e.id) filter (where e.tipo = 'conversao')                      as conversoes,
  count(e.id) filter (where e.tipo = 'conversao' and e.origem = 'lead')   as conversoes_lead,
  count(e.id) filter (where e.tipo = 'conversao' and e.origem = 'clique') as conversoes_clique
from public.ab_variantes v
left join public.ab_eventos e on e.variante_id = v.id
group by v.id, v.experimento_id;

-- updated_at automático
create or replace function public.ab_touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_ab_experimentos_touch on public.ab_experimentos;
create trigger trg_ab_experimentos_touch before update on public.ab_experimentos
  for each row execute function public.ab_touch_updated_at();

drop trigger if exists trg_ab_variantes_touch on public.ab_variantes;
create trigger trg_ab_variantes_touch before update on public.ab_variantes
  for each row execute function public.ab_touch_updated_at();

-- RLS: o time logado gerencia testes e variantes e lê os eventos.
-- Eventos só entram pela função /api/ab (chave de serviço).
alter table public.ab_experimentos enable row level security;
alter table public.ab_variantes    enable row level security;
alter table public.ab_eventos      enable row level security;

drop policy if exists ab_experimentos_team on public.ab_experimentos;
create policy ab_experimentos_team on public.ab_experimentos
  for all to authenticated using (true) with check (true);

drop policy if exists ab_variantes_team on public.ab_variantes;
create policy ab_variantes_team on public.ab_variantes
  for all to authenticated using (true) with check (true);

drop policy if exists ab_eventos_team_read on public.ab_eventos;
create policy ab_eventos_team_read on public.ab_eventos
  for select to authenticated using (true);
