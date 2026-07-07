-- Migration 068: "Atividades 15min" — tracker pessoal de atividades em blocos
-- de 15 minutos (estilo planilha) para mapear o que mexe o ponteiro.
--
-- Regra de privacidade: é 100% PESSOAL. Cada usuário só enxerga/edita as SUAS
-- atividades. NÃO há override de admin — nem admin vê o de outra pessoa.
create table if not exists public.atividades_15min (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dia         date not null,
  intervalo   text not null,                 -- ex: "08:00 - 08:15"
  atividade   text not null default '',
  prioridade  text check (prioridade in ('baixa', 'media', 'alta')),
  updated_at  timestamptz not null default now(),
  unique (user_id, dia, intervalo)
);

create index if not exists idx_atividades_15min_user_dia
  on public.atividades_15min (user_id, dia);

alter table public.atividades_15min enable row level security;

-- Estritamente pessoal: todas as operações exigem user_id = auth.uid().
create policy "atividades_15min_select_own"
  on public.atividades_15min for select
  to authenticated using (user_id = auth.uid());

create policy "atividades_15min_insert_own"
  on public.atividades_15min for insert
  to authenticated with check (user_id = auth.uid());

create policy "atividades_15min_update_own"
  on public.atividades_15min for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "atividades_15min_delete_own"
  on public.atividades_15min for delete
  to authenticated using (user_id = auth.uid());
