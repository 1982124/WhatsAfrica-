create unique index if not exists payment_transactions_provider_tx_unique on public.payment_transactions(provider, provider_transaction_id) where provider_transaction_id is not null;
create index if not exists payment_intents_provider_reference_idx on public.payment_intents(provider, provider_reference) where provider_reference is not null;
create index if not exists payment_events_transaction_id_idx on public.payment_events(transaction_id) where transaction_id is not null;
create index if not exists payment_events_received_at_idx on public.payment_events(received_at desc);
