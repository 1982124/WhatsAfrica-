-- Financial services foundation for partner-led payments.
-- No customer funds are held here. Provider integrations must create/confirm
-- payment state server-side from trusted provider callbacks.
create table if not exists public.payment_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  country_code text,
  account_type text not null check (account_type in ('mobile_money','bank','card','other')),
  external_reference text,
  status text not null default 'pending' check (status in ('pending','connected','suspended','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete set null,
  business_id uuid,
  amount numeric not null check (amount > 0),
  currency text not null,
  purpose text,
  kind text not null check (kind in ('send','receive','deposit','withdrawal','purchase','refund')),
  provider text,
  status text not null default 'created' check (status in ('created','pending','authorized','paid','failed','cancelled','expired')),
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_transactions add column if not exists direction text check(direction in ('in','out'));
alter table public.payment_transactions add column if not exists kind text check(kind in ('send','receive','deposit','withdrawal','purchase','refund','recharge','subscription'));
alter table public.payment_transactions add column if not exists request_id uuid references public.payment_requests(id) on delete set null;
alter table public.payment_transactions add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists payment_connections_user_idx on public.payment_connections(user_id);
create index if not exists payment_requests_requester_idx on public.payment_requests(requester_id);
create index if not exists payment_requests_recipient_idx on public.payment_requests(recipient_id);
create index if not exists payment_requests_status_idx on public.payment_requests(status);
create index if not exists payment_transactions_user_created_idx on public.payment_transactions(user_id,created_at desc);

alter table public.payment_connections enable row level security;
alter table public.payment_requests enable row level security;
alter table public.payment_transactions enable row level security;

drop policy if exists payment_connections_owner on public.payment_connections;
create policy payment_connections_owner on public.payment_connections
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists payment_requests_participants on public.payment_requests;
create policy payment_requests_participants on public.payment_requests
  for select to authenticated
  using ((select auth.uid()) = requester_id or (select auth.uid()) = recipient_id);

drop policy if exists payment_requests_create on public.payment_requests;
create policy payment_requests_create on public.payment_requests
  for insert to authenticated
  with check ((select auth.uid()) = requester_id);

drop policy if exists payment_transactions_owner on public.payment_transactions;
create policy payment_transactions_owner on public.payment_transactions
  for select to authenticated
  using ((select auth.uid()) = user_id or (select auth.uid()) = business_id);

grant select, insert, update, delete on public.payment_connections to authenticated;
grant select, insert on public.payment_requests to authenticated;
grant select on public.payment_transactions to authenticated;
