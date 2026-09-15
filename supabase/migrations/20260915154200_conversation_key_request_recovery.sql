create table if not exists public.conversation_key_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  requester_device_id uuid not null references public.user_devices(id) on delete cascade,
  key_version integer not null check (key_version > 0),
  wrapped_key text,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (conversation_id, requester_device_id, key_version)
);

create index if not exists conversation_key_requests_conversation_idx
  on public.conversation_key_requests(conversation_id, created_at desc);

alter table public.conversation_key_requests enable row level security;

create policy conversation_key_requests_select_participant
on public.conversation_key_requests
for select to authenticated
using (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_key_requests.conversation_id
      and cm.user_id = (select auth.uid())
  )
);

create policy conversation_key_requests_insert_own_device
on public.conversation_key_requests
for insert to authenticated
with check (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_key_requests.conversation_id
      and cm.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.user_devices ud
    where ud.id = conversation_key_requests.requester_device_id
      and ud.user_id = (select auth.uid())
      and ud.revoked_at is null
  )
);

create policy conversation_key_requests_update_participant
on public.conversation_key_requests
for update to authenticated
using (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_key_requests.conversation_id
      and cm.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_key_requests.conversation_id
      and cm.user_id = (select auth.uid())
  )
);

alter publication supabase_realtime add table public.conversation_key_requests;