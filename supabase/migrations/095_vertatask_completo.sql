-- Migration 095: VertaTask completo (Pages, Analytics, Views compartilhadas, Etiquetas,
-- Relações entre tarefas, Histórico, Seguidores/notificações, Modelos e acabamentos de
-- Cycles, Modules e Intake). Tudo aditivo: nada que existe é alterado ou removido.

-- ── Etiquetas ───────────────────────────────────────────────────────────────
create table if not exists public.tarefas_etiquetas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cor         text not null default '#2A25F0',
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_tarefas_etiquetas_nome on public.tarefas_etiquetas (lower(nome));
alter table public.tarefas_itens add column if not exists etiquetas uuid[] not null default '{}';
create index if not exists idx_tarefas_itens_etiquetas on public.tarefas_itens using gin (etiquetas);

-- ── Relações entre tarefas ──────────────────────────────────────────────────
-- 'bloqueia': tarefa_id bloqueia relacionada_id. 'duplica': tarefa_id é duplicata de relacionada_id.
create table if not exists public.tarefas_relacoes (
  id              uuid primary key default gen_random_uuid(),
  tarefa_id       uuid not null references public.tarefas_itens(id) on delete cascade,
  relacionada_id  uuid not null references public.tarefas_itens(id) on delete cascade,
  tipo            text not null check (tipo in ('bloqueia', 'duplica', 'relacionada')),
  criado_por      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  check (tarefa_id <> relacionada_id),
  unique (tarefa_id, relacionada_id, tipo)
);
create index if not exists idx_tarefas_relacoes_a on public.tarefas_relacoes(tarefa_id);
create index if not exists idx_tarefas_relacoes_b on public.tarefas_relacoes(relacionada_id);

-- ── Seguidores ──────────────────────────────────────────────────────────────
create table if not exists public.tarefas_seguidores (
  tarefa_id  uuid not null references public.tarefas_itens(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tarefa_id, user_id)
);
create index if not exists idx_tarefas_seguidores_user on public.tarefas_seguidores(user_id);

-- ── Histórico de atividade da tarefa ────────────────────────────────────────
create table if not exists public.tarefas_atividade (
  id            uuid primary key default gen_random_uuid(),
  tarefa_id     uuid not null references public.tarefas_itens(id) on delete cascade,
  ator_id       uuid references public.profiles(id) on delete set null,
  ator_nome     text,
  campo         text not null,
  valor_antigo  text,
  valor_novo    text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_tarefas_atividade_tarefa on public.tarefas_atividade(tarefa_id, created_at desc);

-- Registra quem mudou o quê. Só edições feitas por pessoa logada (a sincronização com o
-- ClickUp usa a chave de serviço, sem auth.uid(), e não entra no histórico).
create or replace function public.tarefas_log_atividade()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ator uuid := auth.uid();
  nome text;
  novo uuid;
begin
  if ator is null then return new; end if;
  select p.name into nome from public.profiles p where p.id = ator;

  if tg_op = 'INSERT' then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_novo)
    values (new.id, ator, nome, 'criada', new.titulo);
    return new;
  end if;

  if new.titulo is distinct from old.titulo then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'titulo', old.titulo, new.titulo);
  end if;
  if new.status is distinct from old.status then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'status', old.status, new.status);
  end if;
  if new.prioridade is distinct from old.prioridade then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'prioridade', old.prioridade, new.prioridade);
  end if;
  if new.data_inicio is distinct from old.data_inicio then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'data_inicio', old.data_inicio::text, new.data_inicio::text);
  end if;
  if new.data_vencimento is distinct from old.data_vencimento then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'data_vencimento', old.data_vencimento::text, new.data_vencimento::text);
  end if;
  if new.estimativa_min is distinct from old.estimativa_min then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'estimativa_min', old.estimativa_min::text, new.estimativa_min::text);
  end if;
  if new.ciclo_id is distinct from old.ciclo_id then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'ciclo', old.ciclo_id::text, new.ciclo_id::text);
  end if;
  if new.modulo_id is distinct from old.modulo_id then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'modulo', old.modulo_id::text, new.modulo_id::text);
  end if;
  if new.responsaveis is distinct from old.responsaveis then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo)
    values (new.id, ator, nome, 'responsaveis', array_to_string(old.responsaveis, ','), array_to_string(new.responsaveis, ','));
    -- quem entrou como responsável passa a seguir a tarefa e é avisado
    for novo in select unnest(new.responsaveis) except select unnest(old.responsaveis) loop
      insert into public.tarefas_seguidores (tarefa_id, user_id) values (new.id, novo) on conflict do nothing;
      if novo <> ator then
        insert into public.notifications (user_id, type, title, body, link, data)
        values (novo, 'tarefa_atribuida', coalesce(nome, 'Alguém') || ' atribuiu uma tarefa a você', new.titulo, '/tarefas?tarefa=' || new.id::text,
                jsonb_build_object('tarefa_id', new.id, 'ator_id', ator));
      end if;
    end loop;
  end if;
  if new.etiquetas is distinct from old.etiquetas then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo)
    values (new.id, ator, nome, 'etiquetas', array_to_string(old.etiquetas, ','), array_to_string(new.etiquetas, ','));
  end if;
  return new;
end $$;

drop trigger if exists trg_tarefas_log_update on public.tarefas_itens;
create trigger trg_tarefas_log_update after update on public.tarefas_itens
  for each row execute function public.tarefas_log_atividade();
drop trigger if exists trg_tarefas_log_insert on public.tarefas_itens;
create trigger trg_tarefas_log_insert after insert on public.tarefas_itens
  for each row execute function public.tarefas_log_atividade();

-- Comentário novo: quem comenta passa a seguir; seguidores e responsáveis são avisados.
create or replace function public.tarefas_comentario_notifica()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t record;
  alvo uuid;
begin
  select id, titulo, responsaveis, criado_por into t from public.tarefas_itens where id = new.tarefa_id;
  if t.id is null then return new; end if;
  if new.autor_id is not null then
    insert into public.tarefas_seguidores (tarefa_id, user_id) values (new.tarefa_id, new.autor_id) on conflict do nothing;
  end if;
  -- importação do ClickUp (sem autor) não gera aviso
  if new.autor_id is null then return new; end if;
  for alvo in
    select distinct u from (
      select user_id as u from public.tarefas_seguidores where tarefa_id = new.tarefa_id
      union select unnest(t.responsaveis)
    ) x where u is not null and u <> new.autor_id
  loop
    insert into public.notifications (user_id, type, title, body, link, data)
    values (alvo, 'tarefa_comentario', coalesce(new.autor_nome, 'Alguém') || ' comentou em uma tarefa', substring(new.texto from 1 for 200),
            '/tarefas?tarefa=' || new.tarefa_id::text, jsonb_build_object('tarefa_id', new.tarefa_id, 'comentario_id', new.id));
  end loop;
  return new;
end $$;

drop trigger if exists trg_tarefas_comentario_notifica on public.tarefas_comentarios;
create trigger trg_tarefas_comentario_notifica after insert on public.tarefas_comentarios
  for each row execute function public.tarefas_comentario_notifica();

-- ── Views salvas e compartilhadas ───────────────────────────────────────────
create table if not exists public.tarefas_views (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  config      jsonb not null default '{}'::jsonb,   -- { sel, view, agrupar, filtroResp, mostrarConcluidas, etiqueta }
  acesso      text not null default 'publica' check (acesso in ('publica', 'privada')),
  dono_id     uuid references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Pages (documentos) ──────────────────────────────────────────────────────
create table if not exists public.tarefas_paginas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null default 'Sem título',
  conteudo    text not null default '',            -- markdown
  project_id  uuid references public.projects_v2(id) on delete set null,
  modulo_id   uuid references public.tarefas_modulos(id) on delete set null,
  pai_id      uuid references public.tarefas_paginas(id) on delete cascade,
  acesso      text not null default 'publica' check (acesso in ('publica', 'privada')),
  dono_id     uuid references public.profiles(id) on delete set null,
  bloqueada   boolean not null default false,
  arquivada   boolean not null default false,
  posicao     numeric not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_tarefas_paginas_project on public.tarefas_paginas(project_id);
create index if not exists idx_tarefas_paginas_modulo  on public.tarefas_paginas(modulo_id);
create index if not exists idx_tarefas_paginas_pai     on public.tarefas_paginas(pai_id);

create table if not exists public.tarefas_paginas_versoes (
  id         uuid primary key default gen_random_uuid(),
  pagina_id  uuid not null references public.tarefas_paginas(id) on delete cascade,
  titulo     text,
  conteudo   text,
  autor_id   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_tarefas_paginas_versoes on public.tarefas_paginas_versoes(pagina_id, created_at desc);

drop trigger if exists trg_tarefas_paginas_touch on public.tarefas_paginas;
create trigger trg_tarefas_paginas_touch before update on public.tarefas_paginas
  for each row execute function public.tarefas_touch_updated_at();
drop trigger if exists trg_tarefas_views_touch on public.tarefas_views;
create trigger trg_tarefas_views_touch before update on public.tarefas_views
  for each row execute function public.tarefas_touch_updated_at();

-- ── Modelos de tarefa ───────────────────────────────────────────────────────
create table if not exists public.tarefas_modelos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  payload     jsonb not null default '{}'::jsonb,  -- { titulo, descricao, prioridade, estimativa_min, tipo_tarefa, dificuldade, departamento, etiquetas, checklists, subtarefas }
  dono_id     uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── Acabamentos de Cycles, Modules e Intake ─────────────────────────────────
alter table public.tarefas_ciclos
  add column if not exists descricao       text,
  add column if not exists responsavel_id  uuid references public.profiles(id) on delete set null;

alter table public.tarefas_modulos
  add column if not exists status    text not null default 'planejado',
  add column if not exists lider_id  uuid references public.profiles(id) on delete set null,
  add column if not exists membros   uuid[] not null default '{}',
  add column if not exists inicio    date,
  add column if not exists alvo      date,
  add column if not exists links     jsonb not null default '[]'::jsonb;
alter table public.tarefas_modulos drop constraint if exists tarefas_modulos_status_check;
alter table public.tarefas_modulos add constraint tarefas_modulos_status_check
  check (status in ('planejado', 'em_andamento', 'pausado', 'concluido', 'cancelado'));

alter table public.tarefas_intake
  add column if not exists adiado_ate    timestamptz,
  add column if not exists duplicada_de  uuid references public.tarefas_itens(id) on delete set null,
  add column if not exists contato       text;     -- quem pediu (cliente externo), quando não há login
alter table public.tarefas_intake drop constraint if exists tarefas_intake_status_check;
alter table public.tarefas_intake add constraint tarefas_intake_status_check
  check (status in ('pendente', 'aceito', 'recusado', 'adiado', 'duplicado'));

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.tarefas_etiquetas       enable row level security;
alter table public.tarefas_relacoes        enable row level security;
alter table public.tarefas_seguidores      enable row level security;
alter table public.tarefas_atividade       enable row level security;
alter table public.tarefas_views           enable row level security;
alter table public.tarefas_paginas         enable row level security;
alter table public.tarefas_paginas_versoes enable row level security;
alter table public.tarefas_modelos         enable row level security;

drop policy if exists "tarefas_etiquetas_team" on public.tarefas_etiquetas;
create policy "tarefas_etiquetas_team" on public.tarefas_etiquetas for all to authenticated using (true) with check (true);
drop policy if exists "tarefas_relacoes_team" on public.tarefas_relacoes;
create policy "tarefas_relacoes_team" on public.tarefas_relacoes for all to authenticated using (true) with check (true);
drop policy if exists "tarefas_seguidores_team" on public.tarefas_seguidores;
create policy "tarefas_seguidores_team" on public.tarefas_seguidores for all to authenticated using (true) with check (true);
drop policy if exists "tarefas_atividade_leitura" on public.tarefas_atividade;
create policy "tarefas_atividade_leitura" on public.tarefas_atividade for select to authenticated using (true);
drop policy if exists "tarefas_modelos_team" on public.tarefas_modelos;
create policy "tarefas_modelos_team" on public.tarefas_modelos for all to authenticated using (true) with check (true);

-- views: públicas valem para o time; privadas só para o dono; só o dono altera ou apaga
drop policy if exists "tarefas_views_leitura" on public.tarefas_views;
create policy "tarefas_views_leitura" on public.tarefas_views for select to authenticated
  using (acesso = 'publica' or dono_id = auth.uid());
drop policy if exists "tarefas_views_insert" on public.tarefas_views;
create policy "tarefas_views_insert" on public.tarefas_views for insert to authenticated with check (dono_id = auth.uid());
drop policy if exists "tarefas_views_update" on public.tarefas_views;
create policy "tarefas_views_update" on public.tarefas_views for update to authenticated using (dono_id = auth.uid()) with check (dono_id = auth.uid());
drop policy if exists "tarefas_views_delete" on public.tarefas_views;
create policy "tarefas_views_delete" on public.tarefas_views for delete to authenticated using (dono_id = auth.uid());

-- pages: públicas editáveis pelo time (exceto bloqueadas, só o dono); privadas só do dono
drop policy if exists "tarefas_paginas_leitura" on public.tarefas_paginas;
create policy "tarefas_paginas_leitura" on public.tarefas_paginas for select to authenticated
  using (acesso = 'publica' or dono_id = auth.uid());
drop policy if exists "tarefas_paginas_insert" on public.tarefas_paginas;
create policy "tarefas_paginas_insert" on public.tarefas_paginas for insert to authenticated with check (dono_id = auth.uid());
drop policy if exists "tarefas_paginas_update" on public.tarefas_paginas;
create policy "tarefas_paginas_update" on public.tarefas_paginas for update to authenticated
  using (dono_id = auth.uid() or (acesso = 'publica' and not bloqueada))
  with check (dono_id = auth.uid() or (acesso = 'publica' and not bloqueada));
drop policy if exists "tarefas_paginas_delete" on public.tarefas_paginas;
create policy "tarefas_paginas_delete" on public.tarefas_paginas for delete to authenticated using (dono_id = auth.uid());

drop policy if exists "tarefas_paginas_versoes_leitura" on public.tarefas_paginas_versoes;
create policy "tarefas_paginas_versoes_leitura" on public.tarefas_paginas_versoes for select to authenticated
  using (exists (select 1 from public.tarefas_paginas p where p.id = pagina_id and (p.acesso = 'publica' or p.dono_id = auth.uid())));
drop policy if exists "tarefas_paginas_versoes_insert" on public.tarefas_paginas_versoes;
create policy "tarefas_paginas_versoes_insert" on public.tarefas_paginas_versoes for insert to authenticated
  with check (exists (select 1 from public.tarefas_paginas p where p.id = pagina_id and (p.acesso = 'publica' or p.dono_id = auth.uid())));

-- realtime
alter publication supabase_realtime add table public.tarefas_etiquetas;
alter publication supabase_realtime add table public.tarefas_paginas;
alter publication supabase_realtime add table public.tarefas_views;
alter publication supabase_realtime add table public.tarefas_relacoes;
alter publication supabase_realtime add table public.tarefas_atividade;

-- ── Analytics ───────────────────────────────────────────────────────────────
create or replace function public.vertatask_analytics(p_dias integer default 30)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  dias   integer := greatest(1, least(coalesce(p_dias, 30), 180));
  desde  timestamptz := date_trunc('day', now()) - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 180)) - 1);
  r      jsonb;
begin
  select jsonb_build_object(
    'dias', dias,
    'abertas',   (select count(*) from tarefas_itens where parent_id is null and not arquivada and status_tipo <> 'closed'),
    'atrasadas', (select count(*) from tarefas_itens where parent_id is null and not arquivada and status_tipo <> 'closed' and data_vencimento < date_trunc('day', now())),
    'criadas',   (select count(*) from tarefas_itens where parent_id is null and not arquivada and created_at >= desde),
    'concluidas',(select count(*) from tarefas_itens where parent_id is null and not arquivada and status_tipo = 'closed' and data_conclusao >= desde),
    'tempo_medio_dias', (select round(avg(extract(epoch from (data_conclusao - created_at)) / 86400)::numeric, 1)
                           from tarefas_itens where parent_id is null and not arquivada and status_tipo = 'closed' and data_conclusao >= desde and data_conclusao > created_at),
    'por_status', coalesce((select jsonb_agg(x order by x.total desc) from (
        select status, count(*) as total from tarefas_itens where parent_id is null and not arquivada and status_tipo <> 'closed' group by status) x), '[]'::jsonb),
    'por_prioridade', coalesce((select jsonb_agg(x) from (
        select coalesce(prioridade, 'sem') as prioridade, count(*) as total from tarefas_itens where parent_id is null and not arquivada and status_tipo <> 'closed' group by 1) x), '[]'::jsonb),
    'por_responsavel', coalesce((select jsonb_agg(x order by x.abertas desc, x.concluidas desc) from (
        select p.name as nome,
               count(*) filter (where i.status_tipo <> 'closed') as abertas,
               count(*) filter (where i.status_tipo = 'closed' and i.data_conclusao >= desde) as concluidas
          from tarefas_itens i
          cross join lateral unnest(i.responsaveis) as u(uid)
          join profiles p on p.id = u.uid
         where i.parent_id is null and not i.arquivada and (i.status_tipo <> 'closed' or i.data_conclusao >= desde)
         group by p.name order by abertas desc, concluidas desc limit 12) x), '[]'::jsonb),
    'por_cliente', coalesce((select jsonb_agg(x order by x.abertas desc, x.concluidas desc) from (
        select pa.nome as nome,
               count(*) filter (where i.status_tipo <> 'closed') as abertas,
               count(*) filter (where i.status_tipo = 'closed' and i.data_conclusao >= desde) as concluidas
          from tarefas_itens i
          join tarefas_listas l on l.id = i.lista_id
          join tarefas_pastas pa on pa.id = l.pasta_id
         where i.parent_id is null and not i.arquivada and (i.status_tipo <> 'closed' or i.data_conclusao >= desde)
         group by pa.nome order by abertas desc, concluidas desc limit 12) x), '[]'::jsonb),
    'serie', coalesce((select jsonb_agg(x order by x.dia) from (
        select d::date as dia,
               (select count(*) from tarefas_itens i where i.parent_id is null and not i.arquivada and i.created_at >= d and i.created_at < d + interval '1 day') as criadas,
               (select count(*) from tarefas_itens i where i.parent_id is null and not i.arquivada and i.status_tipo = 'closed' and i.data_conclusao >= d and i.data_conclusao < d + interval '1 day') as concluidas
          from generate_series(desde, date_trunc('day', now()), interval '1 day') d) x), '[]'::jsonb),
    'ciclos', coalesce((select jsonb_agg(x order by x.inicio) from (
        select c.nome, c.inicio, c.fim,
               count(i.id) as total,
               count(i.id) filter (where i.status_tipo = 'closed') as concluidas
          from tarefas_ciclos c
          left join tarefas_itens i on i.ciclo_id = c.id and i.parent_id is null and not i.arquivada
         where not c.arquivado
         group by c.id order by c.inicio desc limit 8) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;
grant execute on function public.vertatask_analytics(integer) to authenticated;
