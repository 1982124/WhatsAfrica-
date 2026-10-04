-- Harden public discovery view so caller RLS applies to the underlying businesses table.
ALTER VIEW public.africa_network_businesses SET (security_invoker = true);
