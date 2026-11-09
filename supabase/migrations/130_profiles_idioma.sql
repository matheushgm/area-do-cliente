-- 130 — Idioma da interface por pessoa (2026-11-09)
--
-- O seletor PT | EN do menu do avatar grava aqui (src/context/AppContext.jsx, `mudarIdioma`), e
-- o login aplica o que está gravado, então a escolha acompanha a pessoa em qualquer navegador.
-- Nulo = ainda não escolheu: vale o que o navegador tiver em localStorage['rl_lang'] (e, se tiver,
-- é copiado para cá no próximo login), senão português.
-- A pessoa grava o próprio perfil pela policy `profiles_upsert` (auth.uid() = id).

alter table public.profiles add column if not exists idioma text;

alter table public.profiles drop constraint if exists profiles_idioma_check;
alter table public.profiles add constraint profiles_idioma_check check (idioma is null or idioma in ('pt', 'en'));

comment on column public.profiles.idioma is 'Idioma da interface: pt | en (nulo = padrão, português)';
