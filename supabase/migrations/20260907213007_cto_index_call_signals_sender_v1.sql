-- CTO performance hardening: cover call_signals.sender_id foreign key lookups.
create index if not exists call_signals_sender_id_idx on public.call_signals(sender_id);
