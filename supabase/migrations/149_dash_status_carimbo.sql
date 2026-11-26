-- 149 · dash_insights: o snapshot meta_status para de regravar tudo a cada hora (2026-11-26)
--
-- Depois da 146, o gatilho `trg_dash_insights_pula_igual` não pegava o `meta_status`: o coletor
-- carimba "Atualizado em" com o horário da rodada em cada linha, então o jsonb nunca chega igual.
-- Medido na rodada de 26/11 17:44 UTC: 4.643 linhas regravadas na dash_insights, ~4.200 delas do
-- meta_status, todas só com o carimbo diferente (o mesmo problema do `Coletado` do
-- google_keywords, resolvido nas 147/148).
--
-- O carimbo não pode simplesmente sumir: é o "Conferido em" do status. O viewer usa o maior
-- carimbo da conta (direto ou pela RPC `dash_anuncios_no_ar`) para o "🕒 Atualizado em" da tela e
-- para o aviso de leitura velha (`ADS_STALE_MS`, 36 h) em "Anúncios no ar". O saldo, que também é
-- gravado por rodada, não serve de substituto: não cobre todas as contas.
--
-- Regra: linha do meta_status que chega igual a não ser pelo "Atualizado em" só é regravada
--   * no turno dela: 1 de 6 horas, pelo hash do `row_key` (as linhas de uma conta se espalham
--     pelos turnos, então o maior carimbo da conta continua sendo o da última rodada), ou
--   * se o carimbo gravado já tem mais de 6 h (rodada perdida no turno dela).
-- Fora disso a escrita é descartada (return null, como na 146). Mudou status, veiculação,
-- orçamento ou nome, grava na hora. Efeito: ~1/6 das regravações; o "Conferido em" de uma
-- entidade parada pode ficar até ~6 h atrás da última rodada, bem abaixo das 36 h do aviso.
--
-- Desfazer: drop trigger trg_dash_insights_status_carimbo on public.dash_insights;

create or replace function public.dash_insights_status_carimbo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_antigo timestamptz;
begin
  if new.day is distinct from old.day
     or new.account is distinct from old.account
     or (new.data - 'Atualizado em') is distinct from (old.data - 'Atualizado em') then
    return new;
  end if;

  -- Turno da linha: um em cada 6 horas (UTC), escalonado pelo row_key.
  if ((hashtext(coalesce(new.row_key, '')) % 6) + 6) % 6
     = (extract(hour from now() at time zone 'UTC')::int % 6) then
    return new;
  end if;

  begin
    v_antigo := (old.data ->> 'Atualizado em')::timestamptz;
  exception when others then
    v_antigo := null;
  end;
  if v_antigo is null or v_antigo < now() - interval '6 hours' then
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_dash_insights_status_carimbo on public.dash_insights;
create trigger trg_dash_insights_status_carimbo
  before update on public.dash_insights
  for each row
  when (old.channel = 'meta_status' and new.channel = 'meta_status')
  execute function public.dash_insights_status_carimbo();
