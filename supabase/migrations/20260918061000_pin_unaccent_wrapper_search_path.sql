-- Security hardening: pin compatibility wrapper search_path for unaccent.
begin;
alter function public.unaccent(text) set search_path = pg_catalog, extensions;
alter function public.unaccent(regdictionary, text) set search_path = pg_catalog, extensions;
commit;