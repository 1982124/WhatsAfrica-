drop policy if exists conversation_key_envelopes_insert_recovery_own_device on public.conversation_key_envelopes;
create policy conversation_key_envelopes_insert_recovery_own_device
on public.conversation_key_envelopes
for insert to authenticated
with check (
  device_id in (
    select ud.id
    from public.user_devices ud
    where ud.user_id = (select auth.uid())
      and ud.revoked_at is null
  )
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversation_key_envelopes.conversation_id
      and cm.user_id = (select auth.uid())
  )
);
