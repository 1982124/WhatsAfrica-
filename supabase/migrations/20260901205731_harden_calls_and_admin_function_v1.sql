-- Harden platform admin overview and 1:1 call participant authorization.
create or replace function public.platform_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  select jsonb_build_object(
    'users',(select count(*) from auth.users),
    'businesses',(select count(*) from public.businesses),
    'products',(select count(*) from public.products),
    'groups',(select count(*) from public.groups),
    'messages',(select count(*) from public.messages_v2),
    'orders',(select count(*) from public.orders),
    'reports',(select count(*) from public.reports),
    'live_sessions',(select count(*) from public.business_live_sessions),
    'open_reports',(select count(*) from public.reports)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.platform_admin_overview() from public, anon;
grant execute on function public.platform_admin_overview() to authenticated, service_role;

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

create or replace function private.enforce_one_to_one_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare participant_count integer;
begin
  select count(*) into participant_count from public.call_participants where call_id = new.call_id;
  if participant_count >= 2 then raise exception 'call_participants_limit_reached'; end if;
  return new;
end;
$$;
drop trigger if exists trg_call_participants_limit on public.call_participants;
create trigger trg_call_participants_limit before insert on public.call_participants for each row execute function private.enforce_one_to_one_call();
revoke execute on function private.enforce_one_to_one_call() from public, anon, authenticated;
