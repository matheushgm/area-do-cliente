-- 148 · dash_keywords_limpar em lotes, para caber no statement_timeout (2026-11-26)
--
-- A 147 apagava as palavras que saíram do Google numa chamada só por conta. Em produção, com o
-- Disk IO esgotado, cada bloco lido custa ~7,5 ms: só varrer as 32 mil chaves da NectarCRM pelo
-- índice levou 6,4 s, e a chamada passou dos 8 s do `statement_timeout` do papel `authenticator`
-- (o PostgREST), o que derrubou a limpeza da NectarCRM, Tetralite e Óticas Brasil nas duas rodadas
-- de teste de 26/11. Função com `set statement_timeout` não resolve: o tempo vale para a instrução
-- que chamou a função, já em andamento.
--
-- Agora cada chamada lê no máximo `p_lote` linhas da conta, na ordem do índice
-- `(channel, account, row_key)`, a partir de `p_depois` (exclusive), apaga as que não estão em
-- `p_keys` e devolve `{ apagadas, lidas, ultimo }`. O coletor chama de novo com `p_depois = ultimo`
-- até `ultimo` voltar nulo (a conta acabou). Quem ordena e compara é o Postgres, então a collation
-- (en_US) não importa para o cliente, e apagar uma linha do lote não pula nenhuma outra, porque o
-- cursor é a maior chave lida, apagada ou não.
--
-- A comparação com `p_keys` é um EXCEPT (hash), nunca um anti-join contra `unnest`: com o array
-- vindo de parâmetro o planejador estima 10 linhas e pode escolher laço aninhado, que com 32 mil
-- chaves vira centenas de milhões de comparações.
--
-- `p_keys` vazio (`{}`) apaga a conta inteira (em lotes); nulo ou conta vazia são recusados.

drop function if exists public.dash_keywords_limpar(text, text[]);

create or replace function public.dash_keywords_limpar(
  p_account text,
  p_keys    text[],
  p_depois  text    default null,
  p_lote    integer default 4000
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lidas    integer;
  v_ultimo   text;
  v_apagadas integer;
begin
  if p_account is null or p_account = '' then
    raise exception 'dash_keywords_limpar: conta vazia';
  end if;
  if p_keys is null then
    raise exception 'dash_keywords_limpar: lista de chaves nula (use {} para apagar a conta)';
  end if;
  if p_lote is null or p_lote < 1 or p_lote > 20000 then
    raise exception 'dash_keywords_limpar: lote fora de 1..20000';
  end if;

  -- Um comando só, sem tabela temporária (criar uma por chamada gravaria no catálogo).
  with lote as materialized (
    select d.row_key
      from public.dash_insights d
     where d.channel = 'google_keywords'
       and d.account = p_account
       and (p_depois is null or d.row_key > p_depois)
     order by d.row_key
     limit p_lote
  ), apagar as (
    delete from public.dash_insights d
     where d.channel = 'google_keywords'
       and d.row_key in (select l.row_key from lote l
                         except
                         select unnest(p_keys))
    returning 1
  )
  select (select count(*) from lote),
         (select max(row_key) from lote),
         (select count(*) from apagar)
    into v_lidas, v_ultimo, v_apagadas;

  return jsonb_build_object(
    'apagadas', v_apagadas,
    'lidas',    v_lidas,
    'ultimo',   case when v_lidas < p_lote then null else v_ultimo end
  );
end;
$$;

revoke all on function public.dash_keywords_limpar(text, text[], text, integer) from public, anon, authenticated;
grant execute on function public.dash_keywords_limpar(text, text[], text, integer) to service_role;
