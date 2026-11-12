-- Contratação: candidato que só se inscreveu (formulário de vaga) e ainda não foi entrevistado.
--
-- status 'inscrito' = veio do formulário (ex.: lead ads da vaga no Meta), sem entrevista.
-- formulario = respostas da inscrição, para filtrar no banco de talentos sem ler texto livre:
--   { origem, campanha, anuncio,
--     respostas: { presencial: bool, dominio, gtm: bool, experiencia, contas },   -- a última inscrição
--     inscricoes: [ { data, lead_id, plataforma, respostas } ] }                   -- todas, da mais antiga à mais nova

alter table public.contratacao_candidatos
  drop constraint if exists contratacao_candidatos_status_chk;

alter table public.contratacao_candidatos
  add constraint contratacao_candidatos_status_chk
  check (status in ('inscrito','entrevistado','aprovado','em_espera','reprovado','contratado'));

alter table public.contratacao_candidatos
  add column if not exists formulario jsonb;
