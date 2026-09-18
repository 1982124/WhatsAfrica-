-- Red-team hardening: tariff rules are accessed through controlled RPCs only.
-- Direct Data API access must remain unavailable to anon/authenticated.
alter table public.smartlink_tariff_rules enable row level security;
revoke all on table public.smartlink_tariff_rules from anon, authenticated;
