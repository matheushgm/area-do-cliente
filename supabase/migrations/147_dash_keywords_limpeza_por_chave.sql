-- 147 · google_keywords: limpeza pelas chaves coletadas, sem carimbo por linha (2026-11-26)
--
-- Continuação da 146 (Disk IO). O coletor de palavras-chave do `dashboard-api` roda às 6,
-- 12 e 18 h e regravava as ~96 mil linhas do canal `google_keywords` a cada rodada: punha
-- `"Coletado": <agora>` em cada linha e depois apagava, por conta, as linhas com carimbo
-- mais antigo. Como o carimbo mudava sempre, nenhuma linha chegava igual e o gatilho
-- `trg_dash_insights_pula_igual` não tinha o que pular (~285 mil UPDATE por dia).
--
-- Agora o coletor manda as linhas sem carimbo e, para cada conta lida com sucesso, chama
-- esta função com TODAS as chaves (`row_key`) que vieram na coleta: o que estiver no banco
-- para a conta e não estiver na lista saiu do Google Ads e é apagado. Conta que falhou na
-- coleta não é passada (o coletor já garante isso).
--
-- As chaves vão no corpo do POST (`/rest/v1/rpc/dash_keywords_limpar`); a maior conta
-- (NectarCRM) tem ~32 mil, cerca de 2 MB, longe do limite de URL que um filtro `not.in`
-- esbarraria.
--
-- `p_keys` vazio (`{}`) apaga a conta inteira (conta lida com sucesso e sem palavra nenhuma);
-- `p_keys` nulo é recusado para um erro do chamador não apagar tudo.

create or replace function public.dash_keywords_limpar(p_account text, p_keys text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if p_account is null or p_account = '' then
    raise exception 'dash_keywords_limpar: conta vazia';
  end if;
  if p_keys is null then
    raise exception 'dash_keywords_limpar: lista de chaves nula (use {} para apagar a conta)';
  end if;

  delete from public.dash_insights d
   where d.channel = 'google_keywords'
     and d.account = p_account
     and not exists (select 1 from unnest(p_keys) as k(row_key) where k.row_key = d.row_key);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.dash_keywords_limpar(text, text[]) from public, anon, authenticated;
grant execute on function public.dash_keywords_limpar(text, text[]) to service_role;
