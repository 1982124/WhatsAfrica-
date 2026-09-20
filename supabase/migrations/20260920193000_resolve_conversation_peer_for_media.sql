create or replace function public.resolve_conversation_peer(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
stable
as $$
declare v_peer uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists (
    select 1 from public.conversation_members
    where conversation_id=p_conversation_id and user_id=(select auth.uid())
  ) then
    raise exception 'NOT_CONVERSATION_MEMBER';
  end if;
  select cm.user_id into v_peer
  from public.conversation_members cm
  where cm.conversation_id=p_conversation_id
    and cm.user_id<>(select auth.uid())
  order by cm.joined_at nulls first, cm.user_id
  limit 1;
  if v_peer is null then raise exception 'CORRESPONDANT_INCONNU'; end if;
  return v_peer;
end;
$$;

revoke execute on function public.resolve_conversation_peer(uuid) from public, anon;
grant execute on function public.resolve_conversation_peer(uuid) to authenticated;
