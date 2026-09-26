-- Keep the constraint-backed unique key and remove the redundant duplicate index.
drop index if exists public.payment_events_provider_event_unique;
