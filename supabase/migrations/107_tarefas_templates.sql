-- 107 — Templates do VertaTask (construtor de templates)
--
-- tarefas_modelos deixa de guardar uma tarefa só (payload) e passa a guardar uma
-- árvore de tarefas e subtarefas em `itens`, cada uma com todos os atributos,
-- prazo relativo em dias úteis, regra de responsável e dependências. O formato
-- está em src/lib/templates.js.
--
-- Só acrescenta: `payload` continua até a 108 (o front publicado antes desta
-- mudança ainda lê payload). Modelos que já existem são convertidos para `itens`.

alter table public.tarefas_modelos
  add column if not exists descricao  text,
  add column if not exists itens      jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- payload { titulo, ..., subtarefas: ['título', ...] } → itens [ { ..., subtarefas: [{ id, titulo }] } ]
update public.tarefas_modelos m
set itens = jsonb_build_array(
  (m.payload - 'subtarefas')
  || jsonb_build_object(
       'id', gen_random_uuid(),
       'responsavel', jsonb_build_object('modo', case when jsonb_array_length(coalesce(m.payload->'departamento', '[]'::jsonb)) > 0 then 'departamento' else 'nenhum' end, 'pessoa_id', null),
       'subtarefas', coalesce((
         select jsonb_agg(jsonb_build_object(
                  'id', gen_random_uuid(), 'titulo', s.titulo,
                  'responsavel', jsonb_build_object('modo', 'nenhum', 'pessoa_id', null)) order by s.ord)
         from jsonb_array_elements_text(coalesce(m.payload->'subtarefas', '[]'::jsonb)) with ordinality as s(titulo, ord)
       ), '[]'::jsonb)
     )
)
where m.itens = '[]'::jsonb and (m.payload ? 'titulo');

-- a lista de templates acompanha edições de outras pessoas
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tarefas_modelos') then
    alter publication supabase_realtime add table public.tarefas_modelos;
  end if;
end $$;
