create table if not exists public.telecom_operators (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  name text not null,
  code text,
  status text not null default 'planned' check (status in ('planned','active','paused','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(country_code, name)
);

create table if not exists public.telecom_plans (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.telecom_operators(id) on delete cascade,
  name text not null,
  description text,
  price numeric(14,2) not null check (price >= 0),
  currency text not null default 'XOF',
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  benefits jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','paused','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(operator_id, name)
);

create table if not exists public.telecom_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operator_id uuid not null references public.telecom_operators(id) on delete restrict,
  plan_id uuid not null references public.telecom_plans(id) on delete restrict,
  external_reference text,
  activated_at timestamptz not null default now(),
  expires_at timestamptz,
  quota_bytes bigint check (quota_bytes is null or quota_bytes >= 0),
  consumed_bytes bigint not null default 0 check (consumed_bytes >= 0),
  status text not null default 'active' check (status in ('pending','active','expired','exhausted','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telecom_revenue_rules (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.telecom_operators(id) on delete cascade,
  plan_id uuid references public.telecom_plans(id) on delete cascade,
  operator_share numeric(7,4) not null default 0 check (operator_share >= 0 and operator_share <= 1),
  whatsafrica_share numeric(7,4) not null default 0 check (whatsafrica_share >= 0 and whatsafrica_share <= 1),
  other_share numeric(7,4) not null default 0 check (other_share >= 0 and other_share <= 1),
  currency text not null default 'XOF',
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  created_at timestamptz not null default now(),
  check (operator_share + whatsafrica_share + other_share <= 1)
);

create table if not exists public.telecom_entitlement_events (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid references public.telecom_entitlements(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  operator_id uuid references public.telecom_operators(id) on delete set null,
  plan_id uuid references public.telecom_plans(id) on delete set null,
  event_type text not null check (event_type in ('activation','renewal','consumption','expiration','exhaustion','revocation','reconciliation')),
  bytes_delta bigint,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists telecom_operators_country_status_idx on public.telecom_operators(country_code, status);
create index if not exists telecom_plans_operator_status_idx on public.telecom_plans(operator_id, status);
create index if not exists telecom_entitlements_user_status_idx on public.telecom_entitlements(user_id, status);
create index if not exists telecom_entitlements_operator_plan_idx on public.telecom_entitlements(operator_id, plan_id);
create index if not exists telecom_entitlement_events_user_created_idx on public.telecom_entitlement_events(user_id, created_at desc);
create index if not exists telecom_entitlement_events_external_ref_idx on public.telecom_entitlement_events(external_reference);

alter table public.telecom_operators enable row level security;
alter table public.telecom_plans enable row level security;
alter table public.telecom_entitlements enable row level security;
alter table public.telecom_revenue_rules enable row level security;
alter table public.telecom_entitlement_events enable row level security;

create policy telecom_operators_public_read on public.telecom_operators for select to anon, authenticated using (status = 'active');
create policy telecom_plans_public_read on public.telecom_plans for select to anon, authenticated using (status = 'active' and exists (select 1 from public.telecom_operators o where o.id = operator_id and o.status = 'active'));
create policy telecom_entitlements_owner_read on public.telecom_entitlements for select to authenticated using ((select auth.uid()) = user_id);
create policy telecom_entitlement_events_owner_read on public.telecom_entitlement_events for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.telecom_revenue_rules from anon, authenticated;
revoke all on public.telecom_entitlement_events from anon;
revoke all on public.telecom_entitlements from anon;
