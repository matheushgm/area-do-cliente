-- Migration 143: código de URL de cada variante do teste A/B.
--
-- Pedido do Matheus (25/11/2026): o lead leva a URL da página para o banco, o n8n e o CRM, e ele quer saber
-- por ela de qual variação a pessoa veio. O kit /ab.js põe ?variacao=<codigo> na barra de endereço depois do
-- sorteio (sem recarregar), e quem abre o link com ?variacao=<codigo> cai direto naquela variação.
-- Original = 'original'; as outras recebem b, c, d... na ordem. Dá para trocar na tela (só a-z, 0-9 e hífen).

alter table public.ab_variantes add column if not exists codigo text;

with numeradas as (
  select id,
         case when original then 'original'
              else chr(97 + row_number() over (partition by experimento_id, original order by ordem, created_at)::int)
         end as cod
  from public.ab_variantes
)
update public.ab_variantes v set codigo = n.cod
from numeradas n
where n.id = v.id and v.codigo is null;

alter table public.ab_variantes alter column codigo set not null;
alter table public.ab_variantes add constraint ab_variantes_codigo_formato check (codigo ~ '^[a-z0-9][a-z0-9-]{0,39}$');
create unique index if not exists uq_ab_variantes_codigo on public.ab_variantes (experimento_id, codigo);

-- Variante nova sem código: Original vira 'original', as outras pegam a primeira letra livre (b, c, d...).
create or replace function public.ab_variantes_codigo_padrao() returns trigger
language plpgsql set search_path = public as $$
declare
  letra int := 98; -- 'b'
begin
  if new.codigo is not null and new.codigo <> '' then
    new.codigo := lower(new.codigo);
    return new;
  end if;
  if new.original then
    new.codigo := 'original';
    return new;
  end if;
  while exists (select 1 from public.ab_variantes where experimento_id = new.experimento_id and codigo = chr(letra)) loop
    letra := letra + 1;
  end loop;
  new.codigo := case when letra <= 122 then chr(letra) else 'v' || substr(replace(new.id::text, '-', ''), 1, 6) end;
  return new;
end $$;

drop trigger if exists ab_variantes_codigo_padrao on public.ab_variantes;
create trigger ab_variantes_codigo_padrao before insert on public.ab_variantes
  for each row execute function public.ab_variantes_codigo_padrao();
