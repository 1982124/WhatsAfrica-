drop policy if exists conversation_key_requests_update_participant on public.conversation_key_requests;

create policy conversation_key_requests_update_key_holder
on public.conversation_key_requests
for update to authenticated
using (
  fulfilled_at is null
  and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_key_requests.conversation_id
      and cm.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.conversation_key_envelopes e
    join public.user_devices ud on ud.id = e.device_id
    where e.conversation_id = conversation_key_requests.conversation_id
      and e.key_version = conversation_key_requests.key_version
      and e.revoked_at is null
      and ud.user_id = (select auth.uid())
      and ud.revoked_at is null
  )
)
with check (
  fulfilled_at is not null
  and wrapped_key is not null
  and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_key_requests.conversation_id
      and cm.user_id = (select auth.uid())
  )
);