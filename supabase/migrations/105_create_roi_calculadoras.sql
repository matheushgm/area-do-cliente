-- Migration 105: calculadoras de ROI avulsas (menu Ferramentas > Calculadora de ROI).
-- Independentes de cliente: cada uma nasce em branco e tem nome próprio.
-- Compartilhadas entre o time (qualquer usuário autenticado lê e edita).
create table if not exists public.roi_calculadoras (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null default 'Nova calculadora',
  calc        jsonb,
  result      jsonb,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.roi_calculadoras enable row level security;
create policy "roi_calculadoras_select" on public.roi_calculadoras for select to authenticated using (true);
create policy "roi_calculadoras_insert" on public.roi_calculadoras for insert to authenticated with check (true);
create policy "roi_calculadoras_update" on public.roi_calculadoras for update to authenticated using (true) with check (true);
create policy "roi_calculadoras_delete" on public.roi_calculadoras for delete to authenticated using (true);
-- A coluna projects_v2.roi_livres da 1ª tentativa (por cliente) foi descartada.
alter table public.projects_v2 drop column if exists roi_livres;
