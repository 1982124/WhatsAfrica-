-- CTO security hardening: anonymous clients must not write to internal/public projection tables.
revoke insert, update, delete on table public.call_signals from anon;
revoke insert, update, delete on table public.group_member_directory from anon;
revoke insert, update, delete on table public.public_businesses from anon;
revoke insert, update, delete on table public.public_profiles from anon;
