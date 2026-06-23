-- Campos de lead capturados no fim do formulário público "Roteiros Express".
alter table public.roteiros_express
  add column if not exists email    text,
  add column if not exists telefone text,
  add column if not exists empresa  text;
