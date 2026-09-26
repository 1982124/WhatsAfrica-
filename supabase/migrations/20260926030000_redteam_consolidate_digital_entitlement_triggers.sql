-- Consolidate paid-order digital entitlement issuance to one trigger.
drop trigger if exists trg_orders_after_insert_digital_entitlements on public.orders;
drop trigger if exists trg_orders_issue_digital_entitlements on public.orders;
drop function if exists private.trg_orders_after_insert_digital_entitlements();
drop function if exists private.trg_issue_digital_entitlements();
