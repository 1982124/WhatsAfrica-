-- WASSAFRICA Partner Network Core v1
-- Repository migration only. Do not mark partner services live until a real partner contract/integration exists.

create extension if not exists pgcrypto;

create table if not exists public.partner_services (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null,
  partner_name text not null,
  service_type text not null,
  display_name text not null,
  country_code text not null,
  mode text not null check (mode in ('referral','embedded_handoff','approved_api_orchestration')),
  status text not null default 'draft' check (status in ('draft','active','paused','retired')),
  provider_is_regulated boolean not null default false,
  provider_disclaimer text,
  destination_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_services_active_idx
  on public.partner_services(country_code, service_type, status);

create table if not exists public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null unique,
  partner_service_id uuid references public.partner_services(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  country_code text,
  intent text,
  source_surface text,
  smartlink_id text,
  consent_status text not null default 'not_required' check (consent_status in ('not_required','pending','granted','denied','withdrawn')),
  status text not null default 'created' check (status in ('created','consented','sent','received','qualified','accepted','completed','rejected','expired','cancelled','failed')),
  partner_reference text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  outcome_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists partner_referrals_user_idx on public.partner_referrals(user_id, created_at desc);
create index if not exists partner_referrals_partner_idx on public.partner_referrals(partner_service_id, created_at desc);
create index if not exists partner_referrals_status_idx on public.partner_referrals(status, created_at desc);

create table if not exists public.partner_outcomes (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.partner_referrals(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  partner_reference text,
  attribution_data jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique(referral_id, event_key)
);

create index if not exists partner_outcomes_referral_idx on public.partner_outcomes(referral_id, occurred_at desc);

create table if not exists public.partner_commission_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid references public.partner_referrals(id) on delete set null,
  outcome_id uuid references public.partner_outcomes(id) on delete set null,
  partner_service_id uuid references public.partner_services(id) on delete set null,
  event_type text not null,
  eligible boolean not null default false,
  amount numeric,
  currency text,
  contract_reference text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists partner_commission_referral_idx on public.partner_commission_events(referral_id, created_at desc);

alter table public.partner_services enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.partner_outcomes enable row level security;
alter table public.partner_commission_events enable row level security;

-- Only explicitly active services are public-readable. Draft/paused partner configuration stays private.
drop policy if exists partner_services_public_active on public.partner_services;
create policy partner_services_public_active
  on public.partner_services for select
  to anon, authenticated
  using (status = 'active');

-- A signed-in user can see only referrals belonging to their own account.
drop policy if exists partner_referrals_select_own on public.partner_referrals;
create policy partner_referrals_select_own
  on public.partner_referrals for select
  to authenticated
  using (user_id = auth.uid());

-- Users can create a referral only for themselves. Server-side integrations can use a trusted role.
drop policy if exists partner_referrals_insert_own on public.partner_referrals;
create policy partner_referrals_insert_own
  on public.partner_referrals for insert
  to authenticated
  with check (user_id = auth.uid());

-- No browser-side insert/update/select policy is granted to partner outcomes or commission events.
-- Partner callbacks should be authenticated server-to-server and idempotent on event_key.

comment on table public.partner_services is 'WASSAFRICA partner service catalog; only active services are public-readable.';
comment on table public.partner_referrals is 'Minimal WASSAFRICA referral lifecycle and attribution record.';
comment on table public.partner_outcomes is 'Server-received partner outcome events; event_key provides idempotency.';
comment on table public.partner_commission_events is 'Contractual commission eligibility ledger; never inferred from UI clicks alone.';
