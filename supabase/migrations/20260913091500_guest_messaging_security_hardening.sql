-- WASSAFRICA closure hardening: keep guest-token hashing consistent with session creation.
-- start_guest_conversation stores SHA-256 hashes; send_guest_message must validate against the same representation.
create or replace function public.send_guest_message(p_guest_token text, p_body text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_msg uuid;
begin
  if p_guest_token is null or length(p_guest_token) < 48 or p_body is null or length(trim(p_body)) = 0 then
    raise exception 'INVALID_MESSAGE';
  end if;

  select id into v_id
  from public.guest_conversations
  where guest_token_hash = encode(pg_catalog.sha256(convert_to(p_guest_token,'utf8')),'hex')
    and status = 'open'
    and expires_at > now();

  if v_id is null then
    raise exception 'GUEST_CONVERSATION_NOT_FOUND';
  end if;

  insert into public.guest_messages(conversation_id,sender_role,body)
  values(v_id,'guest',left(trim(p_body),4000))
  returning id into v_msg;

  update public.guest_conversations
  set last_message_at = now()
  where id = v_id;

  return v_msg;
end
$$;

-- Least privilege: these functions already require an authenticated identity.
revoke execute on function public.get_business_guest_conversations() from anon;
revoke execute on function public.get_business_guest_inbox() from anon;
revoke execute on function public.get_business_guest_messages(uuid) from anon;
revoke execute on function public.reply_guest_message(uuid,text) from anon;
revoke execute on function public.send_business_guest_message(uuid,text) from anon;
revoke execute on function public.search_public_profiles(text) from anon;
