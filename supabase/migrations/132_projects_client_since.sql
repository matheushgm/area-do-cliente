-- 132: "Cliente desde", data do primeiro contrato, separada da assinatura do ciclo atual
--
-- Na renovação o time troca a Data de Assinatura (contract_date) para a data do
-- contrato novo, porque é ela que reinicia a barra de 90 dias e o ciclo do
-- programa. Só que o Crescimento (/?visao=crescimento), o card de Novos e o
-- contador "novos" da sidebar liam essa mesma data como entrada do cliente: a
-- renovação aparecia como cliente novo e o cliente sumia da base dos meses
-- anteriores. Agora a entrada é client_since (com fallback para contract_date).
--
-- O trigger preenche client_since sozinho quando a assinatura avança 45 dias ou
-- mais (renovação) e o campo ainda está vazio. Ajuste fino de data (erro de
-- digitação) fica abaixo disso e não mexe em nada.

alter table public.projects_v2 add column if not exists client_since date;

comment on column public.projects_v2.client_since is
  'Data do primeiro contrato (entrada do cliente na base). contract_date é a assinatura do ciclo atual e muda na renovação.';

create or replace function public.projects_v2_client_since_renovacao()
returns trigger language plpgsql as $$
begin
  if new.client_since is null
     and old.contract_date is not null
     and new.contract_date is not null
     and new.contract_date - old.contract_date >= 45 then
    new.client_since := coalesce(old.client_since, old.contract_date);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_v2_client_since on public.projects_v2;
create trigger trg_projects_v2_client_since
  before update of contract_date on public.projects_v2
  for each row execute function public.projects_v2_client_since_renovacao();
