-- Migration 133: módulo Contratação (sidebar > Time > Contratação).
-- Banco de talentos por cargo: candidatos + entrevistas pontuadas (gamificação),
-- currículo no bucket privado `contratacao` e resumo da transcrição feito pela IA.
-- Dados pessoais de candidatos: tudo restrito a admin (app_metadata.role).

create table if not exists public.contratacao_candidatos (
  id                       uuid primary key default gen_random_uuid(),
  cargo                    text not null,
  nome                     text not null,
  email                    text,
  telefone                 text,
  linkedin                 text,
  cidade                   text,
  pretensao_salarial       numeric,
  curriculo_path           text,
  curriculo_nome           text,
  -- entrevistado | aprovado | em_espera | reprovado | contratado
  status                   text not null default 'entrevistado',
  -- flag do banco de talentos: a pessoa arrumou emprego e não está mais disponível
  empregado                boolean not null default false,
  empregado_onde           text,
  empregado_atualizado_em  timestamptz,
  observacoes              text,
  created_by               uuid default auth.uid() references auth.users(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint contratacao_candidatos_status_chk
    check (status in ('entrevistado','aprovado','em_espera','reprovado','contratado'))
);
create index if not exists idx_contratacao_candidatos_cargo on public.contratacao_candidatos (cargo);

create table if not exists public.contratacao_entrevistas (
  id                  uuid primary key default gen_random_uuid(),
  candidato_id        uuid not null references public.contratacao_candidatos(id) on delete cascade,
  cargo               text not null,
  data                date not null default current_date,
  entrevistador_id    uuid default auth.uid() references auth.users(id) on delete set null,
  entrevistador_nome  text,
  -- { [perguntaId]: { nota: 0..3 | null, obs: text } }
  respostas           jsonb not null default '{}'::jsonb,
  -- respostas das dúvidas gerais + nº de clientes, verba, disponibilidade, sinais de alerta
  contexto            jsonb not null default '{}'::jsonb,
  pontuacao           numeric,
  nivel               text,
  detalhe             jsonb,
  transcricao         text,
  resumo_ia           text,
  sugestao_ia         jsonb,
  resumo_gerado_em    timestamptz,
  finalizada          boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_contratacao_entrevistas_candidato on public.contratacao_entrevistas (candidato_id);
create index if not exists idx_contratacao_entrevistas_cargo on public.contratacao_entrevistas (cargo);

alter table public.contratacao_candidatos  enable row level security;
alter table public.contratacao_entrevistas enable row level security;

drop policy if exists "contratacao_candidatos_admin" on public.contratacao_candidatos;
create policy "contratacao_candidatos_admin" on public.contratacao_candidatos
  for all to authenticated
  using (auth.jwt()->'app_metadata'->>'role' = 'admin')
  with check (auth.jwt()->'app_metadata'->>'role' = 'admin');

drop policy if exists "contratacao_entrevistas_admin" on public.contratacao_entrevistas;
create policy "contratacao_entrevistas_admin" on public.contratacao_entrevistas
  for all to authenticated
  using (auth.jwt()->'app_metadata'->>'role' = 'admin')
  with check (auth.jwt()->'app_metadata'->>'role' = 'admin');

-- Currículos: bucket privado, path `<candidato_id>/<arquivo>`, leitura por URL assinada.
insert into storage.buckets (id, name, public)
values ('contratacao', 'contratacao', false)
on conflict (id) do nothing;

drop policy if exists "contratacao_bucket_admin" on storage.objects;
create policy "contratacao_bucket_admin" on storage.objects
  for all to authenticated
  using (bucket_id = 'contratacao' and auth.jwt()->'app_metadata'->>'role' = 'admin')
  with check (bucket_id = 'contratacao' and auth.jwt()->'app_metadata'->>'role' = 'admin');
