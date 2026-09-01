drop policy if exists call_participants_insert_self on public.call_participants;
create policy call_participants_insert_self
on public.call_participants
for insert to authenticated
with check (
  exists (
    select 1
    from public.call_sessions cs
    join public.conversation_members cm on cm.conversation_id = cs.conversation_id
    where cs.id = call_participants.call_id
      and cm.user_id = call_participants.user_id
      and (call_participants.user_id = (select auth.uid()) or cs.initiator_id = (select auth.uid()))
  )
);
