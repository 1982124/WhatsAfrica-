-- Security hardening: move unaccent extension out of public while preserving legacy public.unaccent API compatibility.
begin;
create schema if not exists extensions;
alter extension unaccent set schema extensions;

create or replace function public.unaccent(text)
returns text
language sql
immutable
parallel safe
as $$ select extensions.unaccent($1) $$;

create or replace function public.unaccent(regdictionary, text)
returns text
language sql
immutable
parallel safe
as $$ select extensions.unaccent($1, $2) $$;
commit;