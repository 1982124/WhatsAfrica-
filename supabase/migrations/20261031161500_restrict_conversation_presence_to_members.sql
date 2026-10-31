-- Restrict conversation presence metadata to members of the requested conversation.
-- Existing result shape, 90-second online threshold, target-device filter, and grants are preserved.
-- Non-members receive an empty result set rather than an authorization exception.

create or replace function public.get_conversation_presence(p_conversation_id uuid)
returns table (
  user_id uuid,
  online boolean,
  last_seen_at timestamptz
)
language sql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
  select
    d.user_id,
    d.last_seen_at > now() - interval '90 seconds' as online,
    d.last_seen_at
  from public.user_devices d
  where d.device_label = 'Web'
    and d.revoked_at is null
    and d.user_id <> auth.uid()
    and exists (
      select 1
      from public.conversation_members target_member
      where target_member.conversation_id = p_conversation_id
        and target_member.user_id = d.user_id
    )
    and exists (
      select 1
      from public.conversation_members caller_member
      where caller_member.conversation_id = p_conversation_id
        and caller_member.user_id = auth.uid()
    )
  order by d.last_seen_at desc nulls last
  limit 1;
$function$;

comment on function public.get_conversation_presence(uuid) is
  'Returns Web presence for another member only when the authenticated caller belongs to the requested conversation.';
