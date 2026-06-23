-- Banco de respostas do questionário público "Roteiros Express".
-- Inserts vêm da edge function pública (service role); leitura/gestão pelo time autenticado.
create table if not exists public.roteiros_express (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  nome        text,                         -- nome do respondente / negócio
  contato     text,                         -- whatsapp ou e-mail (opcional)
  answers     jsonb not null default '{}',  -- { p1..p5, c1..c5 }
  scripts     jsonb,                         -- roteiros gerados (preenchido pelo time)
  status      text not null default 'novo', -- novo | gerado | arquivado
  origem      text default 'link-publico'
);

create index if not exists roteiros_express_created_at_idx
  on public.roteiros_express (created_at desc);

alter table public.roteiros_express enable row level security;

-- Time autenticado: acesso total (a ferramenta é interna ao time).
-- Inserts do formulário público chegam via service role, que ignora RLS.
create policy "roteiros_express_select_authenticated"
  on public.roteiros_express for select
  to authenticated using (true);

create policy "roteiros_express_update_authenticated"
  on public.roteiros_express for update
  to authenticated using (true) with check (true);

create policy "roteiros_express_delete_authenticated"
  on public.roteiros_express for delete
  to authenticated using (true);

create policy "roteiros_express_insert_authenticated"
  on public.roteiros_express for insert
  to authenticated with check (true);
