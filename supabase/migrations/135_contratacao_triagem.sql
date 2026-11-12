-- Contratação: triagem do formulário público da vaga (/vaga/:cargo).
--
-- triagem = { respostas, pontos (0-100), resultado ('avanca' | 'talvez' | 'nao_avanca'),
--             eliminatorias[], alertas[], por_pergunta, respondido_em, versao }
-- Gravada por api/vaga-publica.js (chave de serviço). A regra está em src/lib/triagemVaga.js.
-- O candidato que responde sem estar no banco nasce com status 'inscrito'.

alter table public.contratacao_candidatos
  add column if not exists triagem jsonb;

-- Para o limite de envios do link público (últimos 60 min).
create index if not exists idx_contratacao_candidatos_triagem_em
  on public.contratacao_candidatos (((triagem ->> 'respondido_em')))
  where triagem is not null;
