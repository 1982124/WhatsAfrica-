-- Security hardening: pin search_path for Smart Link categorization/branding trigger functions.
alter function public.normalize_business_category(text)
  set search_path = public, pg_catalog;

alter function public.wassafrica_business_smartlink_guard()
  set search_path = public, pg_catalog;
